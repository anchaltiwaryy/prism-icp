/**
 * Seed ./data with an offline demo run (fixture web + fixture model), an accepted ICP, a running field
 * test and two sample accounts, so the dashboard can be explored without network or API keys.
 *   node scripts/seed-demo.mjs
 */
import { DEFAULT_STRATEGY } from '../lib/scoring.js';
import { createRun, executeRun } from '../lib/pipeline.js';
import { experimentAction, reviewIcp } from '../lib/review.js';
import { qualify, transition } from '../lib/gtm/accounts.js';
import { updateCollection } from '../lib/store.js';
import { extractPage } from '../lib/crawler.js';
import { llm, net } from '../fixtures/test-world.js';
import { nowIso, shortHash } from '../lib/util.js';

const run = await executeRun(createRun({name: 'Acme Secure (demo)', offer: 'API Scanner', problem: 'find API vulnerabilities',
  website: 'https://acme.test/', model: 'b2b', budgets: {maxSearches: 4, maxPages: 20}}), {llm, net, strategy: DEFAULT_STRATEGY, keepBrowser: true});
await reviewIcp(run.id, 'ICP-G01', {action: 'accept', actor: 'human:Demo Reviewer', note: 'Worth a field test'});
const experiment = run.experiments.find(item => item.icpId === 'ICP-G01');
await experimentAction(run.id, experiment.id, {action: 'start', actor: 'human:Demo Reviewer'});
await experimentAction(run.id, experiment.id, {action: 'log', actor: 'human:Demo Reviewer', result: 'positive', note: 'Interview 1: API incident last quarter; CTO owns the budget.'});

const card = (await import('../lib/store.js')).getRun(run.id).then(r => r.cards.find(c => c.id === 'ICP-G01'));
const icp = await card;
const pages = [
  ['companya.example', '<title>Company A</title><main>Company A is a SaaS platform for logistics teams. Today we launched our new web app, available to all customers. Our public REST API lets partners sync shipments.</main>'],
  ['internal-tools.example', '<title>Internal Tools Co</title><main>Internal Tools Co builds on-premise software for factory floors. We do not offer any public API or web application.</main>'],
];
const accounts = pages.map(([domain, html]) => {
  const page = extractPage(html, new URL('https://' + domain + '/'), 'fixture');
  const isA = domain.startsWith('companya');
  const fit = qualify(icp, page, {
    criteria: [{criterion: 'Publishes a public API', status: isA ? 'met' : 'not_met', quote: isA ? 'Our public REST API lets partners sync shipments' : 'We do not offer any public API or web application'},
      {criterion: 'Has a security or engineering team', status: 'unknown', quote: ''}],
    disqualifiers: [{disqualifier: 'No public API', status: isA ? 'absent' : 'present', quote: isA ? '' : 'We do not offer any public API or web application'}],
    signals: isA ? [{type: 'product_launch', statement: 'Launched a new web app', quote: 'Today we launched our new web app'}] : [],
    structuralFit: isA ? 'likely' : 'unlikely', hook: '',
  });
  const account = {id: 'AC-' + shortHash(domain), runId: run.id, icpId: 'ICP-G01', offer: icp.offer, segment: icp.segment, name: page.title, domain,
    url: page.url, whatTheyDo: page.excerpt.slice(0, 120), hook: fit.claims[0]?.quote ?? '', buyerRole: icp.buyer,
    discovery: {query: 'demo fixture', at: nowIso(), method: 'fixture'}, page: {title: page.title, observed: page.observed, contentHash: page.contentHash, excerpt: page.excerpt},
    fit, state: 'DISCOVERED', events: [{at: nowIso(), from: null, to: 'DISCOVERED', actor: 'system:demo', note: ''}], model: 'fixture', createdAt: nowIso(), updatedAt: nowIso()};
  transition(account, 'SCREENED', 'system:qualification');
  if (fit.structuralFit === 'unlikely') transition(account, 'DISQUALIFIED', 'system:qualification', 'Disqualifier present: No public API');
  else { transition(account, 'QUALIFIED', 'system:qualification'); transition(account, 'HUMAN_REVIEW', 'system:qualification', 'Awaiting human approval'); }
  return account;
});
await updateCollection('accounts', list => [...list.filter(item => !accounts.some(a => a.id === item.id)), ...accounts]);
console.log('Seeded demo run', run.id, '·', run.cards.length, 'hypotheses ·', run.portfolio.recommended.length, 'recommended ·', accounts.length, 'accounts');
