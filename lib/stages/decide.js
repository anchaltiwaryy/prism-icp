/** S10 portfolio selection, anti-ICPs, validation sprint and downstream lead-intelligence brief (PRD §7 S10, §14.4, §16). */
import { nowIso } from '../util.js';

function templatePlan(card) {
  return {
    experiments: [{
      type: 'problem_interviews', hypothesis: card.hypothesis,
      sample: `Buyers and users from distinct organizations matching: ${card.definition}. Include at least one account just outside the boundary.`,
      recruitingCriteria: [...card.structuralFit.slice(0, 4), `Role: ${card.buyer} or ${card.user}`],
      script: ['Walk me through the last time this problem came up. What happened?', 'What do you use today to handle it, and what does that cost you?',
        'Who decided on that approach, and who signs off on spend for it?', 'What would have to be true for you to change how you handle this?',
        'Is there anything that would rule out an outside provider here?'],
      passCriterion: 'Set before interviews: e.g. most interviewees describe a recent instance AND name a budget owner AND current alternative is unsatisfactory',
      killCriterion: 'Set before interviews: e.g. most report no recent instance, or an adequate free/in-house alternative, or no budget owner',
      minimumEvidence: 'Owner to set the sample size before recruiting; record negative interviews too',
    }],
    leadBrief: {
      searchQueries: [...card.searchTerms.slice(0, 3).map(term => `${term} ${card.job}`.trim()), `${card.segment} ${card.geography}`.trim()],
      directories: ['Industry associations and member directories', 'Public procurement / tender portals (where relevant)', 'Event exhibitor and speaker lists'],
      accountCriteria: card.structuralFit.length ? card.structuralFit : [card.definition],
      scoringRules: ['Structural-fit criteria met with a quote from the organization\'s own site', 'Disqualifiers checked and absent', 'Weak timing signals (launch, hiring, funding) recorded but never treated as intent'],
      monitoringSignals: [card.trigger].filter(item => item && item !== 'unknown'),
      exclusions: card.disqualifiers,
    },
  };
}

export async function s10Portfolio(ctx) {
  const {run} = ctx;
  const topCount = run.brief.topCount === 5 ? 5 : 3;
  const eligible = run.cards.filter(card => ['explore_first', 'conditional_test'].includes(card.decision))
    .sort((a, b) => (a.decision === 'explore_first' ? 0 : 1) - (b.decision === 'explore_first' ? 0 : 1) || b.score.mid - a.score.mid);
  // Diversify correlated bets: max two per offer and one per offer+archetype while alternatives remain.
  const picked = [];
  for (const card of eligible) {
    if (picked.length >= topCount) break;
    const sameOffer = picked.filter(item => item.offerId === card.offerId).length;
    const sameShape = picked.some(item => item.offerId === card.offerId && item.archetype === card.archetype);
    const othersLeft = eligible.some(item => !picked.includes(item) && item !== card && item.offerId !== card.offerId);
    if ((sameOffer >= 2 || sameShape) && othersLeft) continue;
    picked.push(card);
  }
  const watch = [...eligible.filter(card => !picked.includes(card)), ...run.cards.filter(card => card.decision === 'defer')]
    .sort((a, b) => b.score.mid - a.score.mid).slice(0, 6);
  run.portfolio = {
    recommended: picked.map(card => card.id), watchlist: watch.map(card => card.id),
    rejected: run.cards.filter(card => card.decision === 'reject').map(card => card.id),
    noRecommendation: picked.length ? null : {
      reason: 'No hypothesis cleared the evidence, verification and red-team gates. This is a valid outcome, not a failure.',
      gapClosure: [...new Set(run.cards.flatMap(card => card.evidenceNeeds).slice(0, 8))],
    },
    stability: run.sensitivity,
    decidedAt: nowIso(),
  };
  // Why not the others (per offer) — PRD §17.6.
  run.portfolio.whyNot = run.profile.offers.map(offer => {
    const cards = run.cards.filter(card => card.offerId === offer.id);
    const best = cards.filter(card => picked.includes(card));
    return {offer: offer.name, recommended: best.map(card => card.id),
      summary: best.length ? `${best.length} hypothesis recommended for testing` :
        cards.length ? 'Not prioritised: ' + [...new Set(cards.map(card => card.decisionReason))].slice(0, 2).join('; ') : 'No segments researched'};
  });
  // Anti-ICPs: hard rejections, disqualifiers and boundary examples across the winners.
  run.antiIcps = [
    ...run.cards.filter(card => card.decision === 'reject').map(card => ({type: 'rejected_segment', offer: card.offer, text: card.segment, reason: card.decisionReason})),
    ...picked.flatMap(card => card.disqualifiers.map(text => ({type: 'disqualifier', offer: card.offer, icpId: card.id, text}))),
    ...picked.flatMap(card => card.boundaryExamples.map(text => ({type: 'boundary_example', offer: card.offer, icpId: card.id, text}))),
  ];

  // Validation sprint + lead brief for recommended ICPs; gap-closure plans for the best watchlist items when none passed.
  const planFor = picked.length ? picked : watch.slice(0, 2);
  const designed = planFor.length ? await ctx.model('designer', {
    task: 'Design a validation sprint and lead-intelligence brief for each segment.',
    payload: {business: run.profile.summary, segments: planFor.map(card => ({segmentId: card.segmentId, offer: card.offer, definition: card.definition,
      hypothesis: card.hypothesis, buyer: card.buyer, user: card.user, structuralFit: card.structuralFit, disqualifiers: card.disqualifiers,
      unknowns: card.evidenceNeeds, strongestObjection: card.redTeam?.strongestAgainst ?? '', searchTerms: card.searchTerms}))},
  }) : null;
  run.experiments = [];
  for (const card of planFor) {
    const plan = designed?.plans?.find(item => item.segmentId === card.segmentId) ?? templatePlan(card);
    card.leadBrief = {...templatePlan(card).leadBrief, ...plan.leadBrief};
    plan.experiments.forEach((experiment, index) => run.experiments.push({
      id: `X-${card.segmentId}-${index + 1}`, icpId: card.id, offer: card.offer, segment: card.segment, ...experiment,
      purpose: picked.includes(card) ? 'validation' : 'gap_closure', status: 'planned', registeredAt: nowIso(), results: [],
      preRegistered: true,
    }));
    card.nextBestTest = plan.experiments[0]?.type ?? 'problem_interviews';
    card.costToValidate = 'unknown — depends on recruiting access; owner to estimate';
  }
  for (const card of run.cards) card.nextBestTest ??= card.decision === 'reject' ? 'none' : 'primary research to close evidence gaps';
  ctx.log('S10', picked.length
    ? `Recommended ${picked.length}: ${picked.map(card => `${card.id} (${card.decision.replace('_', ' ')}, ${card.score.low}–${card.score.high}, grade ${card.score.grade})`).join(' · ')}`
    : 'No ICP recommended — evidence did not clear the gates. Gap-closure research plan attached.');
  ctx.log('S10', `${run.experiments.length} pre-registered experiments · ${run.antiIcps.length} anti-ICP rules · watchlist ${watch.length}`);
}
