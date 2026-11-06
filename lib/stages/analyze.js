/** S6 hypothesis construction and S7 competition / substitutes / economics (PRD §7 S6–S7). */
import { scoreSegment } from '../scoring.js';

export const claimsFor = (run, segment) => (run.claims ?? []).filter(claim =>
  claim.segmentId === segment.id || (claim.segmentId === 'general' &&
    (run.sources.find(source => source.id === claim.sourceId)?.offerId ?? segment.offerId) === segment.offerId));

const compactClaim = claim => ({id: claim.id, angle: claim.angle, direction: claim.direction, statement: claim.statement,
  quote: claim.quote.slice(0, 220), interestedParty: claim.interestedParty, signalType: claim.signalType});

function baseCard(run, segment) {
  return {
    id: 'ICP-' + segment.id, segmentId: segment.id, offerId: segment.offerId, offer: segment.offer, segment: segment.name,
    archetype: segment.archetype, motion: segment.motion, user: segment.user, buyer: segment.buyer, influencers: segment.influencers,
    geography: run.profile.geographies.join(', '), job: segment.job, trigger: segment.trigger || 'unknown',
    definition: segment.name, hypothesis: `${segment.name} experience "${segment.job}" often enough, and a ${segment.buyer} can fund ${segment.offer}. ` +
      'Disproved if buyers report no recent instance, an adequate free or in-house alternative, or no budget owner.',
    structuralFit: [], disqualifiers: segment.disqualifiers?.length ? segment.disqualifiers : ['No eligible use case', 'Outside delivery scope'],
    boundaryExamples: [], buyingGroup: {user: segment.user, champion: 'to verify', economicBuyer: segment.buyer, influencers: segment.influencers ?? [], gates: []},
    economics: 'unknown — no sourced price, budget or contract-size evidence', channels: [], positioning: '',
    evidenceNeeds: ['Recent concrete instances of the problem', 'Who owns the budget', 'Current alternatives and switching cost'],
    supportingClaimIds: [], counterClaimIds: [], antiSignals: segment.antiSignals ?? [], searchTerms: segment.searchTerms ?? [],
    buyingIntent: 'not_observed', commercialValidation: 'not_tested', marketSize: {status: 'insufficient_data'},
    maturity: 'candidate', review: {status: 'pending'}, analyst: null,
  };
}

export async function s6Hypotheses(ctx) {
  const {run} = ctx;
  run.cards = run.segments.map(segment => baseCard(run, segment));
  run.alternatives = [];
  for (const offer of run.profile.offers) {
    ctx.checkControl();
    const segments = run.segments.filter(segment => segment.offerId === offer.id);
    if (!segments.length) continue;
    const result = await ctx.model('analyst', {
      task: `Write ICP hypothesis cards for every segment of the offer "${offer.name}" and an alternatives matrix for that offer.`,
      payload: {business: run.profile.summary, offer: {name: offer.name, problem: offer.problem, userJob: offer.userJob,
        buyerJob: offer.buyerJob, promisedOutcome: offer.promisedOutcome},
      segments: segments.map(segment => ({segmentId: segment.id, name: segment.name, archetype: segment.archetype, motion: segment.motion,
        user: segment.user, buyer: segment.buyer, job: segment.job, trigger: segment.trigger, disqualifiers: segment.disqualifiers,
        claims: claimsFor(run, segment).slice(0, 40).map(compactClaim)}))},
      maxTokens: 20000,
    });
    for (const draft of result?.cards ?? []) {
      const card = run.cards.find(item => item.segmentId === draft.segmentId && item.offerId === offer.id);
      if (!card) continue;
      const known = new Set(claimsFor(run, segments.find(segment => segment.id === card.segmentId)).map(claim => claim.id));
      Object.assign(card, {
        definition: draft.definition || card.definition, hypothesis: draft.hypothesis || card.hypothesis, job: draft.job || card.job,
        trigger: draft.trigger || card.trigger, structuralFit: draft.structuralFit ?? [],
        disqualifiers: draft.disqualifiers?.length ? draft.disqualifiers : card.disqualifiers, boundaryExamples: draft.boundaryExamples ?? [],
        buyingGroup: draft.buyingGroup ?? card.buyingGroup, economics: draft.economics || card.economics, channels: draft.channels ?? [],
        positioning: draft.positioning ?? '', evidenceNeeds: draft.evidenceNeeds?.length ? draft.evidenceNeeds : card.evidenceNeeds,
        // Cited ids must exist in this segment's ledger; anything else is dropped rather than trusted.
        supportingClaimIds: (draft.supportingClaimIds ?? []).filter(id => known.has(id)),
        counterClaimIds: (draft.counterClaimIds ?? []).filter(id => known.has(id)),
        analyst: ctx.llm.describe(),
      });
      card.buyer = card.buyingGroup.economicBuyer || card.buyer;
    }
    for (const alternative of result?.alternatives ?? []) run.alternatives.push({...alternative, offerId: offer.id, offer: offer.name});
    if (result) ctx.log('S6', `${offer.name}: ${result.cards?.length ?? 0} hypothesis cards, ${result.alternatives?.length ?? 0} alternatives`);
  }
  // Gate: falsifiable hypothesis, explicit job, buying motion, evidence needs, disqualifiers.
  for (const card of run.cards) {
    // Human-approved learned disqualifiers from earlier outcomes (strategy negative rules).
    for (const rule of (ctx.strategy.negativeRules ?? []).filter(item => item.offer === card.offer || item.offer === 'any')) {
      if (!card.disqualifiers.includes(rule.text)) card.disqualifiers.push(rule.text);
    }
    card.gateIssues = [
      !/disprov|falsif|if .* (not|no)|unless/i.test(card.hypothesis) && 'Hypothesis does not say what would disprove it',
      !card.job && 'No customer job', (!card.motion || card.motion === 'to verify') && 'Buying motion undefined',
      !card.evidenceNeeds.length && 'No evidence needs', !card.disqualifiers.length && 'No disqualifying conditions',
    ].filter(Boolean);
    card.preliminary = scoreSegment(claimsFor(run, run.segments.find(segment => segment.id === card.segmentId)), ctx.strategy);
    card.maturity = run.sources.some(source => source.segmentId === card.segmentId) ? 'researched' : 'candidate';
  }
  ctx.log('S6', `${run.cards.length} hypothesis cards · ${run.cards.filter(card => card.gateIssues.length).length} with gate issues`);
}

export async function s7Competition(ctx) {
  const {run} = ctx;
  // Always-present non-obvious alternatives (PRD §7 S7) — the market is never only named competitors.
  for (const offer of run.profile.offers) {
    for (const [type, name] of [['in_house', 'Internal team does it'], ['status_quo', 'Keep current process / do nothing'],
      ['free_tool', 'Free or open-source tools'], ['non_consumption', 'Problem tolerated, no purchase']]) {
      if (!run.alternatives.some(item => item.offerId === offer.id && item.type === type)) {
        run.alternatives.push({name, type, offerId: offer.id, offer: offer.name, note: 'Default substitute category — check in interviews', claimIds: []});
      }
    }
  }
  // F11: no fabricated market size. PRISM only reports sourced, auditable inputs, and none are modelled here.
  run.marketSize = {status: 'insufficient_data', method: null,
    reason: 'No auditable, sourced count of qualifying organizations or spend was retained. PRISM does not estimate TAM/SAM/SOM from model knowledge.'};
  ctx.log('S7', `${run.alternatives.length} alternatives mapped across ${run.profile.offers.length} offers · market size: insufficient_data (not invented)`);
}
