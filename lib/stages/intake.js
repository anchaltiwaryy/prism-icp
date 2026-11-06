/** S0 policy bootstrap and S1 business understanding / offer decomposition (PRD §5, §7 S0–S1). */
import { addSource } from '../evidence.js';
import { domainAllowed } from '../policy.js';
import { normalizeText, quoteIn, rootDomain, slug } from '../util.js';

const RELEVANT = /about|product|solution|service|pricing|plans?|feature|customer|case-?stud|industr|platform|use-?case|who-we|training|course|academy|lab|program|offer|enterprise|team|partner/i;
const IRRELEVANT = /login|log-in|signin|sign-in|signup|sign-up|register|cart|checkout|privacy|terms|cookie|legal|\.pdf$|\.(png|jpe?g|svg|zip)$|mailto:|tel:|#|\/tag\/|\/author\/|wp-json|feed/i;

export async function s0Policy(ctx) {
  const {run} = ctx;
  const {policy} = run;
  const issues = [];
  if (run.brief.website && !domainAllowed(policy, run.brief.website)) issues.push('Business website is on the forbidden-domain list; it will not be crawled.');
  run.audit ??= [];
  run.audit.push({at: new Date().toISOString(), event: 'policy_signed', policyVersion: policy.version, policyHash: policy.hash,
    mode: policy.mode, limits: policy.limits, forbiddenDomains: policy.forbiddenDomains.length, adapters: policy.adapters});
  ctx.log('S0', `${policy.modeLabel} · budget ${policy.limits.maxPages} pages, ${policy.limits.maxSearches} searches, ` +
    `${policy.limits.maxModelCalls} model calls, $${policy.limits.maxUsd} · ${ctx.llm.describe()}` + (issues.length ? ' · ' + issues.join(' ') : ''));
  return {issues};
}

function pickOfficialLinks(page, limit) {
  const seen = new Set();
  return page.links
    .filter(link => rootDomain(link) === page.domain && !IRRELEVANT.test(link))
    .map(link => link.replace(/\/$/, ''))
    .filter(link => link !== page.url.replace(/\/$/, '') && !seen.has(link) && seen.add(link))
    .map(link => ({link, score: (RELEVANT.test(new URL(link).pathname) ? 2 : 0) - new URL(link).pathname.split('/').length * 0.2}))
    .sort((a, b) => b.score - a.score).slice(0, limit).map(item => item.link);
}

export async function s1Intake(ctx) {
  const {run, budget} = ctx;
  const brief = run.brief;
  run.profile ??= {};
  const profile = run.profile;
  profile.name = brief.name;
  profile.domain = brief.website ? rootDomain(brief.website) : null;
  profile.version = 1;

  // ---- collect official pages (company-owned source adapter)
  const limit = run.policy.limits.officialPages;
  if (brief.website && limit > 0 && domainAllowed(run.policy, brief.website) && run.policy.adapters['official-site'] === 'approved') {
    const home = await ctx.net.crawlPage(brief.website, {browser: run.policy.adapters['playwright-render'] === 'approved'});
    budget.page();
    if (home.status === 'collected') {
      addSource(run, home.page, {adapter: 'official-site', origin: 'official', segmentId: null});
      const links = pickOfficialLinks(home.page, limit - 1);
      const results = await Promise.all(links.map(link => budget.can('page') ? (budget.page(), ctx.net.crawlPage(link)) : null));
      results.forEach((result, index) => {
        if (result?.status === 'collected') addSource(run, result.page, {adapter: 'official-site', origin: 'official', segmentId: null});
        else if (result) ctx.gap(links[index], result.reason);
      });
    } else ctx.gap(brief.website, home.reason);
  }
  const official = run.sources.filter(source => source.adapter === 'official-site');
  ctx.log('S1', `${official.length} official pages collected` + (brief.website ? '' : ' · no website supplied, lower-confidence self-reported profile'));
  await ctx.save();
  ctx.checkControl();

  // ---- business understanding card
  const declared = (brief.offers?.length ? brief.offers : [{name: brief.offer, problem: brief.problem}]).map(offer => ({
    ...offer, id: 'F' + slug(offer.name, 24), origin: 'user_declared',
  }));
  const result = await ctx.model('intake', {
    task: 'Build the Business Understanding Card. Declared offers come from the owner. Pages are the business\'s own site.',
    payload: {brief: {name: brief.name, offer: brief.offer, problem: brief.problem, geography: brief.geography, model: brief.model,
      declaredOffers: declared.map(({name, problem, beneficiary}) => ({name, problem, beneficiary}))},
    pages: official.map(source => ({url: source.url, title: source.title, text: source.excerpt.slice(0, 5000)}))},
  });

  const facts = [];
  const downgrade = item => {
    if (item.origin !== 'publicly_observed') return item;
    const source = official.find(page => page.url === item.sourceUrl) ?? official.find(page => quoteIn(page.excerpt, item.quote));
    if (source && quoteIn(source.excerpt, item.quote)) return {...item, sourceId: source.id, sourceUrl: source.url};
    return {...item, origin: 'agent_inferred', quote: '', note: 'Quote not found on a retained page — downgraded to inference'};
  };
  facts.push({statement: `${brief.name} sells ${brief.offer}`, origin: 'user_declared', quote: '', sourceUrl: ''});
  if (brief.problem) facts.push({statement: `Stated problem solved: ${brief.problem}`, origin: 'user_declared', quote: '', sourceUrl: ''});
  for (const fact of result?.facts ?? []) facts.push(downgrade(fact));
  if (!result) {
    for (const source of official.slice(0, 4)) {
      if (source.description) facts.push({statement: `Site describes itself: ${source.description}`, origin: 'publicly_observed',
        quote: source.description, sourceUrl: source.url, sourceId: source.id});
    }
  }

  // Offers: the owner's explicit list wins; otherwise model-decomposed offers with the declared offer kept.
  let offers;
  const observed = (result?.offers ?? []).map(downgrade);
  const same = (a, b) => { const [x, y] = [normalizeText(a).toLowerCase(), normalizeText(b).toLowerCase()]; return x.includes(y) || y.includes(x); };
  // Declared offers keep the owner's name and scope; a matching observation adds category, jobs and a quote.
  const enrich = offer => {
    const match = observed.find(item => same(item.name, offer.name));
    return {...offer, userJob: match?.userJob ?? offer.beneficiary ?? 'unknown', buyerJob: match?.buyerJob ?? 'unknown',
      promisedOutcome: match?.promisedOutcome ?? offer.problem ?? 'unknown', category: match?.category ?? 'unknown',
      outcomeOrigin: match ? match.origin : offer.origin,
      observation: match?.origin === 'publicly_observed' ? {quote: match.quote, sourceId: match.sourceId, sourceUrl: match.sourceUrl} : null};
  };
  if (brief.offers?.length) {
    offers = declared.map(enrich);
  } else {
    offers = [enrich(declared[0])];
    for (const item of observed.slice(0, 5)) {
      if (offers.some(offer => normalizeText(offer.name).toLowerCase() === normalizeText(item.name).toLowerCase())) continue;
      offers.push({id: 'F' + slug(item.name, 24), name: item.name, problem: item.promisedOutcome, origin: item.origin,
        userJob: item.userJob, buyerJob: item.buyerJob, promisedOutcome: item.promisedOutcome, category: item.category,
        observation: item.origin === 'publicly_observed' ? {quote: item.quote, sourceId: item.sourceId, sourceUrl: item.sourceUrl} : null});
    }
    // When the model found the declared offer under another name, keep the observed wording but the owner's scope.
    offers = offers.slice(0, 6);
  }
  // Gate: each offer has a clear outcome or an explicit unknown flag — never an invented feature.
  for (const offer of offers) {
    offer.problem = offer.problem || offer.promisedOutcome || 'unknown';
    offer.outcomeStatus = offer.promisedOutcome && offer.promisedOutcome !== 'unknown' ? (offer.outcomeOrigin ?? offer.origin) : 'unknown';
  }

  Object.assign(profile, {
    summary: result?.summary ?? `${brief.name}: ${brief.offer} — ${brief.problem}`,
    businessModel: brief.model ?? result?.businessModel ?? 'unknown',
    offers, facts,
    assumptions: (result?.assumptions ?? []).map((text, index) => ({id: 'A' + (index + 1), text, status: 'open'})),
    unknowns: [...new Set([...(result?.unknowns ?? []), ...(brief.geography ? [] : ['Commercial operating region']),
      'Pricing and price bands', 'Delivery capacity', 'Historical win/loss and conversion data'])],
    geographies: brief.geography ? [brief.geography] : (result?.geographies?.length ? result.geographies : ['unknown']),
    understoodBy: result ? ctx.llm.describe() : 'deterministic intake (no model)',
  });
  const counts = facts.reduce((acc, fact) => ({...acc, [fact.origin]: (acc[fact.origin] ?? 0) + 1}), {});
  ctx.log('S1', `Business card: ${offers.length} offers · facts ${Object.entries(counts).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ')}`);
}
