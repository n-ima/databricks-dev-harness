// Independent review runner. Only evidence and fresh isolated fixtures are writable.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const repo = resolve('D:/projects/databricks-dev-harness');
const snapshot = resolve(process.argv[3] ?? join(repo, '.harness/runtime/publish-0.6.1'));
const releaseRoot = join(snapshot, '.harness/releases/0.6.1');
const evidenceName = process.argv[4] ?? '2026-09-15-publication-061-independent';
assert.match(evidenceName, /^2026-09-15-publication-061-independent(?:-[a-z0-9]+)*$/);
const prefix = join(repo, 'work/evidence', evidenceName);
const previous = '69ebf2ebe33da2bc3a551970e40fb5edca9667b7';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const save = (name, value) => writeFile(`${prefix}-${name}.json`, JSON.stringify(value, null, 2) + '\n');
const put = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: 'wx' }); };
const hashes = async (root, paths) => Object.fromEntries(await Promise.all(paths.map(async p => [p, hash(await readFile(join(root, p)))])));
function git(args, options = {}) { const r = spawnSync('git', args, { cwd: repo, maxBuffer: 40*1024*1024, ...options }); assert.equal(r.status, 0, r.stderr.toString()); return r.stdout; }
async function release(root) {
  const bytes = await readFile(join(root, 'manifest.json')), manifest = JSON.parse(bytes);
  for (const f of manifest.managedFiles) { const b = await readFile(join(root, 'files', f.path)); assert.equal(hash(b), f.sha256, f.path); assert.equal(b.length, f.bytes, f.path); }
  return { root, manifest, manifestSha256: hash(bytes) };
}
async function run(label, args, cwd, expected = 0) {
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 10*1024*1024 });
  const record = { at: new Date().toISOString(), command: [process.execPath, ...args], cwd, exitCode: r.status, signal: r.signal, error: r.error?.message ?? null, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  await save(label, record);
  if (expected === 'reject') assert.notEqual(r.status, 0, label); else assert.equal(r.status, expected, `${label}: ${record.stderr}`);
  console.log(JSON.stringify({ label, exitCode: r.status, tail: record.stdout.slice(-250), error: record.stderr.slice(-250) }));
  return record;
}
async function copyRelease(source, target) {
  await mkdir(target);
  for (const f of source.manifest.managedFiles) { await mkdir(dirname(join(target, f.path)), { recursive: true }); await copyFile(join(source.root, 'files', f.path), join(target, f.path)); }
}
const phase = process.argv[2];
if (phase === 'audit') {
  const current = await release(releaseRoot), manifest = current.manifest;
  assert.equal(manifest.version, '0.6.1');
  assert.equal(hash(await readFile(join(snapshot, 'harness/base-release.json'))), current.manifestSha256);
  const expected = Object.fromEntries(manifest.managedFiles.map(f => [f.path, f.sha256]));
  assert.deepEqual(await hashes(snapshot, Object.keys(expected)), expected);
  const batch = git(['cat-file', '--batch'], { input: manifest.managedFiles.map(f => `:${f.path}`).join('\n')+'\n' });
  let offset = 0;
  for (const f of manifest.managedFiles) { const end = batch.indexOf(10, offset), header = batch.subarray(offset, end).toString(); assert.match(header, /^[a-f0-9]+ blob \d+$/); const n = Number(header.split(' ')[2]); assert.equal(hash(batch.subarray(end+1,end+1+n)), f.sha256, 'index:'+f.path); offset=end+2+n; }
  const oldRequirementPath = 'docs/harness/requirements/2026-09-15-safe-update-publication.md';
  const oldRequirement = git(['show', `${previous}:${oldRequirementPath}`]).toString('utf8');
  const corrected = await readFile(join(snapshot, oldRequirementPath), 'utf8');
  assert.equal(corrected.replace(/PUB-(0[1-4]):/g, 'P060-$1:'), oldRequirement, 'Only four IDs may differ');
  const invariantFiles = ['tools/lib/acceptance.mjs','tools/lib/evidence.mjs','tools/update-harness.mjs','tools/lib/distribution.mjs','tools/agent-hook.mjs','harness/skills/update-harness/SKILL.md','harness/policy.json'];
  const unchanged = [];
  for (const p of invariantFiles) {
    if (!manifest.managedFiles.some(f => f.path === p)) continue;
    assert.equal(hash(await readFile(join(snapshot,p))), hash(git(['show',`${previous}:${p}`])), p); unchanged.push(p);
  }
  for (const p of ['tools/harness.mjs','tools/lib/distribution.mjs','docs/harness/operations/CLI_REFERENCE.md']) assert.doesNotMatch(await readFile(join(snapshot,p),'utf8'), /scoped-approval|SCOPED_APPROVALS|approval-scope/);
  assert.ok(!manifest.managedFiles.some(f => /scoped-approval|SCOPED_APPROVALS/.test(f.path)));
  const old = [];
  for (const v of ['0.4.0','0.5.0','0.6.0']) { const r=await release(join(repo,'.harness/releases',v)); old.push({version:v,manifestSha256:r.manifestSha256,managedFiles:r.manifest.managedFiles.length}); }
  const retained = ['work/quality/safe-local-update.json','work/reviews/2026-09-15-publication-060-review.md','work/reviews/2026-09-15-publication-060-safe-update-acceptance.json','work/reviews/2026-09-15-publication-060-acceptance.json','work/evidence/2026-09-15-publication-060-independent-quality-verify.json'];
  for (const p of retained) assert.equal(hash(await readFile(join(repo,p))),hash(git(['show',`HEAD:${p}`])),p);
  const candidatePaths=Object.keys((await json(join(repo,'work/evidence/2026-09-15-publication-060-assembly.json'))).preserved);
  const preserved = await hashes(repo,candidatePaths);
  const {acceptanceIds,sealEvidence,validateReceipt}=await import(pathToFileURL(join(snapshot,'tools/lib/evidence.mjs')));
  const fixture = await mkdtemp(join(tmpdir(),'publication-061-seal-'));
  for (const p of ['AGENTS.md','harness.config.json','tools/agent-hook.mjs']) await put(fixture,p,await readFile(join(snapshot,p)));
  const errors=[];
  for(const [p,prefixId] of [[oldRequirementPath,'PUB'],['docs/harness/requirements/2026-09-15-publication-receipt-correction.md','FIX']]) {
    const doc=await readFile(join(snapshot,p),'utf8'), ids=acceptanceIds(doc);
    assert.deepEqual(ids,[1,2,3,4].map(n=>`${prefixId}-0${n}`));
    const q=join(fixture,p); await mkdir(dirname(q),{recursive:true}); await writeFile(q,doc);
    const evidence='work/evidence/observed.md'; await mkdir(dirname(join(fixture,evidence)),{recursive:true}); await writeFile(join(fixture,evidence),'Simulated isolated seal fixture only.\n');
    const review={reviewer:'/root/publication_061_review',provider:'codex',independent:true,acceptance:ids.map(id=>({id,status:'pass',evidence:[evidence]}))};
    const opt={review:'work/review.json',session:'isolated-format-probe',requirement:p,output:`work/${prefixId}-receipt.json`};
    await writeFile(join(fixture,opt.review),JSON.stringify(review)); await sealEvidence(fixture,opt); await validateReceipt(fixture,opt.output);
    for(const [label,items] of [['missing',review.acceptance.slice(1)],['duplicate',[...review.acceptance,review.acceptance[0]]],['legacy-id',review.acceptance.map((a,i)=>i?a:{...a,id:'P060-01'})],['unknown',review.acceptance.map((a,i)=>i?a:{...a,id:'OTHER-01'})]]) {
      const before=await readFile(join(fixture,opt.output)); await writeFile(join(fixture,opt.review),JSON.stringify({...review,acceptance:items}));
      await assert.rejects(sealEvidence(fixture,opt), e=>{errors.push({document:prefixId,probe:label,error:e.message});return /acceptance|ID/i.test(e.message);}); assert.deepEqual(await readFile(join(fixture,opt.output)),before);
    }
    await writeFile(join(fixture,opt.review),JSON.stringify({...review,acceptance:review.acceptance.map((a,i)=>i===3?{...a,status:'not-run'}:a)}));
    const incomplete=await sealEvidence(fixture,opt); assert.equal(incomplete.status,'fail'); await assert.rejects(validateReceipt(fixture,opt.output),/Passing independent/);
    assert.throws(()=>acceptanceIds(doc.replace(`${ids[0]}:`,'P060-01:')),/Invalid acceptance ID/);
  }
  await run('check',[join(snapshot,'tools/harness.mjs'),'check'],snapshot);
  const suite=await run('contracts',['--test','--test-reporter=tap',join(snapshot,'tests/contracts.test.mjs')],snapshot);
  assert.match(suite.stdout,/# fail 0/);
  await save('audit',{at:new Date().toISOString(),status:'pass',reviewer:'/root/publication_061_review',environment:{node:process.version,platform:process.platform},manifestSha256:current.manifestSha256,managedFiles:manifest.managedFiles.length,snapshotPayloadIndexParity:true,oldRequirementOnlyFourIdChanges:true,invariantFiles:unchanged,oldReleases:old,historicalQualityReviewUnchanged:true,preserved,hard03Excluded:true,seal:{simulatedFixture:fixture,fullPassValidated:true,notRunSealsFailAndCannotComplete:true,rejections:errors},contractsTail:suite.stdout.slice(-220)});
} else if (phase === 'prepare') {
  const incoming=await release(releaseRoot), old=await release(join(repo,'.harness/releases/0.6.0'));
  const temp=await mkdtemp(join(tmpdir(),'publication-061-forward-')),target=join(temp,'existing project 0.6.0'); await copyRelease(old,target);
  await put(target,'harness/base-release.json',await readFile(join(old.root,'manifest.json')));
  const product={
    'product.config.json':'{"schemaVersion":1,"name":"publication-061-fixture","displayName":"隔離案件","initializedAt":"2026-09-15T00:00:00Z"}\n',
    'package.json':'{"name":"existing-project","version":"9.8.7","type":"module","private":true}\n',
    'package-lock.json':'{"name":"existing-project","lockfileVersion":3}\n',
    'README.md':'# 既存案件\r\n保持する。\r\n',
    'docs/product/requirements/example.md':'# 既存要件\n\n- AC-01: 2倍の整数を返す。\n',
    'work/sessions/existing.md':'---\nid: existing\ntitle: 既存案件の再開\nstatus: active\nintent: review\nprovider: manual\nphase: review\ngate: none\ngate_status: not-applicable\nstarted: 2026-09-15T00:00:00Z\nupdated: 2026-09-15T00:00:00Z\n---\n\n唯一のwriterは隔離試験。\n',
    'src/example.mjs':'export const twice = x => {if (!Number.isInteger(x)) throw Error("integer"); return x*2;};\n',
    'src/example.test.mjs':'import test from "node:test";import assert from "node:assert/strict";import {twice} from "./example.mjs";test("existing product",()=>{assert.equal(twice(3),6);assert.throws(()=>twice(1.5),/integer/);});\n',
    'apps/existing.bin':Buffer.from([0,255,128,13,10]),
    '.env':'SYNTHETIC_FIXTURE_ONLY=not-a-secret\r\n',
    '.vscode/settings.json':'{"editor.tabSize":3}\n',
    '.harness/local.json':'{"connected":false,"fixture":true}\n'
  };
  for(const [p,b] of Object.entries(product))await put(target,p,b);
  await run('baseline',[join(target,'tools/harness.mjs'),'release','baseline','--manifest','harness/base-release.json'],target);
  await run('product-before',['--test',join(target,'src/example.test.mjs')],target);
  const cli=join(target,'tools/update-harness.mjs');
  const plan=JSON.parse((await run('plan',[cli,'plan','--source',releaseRoot],target)).stdout);
  assert.equal(plan.fromVersion,'0.6.0');assert.equal(plan.toVersion,'0.6.1');assert.equal(plan.canApply,true);assert.equal(plan.counts.delete??0,0);
  const artifact=await json(join(target,plan.plan));
  assert.deepEqual(await hashes(target,old.manifest.managedFiles.map(f=>f.path)),Object.fromEntries(old.manifest.managedFiles.map(f=>[f.path,f.sha256])));
  await save('state',{at:new Date().toISOString(),temp,target,plan,artifactPath:plan.plan,changedOperations:artifact.contract.operations.filter(op=>op.action!=='keep'),oldManifestSha256:old.manifestSha256,baselineSha256:hash(await readFile(join(target,'.harness/installed-release.json'))),protected:await hashes(target,Object.keys(product)),incomingManifestSha256:incoming.manifestSha256});
  console.log(JSON.stringify({target,plan,protectedFiles:Object.keys(product).length},null,2));
} else if(phase==='apply') {
  const s=await json(`${prefix}-state.json`),target=s.target,cli=join(target,'tools/update-harness.mjs');
  const old=await release(join(repo,'.harness/releases/0.6.0')),beforePaths=old.manifest.managedFiles.map(f=>f.path),approvedArtifact=await json(join(target,s.artifactPath));
  assert.ok(target.startsWith(join(tmpdir(),'publication-061-forward-')));assert.equal(s.plan.canApply,true);assert.equal(s.plan.counts.delete??0,0);
  const original=await readFile(join(target,'AGENTS.md'));await writeFile(join(target,'AGENTS.md'),Buffer.concat([original,Buffer.from('\n独立fixtureだけの競合。\n')]));
  const modified=await hashes(target,beforePaths);
  const conflict=JSON.parse((await run('conflict-plan',[cli,'plan','--source',releaseRoot],target,'reject')).stdout);assert.equal(conflict.canApply,false);assert.ok(conflict.conflicts.some(c=>c.path==='AGENTS.md'));
  await run('conflict-apply',[cli,'apply','--plan',conflict.plan,'--yes'],target,'reject');
  assert.deepEqual(await hashes(target,beforePaths),modified);assert.equal(hash(await readFile(join(target,'.harness/installed-release.json'))),s.baselineSha256);assert.deepEqual(await hashes(target,Object.keys(s.protected)),s.protected);
  // Revert only this isolated probe's injected conflict.
  await writeFile(join(target,'AGENTS.md'),original);
  const plan=JSON.parse((await run('fresh-plan',[cli,'plan','--source',releaseRoot],target)).stdout);const artifact=await json(join(target,plan.plan));assert.deepEqual(artifact.contract.operations,approvedArtifact.contract.operations);
  const applied=JSON.parse((await run('apply',[cli,'apply','--plan',plan.plan,'--yes'],target)).stdout);assert.equal(applied.humanReviewRequired,true);
  const incoming=await release(releaseRoot),expected=Object.fromEntries(incoming.manifest.managedFiles.map(f=>[f.path,f.sha256]));assert.deepEqual(await hashes(target,Object.keys(expected)),expected);assert.deepEqual(await hashes(target,Object.keys(s.protected)),s.protected);
  assert.equal(hash(await readFile(join(target,'harness/base-release.json'))),s.oldManifestSha256);
  const baseline=await json(join(target,'.harness/installed-release.json'));assert.equal(baseline.manifest.version,'0.6.1');
  const backup=join(target,applied.backupPath);let backupCount=0;
  for(const op of artifact.contract.operations.filter(x=>['update','delete'].includes(x.action))){assert.equal(hash(await readFile(join(backup,'files',op.path))),op.beforeSha256);backupCount++;}
  assert.equal(hash(await readFile(join(backup,'installed-release.json'))),s.baselineSha256);assert.equal((await json(join(backup,'recovery.json'))).status,'applied');
  const next=JSON.parse((await run('next-plan',[cli,'plan','--source',releaseRoot],target)).stdout);assert.equal(next.fromVersion,'0.6.1');assert.deepEqual(next.counts,{keep:incoming.manifest.managedFiles.length});
  await run('product-after',['--test',join(target,'src/example.test.mjs')],target);
  const context=await run('resume',[join(target,'tools/harness.mjs'),'context'],target);assert.match(context.stdout,/existing/);assert.match(context.stdout,/0.6.1/);
  const audit=await json(`${prefix}-audit.json`);assert.deepEqual(await hashes(repo,Object.keys(audit.preserved)),audit.preserved);
  for(const prior of audit.oldReleases){const r=await release(join(repo,'.harness/releases',prior.version));assert.equal(r.manifestSha256,prior.manifestSha256);}
  await save('forward',{at:new Date().toISOString(),status:'pass',manifestSha256:incoming.manifestSha256,from:'0.6.0',to:'0.6.1',target,planCounts:plan.counts,allManagedMatch:true,managedFiles:incoming.manifest.managedFiles.length,protectedFiles:Object.keys(s.protected).length,allProtectedMatch:true,backupCount,oldBaseManifestPreserved:true,conflictPlanAndApplyRejected:true,rejectionLeavesBytesAndBaselineUnchanged:true,installedVersion:baseline.manifest.version,nextPlanCounts:next.counts,productBeforeAfterPass:true,newProcessResumesSession:true,oldReleasesUnchanged:true,rootCandidateUnchanged:true,realProjectOrDatabricksChanged:false,networkUsed:false});
} else throw Error('Use audit, prepare, or apply');
