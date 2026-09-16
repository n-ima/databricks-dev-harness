import { mkdtemp, mkdir, writeFile, readFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRelease } from '../../tools/lib/distribution.mjs';
import { checkPublication } from '../../tools/lib/publication.mjs';
const base=resolve(tmpdir()),root=await mkdtemp(join(base,'publication-deletion-review-'));
async function put(p,v) { await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n'); }
function git(args) { const r=spawnSync('git',['-C',root,'-c','core.autocrlf=false',...args],{encoding:'utf8',shell:false,timeout:15000});assert.equal(r.status,0,r.stderr);return r.stdout.trim(); }
async function stamp(v) {
  await put('harness.config.json',{harnessVersion:v});await put('package.json',{version:v});await put('package-lock.json',{version:v,packages:{'':{version:v}}});
  await put(`docs/harness/releases/${v}.md`,'変更・移行案内\n');const release=await createRelease(root,{version:v});await put('harness/base-release.json',release.manifest);
}
function commit(){git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgSign=false','commit','-qm','fixture']);return git(['rev-parse','HEAD']);}
try {
  await put('.gitignore','.harness/\n');await put('AGENTS.md','Fixture\n');await put('tools/obsolete.mjs','old managed file\n');await stamp('1.0.0');
  git(['init','--initial-branch=main']);git(['add','--all']);const old=commit();
  await unlink(join(root,'tools/obsolete.mjs'));await stamp('1.1.0');
  git(['add','harness/base-release.json','harness.config.json','package.json','package-lock.json','docs/harness/releases/1.1.0.md']);const head=commit();
  if(process.argv.includes('--expect-fixed')) {
    await assert.rejects(checkPublication(root,{committed:true,base:old,revision:head}),/送信commitの管理file集合/);
    git(['add','--all']);const corrected=commit();
    const report=await checkPublication(root,{committed:true,base:old,revision:corrected});
    assert.equal(report.status,'stamp-valid');
    console.log(JSON.stringify({scenario:'未stage削除は拒否し、削除commit後は受理',rejectedUncommittedDeletion:true,report},null,2));
  } else {
    const report=await checkPublication(root,{committed:true,base:old,revision:head});
    console.log(JSON.stringify({scenario:'削除だけstageし忘れたcommitをmainへ送る',head,workingDiff:git(['diff','--name-only','HEAD']),committedObsoleteFile:git(['show','HEAD:tools/obsolete.mjs']),report},null,2));
  }
} finally { assert.ok(root.startsWith(base+sep+'publication-deletion-review-'));await rm(root,{recursive:true,force:true}); }
