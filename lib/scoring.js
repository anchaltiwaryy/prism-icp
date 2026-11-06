/**
 * S9 scoring (PRD §9.2, §10). Merit, certainty and readiness stay separate:
 *  - opportunity score is an interval built from per-dimension ranges (missing evidence widens, never zeroes);
 *  - evidence grade A/B/C/D/U describes support for the facts, not willingness to pay;
 *  - decision band applies hard gates first and is allowed to recommend nothing.
 */
import { ANGLES, RUBRIC } from './taxonomy.js';

export const RUBRIC_VERSION = 'rubric-2.0';

export const DEFAULT_STRATEGY = {
  version: 'strategy-1', rubricVersion: RUBRIC_VERSION,
  weights: Object.fromEntries(Object.entries(RUBRIC).map(([key, value]) => [key, value.weight])),
  bands: {exploreMid: 72, exploreMaxWidth: 40, conditionalMid: 52, rejectMid: 30},
  sourcePriors: {},            // host -> multiplier on claim weight learned from feedback (0.5–1.2)
  negativeRules: [],           // [{pattern, reason, field}] learned disqualifier patterns
  queryHints: [],              // extra query terms proposed by learning
};

const dimensionOf = claim => ANGLES[claim.angle]?.dimension ?? null;
const usable = claim => ['verified', 'corroborated', 'contradicted', 'observed', 'inferred'].includes(claim.epistemic) && !claim.stale;

function dimensionRange(claims, strategy) {
  const prior = claim => strategy.sourcePriors?.[claim.sourceUrl ? new URL(claim.sourceUrl).hostname : ''] ?? 1;
  const strong = claims.filter(claim => ['verified', 'corroborated'].includes(claim.epistemic) && prior(claim) >= 0.75);
  const support = strong.filter(claim => claim.direction === 'support');
  const challenge = strong.filter(claim => claim.direction !== 'support');
  const contradicted = claims.some(claim => claim.epistemic === 'contradicted');
  const weakSupport = claims.filter(claim => claim.direction === 'support' && ['observed', 'inferred'].includes(claim.epistemic));
  const independentSupport = new Set(support.filter(claim => !claim.interestedParty).map(claim => claim.family)).size;
  if (contradicted || (support.length && challenge.length)) return {range: [1.5, 3.5], basis: 'contradictory evidence'};
  if (challenge.length && !support.length) return {range: [0, 2.5], basis: 'verified challenge'};
  if (independentSupport >= 2) return {range: [3.5, 5], basis: 'corroborated support'};
  if (support.length && support.every(claim => claim.interestedParty)) return {range: [2, 4.5], basis: 'interested-party support only'};
  if (support.length) return {range: [2.5, 4.5], basis: 'single-origin verified support'};
  if (weakSupport.length) return {range: [1.5, 5], basis: 'unverified observation'};
  return {range: [0, 5], basis: 'insufficient coverage — not scored as zero'};
}

export function evidenceGrade(claims) {
  const relevant = claims.filter(usable);
  if (!relevant.length) return 'U';
  const strong = relevant.filter(claim => ['verified', 'corroborated'].includes(claim.epistemic));
  const support = strong.filter(claim => claim.direction === 'support');
  const contradictions = relevant.some(claim => claim.epistemic === 'contradicted');
  const independent = new Set(support.filter(claim => !claim.interestedParty).map(claim => claim.family));
  const documentary = support.some(claim => claim.tier <= 2 && !claim.interestedParty);
  if (!support.length) return strong.length ? 'D' : relevant.some(claim => claim.direction === 'support') ? 'C' : 'D';
  if (contradictions) return 'D';
  if (support.every(claim => claim.interestedParty)) return 'D';
  if (independent.size >= 2 && documentary) return 'A';
  if (independent.size >= 2 || support.some(claim => claim.tier <= 3 && !claim.interestedParty)) return 'B';
  return 'C';
}

export function scoreSegment(claims, strategy = DEFAULT_STRATEGY) {
  const segmentClaims = claims.filter(usable);
  const grade = evidenceGrade(segmentClaims);
  const dimensions = Object.entries(RUBRIC).map(([dimension, meta]) => {
    const weight = strategy.weights?.[dimension] ?? meta.weight;
    if (dimension === 'research') {
      const range = {A: [4, 5], B: [3, 4], C: [1.5, 3], D: [0.5, 2], U: [0, 1]}[grade];
      return {dimension, label: meta.label, weight, range, basis: 'evidence grade ' + grade, claimIds: []};
    }
    const relevant = segmentClaims.filter(claim => dimensionOf(claim) === dimension);
    const {range, basis} = dimensionRange(relevant, strategy);
    return {dimension, label: meta.label, weight, range, basis, claimIds: relevant.map(claim => claim.id)};
  });
  const total = dimensions.reduce((sum, item) => sum + item.weight, 0) || 100;
  const [low, high] = [0, 1].map(index => Math.round(dimensions.reduce((sum, item) => sum + item.weight * item.range[index] / 5, 0) * 100 / total));
  const covered = dimensions.filter(item => item.dimension !== 'research' && !item.basis.startsWith('insufficient')).length;
  return {low, high, mid: Math.round((low + high) / 2), width: high - low, grade, dimensions,
    coveragePct: Math.round(100 * covered / (dimensions.length - 1)), rubricVersion: strategy.rubricVersion ?? RUBRIC_VERSION};
}

/**
 * Decision band (PRD §10.3). Hard exclusions and kill switches reject; missing evidence defers (F13);
 * nothing reaches explore_first without grade A/B, a surviving red-team review and verifier coverage.
 */
export function decide(card, strategy = DEFAULT_STRATEGY) {
  const bands = {...DEFAULT_STRATEGY.bands, ...strategy.bands};
  const score = card.score;
  const redTeam = card.redTeam;
  const gates = [];
  if (card.hardExclusion) gates.push({gate: 'hard exclusion', pass: false, detail: card.hardExclusion});
  if (redTeam?.killSwitch?.fired && redTeam.killSwitch.verified) gates.push({gate: 'kill switch', pass: false, detail: redTeam.killSwitch.reason});
  gates.push({gate: 'red-team review', pass: Boolean(redTeam && redTeam.status !== 'not_reviewed'), detail: redTeam?.status ?? 'not reviewed'});
  gates.push({gate: 'independent verification', pass: Boolean(card.verifiedClaims > 0), detail: `${card.verifiedClaims ?? 0} verified claims`});
  gates.push({gate: 'buying intent not assumed', pass: card.buyingIntent === 'not_observed' || card.buyingIntent === 'observed_strong', detail: card.buyingIntent});
  const failedHard = gates.filter(gate => !gate.pass && ['hard exclusion', 'kill switch'].includes(gate.gate));
  let decision;
  let reason;
  if (failedHard.length) { decision = 'reject'; reason = failedHard.map(gate => gate.detail).join('; '); }
  else if (redTeam?.status === 'reject' && ['A', 'B'].includes(score.grade)) { decision = 'reject'; reason = 'Red team rejected with documentary evidence: ' + redTeam.strongestAgainst; }
  else if (score.mid < bands.rejectMid && ['A', 'B'].includes(score.grade)) { decision = 'reject'; reason = 'Strongly supported poor fit'; }
  else if (['A', 'B'].includes(score.grade) && score.mid >= bands.exploreMid && score.width <= bands.exploreMaxWidth &&
      ['survive', 'revise'].includes(redTeam?.status) && gates.every(gate => gate.pass)) {
    decision = 'explore_first'; reason = 'Grade ' + score.grade + ', score ' + score.low + '–' + score.high + ', survived red team';
  } else if (score.mid >= bands.conditionalMid && ['A', 'B', 'C'].includes(score.grade) && redTeam?.status !== 'reject' &&
      redTeam?.status !== 'defer' && card.verifiedClaims > 0) {
    decision = 'conditional_test'; reason = 'Promising but uncertain (grade ' + score.grade + ', width ' + score.width + ') — interview before scaling';
  } else {
    decision = 'defer';
    reason = score.grade === 'U' ? 'No usable public evidence — defer for primary research, not rejected'
      : redTeam?.status === 'defer' ? 'Red team: market opaque, defer for primary research' : 'Ambiguous economics or thin evidence';
  }
  return {decision, reason, gates};
}

/** Rank stability check (PRD §12.5): does the top set survive ±25% weight perturbations? */
export function sensitivity(cards, strategy = DEFAULT_STRATEGY) {
  const base = rank(cards, strategy.weights);
  const flips = [];
  for (const dimension of Object.keys(strategy.weights)) {
    for (const factor of [0.75, 1.25]) {
      const weights = {...strategy.weights, [dimension]: strategy.weights[dimension] * factor};
      const top = rank(cards, weights);
      if (top.join() !== base.join()) flips.push({dimension, factor, top});
    }
  }
  return {stable: flips.length === 0, baseTop: base, flips: flips.slice(0, 6)};
}
function rank(cards, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return cards.filter(card => ['explore_first', 'conditional_test'].includes(card.decision))
    .map(card => ({id: card.id, mid: card.score.dimensions.reduce((sum, item) =>
      sum + (weights[item.dimension] ?? 0) * (item.range[0] + item.range[1]) / 10, 0) * 100 / total}))
    .sort((a, b) => b.mid - a.mid).slice(0, 3).map(item => item.id);
}
