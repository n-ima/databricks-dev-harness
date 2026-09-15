// Read-only source audit; generated artifacts and tests stay in disposable temp roots.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repository = resolve(process.argv[2] || '.');
const outputs = [];
const originalLog = console.log;
console.log = () => {};
for (const [label, source] of [
  ['local-candidate', repository],
  ['published-0.6.1-payload', join(repository, '.harness/releases/0.6.1/files')],
]) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, 'harness-platform-truth-'));
  try {
    const { planScaffold, applyScaffold } = await import(pathToFileURL(join(source, 'tools/lib/scaffold.mjs')));
    await mkdir(join(root, 'harness'), { recursive: true });
    await writeFile(join(root, 'harness/toolchain.lock.json'), '{"appkitTemplateVersion":"v0.69.1"}\n');
    const noExternal = { run() { throw new Error('External command prohibited in audit'); } };
    const metric = await planScaffold(root, {
      kind: 'metric-view', name: 'audit-metric', source_table: 'dev.audit.orders',
      dimension: ['Region=region'], measure: ['Revenue=SUM(amount)'],
    }, noExternal);
    await applyScaffold(root, { plan: `work/scaffolds/${metric.id}.json`, yes: true }, noExternal);
    const yaml = await readFile(join(root, 'src/metrics/audit-metric.metric.yml'), 'utf8');
    const sql = await readFile(join(root, 'src/metrics/audit-metric.draft.sql'), 'utf8');
    const embedded = sql.split('$$')[1];
    const parser = spawnSync('python', ['-c', [
      'import json,sys,yaml',
      'cases=json.load(sys.stdin)',
      'out={"pyyaml":yaml.__version__,"cases":{}}',
      'for name,text in cases.items():',
      ' try:',
      '  value=yaml.safe_load(text)',
      '  out["cases"][name]={"accepted":isinstance(value,dict),"valueType":type(value).__name__}',
      ' except yaml.YAMLError as exc:',
      '  out["cases"][name]={"accepted":False,"error":str(exc)}',
      'print(json.dumps(out))',
    ].join('\n')], {
      input: JSON.stringify({ standalone: yaml, embedded, commentCorrectedControl: embedded.replace('-- Generated from', '# Generated from') }),
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    assert.equal(parser.status, 0, parser.stderr);
    const parsed = JSON.parse(parser.stdout);
    assert.equal(parsed.cases.standalone.accepted, true);
    assert.equal(parsed.cases.embedded.accepted, false);
    assert.equal(parsed.cases.commentCorrectedControl.accepted, true);
    const countTrials = [];
    for (const [name, keys, sequence] of [['key-count', ['count'], 'version'], ['sequence-count', ['id'], 'count']]) {
      const plan = await planScaffold(root, {
        kind: 'data-update', name, source_table: 'dev.audit.source', target_table: 'dev.audit.target', key: keys, sequence_by: sequence,
      }, noExternal);
      await applyScaffold(root, { plan: `work/scaffolds/${plan.id}.json`, yes: true }, noExternal);
      const test = spawnSync('python', ['-m', 'unittest', 'discover', '-s', 'tests/data_products', '-p', `test_${name.replaceAll('-', '_')}.py`, '-v'], {
        cwd: root, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      });
      assert.equal(test.status, 0, test.stderr);
      const generated = await readFile(join(root, `src/data_products/${name}/job.py`), 'utf8');
      countTrials.push({ name, planStatus: plan.status, exitCode: test.status, stderr: test.stderr,
        unaliasedCountFilter: generated.includes('count().where(F.col("count") > 1)'), sparkExecuted: false });
    }
    outputs.push({ label, metricStatus: metric.status, metricYaml: parsed, countTrials, externalCommands: 0 });
  } finally {
    assert.ok(root.startsWith(base + sep) && root.slice(base.length + 1).startsWith('harness-platform-truth-'));
    await rm(root, { recursive: true, force: true });
  }
}
console.log = originalLog;
originalLog(JSON.stringify({ scope: 'local-generated-fixtures-only', outputs }, null, 2));
