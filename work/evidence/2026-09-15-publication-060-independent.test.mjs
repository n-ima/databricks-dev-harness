import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as updater from '../../.harness/runtime/publish-0.6.0/tools/lib/distribution.mjs';

// Independent fixtures use hand-built manifests, not createRelease/initial apply.
const repo = fileURLToPath(new URL('../../.harness/runtime/publish-0.6.0/', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const put = async (root, path, bytes) => {
  await fs.mkdir(dirname(join(root, path)), { recursive: true });
  await fs.writeFile(join(root, path), bytes);
};
const json = (root, path, value) => put(root, path, JSON.stringify(value));
const readJson = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const manifest = (version, files) => ({ schemaVersion: 1, version, releasedAt: '2026-09-15T00:00:00Z', managedFiles: Object.entries(files).map(([path, bytes]) => ({ path, sha256: hash(bytes), bytes: Buffer.byteLength(bytes), executable: false, strategy: 'replace' })), migrations: [] });

async function fixture(t, withRunner = false) {
  const tempParent = resolve(tmpdir());
  const root = await fs.mkdtemp(join(tempParent, 'publication-060-independent-'));
  t.after(async () => {
    const actual = await fs.realpath(root);
    const actualParent = await fs.realpath(tempParent);
    assert.ok(actual.startsWith(`${actualParent}${sep}`));
    assert.ok(actual.slice(actualParent.length + 1).startsWith('publication-060-independent-'));
    await fs.rm(actual, { recursive: true, force: true });
  });
  t.mock.method(console, 'log', () => {});
  const target = join(root, 'project'), release = join(root, 'release'), source = join(root, 'expanded source');
  const oldFiles = { 'AGENTS.md': 'old\n', 'harness.config.json': '{"harnessVersion":"0.5.0"}\n', 'tools/keep.mjs': 'throw new Error("DATA ONLY");\n', 'scripts/obsolete.mjs': 'old script\n' };
  const newFiles = { 'AGENTS.md': 'new\n', 'harness.config.json': '{"harnessVersion":"0.6.0"}\n', 'tools/keep.mjs': oldFiles['tools/keep.mjs'], 'scripts/new.mjs': 'new script\n' };
  if (withRunner) for (const path of ['tools/update-harness.mjs', 'tools/lib/distribution.mjs', 'tools/lib/shared.mjs']) newFiles[path] = await fs.readFile(join(repo, path));
  const protectedFiles = { 'product.config.json': '{"name":"fixture"}', 'package.json': '{"private":true}', 'package-lock.json': '{"lockfileVersion":3}', 'docs/product/requirements/existing.md': '既存仕様\r\n', 'work/sessions/current.md': '未完了\r\n', 'apps/main.bin': Buffer.from([0, 1, 255, 10]), 'src/data.bin': Buffer.from([128, 0]), 'resources/settings.yml': 'protected\r\n', '.env': 'FIXTURE_SECRET_ONLY=1\r\n', '.harness/local.json': '{}', '.vscode/settings.json': '{}', 'README.md': 'project\r\n' };
  for (const [path, bytes] of Object.entries({ ...oldFiles, ...protectedFiles })) await put(target, path, bytes);
  const oldManifest = manifest('0.5.0', oldFiles), newManifest = manifest('0.6.0', newFiles);
  await json(target, '.harness/installed-release.json', { schemaVersion: 1, manifest: oldManifest, manifestSha256: hash(JSON.stringify(oldManifest)) });
  for (const [path, bytes] of Object.entries(newFiles)) {
    await put(release, `files/${path}`, bytes);
    await put(source, path, bytes);
  }
  await json(release, 'manifest.json', newManifest);
  await json(source, 'harness/base-release.json', newManifest);
  return { root, target, release, source, oldFiles, newFiles, oldManifest, newManifest, protectedFiles };
}
async function sameFiles(root, files) {
  for (const [path, expected] of Object.entries(files)) assert.deepEqual(await fs.readFile(join(root, path)), Buffer.from(expected), path);
}
const runCli = (runner, cwd, args) => spawnSync(process.execPath, [runner, ...args], { cwd, encoding: 'utf8', timeout: 20000 });

test('IND-01 / SU-01,02 hand-built release and Git-free source yield same operations and preserve binary/local bytes', async t => {
  const f = await fixture(t);
  const before = await fs.readFile(join(f.target, '.harness/installed-release.json'));
  const a = await updater.planLocalUpdate(f.target, { source: f.release });
  const b = await updater.planLocalUpdate(f.target, { source: f.source });
  assert.equal(a.contract.sourceSelection.kind, 'release');
  assert.equal(b.contract.sourceSelection.kind, 'source-tree');
  assert.deepEqual(a.contract.operations, b.contract.operations);
  await sameFiles(f.target, { ...f.oldFiles, ...f.protectedFiles });
  assert.deepEqual(await fs.readFile(join(f.target, '.harness/installed-release.json')), before);
  const applied = await updater.applyUpdate(f.target, { plan: b.path, yes: true });
  await sameFiles(f.target, { ...f.newFiles, ...f.protectedFiles });
  await assert.rejects(fs.stat(join(f.target, 'scripts/obsolete.mjs')), { code: 'ENOENT' });
  await sameFiles(join(f.target, applied.backupPath, 'files'), { 'AGENTS.md': f.oldFiles['AGENTS.md'], 'harness.config.json': f.oldFiles['harness.config.json'], 'scripts/obsolete.mjs': f.oldFiles['scripts/obsolete.mjs'] });
});

test('IND-02 / SU-03 invalid clean source, forbidden paths, ambiguous forms and mismatched cache fail before snapshot metadata', async t => {
  for (const variant of ['crlf', 'missing', 'size', 'traversal', 'secret', 'ambiguous', 'wrong-cache']) await t.test(variant, async t => {
    const f = await fixture(t);
    if (variant === 'crlf') await put(f.source, 'AGENTS.md', 'new\r\n');
    if (variant === 'missing') await fs.unlink(join(f.source, 'AGENTS.md'));
    if (variant === 'size') { f.newManifest.managedFiles[0].bytes += 1; await json(f.source, 'harness/base-release.json', f.newManifest); }
    if (['traversal', 'secret'].includes(variant)) { f.newManifest.managedFiles[0].path = variant === 'traversal' ? 'tools/../../outside' : 'tools/.env'; await json(f.source, 'harness/base-release.json', f.newManifest); }
    if (variant === 'ambiguous') await json(f.source, 'manifest.json', f.newManifest);
    if (variant === 'wrong-cache') { await fs.cp(f.release, join(f.source, '.harness/releases/0.6.0'), { recursive: true }); const changed = { ...f.newManifest, migrations: [{ description: 'unexpected migration' }] }; await json(f.source, '.harness/releases/0.6.0/manifest.json', changed); }
    await assert.rejects(updater.planLocalUpdate(f.target, { source: f.source }));
    await assert.rejects(fs.stat(join(f.target, '.harness/updates')), { code: 'ENOENT' });
    await sameFiles(f.target, { ...f.oldFiles, ...f.protectedFiles });
  });
});

test('IND-03 / SU-03 target junction and managed parent junction reject before writes', async t => {
  const f = await fixture(t);
  const alias = join(f.root, 'target-alias');
  await fs.symlink(f.target, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(updater.planLocalUpdate(alias, { source: f.source }), /Symlink|junction/);
  const outside = join(f.root, 'outside');
  await fs.mkdir(outside);
  await fs.rename(join(f.target, 'tools'), join(outside, 'tools'));
  await fs.symlink(join(outside, 'tools'), join(f.target, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(updater.planLocalUpdate(f.target, { source: f.source }), /Symlink|junction/);
  assert.equal(await fs.readFile(join(f.target, 'AGENTS.md'), 'utf8'), 'old\n');
});

test('IND-04 / SU-04 recreated deleted file is detected after writes; baseline and backup retained; replay denied', async t => {
  const f = await fixture(t);
  const plan = await updater.planLocalUpdate(f.target, { source: f.source });
  const before = await fs.readFile(join(f.target, '.harness/installed-release.json'));
  const originalUnlink = fs.unlink;
  let injected = false;
  const mock = t.mock.method(fs, 'unlink', async path => {
    const result = await originalUnlink(path);
    if (path === join(f.target, 'scripts/obsolete.mjs')) { injected = true; await put(f.target, 'scripts/obsolete.mjs', 'resurrected'); }
    return result;
  });
  syncBuiltinESMExports();
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
  await assert.rejects(updater.applyUpdate(f.target, { plan: plan.path, yes: true }), /Post-update verification failed: scripts\/obsolete.mjs/);
  assert.equal(injected, true);
  assert.deepEqual(await fs.readFile(join(f.target, '.harness/installed-release.json')), before);
  const backup = join(f.target, '.harness/backups', plan.contract.id);
  assert.equal((await readJson(join(backup, 'recovery.json'))).status, 'interrupted');
  assert.equal(await fs.readFile(join(backup, 'files/scripts/obsolete.mjs'), 'utf8'), 'old script\n');
  await assert.rejects(updater.applyUpdate(f.target, { plan: plan.path, yes: true }), /changed|already|interrupted/);
  await sameFiles(f.target, f.protectedFiles);
});

test('IND-05 / SU-03,05 actual release runner upgrades 0.5 project; installed runner completes subsequent apply', async t => {
  const f = await fixture(t, true);
  const runner = join(f.release, 'files/tools/update-harness.mjs');
  const p1 = runCli(runner, f.root, ['plan', '--source', f.release, '--target', f.target]);
  assert.equal(p1.status, 0, p1.stderr);
  const a1 = runCli(runner, f.root, ['apply', '--plan', JSON.parse(p1.stdout).plan, '--yes', '--target', f.target]);
  assert.equal(a1.status, 0, a1.stderr);
  assert.equal(JSON.parse(a1.stdout).status, 'ファイル更新・hash確認済み');
  const next = join(f.root, 'next-release');
  const files = { ...f.newFiles, 'AGENTS.md': 'third\n', 'harness.config.json': '{"harnessVersion":"0.7.0"}\n' };
  for (const [path, bytes] of Object.entries(files)) await put(next, `files/${path}`, bytes);
  await json(next, 'manifest.json', manifest('0.7.0', files));
  const localRunner = join(f.target, 'tools/update-harness.mjs');
  const p2 = runCli(localRunner, f.target, ['plan', '--source', next]);
  assert.equal(p2.status, 0, p2.stderr);
  assert.equal(JSON.parse(p2.stdout).fromVersion, '0.6.0');
  const a2 = runCli(localRunner, f.target, ['apply', '--plan', JSON.parse(p2.stdout).plan, '--yes']);
  assert.equal(a2.status, 0, a2.stderr);
  assert.equal((await readJson(join(f.target, '.harness/installed-release.json'))).manifest.version, '0.7.0');
  await sameFiles(f.target, { ...files, ...f.protectedFiles });
});

