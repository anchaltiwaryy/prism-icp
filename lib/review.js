/**
 * S11 human review and §16 field validation. Accept/reject/edit decisions, experiment execution and the
 * commercially_validated label are human-only transitions recorded with actor, reason and lineage.
 */
import { recordFeedback, recordOutcome } from './learning.js';
import { isActive } from './pipeline.js';
import { updateRun } from './store.js';
import { REASON_CODES } from './taxonomy.js';
import { nowIso } from './util.js';

const human = actor => {
  if (!/^human:[\w .@-]{1,60}$/.test(actor ?? '')) throw Object.assign(new Error('This action needs a named human reviewer (actor "human:<name>")'), {status: 403});
  return actor;
};
const fail = (message, status = 409) => { throw Object.assign(new Error(message), {status}); };

function findCard(run, icpId) {
  const card = run.cards?.find(item => item.id === icpId);
  if (!card) fail('ICP not found', 404);
  return card;
}

export async function reviewIcp(runId, icpId, {action, reasonCode, note, actor, edits}) {
  human(actor);
  if (isActive(runId)) fail('Research is still running — review once it finishes');
  const result = await updateRun(runId, run => {
    const card = findCard(run, icpId);
    const event = {at: nowIso(), icpId, action, actor, note: String(note ?? '').slice(0, 600), reasonCode: REASON_CODES[reasonCode] ? reasonCode : null};
    if (action === 'accept') {
      // Accepting a hard-rejected hypothesis is an override and must say why (PRD §22).
      if (card.decision === 'reject' && !event.note) fail('Accepting a rejected hypothesis overrides a hard exclusion — add a note explaining why');
      card.review = {status: 'accepted', by: actor, at: event.at, note: event.note, override: card.decision === 'reject'};
    } else if (action === 'reject') {
      if (!event.reasonCode) fail('Choose a reason code when rejecting', 400);
      card.review = {status: 'rejected', by: actor, at: event.at, note: event.note, reasonCode: event.reasonCode};
      card.maturity = 'rejected';
    } else if (action === 'edit') {
      const allowed = ['definition', 'hypothesis', 'structuralFit', 'disqualifiers', 'buyer', 'user', 'trigger', 'channels'];
      card.history ??= [];
      card.history.push({at: event.at, by: actor, before: Object.fromEntries(allowed.map(key => [key, card[key]]))});
      for (const key of allowed) if (edits?.[key] !== undefined) {
        card[key] = Array.isArray(card[key]) ? [].concat(edits[key]).map(String).filter(Boolean).slice(0, 20) : String(edits[key]).slice(0, 800);
      }
      card.review = {...card.review, edited: true, editedBy: actor, editedAt: event.at};
      event.note ||= 'Edited ' + Object.keys(edits ?? {}).join(', ');
    } else fail('Unknown review action', 400);
    run.reviews ??= [];
    run.reviews.push(event);
    if (run.status === 'awaiting_review' && run.cards.every(item => item.review?.status !== 'pending')) run.status = 'complete';
    return {card, event, offer: card.offer};
  });
  if (action === 'reject' || action === 'accept') {
    await recordFeedback({runId, targetType: 'card', targetId: icpId, verdict: action === 'accept' ? 'positive' : 'negative',
      reasonCode: action === 'accept' ? 'good_fit' : reasonCode, note, actor, offer: result.offer});
  }
  return result;
}

/** Record feedback on a single claim or source (immediate learning signal, PRD §15.1). */
export async function flagEvidence(runId, {targetType, targetId, verdict, reasonCode, note, actor}) {
  human(actor);
  let host = null;
  await updateRun(runId, run => {
    const item = targetType === 'claim' ? run.claims?.find(claim => claim.id === targetId) : run.sources?.find(source => source.id === targetId);
    if (!item) fail('Evidence item not found', 404);
    item.flags ??= [];
    item.flags.push({at: nowIso(), verdict, reasonCode, note: String(note ?? '').slice(0, 300), actor});
    host = item.sourceUrl ? new URL(item.sourceUrl).hostname : item.host ?? null;
    if (targetType === 'claim' && verdict === 'negative') { item.epistemic = 'unresolved'; item.humanChallenged = true; }
  });
  return recordFeedback({runId, targetType, targetId, verdict, reasonCode, note, actor, host});
}

// ---------------------------------------------------------------- field validation
export async function experimentAction(runId, experimentId, {action, actor, result, note, reasonCode, verdict}) {
  human(actor);
  let outcome = null;
  const updated = await updateRun(runId, run => {
    const experiment = run.experiments?.find(item => item.id === experimentId);
    if (!experiment) fail('Experiment not found', 404);
    const card = findCard(run, experiment.icpId);
    if (action === 'start') {
      if (experiment.status !== 'planned') fail('Experiment already started');
      if (card.review?.status !== 'accepted') fail('Accept the ICP before starting its field test');
      experiment.status = 'running'; experiment.startedAt = nowIso(); experiment.startedBy = actor;
      card.maturity = 'field_testing';
    } else if (action === 'log') {
      if (experiment.status !== 'running') fail('Start the experiment before logging results');
      const entry = {at: nowIso(), result: ['positive', 'negative', 'neutral'].includes(result) ? result : 'neutral',
        reasonCode: REASON_CODES[reasonCode] ? reasonCode : null, note: String(note ?? '').slice(0, 1200), actor};
      experiment.results.push(entry);
      outcome = {runId, icpId: card.id, experimentId, type: experiment.type === 'problem_interviews' ? 'interview' : 'qualified_discovery',
        result: entry.result, reasonCode: entry.reasonCode, note: entry.note, actor};
    } else if (action === 'close') {
      if (experiment.status !== 'running') fail('Only a running experiment can be closed');
      if (!['passed', 'failed', 'inconclusive'].includes(verdict)) fail('Verdict must be passed, failed or inconclusive', 400);
      if (!experiment.results.length) fail('Log at least one result before closing');
      const tally = experiment.results.reduce((acc, item) => ({...acc, [item.result]: (acc[item.result] ?? 0) + 1}), {});
      experiment.status = 'closed';
      experiment.verdict = {verdict, by: actor, at: nowIso(), note: String(note ?? '').slice(0, 600), tally,
        against: {pass: experiment.passCriterion, kill: experiment.killCriterion}};
      if (verdict === 'failed') card.maturity = 'revisit_later';
    } else fail('Unknown experiment action', 400);
    return experiment;
  });
  if (outcome) await recordOutcome(outcome);
  return updated;
}

/** Commercial validation is a human judgement against a passed, pre-registered experiment — never automatic. */
export async function validateIcp(runId, icpId, {actor, note}) {
  human(actor);
  const result = await updateRun(runId, run => {
    const card = findCard(run, icpId);
    const passed = (run.experiments ?? []).filter(item => item.icpId === icpId && item.verdict?.verdict === 'passed');
    if (!passed.length) fail('Commercial validation needs at least one closed experiment with verdict "passed"');
    if (!String(note ?? '').trim()) fail('Describe the real-world evidence behind this validation', 400);
    card.commercialValidation = 'validated';
    card.maturity = 'commercially_validated';
    card.validation = {by: actor, at: nowIso(), note: String(note).slice(0, 800), experiments: passed.map(item => item.id)};
    return card;
  });
  await recordOutcome({runId, icpId, type: 'qualified_opportunity', result: 'positive', note: 'Commercially validated: ' + note, actor});
  return result;
}
