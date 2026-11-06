/**
 * Run a research brief from the command line with live public-web collection.
 *   node run-pilot.mjs                       FoxFoster six-offer pilot (discovery mode)
 *   node run-pilot.mjs --mode quick          cheaper orientation run
 *   node run-pilot.mjs --brief my-brief.json any brief with name, offer, problem, website…
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const { createRun, executeRun } = await import('./lib/pipeline.js');
const { saveRun } = await import('./lib/store.js');

const args = process.argv.slice(2);
const flag = name => { const index = args.indexOf('--' + name); return index >= 0 ? args[index + 1] : undefined; };
const briefPath = flag('brief');
const input = briefPath ? JSON.parse(await readFile(briefPath, 'utf8')) : {};
const pilot = briefPath ? null : JSON.parse(await readFile('foxfoster.json', 'utf8'));
const run = createRun({...input, mode: flag('mode') ?? input.mode ?? pilot?.mode, topCount: Number(flag('top') ?? 3)}, {pilot});
await saveRun(run);
console.log('RUN_ID=' + run.id);
let shown = 0;
const timer = setInterval(() => {
  for (const event of run.events.slice(shown)) console.log(`[${event.stage}] ${event.detail}`);
  shown = run.events.length;
}, 1000);
const done = await executeRun(run);
clearInterval(timer);
for (const event of done.events.slice(shown)) console.log(`[${event.stage}] ${event.detail}`);
console.log(`DONE status=${done.status} sources=${done.sources.length} claims=${done.claims.length} cards=${done.cards.length} ` +
  `recommended=${done.portfolio?.recommended?.length ?? 0} spend=$${done.spend?.usd ?? 0}`);
if (done.status === 'failed') process.exitCode = 1;
