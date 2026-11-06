/** S8 adversarial red team and S9 independent verification + calibrated scoring (PRD §7 S8–S9, §8, §9, §10). */
import { applyVerification, isVerified } from '../evidence.js';
import { decide, scoreSegment, sensitivity } from '../scoring.js';
import { RED_TEAM_KEYS, STRONG_SIGNALS, WEAK_TIMING_SIGNALS } from '../taxonomy.js';
import { quoteIn } from '../util.js';
import { claimsFor } from './analyze.js';

const compact = claim => ({id: claim.id, angle: claim.angle, direction: claim.direction, statement: claim.statement,
  quote: claim.quote.slice(0, 220), sourceId: claim.sourceId, interestedParty: claim.interestedParty, signalType: claim.signalType,
  epistemic: claim.epistemic});

/** Deterministic attacks that need no model — always run, and they are the floor when no model exists. */
function mechanicalTests(run, card, claims) {
  const support = claims.filter(claim => claim.direction === 'support');
  const tests = {};
  const weakTiming = support.filter(claim => WEAK_TIMING_SIGNALS.includes(claim.signalType));
  tests.false_signal = weakTiming.length
    ? {result: 'concern', note: `${weakTiming.length} supporting claims rest on launch/hiring/funding-type signals — timing only, not intent`, claimIds: weakTiming.map(c => c.id)}
    : {result: 'pass', note: 'No weak timing signal is treated as intent', claimIds: []};
  const families = new Set(support.map(claim => claim.family));
  tests.evidence_bias = !support.length ? {result: 'not_assessed', note: 'No supporting evidence to assess', claimIds: []}
    : support.every(claim => claim.interestedParty) ? {result: 'fail', note: 'All supporting evidence is vendor or interested-party material', claimIds: support.map(c => c.id)}
    : families.size < 2 ? {result: 'concern', note: 'Support comes from a single origin family', claimIds: support.map(c => c.id)}
    : {result: 'pass', note: `${families.size} independent origin families`, claimIds: []};
  const langs = new Set(run.sources.map(source => (source.lang ?? 'en').slice(0, 2)));
  tests.selection_bias = {result: 'concern', note: `Sources span ${langs.size} language(s) and only indexable public pages; ` +
    (run.brief.geography ? `region ${run.brief.geography} requested` : 'no operating region supplied'), claimIds: []};
  const substitutes = claims.filter(claim => claim.angle === 'competition');
  tests.substitution = substitutes.length ? {result: substitutes.some(c => c.direction !== 'support') ? 'concern' : 'pass',
    note: `${substitutes.length} competition/substitute claims`, claimIds: substitutes.map(c => c.id)}
    : {result: 'not_assessed', note: 'No substitute evidence collected — check in interviews', claimIds: []};
  return tests;
}

function deterministicReview(run, card, claims) {
  const mech = mechanicalTests(run, card, claims);
  const tests = RED_TEAM_KEYS.map(id => ({id, ...(mech[id] ?? {result: 'not_assessed', note: 'Requires model or human red-team review', claimIds: []}), sourceId: '', quote: ''}));
  const hasEvidence = claims.some(claim => claim.direction === 'support');
  return {tests, strongestFor: hasEvidence ? 'Some public observations match the segment' : 'None collected',
    strongestAgainst: 'No independent adversarial review was possible without a model', assumptions: card.evidenceNeeds.slice(0, 5),
    falsePositiveCauses: ['Vendor marketing mistaken for demand', 'Visible online companies overrepresented'],
    wouldChangeDecision: 'Buyer interviews confirming recent pain and a budget owner', killSwitch: {fired: false, reason: '', sourceId: '', quote: ''},
    status: 'defer', reviewer: 'deterministic-checks'};
}

export async function s8RedTeam(ctx) {
  const {run} = ctx;
  const limit = run.policy.limits.redTeamTop;
  // Shortlist on preliminary merit, but never on a card with no evidence at all — those are deferred, not attacked.
  const shortlist = [...run.cards].filter(card => card.preliminary.grade !== 'U')
    .sort((a, b) => b.preliminary.mid - a.preliminary.mid).slice(0, limit);
  for (const card of run.cards) card.redTeam = {status: 'not_reviewed', tests: [], reviewer: null};
  for (let i = 0; i < shortlist.length; i += 3) {
    ctx.checkControl();
    const batch = shortlist.slice(i, i + 3);
    const result = await ctx.model('skeptic', {
      task: 'Attack each shortlisted ICP. Run all fifteen tests per segment. Cite claim ids or exact disconfirming quotes.',
      payload: {business: run.profile.summary,
        segments: batch.map(card => {
          const segment = run.segments.find(item => item.id === card.segmentId);
          const claims = claimsFor(run, segment);
          const challengeSources = run.sources.filter(source => source.segmentId === card.segmentId && source.direction === 'challenge').slice(0, 3);
          return {segmentId: card.segmentId, offer: card.offer, definition: card.definition, hypothesis: card.hypothesis,
            structuralFit: card.structuralFit, buyer: card.buyer, user: card.user, motion: card.motion,
            proponentClaims: claims.filter(claim => claim.direction === 'support').slice(0, 20).map(compact),
            challengeClaims: claims.filter(claim => claim.direction !== 'support').slice(0, 20).map(compact),
            alternatives: run.alternatives.filter(item => item.offerId === card.offerId).map(({name, type}) => ({name, type})),
            disconfirmingSources: challengeSources.map(source => ({sourceId: source.id, title: source.title, text: source.excerpt.slice(0, 1500)}))};
        })},
      maxTokens: 24000,
    });
    for (const card of batch) {
      const claims = claimsFor(run, run.segments.find(segment => segment.id === card.segmentId));
      const review = result?.reviews?.find(item => item.segmentId === card.segmentId);
      if (!review) { card.redTeam = deterministicReview(run, card, claims); continue; }
      const claimIds = new Set(claims.map(claim => claim.id));
      const mech = mechanicalTests(run, card, claims);
      const tests = RED_TEAM_KEYS.map(id => {
        const test = review.tests.find(item => item.id === id) ?? {id, result: 'not_assessed', note: 'Skeptic omitted this test', claimIds: [], sourceId: '', quote: ''};
        const cited = (test.claimIds ?? []).filter(claimId => claimIds.has(claimId));
        const source = run.sources.find(item => item.id === test.sourceId);
        const quoted = Boolean(source && test.quote && quoteIn(source.excerpt, test.quote));
        // A "fail" without a checkable citation is downgraded: the red team needs evidence too.
        const result = test.result === 'fail' && !cited.length && !quoted ? 'concern' : test.result;
        const merged = mech[id] && mech[id].result === 'fail' ? mech[id] : null;
        return {id, result: merged?.result ?? result, note: merged ? merged.note + ' · ' + test.note : test.note + (result !== test.result ? ' (fail downgraded: no checkable citation)' : ''),
          claimIds: [...new Set([...cited, ...(merged?.claimIds ?? [])])], sourceId: quoted ? source.id : '', quote: quoted ? test.quote : ''};
      });
      const killSource = run.sources.find(item => item.id === review.killSwitch?.sourceId);
      const killVerified = Boolean(review.killSwitch?.fired && killSource && quoteIn(killSource.excerpt, review.killSwitch.quote));
      card.redTeam = {...review, tests, killSwitch: {...review.killSwitch, verified: killVerified},
        status: review.killSwitch?.fired && !killVerified && review.status === 'reject' ? 'revise' : review.status,
        reviewer: 'skeptic:' + ctx.llm.describe()};
    }
    if (result) ctx.log('S8', `Red team reviewed ${batch.map(card => card.segmentId).join(', ')} → ${batch.map(card => card.redTeam.status).join(', ')}`);
    await ctx.save();
  }
  const statuses = run.cards.reduce((acc, card) => ({...acc, [card.redTeam.status]: (acc[card.redTeam.status] ?? 0) + 1}), {});
  ctx.log('S8', `Adversarial review: ${Object.entries(statuses).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ')}`);
}

export async function s9VerifyScore(ctx) {
  const {run} = ctx;
  // Material claims: anything that can move a shortlisted decision. The verifier never sees the cards.
  const reviewed = new Set(run.cards.filter(card => card.redTeam.status !== 'not_reviewed').map(card => card.segmentId));
  const material = run.claims.filter(claim => claim.analyst !== 'keyword-heuristic' && !claim.verification &&
    (reviewed.has(claim.segmentId) || claim.segmentId === 'general' || claim.direction === 'exclusion'));
  for (let i = 0; i < material.length; i += 25) {
    ctx.checkControl();
    const batch = material.slice(i, i + 25);
    const result = await ctx.model('verifier', {
      task: 'Check each claim against its quote and surrounding source text.',
      payload: {claims: batch.map(claim => {
        const source = run.sources.find(item => item.id === claim.sourceId);
        const at = source.excerpt.toLowerCase().indexOf(claim.quote.slice(0, 40).toLowerCase());
        const start = Math.max(0, at - 600);
        return {claimId: claim.id, statement: claim.statement, quote: claim.quote, sourceTitle: source.title, sourceHost: source.host,
          sourcePublished: source.published, sourceIsVendorOwnSite: source.interestedParty, context: source.excerpt.slice(start, start + 1600)};
      })},
    });
    if (result) applyVerification(run, result.checks, 'verifier:' + ctx.llm.describe());
    await ctx.save();
  }
  const verdicts = run.claims.reduce((acc, claim) => ({...acc, [claim.verification?.verdict ?? 'unchecked']: (acc[claim.verification?.verdict ?? 'unchecked'] ?? 0) + 1}), {});
  ctx.log('S9', `Verification: ${Object.entries(verdicts).map(([k, v]) => `${v} ${k}`).join(', ')}`);

  for (const card of run.cards) {
    const claims = claimsFor(run, run.segments.find(segment => segment.id === card.segmentId));
    card.score = scoreSegment(claims, ctx.strategy);
    card.verifiedClaims = claims.filter(isVerified).length;
    card.supportingClaimIds = [...new Set([...card.supportingClaimIds, ...claims.filter(claim => isVerified(claim) && claim.direction === 'support').map(c => c.id)])];
    card.counterClaimIds = [...new Set([...card.counterClaimIds, ...claims.filter(claim => isVerified(claim) && claim.direction !== 'support').map(c => c.id)])];
    const exclusion = claims.find(claim => claim.direction === 'exclusion' && isVerified(claim) && claim.segmentId === card.segmentId);
    card.hardExclusion = exclusion ? `${exclusion.statement} [${exclusion.id}]` : null;
    // F08: intent is never inferred from launches, hiring or funding. Only verified strong signals are even shown.
    const strong = claims.filter(claim => STRONG_SIGNALS.includes(claim.signalType) && isVerified(claim));
    card.buyingIntent = 'not_observed';
    card.strongSignals = strong.map(claim => claim.id);
    card.timingSignals = claims.filter(claim => WEAK_TIMING_SIGNALS.includes(claim.signalType)).map(claim => claim.id);
    const decision = decide(card, ctx.strategy);
    Object.assign(card, {decision: decision.decision, decisionReason: decision.reason, gates: decision.gates,
      evidenceGrade: card.score.grade, coveragePct: card.score.coveragePct,
      fitConfidence: card.score.grade === 'A' ? 'moderate' : card.score.grade === 'B' ? 'low-moderate' : 'low',
      maturity: decision.decision === 'reject' ? 'rejected' : decision.decision === 'defer' ? 'revisit_later'
        : ['A', 'B'].includes(card.score.grade) ? 'evidence_supported' : 'researched'});
  }
  run.sensitivity = sensitivity(run.cards, ctx.strategy);
  const decisions = run.cards.reduce((acc, card) => ({...acc, [card.decision]: (acc[card.decision] ?? 0) + 1}), {});
  ctx.log('S9', `Scored ${run.cards.length} hypotheses: ${Object.entries(decisions).map(([k, v]) => `${v} ${k.replace('_', ' ')}`).join(', ')} · ` +
    `ranking ${run.sensitivity.stable ? 'stable' : 'sensitive'} to ±25% weight changes`);
}
