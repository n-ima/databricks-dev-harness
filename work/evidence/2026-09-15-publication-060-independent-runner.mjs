// Independent verification only: writes evidence and new isolated fixtures, never implementation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const repo = resolve('D:/projects/databricks-dev-harness');
const snapshot = join(repo, '.harness/runtime/publish-0.6.0');
const releaseRoot = join(snapshot, '.harness/releases/0.6.0');
const prefix = join(repo, 'work/evidence/2026-09-15-publication-060-independent');
const cli = join(releaseRoot, 'files/tools/update-harness.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const save = async (name, value) => writeFile(`${prefix}-${name}.json`, JSON.stringify(value, null, 2) + '\n');
const put = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: 'wx' }); };
async function inventory(root, paths) { return Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(root, p)))]))); }
async function walk(root, relative = '') {
  const paths = [];
  for (const item of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = relative ? `${relative}/${item.name}` : item.name;
    if (path === '.harness' || path === '.git' || path === 'node_modules') continue;
    assert.ok(!item.isSymbolicLink(), path);
    if (item.isDirectory()) paths.push(...await walk(root, path)); else paths.push(path);
  }
  return paths.sort();
}
async function run(label, args, cwd, expected = 0) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1' } });
  const record = { at: new Date().toISOString(), command: [process.execPath, ...args], cwd, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  await save(label, record);
  console.log(JSON.stringify({ label, exitCode: record.exitCode, stdout: record.stdout.slice(-1000), stderr: record.stderr.slice(-600) }));
  if (expected === 'reject') assert.notEqual(record.exitCode, 0, label); else assert.equal(record.exitCode, expected, `${label}: ${record.stderr}`);
  return record;
}
async function release(root) {
  const manifestBytes = await readFile(join(root, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const actual = await inventory(join(root, 'files'), manifest.managedFiles.map(x => x.path));
  for (const file of manifest.managedFiles) {
    assert.equal(actual[file.path], file.sha256, file.path);
    assert.equal((await readFile(join(root, 'files', file.path))).length, file.bytes, file.path);
  }
  return { root, manifest, manifestSha256: hash(manifestBytes), payloadHashes: actual };
}
async function copyRelease(source, target) {
  await mkdir(target);
  for (const file of source.manifest.managedFiles) { await mkdir(dirname(join(target, file.path)), { recursive: true }); await copyFile(join(source.root, 'files', file.path), join(target, file.path)); }
}
async function assertPreserved(s) {
  assert.deepEqual(await inventory(s.target, Object.keys(s.protected)), s.protected);
  assert.equal(hash(await readFile(join(s.target, 'harness/base-release.json'))), s.oldManifestSha256);
}
const phase = process.argv[2];
if (phase === 'audit') {
  const incoming = await release(releaseRoot);
  assert.equal(incoming.manifest.version, '0.6.0');
  assert.equal(incoming.manifestSha256, '4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c');
  assert.equal(hash(await readFile(join(snapshot, 'harness/base-release.json'))), incoming.manifestSha256);
  const actual = await inventory(snapshot, incoming.manifest.managedFiles.map(x => x.path));
  assert.deepEqual(actual, incoming.payloadHashes);
  const paths = await walk(snapshot);
  assert.ok(!paths.some(p => /(?:scoped-approval|SCOPED_APPROVALS)/.test(p)), 'Unadopted candidate path in snapshot');
  for (const p of ['tools/harness.mjs', 'tools/lib/distribution.mjs', 'docs/harness/operations/CLI_REFERENCE.md']) assert.doesNotMatch(await readFile(join(snapshot, p), 'utf8'), /scoped-approval|SCOPED_APPROVALS|approval-scope/);
  const git = spawnSync('git', ['cat-file', '--batch'], { cwd: repo, input: incoming.manifest.managedFiles.map(x => `:${x.path}`).join('\n') + '\n', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(git.status, 0, git.stderr.toString());
  let offset = 0;
  for (const item of incoming.manifest.managedFiles) {
    const end = git.stdout.indexOf(10, offset), header = git.stdout.subarray(offset, end).toString('utf8');
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(' ')[2]);
    assert.equal(hash(git.stdout.subarray(end + 1, end + 1 + length)), item.sha256, `index:${item.path}`);
    offset = end + 2 + length;
  }
  const assembly = await json(join(repo, 'work/evidence/2026-09-15-publication-060-assembly.json'));
  assert.deepEqual(await inventory(repo, Object.keys(assembly.preserved)), assembly.preserved);
  const old = await Promise.all(['0.4.0', '0.5.0'].map(v => release(join(repo, '.harness/releases', v))));
  const byteEvidence = await json(join(snapshot, 'work/evidence/2026-09-15-publication-060-byte-validation.json'));
  assert.equal(byteEvidence.status, 'pass');
  assert.equal(byteEvidence.manifestSha256, incoming.manifestSha256);
  await save('audit', { at: new Date().toISOString(), status: 'pass', environment: { node: process.version, platform: process.platform }, snapshot, incoming, snapshotFileCount: paths.length, snapshotPaths: paths, indexManagedBlobMatch: true, preserved: assembly.preserved, old, publisherByteEvidence: byteEvidence, boundary: 'Git checkout experiment belongs to publisher evidence; this audit independently checks all index blobs, snapshot bytes and payload.' });
  await run('check', [join(snapshot, 'tools/harness.mjs'), 'check'], snapshot);
  const suite = await run('tests', ['--test', '--test-reporter=tap', join(snapshot, 'tests/update-entry.test.mjs'), join(repo, 'work/evidence/2026-09-15-publication-060-independent.test.mjs')], snapshot);
  assert.match(suite.stdout, /# tests 27/); assert.match(suite.stdout, /# pass 27/); assert.match(suite.stdout, /# fail 0/);
} else if (phase === 'prepare') {
  const incoming = await release(releaseRoot);
  const tempRoot = await mkdtemp(join(tmpdir(), 'publication-060-forward-'));
  const source = join(tempRoot, 'clean source 0.6.0');
  await copyRelease(incoming, source);
  await put(source, 'harness/base-release.json', await readFile(join(releaseRoot, 'manifest.json')));
  const targets = [];
  for (const version of ['0.4.0', '0.5.0']) {
    const old = await release(join(repo, '.harness/releases', version));
    const target = join(tempRoot, `project ${version}`);
    await copyRelease(old, target);
    await put(target, 'harness/base-release.json', await readFile(join(old.root, 'manifest.json')));
    const protectedFiles = {
      'product.config.json': JSON.stringify({ schemaVersion: 1, name: 'publication-fixture', displayName: '公開版隔離案件', initializedAt: '2026-09-15T00:00:00Z' }) + '\n',
      '.gitignore': '.env\n.databricks/\nnode_modules/\n.harness/local.json\n',
      'package.json': JSON.stringify({ name: 'publication-fixture', version: '9.8.7', private: true, type: 'module', scripts: { 'harness:context': 'node tools/harness.mjs context', 'harness:check': 'node tools/harness.mjs check', 'test:harness': 'node --test tests/*.test.mjs' } }) + '\n',
      'package-lock.json': '{"name":"publication-fixture","version":"9.8.7","lockfileVersion":3,"requires":true,"packages":{}}\n',
      'README.md': '# 既存案件\r\n保持する説明。\r\n',
      'docs/product/README.md': '# 隔離案件仕様\n',
      'docs/product/requirements/orders.md': '# 注文明細\n\n- AC-01: 合計金額を算出する。\n- AC-02: 負数量を拒否する。\n',
      'docs/product/architecture/orders.md': '# 既存設計\n整数数量と円単価の積。外部接続なし。\n',
      'work/sessions/publication-fixture.md': '---\nid: publication-fixture\ntitle: 既存案件の未完了作業\nstatus: active\nintent: review\nprovider: manual\nphase: review\ngate: none\ngate_status: not-applicable\nstarted: 2026-09-15T00:00:00Z\nupdated: 2026-09-15T00:00:00Z\n---\n\n# 既存案件の未完了作業\n\n唯一の書込み担当は独立fixture試験。他providerやwriterを起動しない。\n',
      'src/orders.mjs': 'export function total(lines) { if (lines.some(x => x.quantity < 0)) throw Error("negative"); return lines.reduce((sum,x) => sum + x.quantity*x.yen,0); }\n',
      'src/orders.test.mjs': 'import test from "node:test"; import assert from "node:assert/strict"; import {total} from "./orders.mjs"; test("total",()=>assert.equal(total([{quantity:2,yen:120},{quantity:3,yen:10}]),270)); test("negative",()=>assert.throws(()=>total([{quantity:-1,yen:120}]),/negative/));\n',
      'apps/uncommitted.bin': Buffer.from([0, 255, 128, 10]),
      'resources/local.yml': 'fixture: true\r\n',
      '.vscode/settings.json': '{"editor.tabSize":3}\n',
      '.env': 'FIXTURE_ONLY=synthetic-not-a-real-secret\r\n',
      '.harness/local.json': '{"fixture":true,"connected":false}\n'
    };
    for (const name of ['DATABRICKS', 'FRONTEND', 'QUALITY', 'SECURITY']) protectedFiles[`docs/product/standards/${name}.md`] = `# 案件既存${name}基準\n\n既存の基準を保持する。\n`;
    for (const [p, bytes] of Object.entries(protectedFiles)) await put(target, p, bytes);
    await run(`${version}-baseline`, [join(target, 'tools/harness.mjs'), 'release', 'baseline', '--manifest', 'harness/base-release.json'], target);
    const s = { version, target, source, oldManifestSha256: old.manifestSha256, beforeManaged: await inventory(target, Object.keys(old.payloadHashes)), protected: await inventory(target, Object.keys(protectedFiles)), baseline: hash(await readFile(join(target, '.harness/installed-release.json'))) };
    await run(`${version}-old-check`, [join(target, 'tools/harness.mjs'), 'check'], target);
    await run(`${version}-old-product`, ['--test', join(target, 'src/orders.test.mjs')], target);
    const sourcePlan = JSON.parse((await run(`${version}-source-plan`, [join(source, 'tools/update-harness.mjs'), 'plan', '--source', source, '--target', target], tempRoot)).stdout);
    const payloadPlan = JSON.parse((await run(`${version}-payload-plan`, [cli, 'plan', '--source', releaseRoot, '--target', target], tempRoot)).stdout);
    const sourceArtifact = await json(join(target, sourcePlan.plan));
    const payloadArtifact = await json(join(target, payloadPlan.plan));
    assert.deepEqual(sourceArtifact.contract.operations, payloadArtifact.contract.operations);
    assert.equal(sourcePlan.source.kind, 'source-tree'); assert.equal(payloadPlan.source.kind, 'release');
    assert.equal(sourcePlan.canApply, true); assert.equal(sourcePlan.conflicts.length, 0); assert.equal(sourcePlan.counts.delete ?? 0, 0);
    assert.deepEqual(await inventory(target, Object.keys(s.beforeManaged)), s.beforeManaged);
    assert.equal(hash(await readFile(join(target, '.harness/installed-release.json'))), s.baseline);
    await assertPreserved(s);
    targets.push({ ...s, selectedPlan: version === '0.4.0' ? sourcePlan : payloadPlan, planArtifact: version === '0.4.0' ? sourceArtifact : payloadArtifact, runner: version === '0.4.0' ? join(source, 'tools/update-harness.mjs') : cli });
  }
  await save('forward-state', { at: new Date().toISOString(), tempRoot, source, incomingManifestSha256: incoming.manifestSha256, incomingHashes: incoming.payloadHashes, targets, writers: 'Only this isolated test runner; no real projects or providers', planReview: 'Both genuine old manifests; no conflicts/deletions; migrations and operations saved for review; allowed isolated fixture apply only' });
  console.log(JSON.stringify(targets.map(s => ({ version: s.version, target: s.target, plan: s.selectedPlan, protectedCount: Object.keys(s.protected).length })), null, 2));
} else if (phase === 'apply') {
  const state = await json(`${prefix}-forward-state.json`);
  const outcomes = [];
  for (const s of state.targets) {
    const p = s.selectedPlan;
    assert.equal(p.canApply, true); assert.equal(p.conflicts.length, 0); assert.equal(p.counts.delete ?? 0, 0);
    await run(`${s.version}-missing-approval`, [s.runner, 'apply', '--plan', p.plan, '--target', s.target], state.tempRoot, 'reject');
    const originalAgents = await readFile(join(s.target, 'AGENTS.md'));
    await writeFile(join(s.target, 'AGENTS.md'), Buffer.concat([originalAgents, Buffer.from('\n独立試験の案件独自差分\n')]));
    const modified = await inventory(s.target, Object.keys(s.beforeManaged));
    const collision = JSON.parse((await run(`${s.version}-conflict-plan`, [s.runner, 'plan', '--source', releaseRoot, '--target', s.target], state.tempRoot, 'reject')).stdout);
    assert.equal(collision.canApply, false); assert.ok(collision.conflicts.some(x => x.path === 'AGENTS.md'));
    await run(`${s.version}-conflict-apply`, [s.runner, 'apply', '--plan', collision.plan, '--yes', '--target', s.target], state.tempRoot, 'reject');
    await run(`${s.version}-stale-apply`, [s.runner, 'apply', '--plan', p.plan, '--yes', '--target', s.target], state.tempRoot, 'reject');
    assert.deepEqual(await inventory(s.target, Object.keys(s.beforeManaged)), modified);
    assert.equal(hash(await readFile(join(s.target, '.harness/installed-release.json'))), s.baseline);
    await assertPreserved(s);
    // Restore only this test's injected bytes, never source/user changes, then generate a fresh plan.
    await writeFile(join(s.target, 'AGENTS.md'), originalAgents);
    const fresh = JSON.parse((await run(`${s.version}-final-plan`, [s.runner, 'plan', '--source', s.version === '0.4.0' ? state.source : releaseRoot, '--target', s.target], state.tempRoot)).stdout);
    const artifact = await json(join(s.target, fresh.plan));
    assert.deepEqual(artifact.contract.operations, s.planArtifact.contract.operations);
    const applied = JSON.parse((await run(`${s.version}-apply`, [s.runner, 'apply', '--plan', fresh.plan, '--yes', '--target', s.target], state.tempRoot)).stdout);
    assert.equal(applied.status, 'ファイル更新・hash確認済み'); assert.equal(applied.managedFilesVerified, 1067); assert.equal(applied.humanReviewRequired, true);
    assert.deepEqual(await inventory(s.target, Object.keys(state.incomingHashes)), state.incomingHashes);
    await assertPreserved(s);
    const backup = join(s.target, applied.backupPath), backupHashes = {};
    for (const op of artifact.contract.operations.filter(x => ['update', 'delete'].includes(x.action))) { backupHashes[op.path] = hash(await readFile(join(backup, 'files', op.path))); assert.equal(backupHashes[op.path], op.beforeSha256); }
    assert.equal(hash(await readFile(join(backup, 'installed-release.json'))), s.baseline);
    const journal = await json(join(backup, 'recovery.json')); assert.equal(journal.status, 'applied');
    const baseline = await json(join(s.target, '.harness/installed-release.json')); assert.equal(baseline.manifest.version, '0.6.0');
    const nextPlan = JSON.parse((await run(`${s.version}-installed-cli-plan`, [join(s.target, 'tools/update-harness.mjs'), 'plan', '--source', state.source], s.target)).stdout);
    assert.equal(nextPlan.fromVersion, '0.6.0'); assert.equal(nextPlan.toVersion, '0.6.0'); assert.deepEqual(nextPlan.counts, { keep: 1067 });
    await run(`${s.version}-new-check`, [join(s.target, 'tools/harness.mjs'), 'check'], s.target);
    await run(`${s.version}-new-product`, ['--test', join(s.target, 'src/orders.test.mjs')], s.target);
    const context = await run(`${s.version}-new-context`, [join(s.target, 'tools/harness.mjs'), 'context'], s.target); assert.match(context.stdout, /0.6.0/); assert.match(context.stdout, /publication-fixture/);
    for (const noun of ['ハーネス', 'harness', '.harness']) { const routed = JSON.parse((await run(`${s.version}-route-${noun === 'ハーネス' ? 'jp' : noun === 'harness' ? 'en' : 'dot'}`, [join(s.target, 'tools/harness.mjs'), 'route', '--prompt', `この案件の${noun}を、${state.source} から更新して。`], s.target)).stdout); assert.equal(routed.route, 'update-harness'); assert.equal(routed.executionAuthorized, false); }
    const skillPaths = ['harness/skills/update-harness/SKILL.md', '.claude/skills/update-harness/SKILL.md', '.github/skills/update-harness/SKILL.md'];
    const skillHashes = await inventory(s.target, skillPaths); assert.equal(new Set(Object.values(skillHashes)).size, 1);
    assert.deepEqual(await inventory(s.target, Object.keys(state.incomingHashes)), state.incomingHashes); await assertPreserved(s);
    outcomes.push({ version: s.version, target: s.target, applied, allManagedMatch: true, allProtectedMatch: true, protectedCount: Object.keys(s.protected).length, oldBaseManifestPreserved: true, backupCount: Object.keys(backupHashes).length, backupHashes, journal, installedVersion: baseline.manifest.version, nextPlan, skillHashes, rejectionProbes: ['missing-approval', 'conflict-plan', 'conflict-apply', 'stale-apply'], checkBeforeAndAfterPass: true, productBeforeAndAfterPass: true, providerModelsExecuted: false });
  }
  assert.deepEqual(await inventory(state.source, Object.keys(state.incomingHashes)), state.incomingHashes);
  const audit = await json(`${prefix}-audit.json`);
  for (const old of audit.old) assert.deepEqual(await release(old.root), old);
  assert.deepEqual(await release(releaseRoot), audit.incoming);
  assert.deepEqual(await inventory(repo, Object.keys(audit.preserved)), audit.preserved);
  await save('forward-result', { at: new Date().toISOString(), status: 'pass', outcomes, sourceUnchanged: true, oldReleasesUnchanged: true, snapshotPayloadUnchanged: true, rootCandidatePreserved: true, actualProjectsChanged: false, providerModelsExecuted: false, externalNetworkUsed: false, retainedTemp: state.tempRoot });
} else throw new Error('Use audit, prepare or apply');
