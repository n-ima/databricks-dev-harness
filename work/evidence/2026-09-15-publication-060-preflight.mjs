// Read-only publication checks; writes only the evidence report below.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const hash = b => createHash('sha256').update(b).digest('hex');
const json = async p => JSON.parse(await readFile(join(root, p), 'utf8'));
const git = args => execFileSync('git', args, {cwd:root, windowsHide:true, maxBuffer:268435456});
const assembly = await json('work/evidence/2026-09-15-publication-060-assembly.json');
assert.equal(git(['rev-parse','HEAD']).toString().trim(), assembly.base);
const manifestBytes = await readFile(join(root, 'harness/base-release.json'));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.version, '0.6.0');
assert.equal(manifest.managedFiles.length, 1067);
assert.equal(hash(manifestBytes), '4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c');
const names = [...manifest.managedFiles.map(f=>f.path), 'harness/base-release.json'];
const batch = execFileSync('git', ['cat-file','--batch'], {cwd:root, windowsHide:true,
  input:names.map(p=>':'+p).join('\n')+'\n', maxBuffer:268435456});
const index = new Map(); let offset=0;
for (const name of names) {
  const end=batch.indexOf(10, offset); assert.ok(end>offset);
  const header=batch.subarray(offset,end).toString(); const match=header.match(/^[a-f0-9]+ blob (\d+)$/);
  assert.ok(match, 'Missing staged blob: '+name);
  const size=Number(match[1]); offset=end+1;
  index.set(name,batch.subarray(offset,offset+size)); offset+=size+1;
}
assert.equal(offset,batch.length);
assert.deepEqual(index.get('harness/base-release.json'),manifestBytes);
for(const f of manifest.managedFiles) {
  assert.equal(hash(index.get(f.path)),f.sha256,'Staged manifest mismatch: '+f.path);
  assert.equal(hash(await readFile(join(root,'.harness/releases/0.6.0/files',f.path))),f.sha256,'Payload mismatch: '+f.path);
  assert.ok(!/scoped-approval|SCOPED_APPROVAL/.test(f.path),'Unadopted managed file: '+f.path);
}
assert.ok(!index.get('tools/harness.mjs').toString().includes('approval-scope'));
assert.ok(!index.get('tools/lib/distribution.mjs').toString().includes('tests/scoped-approval.test.mjs'));
assert.ok(!index.get('docs/harness/operations/CLI_REFERENCE.md').toString().includes('SCOPED_APPROVALS'));
for(const [path,sha] of Object.entries(assembly.preserved)) assert.equal(hash(await readFile(join(root,path))),sha,'Working candidate changed: '+path);
const oldReleases={'0.4.0':'90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c','0.5.0':'28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18'};
for(const [version,sha] of Object.entries(oldReleases)) {
  const bytes=await readFile(join(root,'.harness/releases',version,'manifest.json'));
  assert.equal(hash(bytes),sha,'Old manifest changed: '+version);
  for(const f of JSON.parse(bytes).managedFiles) assert.equal(hash(await readFile(join(root,'.harness/releases',version,'files',f.path))),f.sha256,'Old payload changed: '+f.path);
}
const staged=git(['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean);
for(const name of staged) assert.ok(assembly.staged.includes(name)||name==='harness/base-release.json'||/^work\/(evidence|reviews)\/2026-09-15-publication-060/.test(name)||/^work\/reviews\/20260915-(010502-538-safe-local-harness-update|013942-357-publish-safe-update-0-6-0)\.receipt\.json$/.test(name),'Unexpected staged file: '+name);
const report={checkedAt:new Date().toISOString(),status:'pass',baseCommit:assembly.base,version:manifest.version,managedFiles:manifest.managedFiles.length,
  manifestSha256:hash(manifestBytes),indexPayloadParity:true,unadoptedCandidateExcluded:true,workingCandidatePreserved:true,oldReleasesPreserved:true,
  stagedFiles:staged.length,realProductChanged:false,databricksAccessed:false};
await writeFile(join(root,'work/evidence/2026-09-15-publication-060-preflight.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
