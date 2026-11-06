/** Shared helpers for the Next.js route handlers. */
import { NextResponse } from 'next/server';

export async function handle(fn) {
  try {
    const result = await fn();
    return result instanceof Response ? result : NextResponse.json(result ?? {ok: true});
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status === 500) console.error('[prism]', error);
    return NextResponse.json({error: String(error?.message ?? error)}, {status});
  }
}

export async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

/** Background jobs (account discovery, drafting) shared across route bundles. */
export const jobs = (globalThis.__prismJobs ??= new Map());
export function startJob(kind, label, fn) {
  const id = kind + '-' + Date.now().toString(36);
  const job = {id, kind, label, status: 'running', startedAt: new Date().toISOString()};
  jobs.set(id, job);
  Promise.resolve().then(fn).then(result => Object.assign(job, {status: 'done', result, finishedAt: new Date().toISOString()}))
    .catch(error => Object.assign(job, {status: 'failed', error: String(error?.message ?? error), finishedAt: new Date().toISOString()}));
  for (const [key, old] of jobs) if (jobs.size > 30 && old.status !== 'running') jobs.delete(key);
  return job;
}
