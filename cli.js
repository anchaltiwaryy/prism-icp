import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run } from './engine.js';
import { markdown } from './report.js';

async function main([command, path, output = 'runs', ...extra]) {
  if (command !== 'run' || !path || extra.length) {
    throw new Error('Usage: node src/cli.js run <brief.json> [output-directory]');
  }
  const input = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  const report = run(input);
  const directory = resolve(output, report.runId);
  await mkdir(directory, {recursive: true});
  await Promise.all([
    writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n'),
    writeFile(join(directory, 'report.md'), markdown(report)),
  ]);
  console.log(directory);
  console.log(report.cards.length + ' hypotheses · ' + report.recommendations.length + ' recommendations');
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error('PRISM: ' + error.message);
  process.exitCode = 1;
}
