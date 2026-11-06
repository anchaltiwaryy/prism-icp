import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { body, handle } from '../../../lib/api.js';
import { createRun, effectiveStatus, startRun } from '../../../lib/pipeline.js';
import { listRuns, saveRun, summarize } from '../../../lib/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => (await listRuns()).map(run => ({...summarize(run), status: effectiveStatus(run)})));
}

export async function POST(request) {
  return handle(async () => {
    const input = await body(request);
    const pilot = input.pilot === 'foxfoster'
      ? JSON.parse(await readFile(path.join(process.cwd(), 'foxfoster.json'), 'utf8')) : null;
    const run = createRun(input, {pilot});
    await saveRun(run);
    startRun(run);
    return Response.json({id: run.id}, {status: 202});
  });
}
