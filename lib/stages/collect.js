/** S4 collection with provenance and S5 extraction + entity resolution (PRD §7 S4–S5). */
import { addSource, admitClaims, resolveEntities } from '../evidence.js';
import { domainAllowed } from '../policy.js';
import { ANGLES } from '../taxonomy.js';
import { normalizeText, rootDomain } from '../util.js';

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|youtube|pinterest)\./;
const STOP = new Set(('the and for with from that this are was were have has into your their our about what which who when where how why not ' +
  'but can will all any per via its than then them they you use used using team teams company companies organization organizations ' +
  'problem problems challenges pain points alternatives free tools pricing cost budget unknown build run find get make').split(' '));
export const topicWords = text => [...new Set(String(text ?? '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) ?? [])].filter(word => !STOP.has(word));
const overlap = (text, words) => { const lower = String(text ?? '').toLowerCase(); return words.filter(word => lower.includes(word)).length; };

export async function s4Collect(ctx) {
  const {run, budget} = ctx;
  const {policy} = run;
  const visited = new Set(run.sources.map(source => source.url));

  // Curated reference pages from the brief (public standards, industry bodies).
  for (const url of run.brief.referenceUrls ?? []) {
    if (visited.has(url) || !budget.can('page') || !domainAllowed(policy, url)) continue;
    budget.page();
    const result = await ctx.net.crawlPage(url);
    if (result.status === 'collected') { addSource(run, result.page, {adapter: 'reference-pages', origin: 'reference', segmentId: 'general'}); visited.add(url); }
    else ctx.gap(url, result.reason);
  }

  let lastSave = Date.now();
  for (const item of run.searchPlan.filter(entry => entry.status === 'planned')) {
    ctx.checkControl();
    if (!budget.can('search') || !budget.can('page')) {
      item.status = 'deferred'; item.reason = budget.exhausted().join(', ') || 'budget';
      continue;
    }
    budget.search();
    const found = await ctx.net.discover(item.query, {adapters: policy.adapters});
    item.adapter = found.adapter;
    item.errors = found.errors;
    item.results = found.results.slice(0, 8).map(result => ({url: result.url, title: result.title?.slice(0, 160) ?? '', snippet: result.snippet?.slice(0, 240) ?? ''}));
    const words = topicWords(item.topic ?? item.query);
    const need = words.length >= 4 ? 2 : Math.min(1, words.length);
    const candidates = item.results.filter(result => {
      if (visited.has(result.url)) return false;
      if (!domainAllowed(policy, result.url) || SEARCH_HOSTS.test(new URL(result.url).hostname)) {
        ctx.gap(result.url, 'Forbidden or search-engine domain (policy)');
        return false;
      }
      // Cheap pre-filter on the listing itself: a result sharing no topic word is not worth a fetch.
      if (result.snippet && words.length && !overlap(result.title + ' ' + result.snippet, words)) {
        ctx.gap(result.url, 'Off-topic search result (relevance filter)');
        return false;
      }
      return true;
    }).slice(0, policy.limits.resultsPerSearch);
    const fetched = await Promise.all(candidates.map(result => {
      if (!budget.can('page')) return null;
      budget.page(); visited.add(result.url);
      return ctx.net.crawlPage(result.url);
    }));
    let kept = 0;
    fetched.forEach((result, index) => {
      if (!result) return;
      if (result.status !== 'collected') { ctx.gap(candidates[index].url, result.reason); return; }
      const text = result.page.title + ' ' + result.page.excerpt.slice(0, 8000);
      let segmentId = item.segmentId;
      if (overlap(text, words) < need) {
        // Off-topic for this query, but it may fit another segment — re-home it rather than waste the fetch.
        const best = run.searchPlan.filter(other => other.segmentId !== 'general' && other.topic)
          .map(other => ({id: other.segmentId, words: topicWords(other.topic)}))
          .map(other => ({...other, score: overlap(text, other.words), need: other.words.length >= 4 ? 2 : 1}))
          .filter(other => other.score >= other.need).sort((a, b) => b.score - a.score)[0];
        if (!best) { ctx.gap(result.page.url, `Off-topic page (relevance filter: fewer than ${need} topic words)`); return; }
        segmentId = best.id;
      }
      const added = addSource(run, result.page, {adapter: item.adapter, origin: 'search', queryId: item.id, query: item.query,
        segmentId, offerId: item.offerId ?? run.segments.find(segment => segment.id === segmentId)?.offerId ?? null,
        angle: item.angle, direction: item.direction});
      if (added.status === 'added') kept++;
    });
    item.status = item.results.length ? 'searched' : 'no_results';
    item.retained = kept;
    const cell = run.coverage.find(entry => entry.segmentId === item.segmentId && entry.angle === item.angle);
    if (cell && cell.status !== 'searched') { cell.status = kept ? 'searched' : 'searched_no_evidence'; cell.reason = kept ? '' : (found.errors[0] ?? 'No retained page'); }
    if (Date.now() - lastSave > 3000) { await ctx.save(); lastSave = Date.now(); }
  }
  for (const cell of run.coverage) if (cell.status === 'planned') { cell.status = 'deferred'; cell.reason = budget.exhausted().join(', ') || 'Budget'; }
  const searched = run.searchPlan.filter(item => ['searched', 'no_results'].includes(item.status)).length;
  const families = new Set(run.sources.map(source => source.family)).size;
  ctx.log('S4', `${searched} searches run · ${run.sources.length} pages retained from ${new Set(run.sources.map(s => s.domain)).size} domains · ` +
    `${families} independent origin families · ${run.sourceGaps?.length ?? 0} skipped or blocked`);
}

// ---------------------------------------------------------------- S5
function windowFor(source, terms) {
  // Give the model the most relevant 3,500 characters rather than only the page header.
  const text = source.excerpt;
  if (text.length <= 3500) return text;
  const lower = text.toLowerCase();
  let best = 0, bestScore = -1;
  for (let start = 0; start < text.length - 3500; start += 700) {
    const chunk = lower.slice(start, start + 3500);
    const score = terms.reduce((sum, term) => sum + (term && chunk.includes(term) ? 1 : 0), 0);
    if (score > bestScore) { best = start; bestScore = score; }
  }
  return (best ? '… ' : '') + text.slice(best, best + 3500);
}

/** Without a model: keyword-matched sentences become unreviewed observations that can never be verified. */
function heuristicClaims(run) {
  const claims = [];
  for (const source of run.sources) {
    const segment = run.segments.find(item => item.id === source.segmentId);
    if (!segment || !source.angle) continue;
    const words = [...ANGLES[source.angle].pro, ...ANGLES[source.angle].anti, ...segment.searchTerms].map(term => term.toLowerCase());
    const sentences = normalizeText(source.excerpt).split(/(?<=[.!?])\s+/).filter(sentence => sentence.length > 50 && sentence.length < 300);
    for (const sentence of sentences.filter(text => words.some(word => text.toLowerCase().includes(word))).slice(0, 2)) {
      claims.push({sourceId: source.id, segmentId: segment.id, angle: source.angle, direction: source.direction === 'support' ? 'support' : 'challenge',
        statement: 'Keyword match (unreviewed): ' + sentence.slice(0, 160), quote: sentence, interestedParty: source.interestedParty, signalType: 'none'});
    }
  }
  return claims;
}

export async function s5Extract(ctx) {
  const {run} = ctx;
  const segmentList = run.segments.map(({id, offer, name, job, buyer, searchTerms}) => ({id, offer, name, job, buyer, searchTerms}));
  const pending = run.sources.filter(source => !source.extracted);
  const batches = [];
  for (let i = 0; i < pending.length; i += 6) batches.push(pending.slice(i, i + 6));
  let modelUsed = false;
  for (const batch of batches) {
    ctx.checkControl();
    const terms = [...new Set(batch.flatMap(source => run.segments.find(item => item.id === source.segmentId)?.searchTerms ?? []))].map(term => term.toLowerCase());
    const result = await ctx.model('extractor', {
      task: 'Extract claims and organizations. Each quote must be an exact substring of that source\'s text.',
      payload: {segments: segmentList, sources: batch.map(source => ({sourceId: source.id, url: source.url, title: source.title,
        host: source.host, isBusinessOwnSite: source.adapter === 'official-site', foundFor: source.segmentId ?? 'general',
        angle: source.angle ?? null, published: source.published, text: windowFor(source, terms)}))},
    });
    if (!result) continue;
    modelUsed = true;
    const admitted = admitClaims(run, result.claims, {analyst: 'extractor:' + ctx.llm.describe()});
    resolveEntities(run, result.organizations);
    for (const source of batch) source.extracted = true;
    ctx.log('S5', `Batch of ${batch.length} sources → ${admitted} claims admitted, ${(result.claims?.length ?? 0) - admitted} rejected or duplicate`);
    await ctx.save();
  }
  if (!modelUsed && run.sources.length) {
    admitClaims(run, heuristicClaims(run), {analyst: 'keyword-heuristic'});
    for (const claim of run.claims) if (claim.analyst === 'keyword-heuristic') claim.epistemic = 'observed';
    for (const source of run.sources) source.extracted = true;
  }
  // Organizations discovered on official pages are the business's own examples; keep the domain linkage visible.
  for (const org of run.organizations ?? []) org.isBusinessItself = org.domain && org.domain === run.profile.domain;
  const rejected = run.rejectedExtractions?.length ?? 0;
  ctx.log('S5', `${run.claims.length} claims in ledger (${rejected} extractions rejected: quote not found or unknown segment) · ` +
    `${run.organizations?.length ?? 0} organizations resolved, ${run.ambiguities?.length ?? 0} ambiguous names held back` +
    (modelUsed ? '' : ' · no model: keyword observations only, cannot be verified'));
  if (run.profile.domain) {
    const own = run.sources.filter(source => rootDomain(source.url) === run.profile.domain).length;
    if (own) ctx.log('S5', `${own} sources are the business's own pages — treated as interested-party evidence`);
  }
}
