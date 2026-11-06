import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.PRISM_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'prism-test-'));

const { createRun, executeRun } = await import('../lib/pipeline.js');
const { fixtureLLM } = await import('../lib/llm.js');
const { DEFAULT_STRATEGY } = await import('../lib/scoring.js');
const { memo, exporters } = await import('../lib/reports.js');
const fx = await import('../fixtures/test-world.js');

const brief = {name: 'Acme Secure', offer: 'API Scanner', problem: 'find API vulnerabilities', website: 'https://acme.test/',
  model: 'b2b', mode: 'discovery', budgets: {maxSearches: 4, maxPages: 20}};

async function runWith(llm = fx.llm, input = brief) {
  const run = createRun(input);
  return executeRun(run, {llm, net: fx.net, strategy: DEFAULT_STRATEGY, keepBrowser: true});
}

const decisions = run => run.cards.map(card => [card.id, card.decision, card.score.low, card.score.high, card.score.grade]);

test('end-to-end: separates evidence, red-teams, verifies and recommends with uncertainty', async () => {
  const run = await runWith();
  assert.equal(run.status, 'awaiting_review', run.error ?? '');
  for (const id of ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']) assert.equal(run.stages[id].status, 'done', id);
  const g01 = run.cards.find(card => card.segmentId === 'G01');
  assert.equal(g01.segment, 'SaaS teams with public APIs');
  assert.equal(g01.score.grade, 'A', 'two independent families incl. a .gov source');
  assert.ok(g01.score.low < g01.score.high, 'score is a range, not a point');
  assert.equal(g01.buyingIntent, 'not_observed');
  assert.equal(g01.commercialValidation, 'not_tested');
  assert.deepEqual(run.portfolio.recommended, ['ICP-G01']);
  assert.equal(g01.decision, 'conditional_test');
  assert.ok(run.experiments.some(item => item.icpId === 'ICP-G01' && item.preRegistered));
  assert.ok(memo(run).includes('Commercial validation needs field outcomes'));
  assert.ok(exporters.claims(run).body.startsWith('id,segmentId'));
});

test('F05 policy-forbidden domains are never fetched', async () => {
  fx.fetchLog.length = 0;
  const run = await runWith();
  assert.ok(!fx.fetchLog.some(url => url.includes('linkedin.com')));
  assert.ok(run.sourceGaps.some(gap => gap.url.includes('linkedin.com')));
});

test('F06 fabricated quotes are rejected; F04/§3.5 syndicated copies count once', async () => {
  const run = await runWith();
  assert.ok(run.rejectedExtractions.some(item => item.quote.includes('300% ROI') && item.reason === 'quote not found in source'));
  assert.ok(!run.claims.some(claim => claim.quote.includes('300% ROI')));
  const copies = run.sources.filter(source => source.title.startsWith('Survey: API incidents'));
  assert.equal(copies.length, 1, 'exact duplicate content is not retained twice');
  for (const claim of run.claims) assert.ok(run.sources.find(source => source.id === claim.sourceId).excerpt.toLowerCase().includes(claim.quote.toLowerCase().slice(0, 30)));
});

test('S1 separates declared, observed and inferred facts; unquoted "observed" facts are downgraded', async () => {
  const run = await runWith();
  const facts = run.profile.facts;
  assert.ok(facts.some(fact => fact.origin === 'user_declared'));
  assert.ok(facts.some(fact => fact.origin === 'publicly_observed' && fact.quote === 'billed per API under test'));
  const invented = facts.find(fact => fact.statement.includes('500 enterprise'));
  assert.equal(invented.origin, 'agent_inferred');
});

test('F07 similar names are not merged without a shared domain', async () => {
  const run = await runWith();
  const acme = run.organizations.filter(org => org.aliases.includes('Acme Secure'));
  assert.equal(acme.length, 2, 'acme.test and acme-secure.example stay separate');
  assert.ok(run.ambiguities.some(item => item.name === 'Acme'));
});

test('F12 verified hard exclusion rejects; F11 market size is never invented', async () => {
  const run = await runWith();
  const g02 = run.cards.find(card => card.segmentId === 'G02');
  assert.equal(g02.decision, 'reject');
  assert.match(g02.decisionReason, /prohibited/);
  assert.equal(run.marketSize.status, 'insufficient_data');
  assert.ok(run.antiIcps.some(item => item.type === 'rejected_segment' && item.text.includes('Foreign')));
});

test('F13/F14 no evidence defers rather than rejects, and zero recommendations is a valid result', async () => {
  const silentNet = {...fx.net, discover: async () => ({adapter: null, results: [], errors: ['offline']}), crawlPage: async url => ({status: 'skipped', reason: 'offline', url})};
  const run = executeRun(createRun(brief), {llm: fx.llm, net: silentNet, strategy: DEFAULT_STRATEGY, keepBrowser: true});
  const done = await run;
  assert.equal(done.status, 'awaiting_review');
  assert.deepEqual(done.portfolio.recommended, []);
  assert.ok(done.portfolio.noRecommendation.reason.includes('valid outcome'));
  assert.ok(done.cards.every(card => card.decision === 'defer'));
});

test('red-team "fail" without a checkable citation is downgraded to concern', async () => {
  const run = await runWith();
  const g01 = run.cards.find(card => card.segmentId === 'G01');
  const substitution = g01.redTeam.tests.find(item => item.id === 'substitution');
  assert.equal(substitution.result, 'concern');
  assert.equal(g01.redTeam.tests.length, 15);
});

test('F15 same frozen inputs and fixtures give the same decisions', async () => {
  const a = await runWith();
  const b = await runWith();
  assert.deepEqual(decisions(a), decisions(b));
  assert.deepEqual(a.portfolio.recommended, b.portfolio.recommended);
});

test('no model configured: research still runs, nothing is verified, nothing is recommended', async () => {
  const none = {provider: 'none', model: null, available: false, describe: () => 'no model configured', json: async () => ({error: 'none'})};
  const run = await runWith(none);
  assert.equal(run.status, 'awaiting_review');
  assert.deepEqual(run.portfolio.recommended, []);
  assert.ok(run.claims.every(claim => claim.analyst === 'keyword-heuristic' && !['verified', 'corroborated'].includes(claim.epistemic)));
});

test('F18 cancel stops a run between stages', async () => {
  const { controlRun } = await import('../lib/pipeline.js');
  const slowLLM = fixtureLLM(async (role, payload, request) => { await new Promise(resolve => setTimeout(resolve, 30)); return fx.llm.json(role, request).then(r => r.data); });
  const run = createRun(brief);
  const pending = executeRun(run, {llm: slowLLM, net: fx.net, strategy: DEFAULT_STRATEGY, keepBrowser: true});
  await new Promise(resolve => setTimeout(resolve, 20));
  await controlRun(run.id, 'cancel');
  const done = await pending;
  assert.equal(done.status, 'cancelled');
});

test('F02 quick mode keeps every offer and searches both sides from the first queries', async () => {
  const offers = ['API Scanner', 'Training', 'Audits', 'Labs', 'Advisory', 'Events'].map(name => ({name, problem: name.toLowerCase() + ' problem'}));
  const run = await runWith(fx.llm, {...brief, mode: 'quick', offers});
  for (const offer of run.profile.offers) assert.ok(run.segments.some(segment => segment.offerId === offer.id), offer.name + ' was dropped');
  const firstEight = run.searchPlan.slice(0, 8);
  assert.ok(firstEight.filter(item => item.direction !== 'support').length >= 3, 'disconfirming queries are scheduled early');
});
