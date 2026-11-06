/**
 * S12 — outcome learning and controlled improvement (PRD §15). Modelled on the Hyperleap tune/learn loop:
 * keep a growing set of known answers, propose small bounded changes, evaluate them offline against the
 * known answers, and only a human can promote a change. Safety, privacy and source policy are never
 * part of a strategy, so no proposal can touch them.
 */
import { decide, DEFAULT_STRATEGY, scoreSegment } from './scoring.js';
import { listRuns, readCollection, updateCollection } from './store.js';
import { REASON_CODES } from './taxonomy.js';
import { nowIso, shortHash } from './util.js';

const MIN_COHORT = 5;
const RECOMMENDED = ['explore_first', 'conditional_test'];

export async function activeStrategy() {
  const learning = await readCollection('learning');
  const active = learning.strategies?.find(item => item.version === learning.activeVersion);
  return active ? {...DEFAULT_STRATEGY, ...active, bands: {...DEFAULT_STRATEGY.bands, ...active.bands},
    weights: {...DEFAULT_STRATEGY.weights, ...active.weights}} : DEFAULT_STRATEGY;
}

// ---------------------------------------------------------------- feedback & outcomes
const ACTOR = /^(human|system|agent):[\w .@-]{1,60}$/;

export async function recordFeedback(input) {
  const item = {
    id: 'FB-' + shortHash(JSON.stringify(input) + Date.now()), at: nowIso(), runId: String(input.runId ?? ''),
    targetType: ['claim', 'source', 'card', 'organization', 'account', 'draft'].includes(input.targetType) ? input.targetType : 'card',
    targetId: String(input.targetId ?? '').slice(0, 80), verdict: input.verdict === 'positive' ? 'positive' : 'negative',
    reasonCode: REASON_CODES[input.reasonCode] ? input.reasonCode : 'other', note: String(input.note ?? '').slice(0, 600),
    host: input.host ? String(input.host).slice(0, 120) : null, offer: input.offer ? String(input.offer).slice(0, 120) : null,
    actor: ACTOR.test(input.actor ?? '') ? input.actor : 'human:anonymous',
  };
  await updateCollection('feedback', list => { list.push(item); });
  return item;
}

export const OUTCOME_TYPES = ['interview', 'qualified_discovery', 'qualified_opportunity', 'meeting', 'reply', 'no_response', 'pilot', 'won', 'lost', 'churned'];

export async function recordOutcome(input) {
  if (!OUTCOME_TYPES.includes(input.type)) throw Object.assign(new Error('Unknown outcome type'), {status: 400});
  const item = {
    id: 'OC-' + shortHash(JSON.stringify(input) + Date.now()), at: nowIso(), occurredAt: input.occurredAt ?? nowIso().slice(0, 10),
    runId: String(input.runId ?? ''), icpId: String(input.icpId ?? ''), experimentId: input.experimentId ?? null,
    accountId: input.accountId ?? null, type: input.type,
    // "No response" is not negative evidence about the ICP (PRD §15.3); it is stored as neutral.
    result: input.type === 'no_response' ? 'neutral' : ['positive', 'negative', 'neutral'].includes(input.result) ? input.result : 'neutral',
    reasonCode: REASON_CODES[input.reasonCode] ? input.reasonCode : null, note: String(input.note ?? '').slice(0, 800),
    actor: ACTOR.test(input.actor ?? '') ? input.actor : 'human:anonymous',
  };
  await updateCollection('outcomes', list => { list.push(item); });
  return item;
}

// ---------------------------------------------------------------- measurement
function cardIndex(runs) {
  const index = new Map();
  for (const run of runs) for (const card of run.cards ?? []) index.set(run.id + '|' + card.id, {run, card});
  return index;
}

/** Known answers: human review decisions and real-world outcomes, keyed to the card they judged. */
export function goldLabels(runs, outcomes) {
  const labels = new Map();
  for (const run of runs) {
    for (const card of run.cards ?? []) {
      if (card.review?.status === 'accepted') labels.set(run.id + '|' + card.id, {label: 1, source: 'review'});
      if (card.review?.status === 'rejected') labels.set(run.id + '|' + card.id, {label: 0, source: 'review', reason: card.review.reasonCode});
    }
  }
  for (const outcome of outcomes) {
    if (outcome.result === 'neutral') continue;
    const key = outcome.runId + '|' + outcome.icpId;
    // Real outcomes outrank review opinions.
    labels.set(key, {label: outcome.result === 'positive' ? 1 : 0, source: 'outcome', reason: outcome.reasonCode});
  }
  return labels;
}

export async function measure() {
  const [runs, outcomes, feedback] = await Promise.all([listRuns(), readCollection('outcomes'), readCollection('feedback')]);
  const index = cardIndex(runs);
  // Calibration by decision band and evidence grade (time-windowed cohorts arrive as data grows).
  const cohorts = {};
  for (const outcome of outcomes) {
    const found = index.get(outcome.runId + '|' + outcome.icpId);
    if (!found || outcome.result === 'neutral') continue;
    for (const key of ['decision:' + found.card.decision, 'grade:' + found.card.score?.grade]) {
      cohorts[key] ??= {positive: 0, negative: 0};
      cohorts[key][outcome.result]++;
    }
  }
  const calibration = Object.entries(cohorts).map(([cohort, counts]) => {
    const n = counts.positive + counts.negative;
    return {cohort, n, positiveRate: n >= MIN_COHORT ? Math.round(100 * counts.positive / n) : null,
      note: n >= MIN_COHORT ? '' : `Fewer than ${MIN_COHORT} outcomes — not enough data`};
  });
  // Source usefulness from verifier verdicts and human feedback across all runs.
  const hosts = {};
  for (const run of runs) for (const claim of run.claims ?? []) {
    if (!claim.verification) continue;
    const host = claim.sourceUrl ? new URL(claim.sourceUrl).hostname : 'unknown';
    hosts[host] ??= {host, checked: 0, supported: 0, rejected: 0, promotional: 0, negativeFeedback: 0};
    hosts[host].checked++;
    if (claim.verification.verdict === 'supported') hosts[host].supported++;
    else if (claim.verification.verdict === 'promotional') hosts[host].promotional++;
    else hosts[host].rejected++;
  }
  for (const item of feedback.filter(entry => entry.verdict === 'negative' && entry.host)) {
    hosts[item.host] ??= {host: item.host, checked: 0, supported: 0, rejected: 0, promotional: 0, negativeFeedback: 0};
    hosts[item.host].negativeFeedback++;
  }
  const sourceStats = Object.values(hosts).map(item => ({...item, precision: item.checked ? Math.round(100 * item.supported / item.checked) : null}))
    .sort((a, b) => b.checked - a.checked);
  // Validated Opportunity Yield (north star, PRD §1.3): recommended ICPs with a positive real-world validation outcome.
  const recommended = runs.flatMap(run => (run.portfolio?.recommended ?? []).map(id => run.id + '|' + id));
  const validated = recommended.filter(key => outcomes.some(outcome => outcome.runId + '|' + outcome.icpId === key &&
    outcome.result === 'positive' && ['qualified_discovery', 'qualified_opportunity', 'pilot', 'won'].includes(outcome.type)));
  const reasons = {};
  for (const item of [...outcomes, ...feedback]) if (item.reasonCode && item.result !== 'positive' && item.verdict !== 'positive') reasons[item.reasonCode] = (reasons[item.reasonCode] ?? 0) + 1;
  return {
    runs: runs.length, outcomes: outcomes.length, feedback: feedback.length, labels: goldLabels(runs, outcomes).size,
    voy: {recommended: recommended.length, validated: validated.length,
      rate: recommended.length >= MIN_COHORT ? Math.round(100 * validated.length / recommended.length) : null,
      caveat: 'Selection bias: only ICPs you chose to test can validate; outreach quality and missing outcomes are not controlled.'},
    calibration, sourceStats: sourceStats.slice(0, 40), reasons,
  };
}

// ---------------------------------------------------------------- proposals
function rescore(run, strategy) {
  return (run.cards ?? []).filter(card => card.score).map(card => {
    const claims = (run.claims ?? []).filter(claim => claim.segmentId === card.segmentId || claim.segmentId === 'general');
    const score = scoreSegment(claims, strategy);
    const decision = decide({...card, score}, strategy).decision;
    return {key: run.id + '|' + card.id, decision, archetype: card.archetype};
  });
}

/** Offline evaluation against known answers (PRD §15.2 step 6). */
export async function evaluateStrategy(candidate, baseline) {
  const [runs, outcomes] = await Promise.all([listRuns(), readCollection('outcomes')]);
  const labels = goldLabels(runs, outcomes);
  const stats = strategy => {
    const rows = runs.flatMap(run => rescore(run, strategy)).filter(row => labels.has(row.key));
    const tp = rows.filter(row => RECOMMENDED.includes(row.decision) && labels.get(row.key).label === 1).length;
    const fp = rows.filter(row => RECOMMENDED.includes(row.decision) && labels.get(row.key).label === 0).length;
    const fn = rows.filter(row => !RECOMMENDED.includes(row.decision) && labels.get(row.key).label === 1).length;
    const archetypeCounts = rows.reduce((acc, row) => ({...acc, [row.archetype]: (acc[row.archetype] ?? 0) + 1}), {});
    const majority = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const rare = rows.filter(row => row.archetype !== majority && labels.get(row.key).label === 1);
    return {n: rows.length, tp, fp, fn, precision: tp + fp ? Math.round(100 * tp / (tp + fp)) : null,
      recall: tp + fn ? Math.round(100 * tp / (tp + fn)) : null,
      rareRecall: rare.length ? Math.round(100 * rare.filter(row => RECOMMENDED.includes(row.decision)).length / rare.length) : null,
      hardNegativesRecommended: fp};
  };
  const before = stats(baseline);
  const after = stats(candidate);
  let verdict;
  if (after.n < 6) verdict = 'insufficient_labels';
  else if (after.hardNegativesRecommended > before.hardNegativesRecommended || (before.rareRecall ?? 0) > (after.rareRecall ?? 0) ||
    (before.recall ?? 0) > (after.recall ?? 0) + 5) verdict = 'regression';
  else if ((after.precision ?? 0) > (before.precision ?? 0) || after.fp < before.fp) verdict = 'better';
  else verdict = 'no_change';
  return {before, after, verdict, evaluatedAt: nowIso()};
}

export async function generateProposals() {
  const metrics = await measure();
  const current = await activeStrategy();
  const proposals = [];
  for (const host of metrics.sourceStats) {
    const poor = (host.checked >= 8 && host.precision !== null && host.precision < 40) || host.negativeFeedback >= 2;
    if (poor && (current.sourcePriors?.[host.host] ?? 1) > 0.5) {
      proposals.push({kind: 'source_prior', title: `Down-weight ${host.host}`,
        change: {sourcePriors: {...current.sourcePriors, [host.host]: 0.5}},
        because: `${host.supported}/${host.checked} claims verified (${host.precision ?? '–'}%), ${host.negativeFeedback} negative reviews`,
        risk: 'Fewer claims from this host count toward grades; a niche segment that depends on it may lose coverage.'});
    }
  }
  const byOfferReason = {};
  const [outcomes, feedback, runs] = await Promise.all([readCollection('outcomes'), readCollection('feedback'), listRuns()]);
  const index = cardIndex(runs);
  for (const item of [...outcomes.filter(entry => entry.result === 'negative'), ...feedback.filter(entry => entry.verdict === 'negative' && entry.targetType !== 'source')]) {
    if (!item.reasonCode || ['other', 'bad_source', 'bad_claim', 'bad_merge', 'stale_data'].includes(item.reasonCode)) continue;
    const offer = item.offer ?? index.get(item.runId + '|' + (item.icpId ?? item.targetId))?.card.offer ?? 'any';
    const key = offer + '|' + item.reasonCode;
    byOfferReason[key] = (byOfferReason[key] ?? 0) + 1;
  }
  for (const [key, count] of Object.entries(byOfferReason)) {
    const [offer, reasonCode] = key.split('|');
    if (count < 3 || current.negativeRules?.some(rule => rule.offer === offer && rule.reasonCode === reasonCode)) continue;
    proposals.push({kind: 'negative_rule', title: `Add disqualifier for ${offer}: ${REASON_CODES[reasonCode]}`,
      change: {negativeRules: [...(current.negativeRules ?? []), {offer, reasonCode, text: REASON_CODES[reasonCode] + ' (learned from outcomes)'}]},
      because: `${count} negative outcomes or reviews with reason "${reasonCode}"`,
      risk: 'May exclude accounts where the reason was execution, not fit. Check the notes before approving.'});
  }
  const explore = metrics.calibration.find(item => item.cohort === 'decision:explore_first');
  const conditional = metrics.calibration.find(item => item.cohort === 'decision:conditional_test');
  if (explore?.positiveRate !== null && explore?.positiveRate !== undefined && conditional?.positiveRate !== null && conditional?.positiveRate !== undefined &&
      explore.positiveRate < conditional.positiveRate) {
    proposals.push({kind: 'band_threshold', title: 'Raise the explore-first threshold by 5',
      change: {bands: {...current.bands, exploreMid: Math.min(90, current.bands.exploreMid + 5)}},
      because: `explore_first validated ${explore.positiveRate}% vs conditional_test ${conditional.positiveRate}% (n=${explore.n}/${conditional.n})`,
      risk: 'Fewer explore-first recommendations; check for over-conservatism.'});
  }
  const saved = [];
  for (const proposal of proposals) {
    const candidate = {...current, ...proposal.change, version: 'candidate'};
    const evaluation = await evaluateStrategy(candidate, current);
    saved.push({id: 'LP-' + shortHash(proposal.title + JSON.stringify(proposal.change)), ...proposal, evaluation,
      status: evaluation.verdict === 'regression' ? 'shadow_failed' : 'shadow', createdAt: nowIso(), baseVersion: current.version});
  }
  await updateCollection('learning', learning => {
    learning.proposals ??= [];
    for (const proposal of saved) if (!learning.proposals.some(item => item.id === proposal.id)) learning.proposals.push(proposal);
  });
  return {metrics, proposals: saved};
}

/** Human-only promotion of a proposal to a new strategy version, with an understandable changelog entry. */
export async function decideProposal(id, {action, actor, note}) {
  if (!/^human:/.test(actor ?? '')) throw Object.assign(new Error('Only a human reviewer can approve or reject learning changes'), {status: 403});
  const current = await activeStrategy();
  return updateCollection('learning', learning => {
    const proposal = learning.proposals?.find(item => item.id === id);
    if (!proposal) throw Object.assign(new Error('Proposal not found'), {status: 404});
    if (!['shadow', 'shadow_failed'].includes(proposal.status)) throw Object.assign(new Error('Proposal already decided'), {status: 409});
    proposal.decidedBy = actor; proposal.decidedAt = nowIso(); proposal.note = String(note ?? '').slice(0, 400);
    if (action !== 'approve') { proposal.status = 'rejected'; return; }
    if (proposal.status === 'shadow_failed' && !/override/i.test(note ?? '')) {
      throw Object.assign(new Error('This change regressed on known answers. Add "override" to the note to approve anyway.'), {status: 409});
    }
    const version = 'strategy-' + ((learning.strategies?.length ?? 0) + 2);
    learning.strategies ??= [];
    learning.strategies.push({...current, ...proposal.change, version, createdAt: nowIso(), from: current.version, proposalId: id});
    learning.previousVersion = learning.activeVersion ?? DEFAULT_STRATEGY.version;
    learning.activeVersion = version;
    proposal.status = 'adopted';
    learning.changelog ??= [];
    const e = proposal.evaluation;
    learning.changelog.unshift({at: nowIso(), version, by: actor,
      text: `Changed ${proposal.title.toLowerCase()} because ${proposal.because}; benchmark effect: precision ${e.before.precision ?? '–'}% → ${e.after.precision ?? '–'}%, ` +
        `recall ${e.before.recall ?? '–'}% → ${e.after.recall ?? '–'}% on ${e.after.n} known answers (${e.verdict}); known risk: ${proposal.risk}`});
  });
}

export async function rollbackStrategy(actor) {
  if (!/^human:/.test(actor ?? '')) throw Object.assign(new Error('Only a human can roll back'), {status: 403});
  return updateCollection('learning', learning => {
    const target = learning.previousVersion ?? DEFAULT_STRATEGY.version;
    learning.changelog ??= [];
    learning.changelog.unshift({at: nowIso(), version: target, by: actor, text: `Rolled back from ${learning.activeVersion ?? DEFAULT_STRATEGY.version} to ${target}`});
    learning.activeVersion = target === DEFAULT_STRATEGY.version ? null : target;
    learning.previousVersion = null;
  });
}
