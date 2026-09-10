import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureRoot = await mkdtemp(join(tmpdir(), 'databricks-reaudit-'));
await cp(join(root, 'tools'), join(fixtureRoot, 'tools'), { recursive: true });
await cp(join(root, 'harness.config.json'), join(fixtureRoot, 'harness.config.json'));
await mkdir(join(fixtureRoot, 'work/sessions'), { recursive: true });
for (let i = 1; i <= 9; i++) {
  const id = 'session-' + String(i).padStart(2, '0');
  const fields = [
    '---', 'id: ' + id, 'title: Audit task ' + i, 'status: active',
    'intent: mock-ui', 'phase: mock', 'gate: ui-mock', 'gate_status: pending',
    'updated: 2026-09-09T00:' + String(i).padStart(2, '0') + ':00Z',
    'last_checkpoint: 2026-09-09T00:' + String(i).padStart(2, '0') + ':00Z',
    '---', '# Work session', '## Verified current state', 'CURRENT-SLICE-' + i,
    '## Next actions', 'NEXT-ACTION-' + i, '## Blockers and human gates',
    'Awaiting user mock approval.'
  ];
  await writeFile(join(fixtureRoot, 'work/sessions', id + '.md'), fields.join('\n') + '\n');
}
function run(file, args, input = '{}') {
  const env = { ...process.env };
  delete env.HARNESS_SESSION_ID;
  delete env.HARNESS_LOOP_ID;
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: fixtureRoot, input, encoding: 'utf8', env, timeout: 15000, shell: false
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
const cli = run('tools/harness.mjs', ['context']);
const hook = JSON.parse(run('tools/agent-hook.mjs', ['context', '--provider', 'claude']));
const stop = JSON.parse(run('tools/agent-hook.mjs', ['stop', '--provider', 'claude']));
const result = {
  observedAt: new Date().toISOString(),
  scope: 'Isolated fixture; no provider model, authentication, network, or product state.',
  fixtureRoot,
  sessionCount: 9,
  findings: {
    cliListsNewestSession: cli.includes('Audit task 9'),
    hookListsNewestSession: hook.additionalContext.includes('Audit task 9'),
    cliExposesCurrentSlice: cli.includes('CURRENT-SLICE-'),
    cliExposesNextAction: cli.includes('NEXT-ACTION-'),
    cliExposesPendingGate: cli.includes('ui-mock'),
    hookExposesPendingGate: hook.additionalContext.includes('ui-mock'),
    ordinaryStopBlocksWithoutCheckpoint: stop.decision === 'block',
    cliExplainsTruncation: /truncat|omitt|more session|全9|省略/i.test(cli),
    hookExplainsTruncation: /truncat|omitt|more session|全9|省略/i.test(hook.additionalContext)
  },
  outputs: { context: cli, sessionStart: hook, ordinaryStop: stop },
  interpretation: [
    'These are observations of current behavior, not a certification of a new acceptance contract.',
    'A plain Stop hook is not a semantic checkpoint mechanism; blocking is scoped to matched automatic loops.',
    'Context retrieval and human-facing project progress are different responsibilities.'
  ]
};
await writeFile(join(root, 'work/evidence/2026-09-10-context-probe.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ fixtureRoot, findings: result.findings }, null, 2));

