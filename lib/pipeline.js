/**
 * Run controller (PRD §12.1, §12.3). The controller — not any model — owns stage order, checkpoints,
 * budgets, pause/cancel/resume and the per-stage audit contract. Stages are resumable: a completed
 * stage is skipped when a run resumes.
 */
import { closeBrowser, crawlPage, discover, newsSearch } from './crawler.js';
import { activeStrategy } from './learning.js';
import { createLLM } from './llm.js';
import { budget as makeBudget, buildPolicy } from './policy.js';
import { PROMPTS } from './prompts.js';
import { SCHEMAS } from './schemas.js';
import { getRun, saveRun } from './store.js';
import { s0Policy, s1Intake } from './stages/intake.js';
import { s2Universe, s3Plan } from './stages/explore.js';
import { s4Collect, s5Extract } from './stages/collect.js';
import { s6Hypotheses, s7Competition } from './stages/analyze.js';
import { s8RedTeam, s9VerifyScore } from './stages/challenge.js';
import { s10Portfolio } from './stages/decide.js';
import { r1Recheck, r2Carry, r3Delta } from './stages/refresh.js';
import { nowIso, sha, uuid } from './util.js';

export const STAGES = [
  ['S0', 'Policy & budgets', s0Policy], ['S1', 'Business understanding', s1Intake], ['S2', 'Market universe', s2Universe],
  ['S3', 'Source plan', s3Plan], ['S4', 'Collection', s4Collect], ['S5', 'Extraction & entities', s5Extract],
  ['S6', 'Hypotheses', s6Hypotheses], ['S7', 'Competition & economics', s7Competition], ['S8', 'Red team', s8RedTeam],
  ['S9', 'Verification & scoring', s9VerifyScore], ['S10', 'Portfolio & validation sprint', s10Portfolio],
];
export const REFRESH_STAGES = [
  ['S0', 'Policy & budgets', s0Policy], ['R1', 'Re-check sources', r1Recheck], ['S5', 'Extraction & entities', s5Extract],
  ['R2', 'Carry hypotheses', r2Carry], ['S9', 'Verification & scoring', s9VerifyScore], ['S10', 'Portfolio & validation sprint', s10Portfolio],
  ['R3', 'Delta report', r3Delta],
];
export const STAGE_LABELS = Object.fromEntries([...STAGES, ...REFRESH_STAGES, ['S11', 'Human review'], ['S12', 'Outcome learning']].map(([id, label]) => [id, label]));

// Shared across Next.js route bundles (each bundle may load its own copy of this module).
const registry = (globalThis.__prismRuns ??= new Map());

class ControlSignal extends Error {
  constructor(action) { super('Run ' + action); this.action = action; }
}

export function isActive(id) { return registry.has(id); }

const text = (value, max) => String(value ?? '').trim().slice(0, max);

/** Validate a brief and build a new run record (F01: name, offer and problem are enough to start). */
export function createRun(input, {pilot} = {}) {
  const source = pilot ?? input;
  const name = text(source.name, 160);
  const offer = pilot ? `All ${pilot.offers.length} ${pilot.name} offers` : text(input.offer, 160);
  const problem = pilot ? 'Find evidence-backed customer groups for each offer' : text(input.problem, 600);
  if (!name || !offer || !problem) throw Object.assign(new Error('Enter a business name, what you sell, and the problem it solves.'), {status: 400});
  let website = text(source.website, 300);
  if (website && !/^https:\/\//i.test(website)) website = 'https://' + website.replace(/^http:\/\//i, '');
  const model = ['b2b', 'b2c', 'mixed', 'b2b2c'].includes(source.model) ? source.model : 'b2b';
  const geography = text(input.geography ?? source.geography, 120) || 'Global';
  const brief = {
    name, offer, problem, website, geography, model, topCount: Number(input.topCount) === 5 ? 5 : 3,
    offers: pilot?.offers ?? (Array.isArray(input.offers) && input.offers.length ? input.offers.slice(0, 8).map(item => ({
      name: text(item.name, 120), problem: text(item.problem, 400), beneficiary: text(item.beneficiary, 160) || undefined,
    })).filter(item => item.name && item.problem) : undefined),
    referenceUrls: (pilot?.referenceUrls ?? input.referenceUrls ?? []).filter(url => /^https:\/\//.test(url)).slice(0, 10),
    excludedMarkets: (input.excludedMarkets ?? []).map(item => text(item, 80)).filter(Boolean).slice(0, 20),
    constraints: text(input.constraints, 600) || undefined, pricing: text(input.pricing, 200) || undefined,
  };
  const policy = buildPolicy({mode: input.mode ?? pilot?.mode, budgets: input.budgets, forbiddenDomains: input.forbiddenDomains,
    adapters: input.adapters, geography: brief.geography === 'Global' ? null : brief.geography});
  return {
    id: uuid(), createdAt: nowIso(), status: 'queued', kind: 'research', brief, policy, stages: {}, events: [],
    sources: [], sourceGaps: [], claims: [], segments: [], cards: [], modelCalls: [], reviews: [],
    pilot: pilot ? pilot.id ?? pilot.name : null,
  };
}

export function createRefreshRun(parent, input = {}) {
  const policy = buildPolicy({mode: 'refresh', budgets: input.budgets, forbiddenDomains: parent.policy?.forbiddenDomains});
  return {
    id: uuid(), createdAt: nowIso(), status: 'queued', kind: 'refresh', parentRunId: parent.id,
    brief: {...parent.brief}, policy, stages: {}, events: [], sources: [], sourceGaps: [], claims: [],
    profile: parent.profile, segments: parent.segments, searchPlan: (parent.searchPlan ?? []).map(item => ({...item, status: item.status === 'planned' ? 'deferred' : item.status})),
    coverage: parent.coverage, crossCuts: parent.crossCuts, universe: parent.universe, organizations: parent.organizations ?? [],
    cards: [], modelCalls: [], reviews: [],
  };
}

function stageDigest(run) {
  return sha(JSON.stringify([run.profile?.offers?.length, run.segments?.length, run.sources?.length, run.claims?.length,
    run.cards?.map(card => [card.id, card.decision, card.score?.low, card.score?.high])])).slice(0, 12);
}

/** Execute (or resume) a run to completion. Resolves when the run ends, pauses or is cancelled. */
export async function executeRun(runOrId, deps = {}) {
  let run = typeof runOrId === 'string' ? await getRun(runOrId) : runOrId;
  if (!run) throw new Error('Run not found');
  if (registry.has(run.id)) return run;
  const entry = {control: null};
  registry.set(run.id, entry);
  const llm = deps.llm ?? createLLM();
  const net = deps.net ?? {crawlPage, discover, newsSearch};
  const strategy = deps.strategy ?? await activeStrategy();
  const parent = run.parentRunId ? (deps.parent ?? await getRun(run.parentRunId)) : null;
  const tracker = makeBudget(run);
  run.llm = {provider: llm.provider, model: llm.model};
  run.strategyVersion = strategy.version;
  const ctx = {
    run, llm, net, strategy, budget: tracker, parent,
    log(stage, detail) { run.events.push({at: nowIso(), stage, detail}); },
    gap(url, reason) { if (run.sourceGaps.length < 400) run.sourceGaps.push({url, reason, at: nowIso()}); },
    save: () => saveRun(run),
    checkControl() { if (entry.control) throw new ControlSignal(entry.control); },
    async model(role, {task, payload, maxTokens}) {
      if (!llm.available) return null;
      if (!tracker.can('model')) {
        run.modelCalls.push({at: nowIso(), stage: run.stage, role, ok: false, error: 'Model budget exhausted — skipped'});
        return null;
      }
      const started = Date.now();
      const result = await llm.json(role, {instructions: PROMPTS[role], task, payload, schema: SCHEMAS[role], maxTokens});
      tracker.model(result.usage);
      run.modelCalls.push({at: nowIso(), stage: run.stage, role, ok: !result.error, error: result.error ?? null,
        ms: Date.now() - started, usage: result.usage ?? null, model: llm.describe()});
      if (result.error) { this.log(run.stage, `Model call failed (${role}) — continuing with explicit gaps: ${result.error}`); return null; }
      return result.data;
    },
  };
  const stages = run.kind === 'refresh' ? REFRESH_STAGES : STAGES;
  run.status = 'running';
  run.error = null;
  await saveRun(run);
  try {
    for (const [id, label, fn] of stages) {
      if (run.stages[id]?.status === 'done') continue;
      ctx.checkControl();
      const record = run.stages[id] = {status: 'running', label, attempt: (run.stages[id]?.attempt ?? 0) + 1, startedAt: nowIso(),
        inputHash: stageDigest(run), model: llm.describe(), policyVersion: run.policy.version, strategyVersion: strategy.version,
        spendBefore: {...tracker.spend}};
      run.stage = id;
      await saveRun(run);
      await fn(ctx);
      Object.assign(record, {status: 'done', finishedAt: nowIso(), outputHash: stageDigest(run),
        cost: {usd: Math.round((tracker.spend.usd - record.spendBefore.usd) * 10000) / 10000,
          modelCalls: tracker.spend.modelCalls - record.spendBefore.modelCalls, pages: tracker.spend.pages - record.spendBefore.pages,
          searches: tracker.spend.searches - record.spendBefore.searches}});
      delete record.spendBefore;
      await saveRun(run);
    }
    run.stage = 'S11';
    run.status = 'awaiting_review';
    run.completedAt = nowIso();
    const exhausted = tracker.exhausted();
    ctx.log('S11', 'Research complete — awaiting human review. ' + (exhausted.length ? `Limits reached: ${exhausted.join(', ')}.` : 'Within budget.'));
  } catch (error) {
    const current = run.stages[run.stage];
    if (error instanceof ControlSignal) {
      if (current?.status === 'running') current.status = 'interrupted';
      run.status = error.action === 'cancel' ? 'cancelled' : 'paused';
      ctx.log(run.stage ?? 'S0', error.action === 'cancel' ? 'Cancelled by operator' : 'Paused by operator — resume continues from this stage');
    } else {
      if (current) current.status = 'failed';
      run.status = 'failed';
      run.error = String(error?.message ?? error).slice(0, 500);
      ctx.log(run.stage ?? 'S0', 'Error: ' + run.error);
    }
  } finally {
    registry.delete(run.id);
    await saveRun(run);
    if (!deps.keepBrowser && registry.size === 0) await closeBrowser();
  }
  return run;
}

/** Start a run in the background (API use). */
export function startRun(run, deps) {
  executeRun(run, deps).catch(async error => {
    run.status = 'failed'; run.error = String(error?.message ?? error);
    await saveRun(run).catch(() => {});
  });
  return run;
}

export async function controlRun(id, action) {
  if (!['pause', 'cancel', 'resume'].includes(action)) throw Object.assign(new Error('Unknown action'), {status: 400});
  const run = await getRun(id);
  if (!run) throw Object.assign(new Error('Run not found'), {status: 404});
  if (action === 'resume') {
    if (registry.has(id)) return {status: 'running'};
    if (!['paused', 'failed', 'interrupted', 'running', 'queued'].includes(run.status)) {
      throw Object.assign(new Error(`A ${run.status} run cannot be resumed`), {status: 409});
    }
    startRun(run);
    return {status: 'running'};
  }
  const entry = registry.get(id);
  if (entry) { entry.control = action; return {status: action === 'pause' ? 'pausing' : 'cancelling'}; }
  if (action === 'cancel' && !['awaiting_review', 'complete', 'cancelled'].includes(run.status)) {
    run.status = 'cancelled'; await saveRun(run);
  }
  return {status: run.status};
}

/** A run left "running" by a server restart is shown as interrupted so the operator can resume it. */
export function effectiveStatus(run) {
  if (['running', 'queued'].includes(run.status) && !registry.has(run.id) && Date.now() - Date.parse(run.updatedAt ?? run.createdAt) > 90000) return 'interrupted';
  return run.status;
}
