import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';

// One-shot local regression evidence; never overwrite an earlier run.
const tests = readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
  encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024,
});
const output = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync('work/evidence/2026-09-16-adopt-main-tests.log', output, { flag: 'wx' });
const count = name => Number(output.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] ?? NaN);
const report = {
  observedAt: new Date().toISOString(), node: process.version, platform: process.platform,
  command: 'node --test --test-reporter=tap tests/*.test.mjs',
  exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
  tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'),
  log: 'work/evidence/2026-09-16-adopt-main-tests.log',
  liveProviderTested: false, databricksTested: false,
};
writeFileSync('work/evidence/2026-09-16-adopt-main-tests.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
process.exitCode = result.status === 0 && Number.isFinite(report.tests) && report.fail === 0 ? 0 : 1;
