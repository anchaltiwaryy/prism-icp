export const rubric = Object.freeze({
  pain: 20, fit: 15, economics: 15, reach: 10,
  timing: 10, delivery: 10, advantage: 10, research: 10,
});

export const angles = {
  pain: 'Demand and pain', identity: 'Customer identity', roles: 'Users and buyers',
  economics: 'Willingness to pay', stack: 'Technographics', timing: 'Timing',
  structure: 'Market structure', advantage: 'Competition and substitutes',
  reach: 'Reachability', friction: 'Adoption friction', fit: 'Strategic fit',
  delivery: 'Delivery and repeatability', risks: 'Risks and exclusions',
  regional: 'Macro and regional', adjacency: 'Adjacent markets',
};

const motions = {
  b2b: ['direct team purchase', 'regulated or time-bound procurement', 'channel-led delivery'],
  b2c: ['individual paid', 'institution sponsored', 'employer sponsored'],
};

export function plan(brief) {
  return brief.offers.flatMap((offer, offerIndex) => {
    const paths = offer.segments ?? Object.entries(motions)
      .filter(([model]) => brief.model === 'mixed' || model === brief.model)
      .flatMap(([model, entries]) => entries.map(motion => ({
        segment: motion + ' for ' + offer.problem, motion,
        user: offer.beneficiary ?? 'unknown',
        buyer: motion === 'individual paid' ? 'individual purchaser' : 'budget owner to verify',
        model,
      })));
    return paths.flatMap((segment, segmentIndex) =>
      (brief.geographies ?? ['unknown']).map((geography, geoIndex) => ({
        ...segment, geography, id: [offerIndex + 1, segmentIndex + 1, geoIndex + 1].join('-'),
        offer: offer.name, job: offer.problem,
        hypothesis: segment.segment + ' has recurring need and a reachable buyer for ' + offer.name,
        exclusions: offer.exclusions ?? ['Outside delivery scope', 'No eligible use case'],
        boundaries: ['Include only when need and buyer ownership can be demonstrated',
          'Exclude accounts that fail an offer constraint'],
        alternatives: ['Incumbent provider', 'Internal delivery', 'Free substitutes', 'Non-consumption'],
        queries: Object.entries(angles).flatMap(([angle, label]) => [
          {angle, direction: 'support', query: [segment.segment, geography, label, offer.problem].join(' ')},
          {angle, direction: 'challenge', query: [segment.segment, geography, label, 'barriers alternatives no budget'].join(' ')},
        ]),
      })));
  });
}
