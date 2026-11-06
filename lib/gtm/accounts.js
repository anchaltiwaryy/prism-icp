/**
 * Account discovery and qualification for an accepted ICP (PRD §13.3 handoff; state machine from the
 * Vyve pipeline). Organizations only — buyer is a role archetype, never a person. Every fit criterion
 * and signal needs an exact quote from the organization's own page. Launch/hiring/funding signals are
 * timing context, never intent (F08, §17.5 Company A fixture). APPROVED is a human-only state.
 */
import { crawlPage, discover } from '../crawler.js';
import { classifySource } from '../evidence.js';
import { activeStrategy, recordFeedback } from '../learning.js';
import { createLLM } from '../llm.js';
import { domainAllowed } from '../policy.js';
import { PROMPTS } from '../prompts.js';
import { SCHEMAS } from '../schemas.js';
import { getRun, readCollection, updateCollection } from '../store.js';
import { STRONG_SIGNALS, WEAK_TIMING_SIGNALS } from '../taxonomy.js';
import { nowIso, quoteIn, rootDomain, shortHash } from '../util.js';

export const STATES = ['DISCOVERED', 'SCREENED', 'QUALIFIED', 'NEEDS_RESEARCH', 'DISQUALIFIED', 'HUMAN_REVIEW',
  'APPROVED', 'REJECTED', 'DRAFTED', 'QUEUED', 'SUPPRESSED'];
const ALLOWED = {
  DISCOVERED: ['SCREENED', 'NEEDS_RESEARCH', 'DISQUALIFIED', 'SUPPRESSED'],
  SCREENED: ['QUALIFIED', 'NEEDS_RESEARCH', 'DISQUALIFIED', 'SUPPRESSED'],
  QUALIFIED: ['HUMAN_REVIEW', 'SUPPRESSED'],
  NEEDS_RESEARCH: ['SCREENED', 'HUMAN_REVIEW', 'DISQUALIFIED', 'SUPPRESSED'],
  HUMAN_REVIEW: ['APPROVED', 'REJECTED', 'SUPPRESSED'],
  APPROVED: ['DRAFTED', 'REJECTED', 'SUPPRESSED'],
  DRAFTED: ['QUEUED', 'APPROVED', 'SUPPRESSED'],
  QUEUED: ['SUPPRESSED'], DISQUALIFIED: ['HUMAN_REVIEW'], REJECTED: [], SUPPRESSED: [],
};
const HUMAN_ONLY = new Set(['APPROVED', 'REJECTED']);

export class ApprovalRequired extends Error { constructor(message) { super(message); this.status = 403; } }

export function transition(account, to, actor, note = '') {
  if (!(ALLOWED[account.state] ?? []).includes(to)) {
    if (['DRAFTED', 'QUEUED'].includes(to)) throw new ApprovalRequired(`${account.name} is ${account.state}; drafting and queueing require a human APPROVED decision`);
    throw Object.assign(new Error(`${account.name}: ${account.state} → ${to} not allowed`), {status: 409});
  }
  if (HUMAN_ONLY.has(to) && account.state === 'HUMAN_REVIEW' && !/^human:/.test(actor)) {
    throw new ApprovalRequired(`${to} can only be set by a human reviewer (actor=${actor})`);
  }
  account.events.push({at: nowIso(), from: account.state, to, actor, note: String(note).slice(0, 400)});
  account.state = to;
  account.updatedAt = nowIso();
}

const NOT_ORGS = /(^|\.)(wikipedia\.org|reddit\.com|quora\.com|medium\.com|youtube\.com|github\.com|g2\.com|capterra\.com|gartner\.com|crunchbase\.com|clutch\.co|forbes\.com|techcrunch\.com|indeed\.com|glassdoor\.com|naukri\.com|stackoverflow\.com|amazon\.|apple\.com|google\.|microsoft\.com|substack\.com|eventbrite\.com|meetup\.com|ctftime\.org)$/;

/** Fixture-safe qualification of one organization page against ICP criteria. Exported for tests. */
export function qualify(card, page, fit, strategy = {}) {
  const criteria = (fit?.criteria ?? []).map(item => ({...item, quoteVerified: item.status !== 'unknown' && quoteIn(page.excerpt, item.quote)}))
    // A met/not_met verdict without a literal quote is downgraded to unknown.
    .map(item => item.status !== 'unknown' && !item.quoteVerified ? {...item, status: 'unknown', note: 'quote not found on page'} : item);
  const disqualifiers = (fit?.disqualifiers ?? []).map(item => ({...item, quoteVerified: item.status === 'present' && quoteIn(page.excerpt, item.quote)}))
    .map(item => item.status === 'present' && !item.quoteVerified ? {...item, status: 'unknown', note: 'quote not found on page'} : item);
  const signals = (fit?.signals ?? []).filter(signal => quoteIn(page.excerpt, signal.quote)).map(signal => ({...signal,
    strength: STRONG_SIGNALS.includes(signal.type) ? 'strong' : 'weak_timing',
    interpretation: WEAK_TIMING_SIGNALS.includes(signal.type) ? 'Timing context only — not evidence of purchase intent' : 'Requires confirmation in conversation'}));
  const met = criteria.filter(item => item.status === 'met').length;
  const notMet = criteria.filter(item => item.status === 'not_met').length;
  const present = disqualifiers.filter(item => item.status === 'present');
  const learned = (strategy.negativeRules ?? []).filter(rule => rule.offer === card.offer || rule.offer === 'any');
  let structuralFit = met >= Math.max(2, Math.ceil(criteria.length * 0.6)) && !notMet ? 'likely'
    : met >= 1 ? 'possible' : notMet ? 'unlikely' : 'unknown';
  if (present.length) structuralFit = 'unlikely';
  const gates = [
    {gate: 'Structural fit quoted from the organization\'s own page', pass: met >= 1},
    {gate: 'No disqualifier present', pass: !present.length, detail: present.map(item => item.disqualifier).join('; ')},
    {gate: 'Buyer is a role, not a harvested person', pass: true, detail: card.buyer},
    {gate: 'Purchase intent not inferred from weak signals', pass: true, detail: signals.filter(s => s.strength === 'weak_timing').length + ' weak timing signals'},
  ];
  const claims = [
    ...criteria.filter(item => item.status === 'met').map((item, index) => ({id: 'AC' + (index + 1), statement: item.criterion, quote: item.quote, verified: true})),
    ...signals.map((signal, index) => ({id: 'AS' + (index + 1), statement: signal.statement, quote: signal.quote, verified: true, signalType: signal.type})),
  ];
  return {
    structuralFit, criteria, disqualifiers, signals, gates, claims, learnedRules: learned.map(rule => rule.text),
    buyingIntent: signals.some(signal => signal.strength === 'strong') ? 'strong_signal_unconfirmed' : 'not_observed',
    activeBuyer: false, // PRISM never labels an organization an active buyer from desk research.
    fitScore: {low: Math.round(100 * met / Math.max(criteria.length, 1) * 0.7), high: Math.round(100 * (met + criteria.filter(i => i.status === 'unknown').length) / Math.max(criteria.length, 1))},
  };
}

export async function findAccounts(runId, icpId, {limit = 6, llm = createLLM(), net = {crawlPage, discover}} = {}) {
  const run = await getRun(runId);
  const card = run?.cards?.find(item => item.id === icpId);
  if (!card) throw Object.assign(new Error('ICP not found'), {status: 404});
  if (card.review?.status !== 'accepted') throw Object.assign(new Error('Accept this ICP before discovering sample accounts'), {status: 409});
  const strategy = await activeStrategy();
  const [existing, suppression] = await Promise.all([readCollection('accounts'), readCollection('suppression')]);
  const known = new Set(existing.map(account => account.domain));
  const suppressed = new Set(suppression.map(item => item.domain));
  const queries = (card.leadBrief?.searchQueries?.length ? card.leadBrief.searchQueries : [card.definition]).slice(0, 4);
  const candidates = new Map();
  for (const query of queries) {
    const found = await net.discover(query, {adapters: run.policy.adapters});
    for (const result of found.results) {
      const domain = rootDomain(result.url);
      if (!domain || candidates.has(domain) || known.has(domain) || domain === run.profile.domain) continue;
      if (NOT_ORGS.test(domain) || !domainAllowed(run.policy, result.url) || classifySource(result.url).tier === 4) continue;
      candidates.set(domain, {domain, foundBy: query, hint: result.title});
    }
    if (candidates.size >= limit * 2) break;
  }
  const created = [];
  for (const candidate of [...candidates.values()].slice(0, limit * 2)) {
    if (created.length >= limit) break;
    const fetched = await net.crawlPage('https://' + candidate.domain + '/', {browser: true});
    if (fetched.status !== 'collected') continue;
    const page = fetched.page;
    const response = llm.available ? await llm.json('accountFit', {instructions: PROMPTS.accountFit, schema: SCHEMAS.accountFit,
      task: 'Assess this organization against the ICP. Quote exactly.',
      payload: {icp: {definition: card.definition, structuralFit: card.structuralFit, disqualifiers: card.disqualifiers, buyer: card.buyer},
        organization: {url: page.url, title: page.title, text: page.excerpt.slice(0, 6000)}}}) : {error: 'no model'};
    const fit = qualify(card, page, response.data, strategy);
    const account = {
      id: 'AC-' + shortHash(candidate.domain), runId, icpId, offer: card.offer, segment: card.segment,
      name: response.data?.organization || page.title.split(/[|\-–]/)[0].trim() || candidate.domain, domain: candidate.domain, url: page.url,
      whatTheyDo: response.data?.whatTheyDo ?? page.description ?? '', hook: fit.claims[0]?.quote ?? '', buyerRole: card.buyer,
      discovery: {query: candidate.foundBy, at: nowIso(), method: 'public search pointer → organization homepage'},
      page: {title: page.title, observed: page.observed, contentHash: page.contentHash, excerpt: page.excerpt.slice(0, 1200)},
      fit, state: 'DISCOVERED', events: [{at: nowIso(), from: null, to: 'DISCOVERED', actor: 'system:account_search', note: candidate.foundBy}],
      model: response.error ? null : llm.describe(), createdAt: nowIso(), updatedAt: nowIso(),
    };
    if (suppressed.has(account.domain)) transition(account, 'SUPPRESSED', 'system:suppression', 'Domain on suppression list');
    else if (!response.data) transition(account, 'NEEDS_RESEARCH', 'system:qualification', 'No model assessment — needs a human or model review');
    else {
      transition(account, 'SCREENED', 'system:qualification', `${fit.criteria.filter(c => c.status === 'met').length}/${fit.criteria.length} criteria met with quotes`);
      if (fit.structuralFit === 'unlikely') transition(account, 'DISQUALIFIED', 'system:qualification', fit.gates.find(g => !g.pass)?.detail || 'Structural fit unlikely');
      else if (fit.structuralFit === 'unknown') transition(account, 'NEEDS_RESEARCH', 'system:qualification', 'Page too thin to judge fit');
      else {
        transition(account, 'QUALIFIED', 'system:qualification', 'Structural fit ' + fit.structuralFit);
        transition(account, 'HUMAN_REVIEW', 'system:qualification', 'Awaiting human approval — nothing is drafted before approval');
      }
    }
    created.push(account);
  }
  await updateCollection('accounts', list => { list.push(...created); });
  return {created, searched: queries.length, candidates: candidates.size};
}

export async function accountAction(accountId, {action, actor, note, reasonCode}) {
  if (!/^human:[\w .@-]{1,60}$/.test(actor ?? '')) throw new ApprovalRequired('Account decisions need a named human reviewer');
  let changed;
  await updateCollection('accounts', list => {
    const account = list.find(item => item.id === accountId);
    if (!account) throw Object.assign(new Error('Account not found'), {status: 404});
    if (action === 'approve') transition(account, 'APPROVED', actor, note || 'Approved for drafting');
    else if (action === 'reject') { transition(account, 'REJECTED', actor, (reasonCode ? reasonCode + ': ' : '') + (note ?? '')); account.rejection = {reasonCode, note}; }
    else if (action === 'review') transition(account, 'HUMAN_REVIEW', actor, note || 'Sent to human review');
    else if (action === 'suppress') transition(account, 'SUPPRESSED', actor, note || 'Suppressed');
    else throw Object.assign(new Error('Unknown account action'), {status: 400});
    changed = account;
  });
  if (action === 'reject' || action === 'approve') {
    await recordFeedback({runId: changed.runId, targetType: 'account', targetId: changed.id, verdict: action === 'approve' ? 'positive' : 'negative',
      reasonCode: action === 'approve' ? 'good_fit' : reasonCode, note, actor, offer: changed.offer});
  }
  if (action === 'suppress') {
    await updateCollection('suppression', list => { if (!list.some(item => item.domain === changed.domain)) list.push({domain: changed.domain, at: nowIso(), by: actor, note}); });
  }
  return changed;
}
