import { angles, plan, rubric } from './planner.js';
import { collect, hash, verifyClaims } from './evidence.js';

const defaults = {hosts: [], maxSources: 40, maxAgeDays: 180, maxRecommendations: 3};
const text = value => typeof value === 'string' && Boolean(value.trim());

function validate(input) {
  if (!text(input.name) || !['b2b', 'b2c', 'mixed'].includes(input.model) ||
      !Array.isArray(input.offers) || !input.offers.length ||
      input.offers.some(offer => !text(offer.name) || !text(offer.problem))) {
    throw new Error('Provide name, model and at least one offer with name and problem');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf) || !Number.isFinite(Date.parse(input.asOf)) ||
      new Date(input.asOf).toISOString().slice(0, 10) !== input.asOf) {
    throw new Error('Provide a valid asOf date (YYYY-MM-DD)');
  }
  if (input.geographies !== undefined && (!Array.isArray(input.geographies) ||
      !input.geographies.length || input.geographies.some(value => !text(value)))) {
    throw new Error('Geographies must be a nonempty list of labels');
  }
  for (const offer of input.offers) {
    if (offer.segments !== undefined && (!Array.isArray(offer.segments) || offer.segments.length < 3 ||
        offer.segments.some(segment => !text(segment.segment) || !text(segment.motion) ||
          !text(segment.user) || !text(segment.buyer)) ||
        new Set(offer.segments.map(segment => segment.segment.trim().toLowerCase())).size < 3)) {
      throw new Error('Provide at least three distinct segments with motion, user and buyer per custom offer');
    }
  }
}

function score(claims, sources) {
  const verified = claims.filter(claim => claim.status === 'verified');
  const supportive = verified.filter(claim => claim.direction === 'support');
  const challenged = claims.filter(claim => claim.direction !== 'support');
  const records = supportive.map(claim => ({...sources.get(claim.sourceId), claim}));
  const primary = records.filter(source => source.kind === 'primary');
  const independent = primary.some(first => records.some(second =>
    first.claim.angle === second.claim.angle && first.claim.statement === second.claim.statement &&
    ['origin', 'digest', 'host', 'publisher'].every(field => first[field] !== second[field])));
  const grade = challenged.length ? 'D' : independent ? 'A' : primary.length ? 'B' : records.length ? 'C' : 'U';
  const dimensions = Object.entries(rubric).map(([dimension, weight]) => {
    const positive = supportive.filter(claim => claim.angle === dimension);
    const negative = challenged.filter(claim => claim.angle === dimension);
    const range = dimension === 'research' ? {A: [4, 5], B: [3, 4], C: [1, 3], D: [0, 2], U: [0, 5]}[grade] :
      negative.length ? [0, 3] : positive.length ? [4, 5] : [0, 5];
    return {dimension, weight, range, claimIds: [...positive, ...negative].map(claim => claim.id)};
  });
  const [low, high] = [0, 1].map(index => dimensions.reduce(
    (sum, item) => sum + item.range[index] * item.weight / 5, 0));
  return {grade, low, high, dimensions};
}

export function run(input) {
  validate(input);
  const policy = {...defaults, ...input.policy};
  if (!Array.isArray(policy.hosts) || policy.hosts.some(host => !/^[a-z0-9.-]+$/.test(host)) ||
      !['maxSources', 'maxAgeDays', 'maxRecommendations'].every(key =>
        Number.isSafeInteger(policy[key]) && policy[key] >= 0) || policy.maxRecommendations > 3) {
    throw new Error('Invalid policy bounds or host allowlist');
  }
  const collected = collect(input.sources ?? [], policy, input.asOf);
  const sources = new Map(collected.evidence.map(source => [source.id, source]));
  const candidates = plan(input);
  for (const record of input.claims ?? []) {
    if (!candidates.some(candidate => candidate.id === record.candidate)) {
      throw new Error('Claim references unknown candidate ' + record.candidate);
    }
  }
  const cards = candidates.map(candidate => {
    const claims = verifyClaims(candidate, input.claims ?? [], collected.evidence);
    const opportunity = score(claims, sources);
    const counterclaims = claims.filter(claim => claim.direction !== 'support');
    const proponents = new Set(claims.filter(claim => claim.direction === 'support')
      .map(claim => claim.analyst?.trim().toLowerCase()).filter(Boolean));
    const reviews = (input.reviews ?? []).filter(item => item.candidate === candidate.id &&
      item.critic?.trim() && !proponents.has(item.critic.trim().toLowerCase()) &&
      text(item.challenge) && ['cleared', 'unresolved'].includes(item.disposition));
    const review = reviews.find(item => item.disposition === 'unresolved') ?? reviews[0];
    const coverage = Object.keys(angles).map(angle => {
      const checked = claims.some(claim => claim.angle === angle && claim.status === 'verified');
      return {angle, status: checked ? 'checked' : 'deferred',
        reason: checked ? 'Reviewed against a retained excerpt' : 'No fresh independently reviewed excerpt'};
    });
    const rejected = counterclaims.some(claim => claim.direction === 'exclusion' && claim.status === 'verified');
    const eligible = ['A', 'B'].includes(opportunity.grade) && opportunity.low >= 75 &&
      review?.disposition === 'cleared';
    return {
      ...candidate, claims, coverage, opportunity,
      coveragePct: Math.round(100 * coverage.filter(item => item.status === 'checked').length / coverage.length),
      redTeam: {challenge: review?.challenge ?? 'Check whether the incumbent or free substitutes already meet the job',
        critic: review?.critic ?? null, disposition: review?.disposition ?? 'unresolved',
        counterclaimIds: counterclaims.map(claim => claim.id)},
      status: rejected ? 'rejected' : eligible ? 'evidence_supported' : 'revisit_later',
      buyingIntent: 'not_observed', marketSize: 'unknown', commercialValidation: 'not_tested',
      nextTest: {
        method: 'Buyer and user problem interviews',
        sample: 'Five distinct organizations or purchasers matching the segment',
        pass: 'At least three describe a recent instance and identify a plausible funding route',
        stop: 'Stop if scope or buyer authority repeatedly fails qualification',
        cost: 'unknown',
      },
    };
  }).sort((a, b) => b.opportunity.low - a.opportunity.low || a.id.localeCompare(b.id, 'en'));
  return {
    version: '1.0', runId: hash(JSON.stringify(input)), asOf: input.asOf,
    business: {name: input.name, website: input.website ?? 'unknown', offers: input.offers,
      model: input.model, facts: 'user_declared'},
    policy, evidence: collected.evidence, audit: collected.audit,
    spend: {retainedSources: collected.consumed, networkRequests: 0, modelTokens: 0},
    recommendations: cards.filter(card => card.status === 'evidence_supported')
      .slice(0, policy.maxRecommendations).map(card => card.id),
    cards,
  };
}
