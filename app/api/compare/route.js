import { handle } from '../../../lib/api.js';
import { getRun } from '../../../lib/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const key = card => (card.offer + '|' + card.segment).toLowerCase();

/** Compare two runs side by side (PRD §4.3 compare mode): matched hypotheses, decision and score changes. */
export async function GET(request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const [a, b] = await Promise.all([getRun(params.get('a')), getRun(params.get('b'))]);
    if (!a || !b) throw Object.assign(new Error('Choose two existing runs'), {status: 404});
    const left = new Map((a.cards ?? []).map(card => [key(card), card]));
    const right = new Map((b.cards ?? []).map(card => [key(card), card]));
    const rows = [...new Set([...left.keys(), ...right.keys()])].map(k => {
      const x = left.get(k), y = right.get(k);
      const card = x ?? y;
      return {offer: card.offer, segment: card.segment,
        a: x ? {id: x.id, decision: x.decision, low: x.score?.low, high: x.score?.high, grade: x.score?.grade, recommended: a.portfolio?.recommended?.includes(x.id)} : null,
        b: y ? {id: y.id, decision: y.decision, low: y.score?.low, high: y.score?.high, grade: y.score?.grade, recommended: b.portfolio?.recommended?.includes(y.id)} : null};
    }).sort((p, q) => p.offer.localeCompare(q.offer));
    const meta = run => ({id: run.id, name: run.brief.name, mode: run.policy.mode, createdAt: run.createdAt, sources: run.sources.length,
      claims: run.claims.length, recommended: run.portfolio?.recommended?.length ?? 0, strategy: run.strategyVersion, model: run.llm});
    return {a: meta(a), b: meta(b), rows};
  });
}
