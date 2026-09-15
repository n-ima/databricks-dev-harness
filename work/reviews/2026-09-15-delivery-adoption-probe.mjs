import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRelease } from '../../tools/lib/distribution.mjs';

// Independent local probes; fixture data does not attest to live execution.
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const hash = value => sha(JSON.stringify(ordered(value)));
const ops = ['ownership', 'monitoring', 'recovery', 'data-protection', 'cost', 'dependency-updates'];

async function fixture(t, copyTools = true) {
  const root = await mkdtemp(join(tmpdir(), 'delivery-adoption-review-'));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
    assert.ok(root.split(sep).at(-1).startsWith('delivery-adoption-review-'));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (path, content) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
    return { path, sha256: sha(content) };
  };
  if (copyTools) await cp(join(source, 'tools'), join(root, 'tools'), { recursive: true });
  const requirement = await put('docs/requirement.md', '# 独立fixture\n\n## 受入条件\n\n- AC-01: 記録を読み取って診断する。\n');
  const artifact = await put('src/fixture.txt', 'Synthetic implementation only.');
  const evidence = await put('evidence.txt', 'Synthetic observations only; no real service was called.');
  const c = { schemaVersion: 1, producer: { actor: 'author', context: 'author-context' }, requirement,
    artifacts: [artifact], requirements: ['AC-01'], risks: [], interfaces: [],
    testCases: [{ id: 'TC-01', requirements: ['AC-01'], level: 'unit', environment: 'local',
      preconditions: 'ローカルfixture', steps: ['静的記録を読む'], expected: '結果を確認できる', result: null }],
    operations: ops.map(id => ({ id, status: 'not-applicable', reason: '一時fixtureであり実際の運用対象がない。', testIds: [], document: null })), reviews: [] };
  const save = () => put('contract.json', JSON.stringify(c));
  const seal = () => {
    const { reviews, testCases, ...design } = c;
    const basis = hash({ ...design, testCases: testCases.map(({ result, ...tc }) => tc) });
    c.testCases[0].result = { status: 'pass', environment: 'local', basisSha256: basis, evidence: [evidence],
      command: 'node -e "require(\'node:fs\').writeFileSync(\'COMMAND_EXECUTED\',\'unexpected\')"', versions: 'synthetic fixture' };
    const { reviews: omitted, ...reviewed } = c;
    c.reviews = [{ actor: 'reviewer', context: 'fresh-review-context', independent: true, status: 'pass',
      reviewedSha256: hash(reviewed), coverage: { requirements: ['AC-01'], risks: [], interfaces: [], operations: ops }, evidence: [evidence] }];
  };
  const run = (...args) => spawnSync(process.execPath, [join(root, 'tools/harness.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  return { root, c, put, save, seal, run };
}

async function snapshot(root, prefix = '') {
  const result = [];
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? prefix + '/' + item.name : item.name;
    if (item.isDirectory()) result.push(...await snapshot(root, path));
    else if (item.isFile()) result.push([path, sha(await readFile(join(root, path)))]);
  }
  return result.sort((a, b) => a[0].localeCompare(b[0]));
}

test('integrated CLI is advisory, preserves all fixture bytes and keeps recorded command inert', async t => {
  const f = await fixture(t); f.seal(); await f.save();
  const before = await snapshot(f.root);
  const run = f.run('delivery', 'check', '--contract', 'contract.json', '--phase', 'verify');
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.deepEqual(report.findings, []);
  assert.equal(report.certifiesAcceptance, false);
  assert.equal(report.recordedExecutions, 1);
  assert.equal(report.executed, undefined);
  assert.deepEqual(await snapshot(f.root), before);
  assert.match(f.run('--help').stdout, /delivery check --contract/);
  assert.match(f.run('--help').stdout, /delivery hashes --contract/);
});

test('integrated CLI separates design without execution from verify findings', async t => {
  const f = await fixture(t); await f.save();
  const design = f.run('delivery', 'check', '--contract', 'contract.json', '--phase', 'design');
  assert.equal(design.status, 0, design.stderr);
  assert.equal(JSON.parse(design.stdout).recordedExecutions, 0);
  const verify = f.run('delivery', 'check', '--contract', 'contract.json', '--phase', 'verify');
  assert.equal(verify.status, 1, verify.stderr);
  const codes = JSON.parse(verify.stdout).findings.map(f => f.code);
  assert.ok(codes.includes('TEST_NOT_PASSED'));
  assert.ok(codes.includes('MISSING_REVIEW'));
});

test('integrated hashes reports record hashes without validating or executing stale evidence', async t => {
  const f = await fixture(t); f.seal(); await f.save(); await f.put('src/fixture.txt', 'Changed bytes');
  const run = f.run('delivery', 'hashes', '--contract', 'contract.json');
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.certifiesAcceptance, false);
  assert.match(report.summary, /証明しません/);
  assert.equal(report.basisSha256, f.c.testCases[0].result.basisSha256);
  assert.equal(report.reviewedSha256, f.c.reviews[0].reviewedSha256);
  const check = f.run('delivery', 'check', '--contract', 'contract.json');
  assert.equal(check.status, 1);
  assert.ok(JSON.parse(check.stdout).findings.some(f => f.code === 'ARTIFACT_MISMATCH'));
});

test('integrated CLI rejects invalid arguments and malformed input with exit 2', async t => {
  const f = await fixture(t); await f.save();
  for (const args of [[], ['other'], ['check'], ['check', '--contract'], ['hashes', '--contract', 'contract.json', '--phase', 'design'],
    ['check', '--contract', 'contract.json', '--contract', 'contract.json'], ['check', '--contract', 'contract.json', '--unknown', 'x']]) {
    assert.equal(f.run('delivery', ...args).status, 2, JSON.stringify(args));
  }
  await f.put('broken.json', '{');
  assert.equal(f.run('delivery', 'check', '--contract', 'broken.json').status, 2);
});

test('integrated CLI invalid phase follows documented argument-error exit 2', async t => {
  const f = await fixture(t); await f.save();
  const run = f.run('delivery', 'check', '--contract', 'contract.json', '--phase', 'invalid');
  assert.equal(run.status, 2, run.stdout + run.stderr);
});

test('integrated CLI rejects unsafe contract paths and junctions', async t => {
  const f = await fixture(t); await f.save();
  for (const path of ['../contract.json', '/contract.json', 'C:/contract.json', '.git/config', 'docs/NUL', 'https://example.invalid/file'])
    assert.equal(f.run('delivery', 'check', '--contract', path).status, 2, path);
  await symlink(join(f.root, 'docs'), join(f.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(f.run('delivery', 'check', '--contract', 'linked/requirement.md').status, 2);
});

test('release manifest owns adopted delivery implementation, tests, template and operations guide', async t => {
  const f = await fixture(t, false);
  // This release is a synthetic package, not the repository release.
  await f.put('harness.config.json', JSON.stringify({ harnessVersion: '0.0.1' }));
  const expected = ['tools/lib/delivery-assurance.mjs', 'tests/delivery-assurance.test.mjs', 'tests/delivery-independent.test.mjs',
    'harness/templates/delivery-contract.json', 'docs/harness/operations/DELIVERY_ASSURANCE.md'];
  for (const path of expected) await f.put(path, (await readFile(join(source, path), 'utf8')).replaceAll('\r\n', '\n'));
  const release = await createRelease(f.root);
  const manifest = new Map(release.manifest.managedFiles.map(entry => [entry.path, entry.sha256]));
  for (const path of expected) assert.equal(manifest.get(path), sha(await readFile(join(f.root, path))), path);
  assert.ok(!manifest.has('contract.json'));
  assert.ok(!manifest.has('src/fixture.txt'));
});
