import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.PRISM_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'prism-gtm-'));

const { qualify, transition, ApprovalRequired } = await import('../lib/gtm/accounts.js');
const { runQa } = await import('../lib/gtm/qa.js');
const { createRun, executeRun } = await import('../lib/pipeline.js');
const { reviewIcp, experimentAction, validateIcp } = await import('../lib/review.js');
const { decideProposal, evaluateStrategy, measure, recordOutcome } = await import('../lib/learning.js');
const { DEFAULT_STRATEGY } = await import('../lib/scoring.js');
const { updateCollection } = await import('../lib/store.js');
const fx = await import('../fixtures/test-world.js');

const xnolex = {offer: 'Xnolex', segment: 'SaaS with material web/API footprint', buyer: 'CTO or security leader',
  structuralFit: ['Operates a customer-facing web application', 'Has a dedicated security function', 'Subject to a security assessment requirement'],
  disqualifiers: ['No externally testable digital estate']};

test('§17.5 Company A: launch is weak timing, fit is only "possible", never an active VAPT buyer', () => {
  const page = {excerpt: 'Company A is a SaaS platform for logistics teams. Today we launched our new web app, available to all customers.'};
  const modelSays = {
    criteria: [
      {criterion: 'Operates a customer-facing web application', status: 'met', quote: 'Today we launched our new web app'},
      {criterion: 'Has a dedicated security function', status: 'met', quote: 'our world-class security team'}, // not on page
      {criterion: 'Subject to a security assessment requirement', status: 'unknown', quote: ''},
    ],
    disqualifiers: [{disqualifier: 'No externally testable digital estate', status: 'absent', quote: ''}],
    signals: [{type: 'product_launch', statement: 'Launched a web app', quote: 'Today we launched our new web app'}],
    structuralFit: 'likely', hook: '',
  };
  const fit = qualify(xnolex, page, modelSays);
  assert.equal(fit.structuralFit, 'possible');
  assert.equal(fit.criteria[1].status, 'unknown', 'unquoted "met" is downgraded to unknown');
  assert.equal(fit.signals[0].strength, 'weak_timing');
  assert.match(fit.signals[0].interpretation, /not evidence of purchase intent/);
  assert.equal(fit.buyingIntent, 'not_observed');
  assert.equal(fit.activeBuyer, false);
});

test('account state machine: approval is human-only and drafting needs approval', () => {
  const account = {name: 'Company A', state: 'DISCOVERED', events: []};
  assert.throws(() => transition(account, 'APPROVED', 'human:pat'), /not allowed/);
  for (const state of ['SCREENED', 'QUALIFIED', 'HUMAN_REVIEW']) transition(account, state, 'system:test');
  assert.throws(() => transition(account, 'APPROVED', 'system:auto'), ApprovalRequired);
  assert.throws(() => transition(account, 'DRAFTED', 'system:outreach'), ApprovalRequired);
  transition(account, 'APPROVED', 'human:pat');
  transition(account, 'DRAFTED', 'system:outreach');
  assert.equal(account.events.length, 5);
});

test('outreach QA blocks uncited facts, numbers in generated copy and hype', () => {
  const steps = [
    {step: 1, subject: 'Hello', lines: [
      {text: 'You grew 40% last year.', tag: 'GENERATED', claimIds: []},
      {text: 'Your team just launched a new app.', tag: 'ACCOUNT', claimIds: []},
      {text: 'We can supercharge your security?', tag: 'GENERATED', claimIds: []}]},
    {step: 2, subject: 'Hello', lines: [{text: 'Following up.', tag: 'GENERATED', claimIds: []}]},
  ];
  const qa = runQa(steps, {accountClaims: [], offerFacts: []});
  assert.equal(qa.pass, false);
  const failed = qa.checks.filter(check => !check.pass).map(check => check.check);
  assert.ok(failed.some(name => name.includes('account lines cite')));
  assert.ok(failed.some(name => name.includes('unsupported numbers')));
  assert.ok(failed.some(name => name.includes('filler')));
  assert.ok(failed.includes('Subjects distinct'));
  const good = runQa([{step: 1, subject: 'A question', lines: [
    {text: 'Your site says you launched a new web app.', tag: 'ACCOUNT', claimIds: ['AC1']},
    {text: 'Would a short call be useful?', tag: 'GENERATED', claimIds: []}]}], {accountClaims: [{id: 'AC1', verified: true}], offerFacts: []});
  assert.equal(good.pass, true, JSON.stringify(good.checks.filter(check => !check.pass)));
});

test('review, field test and commercial validation are human-gated and evidence-gated', async () => {
  const run = await executeRun(createRun({name: 'Acme Secure', offer: 'API Scanner', problem: 'find API vulnerabilities',
    website: 'https://acme.test/', budgets: {maxSearches: 4, maxPages: 20}}), {llm: fx.llm, net: fx.net, strategy: DEFAULT_STRATEGY, keepBrowser: true});
  await assert.rejects(reviewIcp(run.id, 'ICP-G01', {action: 'accept', actor: 'system:auto'}), /human reviewer/);
  await assert.rejects(reviewIcp(run.id, 'ICP-G03', {action: 'reject', actor: 'human:pat'}), /reason code/);
  await assert.rejects(validateIcp(run.id, 'ICP-G01', {actor: 'human:pat', note: 'looks good'}), /passed/);
  await reviewIcp(run.id, 'ICP-G01', {action: 'accept', actor: 'human:pat', note: 'worth testing'});
  const experiment = run.experiments.find(item => item.icpId === 'ICP-G01');
  await assert.rejects(experimentAction(run.id, experiment.id, {action: 'log', actor: 'human:pat', result: 'positive'}), /Start the experiment/);
  await experimentAction(run.id, experiment.id, {action: 'start', actor: 'human:pat'});
  await experimentAction(run.id, experiment.id, {action: 'log', actor: 'human:pat', result: 'positive', note: 'Recent incident, CTO owns budget'});
  await experimentAction(run.id, experiment.id, {action: 'close', actor: 'human:pat', verdict: 'passed', note: 'Met pre-registered criterion'});
  const card = await validateIcp(run.id, 'ICP-G01', {actor: 'human:pat', note: 'Three interviews passed; one pilot agreed'});
  assert.equal(card.maturity, 'commercially_validated');
  const metrics = await measure();
  assert.ok(metrics.outcomes >= 2);
  assert.equal(metrics.voy.validated, 1);
});

test('learning changes cannot deploy without a human and regressions stay in shadow', async () => {
  await updateCollection('learning', learning => {
    learning.proposals = [{id: 'LP-test', title: 'Test change', kind: 'band_threshold', change: {bands: {...DEFAULT_STRATEGY.bands, exploreMid: 80}},
      because: 'test', risk: 'test', status: 'shadow_failed', evaluation: {before: {}, after: {}, verdict: 'regression'}}];
  });
  await assert.rejects(decideProposal('LP-test', {action: 'approve', actor: 'system:auto'}), /human/);
  await assert.rejects(decideProposal('LP-test', {action: 'approve', actor: 'human:pat'}), /regressed/);
  const evaluation = await evaluateStrategy(DEFAULT_STRATEGY, DEFAULT_STRATEGY);
  assert.equal(evaluation.verdict, 'insufficient_labels');
  await recordOutcome({type: 'no_response', runId: 'x', icpId: 'y', actor: 'human:pat'});
  const metrics = await measure();
  assert.ok(metrics.outcomes >= 1);
});
