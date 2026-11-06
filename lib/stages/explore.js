/** S2 divergent market universe and S3 source plan / query lattice (PRD §6, §7 S2–S3). */
import { ANGLES, ANGLE_KEYS, CROSS_CUTS } from '../taxonomy.js';
import { normalizeText } from '../util.js';

const MOTIONS = {
  b2b: [['direct team purchase', 'company_type', 'budget owner to verify'],
    ['regulated or time-bound procurement', 'lifecycle_event', 'budget owner to verify'],
    ['channel-led delivery', 'channel_partner', 'partner owner']],
  b2c: [['individual paid', 'consumer', 'individual purchaser'],
    ['institution sponsored', 'institution', 'program owner to verify'],
    ['employer sponsored', 'company_type', 'learning and development owner to verify']],
};

function seedSegments(offer, model) {
  if (offer.segments?.length) {
    return offer.segments.map(segment => ({...segment, name: segment.segment ?? segment.name,
      archetype: segment.archetype ?? (/channel|partner|agenc|provider/i.test(segment.motion + segment.segment) ? 'channel_partner'
        : /procure|compliance|scheduled|time-bound/i.test(segment.motion + segment.segment) ? 'lifecycle_event'
        : /institution|college|universit|school/i.test(segment.segment) ? 'institution'
        : /individual|learner|student|career/i.test(segment.segment) ? 'consumer' : 'company_type'),
      job: offer.problem, model: /individual|learner|student/i.test(segment.segment) ? 'b2c' : 'b2b', origin: 'user_declared'}));
  }
  return Object.entries(MOTIONS).filter(([kind]) => model === 'mixed' || model === kind || (model === 'b2b2c'))
    .flatMap(([kind, entries]) => entries.map(([motion, archetype, buyer]) => ({
      name: `${motion} for ${offer.problem}`, motion, archetype, user: offer.beneficiary ?? 'unknown', buyer,
      job: offer.problem, model: kind, origin: 'planner'})));
}

/** Choose a diverse subset: round-robin across archetypes so pruning never collapses to one stereotype. */
function diverse(segments, count) {
  const byArchetype = new Map();
  for (const segment of segments) byArchetype.set(segment.archetype, [...(byArchetype.get(segment.archetype) ?? []), segment]);
  const out = [];
  while (out.length < count && [...byArchetype.values()].some(list => list.length)) {
    for (const list of byArchetype.values()) if (list.length && out.length < count) out.push(list.shift());
  }
  return out;
}

export async function s2Universe(ctx) {
  const {run} = ctx;
  const {profile, policy} = run;
  const model = run.brief.model ?? profile.businessModel ?? 'b2b';
  const seeds = profile.offers.flatMap(offer => seedSegments(offer, model).map(segment => ({...segment, offer: offer.name, offerId: offer.id})));
  const mapped = await ctx.model('cartographer', {
    task: `Generate a divergent segment universe. Return up to ${Math.max(4, policy.limits.segmentsPerOffer + 2)} segments per offer.`,
    payload: {business: profile.summary, model, geographies: profile.geographies,
      offers: profile.offers.map(({name, problem, userJob, buyerJob, promisedOutcome}) => ({name, problem, userJob, buyerJob, promisedOutcome})),
      seedSegments: seeds.map(({offer, name, motion, user, buyer}) => ({offer, name, motion, user, buyer})),
      exclusions: run.brief.excludedMarkets ?? []},
  });
  const universe = [...seeds];
  for (const segment of mapped?.segments ?? []) {
    const offer = profile.offers.find(item => item.name === segment.offer);
    if (!offer) continue;
    universe.push({...segment, offer: offer.name, offerId: offer.id, origin: 'cartographer'});
  }
  // Deduplicate on offer + normalised name; seeds the owner declared always survive pruning.
  const seen = new Set();
  const unique = universe.filter(segment => {
    const key = segment.offerId + '|' + normalizeText(segment.name).toLowerCase();
    return !seen.has(key) && seen.add(key);
  });
  const excluded = (run.brief.excludedMarkets ?? []).map(item => item.toLowerCase());
  const perOffer = profile.offers.map(offer => {
    const pool = unique.filter(segment => segment.offerId === offer.id &&
      !excluded.some(term => normalizeText(segment.name).toLowerCase().includes(term)));
    // Owner-declared segments first, always leaving room for one divergent cartographer segment;
    // generic planner seeds only fill what is left.
    const declared = pool.filter(segment => segment.origin === 'user_declared');
    const mapped = pool.filter(segment => segment.origin === 'cartographer');
    const quota = policy.limits.segmentsPerOffer;
    const takeDeclared = Math.min(declared.length, Math.max(1, quota - (mapped.length ? 1 : 0)));
    const mappedPicks = diverse(mapped, Math.max(0, quota - takeDeclared));
    const fill = diverse(pool.filter(segment => segment.origin === 'planner'), quota - takeDeclared - mappedPicks.length);
    return [...declared.slice(0, takeDeclared), ...mappedPicks, ...fill];
  });
  // Allocate the segment budget round-robin across offers so no offer is silently dropped (F02).
  const cap = Math.max(policy.limits.maxSegments, profile.offers.length);
  const segments = [];
  while (segments.length < cap && perOffer.some(list => list.length)) {
    for (const list of perOffer) if (list.length && segments.length < cap) segments.push(list.shift());
  }
  segments.sort((a, b) => profile.offers.findIndex(o => o.id === a.offerId) - profile.offers.findIndex(o => o.id === b.offerId));
  run.segments = segments.map((segment, index) => ({
    id: 'G' + String(index + 1).padStart(2, '0'), offerId: segment.offerId, offer: segment.offer, name: segment.name,
    archetype: segment.archetype ?? 'company_type', motion: segment.motion ?? 'to verify', user: segment.user ?? 'to verify',
    buyer: segment.buyer ?? 'to verify', influencers: segment.influencers ?? [], job: segment.job ?? '',
    whyPlausible: segment.whyPlausible ?? '', trigger: segment.trigger ?? '', disqualifiers: segment.disqualifiers ?? [],
    searchTerms: (segment.searchTerms ?? []).slice(0, 6), antiSignals: segment.antiSignals ?? [], model: segment.model ?? 'b2b',
    origin: segment.origin,
  }));
  const archetypes = list => Object.fromEntries(profile.offers.map(offer => [offer.name,
    [...new Set(list.filter(segment => segment.offerId === offer.id).map(segment => segment.archetype ?? 'company_type'))]]));
  run.universe = {considered: unique.length, kept: run.segments.length, excludedByOwner: excluded,
    archetypesConsidered: archetypes(unique), archetypesPerOffer: archetypes(run.segments)};
  // PRD S2 gate applies before narrowing: at least 3 distinct archetypes explored per offer.
  const thin = Object.entries(run.universe.archetypesConsidered).filter(([, list]) => list.length < 3).map(([name]) => name);
  run.universe.gate = thin.length ? `Fewer than 3 archetypes explored for: ${thin.join(', ')}` : 'At least 3 archetypes explored per offer before narrowing';
  ctx.log('S2', `${unique.length} segment concepts considered, ${run.segments.length} kept across ${profile.offers.length} offers · ${run.universe.gate}`);
}

export async function s3Plan(ctx) {
  const {run} = ctx;
  const {policy} = run;
  const depth = policy.limits.angleDepth;
  const angles = ANGLE_KEYS.filter(key => ANGLES[key].priority <= depth);
  const geo = run.brief.geography && !/global|unknown/i.test(run.brief.geography) ? ' ' + run.brief.geography : '';
  const hints = ctx.strategy.queryHints ?? [];
  const lattice = [];
  // Search engines know categories, not unknown product names: short queries built from segment jargon and the
  // offer's category/problem. `topic` words drive the relevance filter in S4.
  const words = (text, max) => String(text ?? '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, max).join(' ');
  const offerTopic = offer => words(offer.category && offer.category !== 'unknown' ? offer.category : offer.problem, 5);
  const q = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  for (const segment of run.segments) {
    const offer = run.profile.offers.find(item => item.id === segment.offerId);
    const term = words(segment.searchTerms[0] ?? segment.name, 6);
    const topic = q(term, offerTopic(offer));
    for (const angle of angles) {
      const meta = ANGLES[angle];
      lattice.push({segmentId: segment.id, angle, direction: 'support', topic,
        query: q(term, meta.pro[0], angle === 'competition' || angle === 'economics' ? offerTopic(offer) : words(offer.problem, 4)) + geo});
      lattice.push({segmentId: segment.id, angle, direction: 'challenge', topic,
        query: q(term, meta.anti[0] ?? 'alternatives', offerTopic(offer)) + geo});
    }
  }
  // Offer-level substitute and pricing landscape, shared by that offer's segments.
  for (const offer of run.profile.offers) {
    const topic = offerTopic(offer);
    lattice.push({segmentId: 'general', offerId: offer.id, angle: 'competition', direction: 'challenge', topic, query: q(topic, 'alternatives free tools') + geo});
    lattice.push({segmentId: 'general', offerId: offer.id, angle: 'economics', direction: 'support', topic, query: q(topic, 'pricing cost') + geo});
  }
  for (const hint of hints.slice(0, 5)) lattice.push({segmentId: 'general', angle: 'pain', direction: 'support', query: hint, origin: 'learning'});

  // Priority: interleave segments, priority-1 angles first, alternate support/challenge so both sides are covered.
  const order = (item) => (ANGLES[item.angle]?.priority ?? 1) * 1000 + (item.segmentId === 'general' ? 0 : 1);
  const bySegment = new Map();
  for (const item of lattice.sort((a, b) => order(a) - order(b))) bySegment.set(item.segmentId, [...(bySegment.get(item.segmentId) ?? []), item]);
  // Every other segment leads with its disconfirming query, so even a tiny budget searches both sides.
  [...bySegment.values()].forEach((list, index) => {
    if (index % 2 === 1 && list.length > 1 && list[0].direction === 'support') [list[0], list[1]] = [list[1], list[0]];
  });
  const queue = [];
  while ([...bySegment.values()].some(list => list.length)) for (const list of bySegment.values()) if (list.length) queue.push(list.shift());
  const seen = new Set();
  run.searchPlan = queue.filter(item => !seen.has(item.query.toLowerCase()) && seen.add(item.query.toLowerCase()))
    .map((item, index) => ({...item, id: 'Q' + String(index + 1).padStart(3, '0'),
      status: index < policy.limits.maxSearches ? 'planned' : 'deferred', reason: index < policy.limits.maxSearches ? '' : 'search budget',
      adapter: null, results: []}));

  run.coverage = run.segments.flatMap(segment => ANGLE_KEYS.map(angle => ({
    segmentId: segment.id, angle,
    status: !angles.includes(angle) ? 'deferred' : run.searchPlan.some(item => item.segmentId === segment.id && item.angle === angle && item.status === 'planned') ? 'planned' : 'deferred',
    reason: !angles.includes(angle) ? `Outside ${policy.modeLabel} depth` : run.searchPlan.some(item => item.segmentId === segment.id && item.angle === angle && item.status === 'planned') ? '' : 'Search budget',
  })));
  run.crossCuts = CROSS_CUTS.map(cut => ({cut, status:
    /buyer vs user|positive vs negative|direct vs channel/.test(cut) ? 'addressed_by_design' :
    /local vs international/.test(cut) ? (geo ? 'addressed_by_design' : 'not_assessed') : 'not_assessed'}));
  const planned = run.searchPlan.filter(item => item.status === 'planned');
  ctx.log('S3', `${run.searchPlan.length} queries in the lattice (${planned.filter(item => item.direction !== 'support').length} disconfirming), ` +
    `${planned.length} scheduled, ${run.searchPlan.length - planned.length} deferred by budget · ${angles.length} of ${ANGLE_KEYS.length} angles in scope`);
}
