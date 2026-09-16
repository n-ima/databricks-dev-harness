import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkPublication, prePush, installGuard, guardStatus } from '../tools/lib/publication.mjs';
import { createRelease, assertPublicationUpgrade, planLocalUpdate, applyUpdate, registerBaseline } from '../tools/lib/distribution.mjs';
import { resolveRoute } from '../tools/lib/workloads.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const zero='0'.repeat(40);
async function put(root,path,value) { await mkdir(dirname(join(root,path)),{recursive:true}); await writeFile(join(root,path),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'); }
async function temp(t) { const base=resolve(tmpdir()),root=await mkdtemp(join(base,'publication-test-')); t.after(async()=>{assert.ok(root.startsWith(base+sep+'publication-test-'));await rm(root,{recursive:true,force:true});});return root; }
function git(root,args,pass=true) {
  const r=spawnSync('git',['-C',root,'-c','core.autocrlf=false',...args],{encoding:'utf8',shell:false,timeout:30000});
  if(pass) assert.equal(r.status,0,r.stderr||r.stdout);return r;
}
function commit(root) { git(root,['add','--all']);git(root,['-c','user.name=Publication fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgSign=false','commit','-qm','fixture']);return git(root,['rev-parse','HEAD']).stdout.trim(); }
async function version(root,v) {
  await put(root,'harness.config.json',{harnessVersion:v});
  await put(root,'package.json',{name:'harness-fixture',version:v});
  await put(root,'package-lock.json',{name:'harness-fixture',version:v,lockfileVersion:3,packages:{'':{name:'harness-fixture',version:v}}});
  await put(root,`docs/harness/releases/${v}.md`,'変更と移行: fixture。案件を上書きしない。\n');
}
async function stamp(root,v) { await version(root,v); const r=await createRelease(root,{version:v}); await put(root,'harness/base-release.json',r.manifest);return r; }
async function source(t) {
  t.mock.method(console,'log',()=>{});const root=await temp(t);
  await put(root,'AGENTS.md','Harness fixture\n');await put(root,'.gitignore','.harness/\n');
  for(const path of ['tools/harness-publication.mjs','tools/lib/publication.mjs','tools/lib/distribution.mjs','tools/lib/shared.mjs']) {await mkdir(dirname(join(root,path)),{recursive:true});await cp(join(repo,path),join(root,path));}
  await stamp(root,'1.0.0');return root;
}
async function gitSource(t) {const root=await source(t);git(root,['init','-q','--initial-branch=work']);const sha=commit(root);return {root,sha};}

test('publication checks complete source without using cached payload',async t=>{
  const root=await source(t);const r=await checkPublication(root);assert.equal(r.version,'1.0.0');assert.equal(r.certifiesAcceptance,false);
  await put(root,'tools/added.mjs','new\n');await assert.rejects(checkPublication(root),/未収録/);
  await put(root,'AGENTS.md','changed\n');await assert.rejects(checkPublication(root),/hash mismatch/);
});
test('publication rejects missing stamp, deleted file and same-byte omitted file',async t=>{
  const root=await source(t);const stampPath=join(root,'harness/base-release.json');const original=await readFile(stampPath,'utf8');
  await unlink(stampPath);await assert.rejects(checkPublication(root));await writeFile(stampPath,original);
  const manifest=JSON.parse(original);manifest.managedFiles=manifest.managedFiles.filter(f=>f.path!=='AGENTS.md');await put(root,'harness/base-release.json',manifest);await assert.rejects(checkPublication(root),/未収録/);
  await writeFile(stampPath,original);await unlink(join(root,'AGENTS.md'));await assert.rejects(checkPublication(root));
});
test('package and lock versions and release notes are required',async t=>{
  for(const path of ['package.json','package-lock.json']) {
    const root=await source(t);const data=JSON.parse(await readFile(join(root,path)));data.version='2.0.0';await put(root,path,data);await assert.rejects(checkPublication(root),/版が不一致/);
  }
  const root=await source(t);const data=JSON.parse(await readFile(join(root,'package-lock.json')));data.packages[''].version='0.1.0';await put(root,'package-lock.json',data);await assert.rejects(checkPublication(root),/版が不一致/);
  const noNotes=await source(t);await unlink(join(noNotes,'docs/harness/releases/1.0.0.md'));const fresh=await createRelease(noNotes,{output:'.harness/releases/notes-candidate'});await put(noNotes,'harness/base-release.json',fresh.manifest);await assert.rejects(checkPublication(noNotes),/移行案内/);
});
test('immutable version compares files, migrations and executable attributes; rejects downgrade',async t=>{
  const root=await source(t);const m=JSON.parse(await readFile(join(root,'harness/base-release.json')));
  for(const mutate of [v=>v.managedFiles[0].sha256='a'.repeat(64),v=>v.managedFiles[0].executable=!v.managedFiles[0].executable,v=>v.migrations.push({description:'changed'})]) {const copy=structuredClone(m);mutate(copy);assert.throws(()=>assertPublicationUpgrade(copy,m),/同じ公開版/);}
  const older=structuredClone(m);older.version='0.9.0';assert.throws(()=>assertPublicationUpgrade(older,m),/戻す/);assertPublicationUpgrade(m,m);
});
test('source checker and hook reject product repositories and links',async t=>{
  const root=await source(t);await put(root,'product.config.json',{name:'product'});await assert.rejects(checkPublication(root),/開発元/);await assert.rejects(installGuard(root),/開発元/);
  const linked=await source(t),outside=await temp(t);await put(outside,'secret.md','outside\n');
  try {await symlink(outside,join(linked,'tools/outside'),process.platform==='win32'?'junction':'dir');}
  catch(e) {if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('Host does not allow directory links');return;}throw e;}
  await assert.rejects(checkPublication(linked),/link|junction|Symlink/);
});
test('Git guard matches actual destination main and only committed HEAD',async t=>{
  const {root,sha}=await gitSource(t);
  assert.equal((await prePush(root,`refs/heads/work ${sha} refs/heads/main ${zero}\n`)).status,'checked');
  assert.equal((await prePush(root,`refs/heads/work ${sha} refs/heads/backup ${zero}\n`)).status,'not-main');
  await assert.rejects(prePush(root,`refs/heads/work ${zero} refs/heads/main ${sha}\n`),/削除/);
  await assert.rejects(prePush(root,`refs/heads/work ${'b'.repeat(40)} refs/heads/main ${zero}\n`),/HEAD/);
  await assert.rejects(checkPublication(root,{base:'a'.repeat(40)}),/Git確認/);
  await put(root,'package.json',{version:'1.0.0',name:'modified'});await assert.rejects(checkPublication(root,{committed:true}),/commit/);
});
test('Git guard refuses staged uncommitted publication even when source stamp is coherent',async t=>{
  const {root}=await gitSource(t);await put(root,'tools/new.mjs','new\n');await stamp(root,'1.1.0');git(root,['add','--all']);await assert.rejects(checkPublication(root,{committed:true}),/commit/);
});
test('Git guard refuses a deleted managed file still present in the pushed commit',async t=>{
  const {root,sha}=await gitSource(t);
  await unlink(join(root,'tools/harness-publication.mjs'));
  await stamp(root,'1.1.0');
  git(root,['add','harness/base-release.json','harness.config.json','package.json','package-lock.json','docs/harness/releases/1.1.0.md']);
  git(root,['-c','user.name=Publication fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgSign=false','commit','-qm','forgot deletion']);
  await assert.rejects(checkPublication(root,{committed:true,base:sha}),/送信commitの管理file集合/);
  commit(root);
  assert.equal((await checkPublication(root,{committed:true,base:sha})).status,'stamp-valid');
});
test('hook install is idempotent and preserves existing hook and custom hooksPath',async t=>{
  const {root}=await gitSource(t);assert.equal((await guardStatus(root)).status,'not-installed');assert.equal((await installGuard(root)).status,'installed');assert.equal((await installGuard(root)).status,'installed');
  const other=await gitSource(t);await put(other.root,'.git/hooks/pre-push','#!/bin/sh\necho custom\n');await assert.rejects(installGuard(other.root),/既存pre-push/);assert.match(await readFile(join(other.root,'.git/hooks/pre-push'),'utf8'),/custom/);
  const custom=await gitSource(t);git(custom.root,['config','--local','core.hooksPath','custom-hooks']);await assert.rejects(installGuard(custom.root),/core.hooksPath/);assert.equal(git(custom.root,['config','--local','--get','core.hooksPath']).stdout.trim(),'custom-hooks');
});
test('real local Git push passes stamped main, blocks stale main and still allows backup',async t=>{
  const {root,sha}=await gitSource(t),remote=await temp(t);git(remote,['init','--bare','-q']);git(root,['remote','add','origin',remote]);await installGuard(root);
  git(root,['push','origin','HEAD:main']);assert.equal(git(remote,['rev-parse','refs/heads/main']).stdout.trim(),sha);
  await put(root,'AGENTS.md','unstamped\n');commit(root);
  const failed=git(root,['push','origin','HEAD:main'],false);assert.notEqual(failed.status,0);assert.match(failed.stderr,/公開を停止/);assert.equal(git(remote,['rev-parse','refs/heads/main']).stdout.trim(),sha);
  git(root,['push','origin','HEAD:backup']);
  await stamp(root,'1.1.0');const next=commit(root);git(root,['push','origin','HEAD:main']);assert.equal(git(remote,['rev-parse','refs/heads/main']).stdout.trim(),next);
  assert.notEqual(git(root,['push','origin',':main'],false).status,0);
});
test('cache-free source and immutable payload update preserve product files and stop conflicts',async t=>{
  const root=await source(t),old=join(root,'.harness/releases/1.0.0');const original=await readFile(join(old,'manifest.json'));
  await put(root,'AGENTS.md','new instructions\n');const next=await stamp(root,'1.1.0');const clean=await temp(t);
  await cp(root,clean,{recursive:true,filter:path=>!path.includes(`${sep}.harness`)});
  for(const selected of [clean,join(root,next.path)]) {
    const target=await temp(t);await cp(join(old,'files'),target,{recursive:true});await put(target,'original-manifest.json',original.toString());
    // Registration consumes the genuine old manifest, not a snapshot of edited product files.
    await registerBaseline(target,{manifest:'original-manifest.json'});await put(target,'product.config.json',{name:'fixture-product'});
    const owned={'docs/product/spec.md':'案件定義','apps/app.ts':'案件コード','package.json':'案件依存','.env':'FAKE_FIXTURE_ONLY','work/sessions/product.md':'進行中の記録'};
    for(const [path,bytes] of Object.entries(owned)) await put(target,path,bytes);
    const plan=await planLocalUpdate(target,{source:selected,quiet:true});assert.equal(plan.canApply,true);await applyUpdate(target,{plan:plan.path,yes:true,quiet:true});assert.equal(await readFile(join(target,'AGENTS.md'),'utf8'),'new instructions\n');
    for(const [path,bytes] of Object.entries(owned)) assert.equal(await readFile(join(target,path),'utf8'),bytes,path);
    const second=await planLocalUpdate(target,{source:selected,quiet:true});assert.ok(second.contract.operations.every(op=>op.action==='keep'));
  }
  const conflict=await temp(t);await cp(join(old,'files'),conflict,{recursive:true});await put(conflict,'original-manifest.json',original.toString());await registerBaseline(conflict,{manifest:'original-manifest.json'});await put(conflict,'product.config.json',{name:'fixture'});await put(conflict,'AGENTS.md','案件独自policy');
  const blocked=await planLocalUpdate(conflict,{source:clean,quiet:true});assert.equal(blocked.canApply,false);await assert.rejects(applyUpdate(conflict,{plan:blocked.path,yes:true,quiet:true}),/conflicts/);assert.equal(await readFile(join(conflict,'AGENTS.md'),'utf8'),'案件独自policy');assert.deepEqual(await readFile(join(old,'manifest.json')),original);
});
test('natural-language publication routes only the harness source and preserves explicit inspection',async t=>{
  // This test is distributed to initialized products too; the host is not necessarily source.
  const fixture=await temp(t);await cp(join(repo,'harness'),join(fixture,'harness'),{recursive:true});await cp(join(repo,'vendor'),join(fixture,'vendor'),{recursive:true});
  for(const prompt of ['mainにpushしてください','mainに反映してください','ハーネスの新版を公開してください']) assert.equal((await resolveRoute(fixture,prompt)).id,'publish-harness');
  assert.equal((await resolveRoute(fixture,'mainへの公開を調べて',{intent:'investigate'})).id,'investigate');
  await put(fixture,'product.config.json',{name:'fixture'});
  assert.notEqual((await resolveRoute(fixture,'mainにpushしてください')).id,'publish-harness');await assert.rejects(resolveRoute(fixture,'公開',{intent:'publish-harness'}),/開発元/);
});
