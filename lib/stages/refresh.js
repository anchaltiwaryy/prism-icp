/** Refresh / delta mode (PRD §4.3, F19): re-check prior sources, re-extract only what changed, report the delta. */
import { addSource } from '../evidence.js';

export async function r1Recheck(ctx) {
  const {run, budget} = ctx;
  const parent = ctx.parent;
  const status = {unchanged: 0, changed: 0, unavailable: 0};
  run.sources = [];
  run.claims = [];
  const idMap = new Map();
  for (const old of parent.sources) {
    ctx.checkControl();
    if (!budget.can('page')) { status.unavailable++; ctx.gap(old.url, 'Refresh page budget exhausted'); continue; }
    budget.page();
    const result = await ctx.net.crawlPage(old.url, {browser: old.adapter?.startsWith('playwright')});
    if (result.status !== 'collected') {
      status.unavailable++;
      ctx.gap(old.url, 'Refresh: ' + result.reason);
      continue;
    }
    const meta = {adapter: old.adapter, origin: old.origin, queryId: old.queryId, query: old.query, segmentId: old.segmentId,
      offerId: old.offerId, angle: old.angle, direction: old.direction};
    const added = addSource(run, result.page, meta);
    if (added.status !== 'added') continue;
    idMap.set(old.id, added.source.id);
    if (result.page.contentHash === old.contentHash) {
      status.unchanged++;
      added.source.extracted = true;
      added.source.refresh = 'unchanged';
      for (const claim of parent.claims.filter(item => item.sourceId === old.id)) {
        run.claims.push({...claim, id: 'C' + String(run.claims.length + 1).padStart(4, '0'), parentClaimId: claim.id,
          sourceId: added.source.id, family: added.source.family, refresh: 'unchanged'});
      }
    } else {
      status.changed++;
      added.source.refresh = 'changed';
    }
  }
  run.refreshStats = {...status, staleClaims: parent.claims.filter(claim => !idMap.has(claim.sourceId)).map(claim => claim.id)};
  ctx.log('R1', `Re-checked ${parent.sources.length} sources: ${status.unchanged} unchanged, ${status.changed} changed (re-extracting), ` +
    `${status.unavailable} unavailable · ${run.refreshStats.staleClaims.length} prior claims now stale`);
}

export async function r2Carry(ctx) {
  const {run, parent} = ctx;
  run.cards = parent.cards.map(card => ({...card, score: undefined, decision: undefined, gates: undefined, preliminary: card.preliminary,
    redTeam: card.redTeam ?? {status: 'not_reviewed', tests: []}, review: {status: 'pending'}, previous: {decision: card.decision,
      low: card.score?.low, high: card.score?.high, grade: card.score?.grade}}));
  run.alternatives = parent.alternatives ?? [];
  run.marketSize = parent.marketSize;
  ctx.log('R2', `Carried ${run.cards.length} hypothesis cards and their red-team reviews from run ${parent.id.slice(0, 8)}`);
}

export async function r3Delta(ctx) {
  const {run, parent} = ctx;
  const claimsNew = run.claims.filter(claim => !claim.parentClaimId).length;
  const changes = run.cards.map(card => ({id: card.id, segment: card.segment, before: card.previous?.decision ?? null, after: card.decision,
    scoreBefore: card.previous ? `${card.previous.low}–${card.previous.high}` : null, scoreAfter: `${card.score.low}–${card.score.high}`,
    gradeBefore: card.previous?.grade ?? null, gradeAfter: card.score.grade}))
    .filter(change => change.before !== change.after || change.scoreBefore !== change.scoreAfter || change.gradeBefore !== change.gradeAfter);
  const before = parent.portfolio?.recommended ?? [];
  const after = run.portfolio?.recommended ?? [];
  run.delta = {
    parentRunId: parent.id, claims: {new: claimsNew, unchanged: run.claims.length - claimsNew, stale: run.refreshStats.staleClaims.length},
    sources: run.refreshStats, cardChanges: changes,
    recommendations: {added: after.filter(id => !before.includes(id)), removed: before.filter(id => !after.includes(id)), kept: after.filter(id => before.includes(id))},
  };
  ctx.log('R3', `Delta: ${changes.length} hypotheses changed · recommendations +${run.delta.recommendations.added.length} / -${run.delta.recommendations.removed.length}`);
}
