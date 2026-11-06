/**
 * Outreach drafting for human-APPROVED accounts only, with provenance-tagged lines and QA (Vyve pattern).
 * Nothing is ever sent: queued steps become .eml files in data/workspace/outbox addressed to the owner's
 * own inbox (PRISM_OWN_INBOX) or a non-routable placeholder. No prospect email address is collected.
 */
import { createLLM } from '../llm.js';
import { PROMPTS } from '../prompts.js';
import { SCHEMAS } from '../schemas.js';
import { getRun, readCollection, updateCollection, writeWorkspaceFile } from '../store.js';
import { nowIso } from '../util.js';
import { ApprovalRequired, transition } from './accounts.js';
import { runQa } from './qa.js';

function offerFactsFor(run, offerName) {
  const offer = run.profile?.offers?.find(item => item.name === offerName);
  const facts = [];
  if (offer) facts.push({id: 'OF1', text: `${offer.name}: ${offer.promisedOutcome && offer.promisedOutcome !== 'unknown' ? offer.promisedOutcome : offer.problem}`, origin: offer.origin});
  if (offer?.observation?.quote) facts.push({id: 'OF2', text: offer.observation.quote, origin: 'publicly_observed'});
  for (const fact of (run.profile?.facts ?? []).filter(item => item.origin !== 'agent_inferred').slice(0, 4)) {
    facts.push({id: 'OF' + (facts.length + 1), text: fact.quote || fact.statement, origin: fact.origin});
  }
  return facts;
}

function templateSequence(account, facts) {
  const hook = account.fit.claims[0];
  const role = account.buyerRole || 'team lead';
  return [
    {step: 1, subject: `${account.name} — a question about ${account.segment.toLowerCase().slice(0, 40)}`, lines: [
      hook ? {text: `I read on your site: "${hook.quote.slice(0, 140)}".`, tag: 'ACCOUNT', claimIds: [hook.id]} : null,
      {text: `We work on ${facts[0]?.text.slice(0, 120) ?? account.offer}.`, tag: 'OFFER', claimIds: facts[0] ? [facts[0].id] : []},
      {text: `I am trying to learn how teams like yours handle this today, not pitch.`, tag: 'GENERATED', claimIds: []},
      {text: `Would a short conversation with the ${role} be useful, or is this not a priority right now?`, tag: 'GENERATED', claimIds: []},
    ].filter(Boolean)},
    {step: 2, subject: `How ${account.name} handles this today`, lines: [
      {text: `Following my earlier note.`, tag: 'GENERATED', claimIds: []},
      {text: `Most teams we speak with use an internal process, a free tool, or an outside specialist.`, tag: 'GENERATED', claimIds: []},
      {text: `Which of those is closest to how you work?`, tag: 'GENERATED', claimIds: []},
    ]},
    {step: 3, subject: `Closing the loop`, lines: [
      {text: `I will leave it here so I am not cluttering your inbox.`, tag: 'GENERATED', claimIds: []},
      {text: `If someone else owns this area, who should I ask instead?`, tag: 'GENERATED', claimIds: []},
    ]},
  ];
}

export async function draftSequence(accountId, {llm = createLLM()} = {}) {
  const accounts = await readCollection('accounts');
  const account = accounts.find(item => item.id === accountId);
  if (!account) throw Object.assign(new Error('Account not found'), {status: 404});
  if (account.state !== 'APPROVED') throw new ApprovalRequired(`${account.name} is ${account.state}: sequences are only drafted for human-APPROVED accounts`);
  const run = await getRun(account.runId);
  const facts = offerFactsFor(run, account.offer);
  const accountClaims = account.fit.claims;
  let steps = null;
  if (llm.available) {
    const response = await llm.json('outreach', {instructions: PROMPTS.outreach, schema: SCHEMAS.outreach,
      task: 'Draft the three-step sequence. Cite only the supplied claim and fact ids.',
      payload: {seller: run.profile.name, offer: account.offer, recipientRole: account.buyerRole, organization: account.name,
        whatTheyDo: account.whatTheyDo, verifiedAccountClaims: accountClaims.map(({id, statement, quote}) => ({id, statement, quote})),
        offerFacts: facts}});
    steps = response.data?.steps?.map(step => ({...step, step: Number(step.step)})) ?? null;
  }
  steps ??= templateSequence(account, facts);
  let qa = runQa(steps, {accountClaims, offerFacts: facts});
  if (!qa.pass && llm.available) {
    // One redraft from the template, which is built to pass; a failing model draft never ships.
    const fallback = templateSequence(account, facts);
    const fallbackQa = runQa(fallback, {accountClaims, offerFacts: facts});
    if (fallbackQa.pass) { steps = fallback; qa = {...fallbackQa, note: 'Model draft failed QA; template draft used instead'}; }
  }
  return updateCollection('accounts', list => {
    const current = list.find(item => item.id === accountId);
    current.draft = {steps, qa, offerFacts: facts, draftedAt: nowIso(), by: llm.available ? llm.describe() : 'template'};
    if (qa.pass) transition(current, 'DRAFTED', 'system:outreach', qa.summary);
    else current.events.push({at: nowIso(), from: current.state, to: current.state, actor: 'system:qa', note: 'Draft failed QA: ' + qa.summary});
  }).then(list => list.find(item => item.id === accountId));
}

function eml(account, step, sendDate) {
  const to = process.env.PRISM_OWN_INBOX || 'review-queue@example.invalid';
  const body = step.lines.map(line => line.text).join('\n\n');
  return [
    `To: ${to}`, `From: ${process.env.PRISM_SENDER || 'founder@example.invalid'}`, `Subject: ${step.subject}`, `Date: ${new Date(sendDate).toUTCString()}`,
    `X-PRISM-Intended-Account: ${account.domain}`, `X-PRISM-Intended-Role: ${account.buyerRole}`, `X-PRISM-ICP: ${account.icpId}`,
    `X-PRISM-QA: ${account.draft.qa.summary}`, 'X-PRISM-Note: DRY RUN. PRISM never sends outreach and holds no prospect email address.',
    'Content-Type: text/plain; charset=utf-8', '', body, '',
    '---', step.lines.map(line => `[${line.tag}${line.claimIds?.length ? ' ' + line.claimIds.join(',') : ''}] ${line.text}`).join('\n'), '',
  ].join('\r\n');
}

export async function queueDraft(accountId, {actor}) {
  if (!/^human:[\w .@-]{1,60}$/.test(actor ?? '')) throw new ApprovalRequired('Queueing needs a named human reviewer');
  const suppression = await readCollection('suppression');
  const files = [];
  await updateCollection('accounts', async list => {
    const account = list.find(item => item.id === accountId);
    if (!account) throw Object.assign(new Error('Account not found'), {status: 404});
    if (account.state !== 'DRAFTED' || !account.draft?.qa?.pass) throw new ApprovalRequired('Only a QA-passed draft for an approved account can be queued');
    if (suppression.some(item => item.domain === account.domain)) throw Object.assign(new Error('Domain is suppressed'), {status: 409});
    const offsets = [0, 3, 7];
    for (const step of account.draft.steps) {
      const date = Date.now() + (offsets[step.step - 1] ?? 7) * 86400000;
      files.push(await writeWorkspaceFile(`outbox/${account.id}-step${step.step}.eml`, eml(account, step, date)));
    }
    transition(account, 'QUEUED', actor, `${files.length} dry-run drafts written to the local outbox`);
  });
  await updateCollection('outbox', list => {
    list.push({accountId, at: nowIso(), by: actor, files: files.map(file => file.split(/[\\/]/).slice(-2).join('/')), mode: 'dry_run'});
  });
  return {files: files.length, mode: 'dry_run'};
}
