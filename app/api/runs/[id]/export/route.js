import { handle } from '../../../../../lib/api.js';
import { exporters } from '../../../../../lib/reports.js';
import { getRun } from '../../../../../lib/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, {params}) {
  return handle(async () => {
    const {id} = await params;
    const run = await getRun(id);
    if (!run) throw Object.assign(new Error('Run not found'), {status: 404});
    const format = new URL(request.url).searchParams.get('format') ?? 'json';
    const exporter = exporters[format];
    if (!exporter) throw Object.assign(new Error('Unknown format. Use ' + Object.keys(exporters).join(', ')), {status: 400});
    const file = exporter(run);
    const name = run.brief.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + run.id.slice(0, 8) + '-' + file.name;
    return new Response(file.body, {headers: {'content-type': file.type, 'content-disposition': `attachment; filename="${name}"`}});
  });
}
