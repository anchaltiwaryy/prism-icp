import { promises as fs } from 'node:fs';
import path from 'node:path';
const base = path.join(process.cwd(), 'data');
export async function listRuns() {
  await fs.mkdir(base, { recursive: true });
  const names = (await fs.readdir(base)).filter(name => /^[a-f0-9-]{36}$/.test(name));
  const runs = await Promise.all(names.map(async id => {
    try { return JSON.parse(await fs.readFile(path.join(base, id, 'run.json'), 'utf8')); } catch { return null; }
  }));
  return runs.filter(Boolean).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getRun(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try { return JSON.parse(await fs.readFile(path.join(base,id,'run.json'),'utf8')); } catch { return null; }
}
export async function saveRun(run) {
  const directory = path.join(base, run.id);
  await fs.mkdir(directory, { recursive: true });
  const temp = path.join(directory, 'run.tmp');
  await fs.writeFile(temp, JSON.stringify(run, null, 2));
  await fs.rename(temp, path.join(directory, 'run.json'));
}
