import assert from 'node:assert/strict';
import fs, { access, link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { syncSkillsSafely } from '../tools/lib/skill-sync.mjs';
import { correctedVendorBytes, vendorPatches } from '../tools/lib/vendor-patches.mjs';
import { sha256 } from '../tools/lib/shared.mjs';
import { freshTemplateFixture } from './helpers/initialization.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, 'truth-assets-independent-'));
  t.after(async () => {
    assert.ok(root.startsWith(base + sep) && root.slice(base.length + 1).startsWith('truth-assets-independent-'));
    assert.equal((await lstat(root)).isSymbolicLink(), false);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function put(root, path, bytes) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), bytes);
}
async function present(path) {
  try { await access(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
const expected = () => new Map([['core/SKILL.md', Buffer.from('# Current instruction\n')]]);
const targets = root => [join(root, '.claude/skills'), join(root, '.github/skills')];
async function seed(root) {
  for (const target of targets(root)) await put(target, 'core/SKILL.md', '# Previous instruction\n');
}

for (const index of [0, 1]) for (const kind of ['unknown-file', 'empty-unknown-directory']) {
  test(`IND-ASSET preflight ${kind} in provider ${index} preserves both trees`, async t => {
    const root = await fixture(t); await seed(root);
    const target = targets(root)[index];
    if (kind === 'unknown-file') await put(target, 'core/custom.txt', 'user-owned');
    else await mkdir(join(target, 'custom-empty'), { recursive: true });
    await assert.rejects(syncSkillsSafely(root, targets(root), expected()), /Unknown|unmanaged/i);
    for (const p of targets(root)) assert.equal(await readFile(join(p, 'core/SKILL.md'), 'utf8'), '# Previous instruction\n');
    assert.equal(await present(join(root, '.harness/agent-assets/backups')), false);
    assert.equal(await present(join(target, kind === 'unknown-file' ? 'core/custom.txt' : 'custom-empty')), true);
  });
}
for (const index of [0, 1]) {
  test(`IND-ASSET hardlink in provider ${index} rejects before writes`, async t => {
    const root = await fixture(t); await seed(root);
    const target = join(targets(root)[index], 'core/SKILL.md');
    await link(target, join(root, 'hardlink-original.md'));
    await assert.rejects(syncSkillsSafely(root, targets(root), expected()), /hardlink|link/i);
    for (const p of targets(root)) assert.equal(await readFile(join(p, 'core/SKILL.md'), 'utf8'), '# Previous instruction\n');
    assert.equal(await readFile(join(root, 'hardlink-original.md'), 'utf8'), '# Previous instruction\n');
  });
}
for (const location of ['target-root', 'expected-subdirectory']) {
  test(`IND-ASSET junction at ${location} rejects without changing linked data`, async t => {
    const root = await fixture(t), to = targets(root);
    await put(to[0], 'core/SKILL.md', '# Previous instruction\n');
    const outside = join(root, 'linked-data');
    await put(outside, 'core/SKILL.md', '# Linked data\n');
    if (location === 'target-root') {
      await mkdir(dirname(to[1]), { recursive: true });
      await symlink(outside, to[1], 'junction');
    } else {
      await mkdir(to[1], { recursive: true });
      await symlink(join(outside, 'core'), join(to[1], 'core'), 'junction');
    }
    await assert.rejects(syncSkillsSafely(root, to, expected()), /junction|link/i);
    assert.equal(await readFile(join(to[0], 'core/SKILL.md'), 'utf8'), '# Previous instruction\n');
    assert.equal(await readFile(join(outside, 'core/SKILL.md'), 'utf8'), '# Linked data\n');
  });
}
test('IND-ASSET file symlink is rejected when host permits creating one', async t => {
  const root = await fixture(t); await put(targets(root)[0], 'core/SKILL.md', '# Previous instruction\n');
  await put(root, 'original.md', '# Linked instruction\n');
  const linked = join(targets(root)[1], 'core/SKILL.md');
  await mkdir(dirname(linked), { recursive: true });
  try { await symlink(join(root, 'original.md'), linked, 'file'); }
  catch (e) { if (['EPERM', 'EACCES'].includes(e.code)) { t.skip('Host cannot create file symlinks; junction paths are tested separately.'); return; } throw e; }
  await assert.rejects(syncSkillsSafely(root, targets(root), expected()), /link/i);
  assert.equal(await readFile(join(root, 'original.md'), 'utf8'), '# Linked instruction\n');
});
test('IND-ASSET initial sync, complete backup, idempotence and retry preserve prior bytes', async t => {
  const root = await fixture(t), to = targets(root);
  const first = await syncSkillsSafely(root, to, expected());
  assert.equal(first.changed, 2); assert.equal(first.backup, null);
  const next = new Map([['core/SKILL.md', Buffer.from('# New instruction\n')]]);
  const second = await syncSkillsSafely(root, to, next);
  assert.equal(second.changed, 2);
  const backup = JSON.parse(await readFile(join(second.backup, 'manifest.json'), 'utf8'));
  assert.equal(backup.files.length, 2);
  for (const item of backup.files) {
    const content = await readFile(join(second.backup, item.path));
    assert.equal(content.toString(), '# Current instruction\n'); assert.equal(sha256(content), item.sha256);
  }
  assert.deepEqual(await syncSkillsSafely(root, to, next), { changed: 0, backup: null });
  assert.equal((await readdir(join(root, '.harness/agent-assets/backups'))).length, 1);
});
for (const failure of ['rename', 'write']) test('IND-ASSET interrupted second ' + failure + ' retains both backups and explicit retry works', async t => {
  const root = await fixture(t); await seed(root);
  const to = targets(root), failPath = join(to[1], 'core/SKILL.md');
  const originalRename = fs.rename, originalOpen = fs.open;
  let injected = false;
  fs.rename = async (from, destination) => {
    if (failure === 'rename' && resolve(destination) === failPath) { injected = true; throw new Error('Independent injected rename failure'); }
    return originalRename(from, destination);
  };
  fs.open = async (path, ...args) => {
    const handle = await originalOpen(path, ...args);
    if (failure === 'write' && String(path).startsWith(failPath + '.tmp-')) {
      const originalWrite = handle.writeFile.bind(handle);
      handle.writeFile = async () => { injected = true; await originalWrite('partial'); throw new Error('Independent injected write failure'); };
    }
    return handle;
  };
  syncBuiltinESMExports();
  try { await assert.rejects(syncSkillsSafely(root, to, expected()), /injected (rename|write) failure/); }
  finally { fs.rename = originalRename; fs.open = originalOpen; syncBuiltinESMExports(); }
  assert.equal(injected, true);
  const backupRoot = join(root, '.harness/agent-assets/backups'), [backupId] = await readdir(backupRoot);
  const backup = JSON.parse(await readFile(join(backupRoot, backupId, 'manifest.json'), 'utf8'));
  assert.equal(backup.files.length, 2);
  for (const item of backup.files) assert.equal(await readFile(join(backupRoot, backupId, item.path), 'utf8'), '# Previous instruction\n');
  // A failed atomic rename may leave an implementation-owned temporary file.
  // Retry must remain usable without deleting an unknown user file.
  const retry = await syncSkillsSafely(root, to, expected());
  assert.equal(retry.changed, 1);
  for (const p of to) assert.equal(await readFile(join(p, 'core/SKILL.md'), 'utf8'), '# Current instruction\n');
});
test('IND-ASSET cleanup failure reports the exact leftover and preserves destination and backups', async t => {
  const root = await fixture(t); await seed(root);
  const to = targets(root), failPath = join(to[1], 'core/SKILL.md');
  const originalRename = fs.rename, originalUnlink = fs.unlink; let leftover = null;
  fs.rename = async (from, destination) => {
    if (resolve(destination) === failPath) { leftover = String(from); throw new Error('Independent rename failure'); }
    return originalRename(from, destination);
  };
  fs.unlink = async path => {
    if (String(path) === leftover) throw Object.assign(new Error('Independent cleanup failure'), { code: 'EBUSY' });
    return originalUnlink(path);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(syncSkillsSafely(root, to, expected()), error => error.message.includes('temporary cleanup failed') && error.message.includes(leftover)); }
  finally { fs.rename = originalRename; fs.unlink = originalUnlink; syncBuiltinESMExports(); }
  assert.equal(await present(leftover), true);
  assert.equal(await readFile(failPath, 'utf8'), '# Previous instruction\n');
  assert.equal((await readdir(join(root, '.harness/agent-assets/backups'))).length, 1);
  await assert.rejects(syncSkillsSafely(root, to, expected()), /Unknown|unmanaged/i);
  assert.equal(await present(leftover), true);
});

const originalVendor = Buffer.from('# Original upstream\nOld guidance\n');
const spec = path => ({ path, sourceSha256: sha256(originalVendor), edits: [{ before: 'Old guidance', after: 'Reviewed correction' }] });
async function patchFixture(root, entries = [spec('skill/SKILL.md')]) {
  await put(root, 'harness/vendor-patches.json', JSON.stringify({ schemaVersion: 1, upstreamVersion: '0.2.10', files: entries }));
  for (const item of entries) await put(root, 'vendor/' + item.path, originalVendor);
}
test('IND-VENDOR original and already-corrected inputs are deterministic; modified input is refused', () => {
  const corrected = correctedVendorBytes(originalVendor, spec('unused'));
  assert.equal(corrected.toString(), '# Original upstream\nReviewed correction\n');
  assert.deepEqual(correctedVendorBytes(corrected, spec('unused')), corrected);
  assert.throws(() => correctedVendorBytes(Buffer.concat([originalVendor, Buffer.from('drift')]), spec('unused')));
  assert.throws(() => correctedVendorBytes(Buffer.concat([corrected, Buffer.from('drift')]), spec('unused')));
});
test('IND-VENDOR version mismatch and later-file hash mismatch cause no partial write', async t => {
  const root = await fixture(t); await patchFixture(root, [spec('one/SKILL.md'), spec('two/SKILL.md')]);
  const vendor = join(root, 'vendor');
  await assert.rejects(vendorPatches(root, vendor, '0.2.11', { write: true }), /version/i);
  await put(vendor, 'two/SKILL.md', 'unexpected upstream');
  await assert.rejects(vendorPatches(root, vendor, '0.2.10', { write: true }));
  assert.deepEqual(await readFile(join(vendor, 'one/SKILL.md')), originalVendor);
  assert.equal(await readFile(join(vendor, 'two/SKILL.md'), 'utf8'), 'unexpected upstream');
});
test('IND-VENDOR read-only validation does not patch; write then check is idempotent', async t => {
  const root = await fixture(t); await patchFixture(root); const vendor = join(root, 'vendor');
  await assert.rejects(vendorPatches(root, vendor, '0.2.10'), /not applied/i);
  assert.deepEqual(await readFile(join(vendor, 'skill/SKILL.md')), originalVendor);
  assert.equal((await vendorPatches(root, vendor, '0.2.10', { write: true })).changed, 1);
  assert.equal((await vendorPatches(root, vendor, '0.2.10')).changed, 0);
});
test('IND-VENDOR actual Lakebase patch roundtrips upstream hash and provider parity', async () => {
  const manifest = JSON.parse(await readFile(join(repository, 'harness/vendor-patches.json'), 'utf8'));
  const [item] = manifest.files;
  const content = await readFile(join(repository, 'vendor/databricks-skills', item.path));
  let original = content.toString();
  for (const edit of [...item.edits].reverse()) original = original.replace(edit.after, edit.before);
  assert.equal(sha256(Buffer.from(original)), item.sourceSha256);
  assert.deepEqual(correctedVendorBytes(Buffer.from(original), item), content);
  for (const provider of ['.claude', '.github']) assert.deepEqual(await readFile(join(repository, provider, 'skills', item.path)), content);
  assert.match(content.toString(), /HARNESS CORRECTION/);
  assert.doesNotMatch(content.toString(), /migrate to the `postgres` resource key/);
});

for (const scenario of ['same-version', 'changed-version', 'changed-hash']) {
  test('IND-VENDOR full refresh uses mocked installer/legal data and ' + scenario, async t => {
    const parent = await fixture(t), root = join(parent, 'project');
    await freshTemplateFixture(repository, root);
    const cli = join(root, 'tools/harness.mjs');
    const initial = spawnSync(process.execPath, [cli, 'setup', '--project-name', 'review-fixture', '--skip-agent-skills'], { cwd: root, encoding: 'utf8', timeout: 60000 });
    assert.equal(initial.status, 0, initial.stderr + initial.stdout);
    const protectedPaths = ['vendor/databricks-skills.lock.json', 'vendor/databricks-skills/databricks-lakebase/SKILL.md', '.claude/skills/databricks-lakebase/SKILL.md', '.github/skills/databricks-lakebase/SKILL.md'];
    const before = await Promise.all(protectedPaths.map(path => readFile(join(root, path))));
    const loader = [
      'import cp from "node:child_process";',
      'import fs from "node:fs";',
      'import {join} from "node:path";',
      'import {pathToFileURL} from "node:url";',
      'import {syncBuiltinESMExports} from "node:module";',
      'const root=' + JSON.stringify(root) + ',scenario=' + JSON.stringify(scenario) + ';',
      'const patch=JSON.parse(fs.readFileSync(join(root,"harness/vendor-patches.json"),"utf8")).files[0];',
      'const calls={installer:0,legal:0,networkUsed:false};',
      'cp.spawnSync=(command,args)=>{',
      ' if(command!=="databricks")throw Error("Unexpected external process prohibited: "+command);',
      ' if(args[0]==="-v")return {status:0,stdout:"Databricks CLI v1.6.0",stderr:""};',
      ' if(args[0]!=="aitools"||args[1]!=="install")throw Error("Unexpected Databricks command prohibited");',
      ' calls.installer++;const stage=join(root,args[args.indexOf("--path")+1]);',
      ' fs.cpSync(join(root,"vendor/databricks-skills"),stage,{recursive:true});',
      ' const path=join(stage,patch.path);let text=fs.readFileSync(path,"utf8");',
      ' for(const edit of [...patch.edits].reverse())text=text.replace(edit.after,edit.before);',
      ' fs.writeFileSync(path,text+(scenario==="changed-hash"?"\\nUnexpected upstream drift":""));',
      ' return {status:0,stdout:"Using skills version "+(scenario==="changed-version"?"0.2.11":"0.2.10"),stderr:""};',
      '};syncBuiltinESMExports();',
      'globalThis.fetch=async url=>{const name=String(url).split("/").at(-1);if(!["LICENSE","NOTICE"].includes(name))throw Error("Unexpected network request prohibited");calls.legal++;return new Response(fs.readFileSync(join(root,"vendor/databricks-skills",name)),{status:200,headers:{"content-type":"text/plain"}});};',
      'process.on("exit",()=>console.log("INDEPENDENT_MOCK_IO="+JSON.stringify(calls)));',
      'process.argv=[process.execPath,join(root,"tools/harness.mjs"),"setup","--project-name","review-fixture","--refresh-skills"];',
      'await import(pathToFileURL(join(root,"tools/harness.mjs")));',
    ].join('\n');
    const refreshed = spawnSync(process.execPath, ['--input-type=module', '-e', loader], { cwd: root, encoding: 'utf8', timeout: 60000 });
    const calls = JSON.parse(refreshed.stdout.match(/INDEPENDENT_MOCK_IO=(.+)/)?.[1] || 'null');
    assert.deepEqual(calls, { installer: 1, legal: 2, networkUsed: false });
    if (scenario === 'same-version') {
      assert.equal(refreshed.status, 0, refreshed.stderr + refreshed.stdout);
      const corrected = await readFile(join(root, protectedPaths[1]));
      assert.match(corrected.toString(), /HARNESS CORRECTION/);
      for (const path of protectedPaths.slice(2)) assert.deepEqual(await readFile(join(root, path)), corrected);
    } else {
      assert.notEqual(refreshed.status, 0);
      for (let i = 0; i < protectedPaths.length; i++) assert.deepEqual(await readFile(join(root, protectedPaths[i])), before[i]);
    }
  });
}
