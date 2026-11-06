/**
 * Local persistence. Runs live in data/<run-id>/run.json (one immutable-ish record per research run);
 * cross-run GTM state (accounts, outbox, outcomes, learning) lives in data/workspace/*.json.
 * Writes are atomic (temp file + rename) and serialised per file with an in-process lock.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withLock } from './util.js';

const ID = /^[a-f0-9-]{36}$/;
export const dataDir = () => process.env.PRISM_DATA_DIR ?? path.join(process.cwd(), 'data');

async function atomicWrite(file, value) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const temp = file + '.' + process.pid + '.tmp';
  await fs.writeFile(temp, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(temp, file); return; } catch (error) {
      // Windows can briefly lock a file another reader has open.
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

// ---------------------------------------------------------------- runs
export async function getRun(id) {
  if (!ID.test(String(id))) return null;
  return readJson(path.join(dataDir(), id, 'run.json'), null);
}
export async function saveRun(run) {
  run.updatedAt = new Date().toISOString();
  const file = path.join(dataDir(), run.id, 'run.json');
  await withLock(file, () => atomicWrite(file, run));
}
/** Read-modify-write a stored run under a lock (used by review, validation and account actions). */
export async function updateRun(id, mutate) {
  return withLock('run:' + id, async () => {
    const run = await getRun(id);
    if (!run) throw Object.assign(new Error('Run not found'), {status: 404});
    const result = await mutate(run);
    await saveRun(run);
    return result ?? run;
  });
}
export async function listRuns() {
  await fs.mkdir(dataDir(), {recursive: true});
  const names = (await fs.readdir(dataDir())).filter(name => ID.test(name));
  const runs = await Promise.all(names.map(id => getRun(id)));
  return runs.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** Light listing for the sidebar: no sources/claims payloads. */
export function summarize(run) {
  const cards = run.cards ?? [];
  return {
    id: run.id, createdAt: run.createdAt, updatedAt: run.updatedAt, status: run.status, mode: run.policy?.mode,
    name: run.brief?.name, offer: run.brief?.offer, geography: run.brief?.geography, parentRunId: run.parentRunId ?? null,
    stage: run.stage ?? null, sources: run.sources?.length ?? 0, claims: run.claims?.length ?? 0,
    cards: cards.length, recommended: run.portfolio?.recommended?.length ?? 0,
    rejected: cards.filter(card => card.decision === 'reject').length, spend: run.spend ?? null,
    llm: run.llm ?? null, error: run.error ?? null,
  };
}
export async function writeRunFile(runId, name, content) {
  if (!ID.test(runId) || !/^[a-z0-9._-]+$/i.test(name)) throw new Error('Invalid run file');
  await atomicWrite(path.join(dataDir(), runId, name), content);
}

// ---------------------------------------------------------------- workspace collections
const COLLECTIONS = ['accounts', 'outbox', 'outcomes', 'feedback', 'learning', 'suppression'];
export async function readCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error('Unknown collection ' + name);
  return readJson(path.join(dataDir(), 'workspace', name + '.json'), name === 'learning' ? {} : []);
}
/** Read-modify-write a workspace collection under its lock. `mutate` may return a new value or mutate in place. */
export async function updateCollection(name, mutate) {
  if (!COLLECTIONS.includes(name)) throw new Error('Unknown collection ' + name);
  const file = path.join(dataDir(), 'workspace', name + '.json');
  return withLock(file, async () => {
    const current = await readJson(file, name === 'learning' ? {} : []);
    const next = (await mutate(current)) ?? current;
    await atomicWrite(file, next);
    return next;
  });
}
export async function writeWorkspaceFile(relative, content) {
  if (!/^[a-z0-9/_.-]+$/i.test(relative) || relative.includes('..')) throw new Error('Invalid workspace path');
  const file = path.join(dataDir(), 'workspace', relative);
  await atomicWrite(file, content);
  return file;
}
