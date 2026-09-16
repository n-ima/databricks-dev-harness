import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { registerBaseline } from '../../tools/lib/distribution.mjs';
import { sha256 } from '../../tools/lib/shared.mjs';
const root=process.cwd(),run=process.argv[2];
if(!/^r[1-9][0-9]*$/.test(run??'')) throw new Error('Use unique rN.');
const current=JSON.parse(await readFile('harness/base-release.json'));
assert.equal(current.version,'0.7.1');
const oldRoot=join(root,'.harness/releases/0.7.0');
const oldBytes=await readFile(join(oldRoot,'manifest.json')),old=JSON.parse(oldBytes);
const base=resolve(tmpdir()),temp=await mkdtemp(join(base,'publish-071-update-'));
const commands=[],checks=[];
const emptyGitConfiguration=join(temp,'empty-git-hooks');await mkdir(emptyGitConfiguration);
async function put(target,path,data){await mkdir(dirname(join(target,path)),{recursive:true});await writeFile(join(target,path),data);}
function exec(cwd,command,args,expected=0,timeout=60000){
  const r=spawnSync(command,args,{cwd,encoding:'utf8',shell:false,timeout,maxBuffer:16*1024*1024});
  commands.push({command,args,cwd,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message??null});
  if(expected!==null) assert.equal(r.status,expected,r.stderr||r.stdout);return r;
}
function git(cwd,args){return exec(cwd,'git',['-c',`core.hooksPath=${emptyGitConfiguration}`,'-c',`init.templateDir=${emptyGitConfiguration}`,'-c','core.autocrlf=true',...args]);}
const protectedFiles={'product.config.json':JSON.stringify({name:'synthetic-existing-product'}),'docs/product/requirements/current.md':'案件の進行中の日本語要件\r\n','apps/main.ts':'// unfinished product work\n','package.json':'{"name":"existing-product","private":true}\n','package-lock.json':'{"name":"existing-product","lockfileVersion":3,"packages":{}}\n','.env':'FAKE_FIXTURE_ONLY=not-a-real-secret\n','.harness/local.json':'{"fixture":true}\n','work/sessions/current.md':'設計を継続中\n','.github/skills/product-only/SKILL.md':'案件固有のskill\n'};
async function product(name){
  const target=join(temp,name);await cp(join(oldRoot,'files'),target,{recursive:true});
  await put(target,'old-manifest.json',oldBytes);await registerBaseline(target,{manifest:'old-manifest.json'});
  for(const [path,data] of Object.entries(protectedFiles)) await put(target,path,data);return target;
}
async function verifyOld(){
  assert.deepEqual(await readFile(join(oldRoot,'manifest.json')),oldBytes);
  for(const f of old.managedFiles) assert.equal(sha256(await readFile(join(oldRoot,'files',f.path))),f.sha256,f.path);
}
try{
  await verifyOld();
  const source=join(temp,'source'),clone=join(temp,'fresh-clone');await mkdir(source);
  for(const f of current.managedFiles) await put(source,f.path,await readFile(join(root,f.path)));
  for(const p of ['harness/base-release.json','package.json','package-lock.json']) await put(source,p,await readFile(join(root,p)));
  git(source,['init','-q']);git(source,['add','--all']);git(source,['-c','user.name=Publication test','-c','user.email=fixture@example.invalid','-c','commit.gpgSign=false','commit','-qm','local release canary']);
  git(temp,['clone','--quiet','--no-hardlinks',source,clone]);
  await assert.rejects(stat(join(clone,'.harness')),{code:'ENOENT'});
  exec(clone,process.execPath,['tools/harness-publication.mjs','check','--committed']);
  checks.push('cache-free real Git clone: complete stamped source, LF bytes and committed scope verified');
  const cli=join(clone,'tools/update-harness.mjs');
  for(const [name,selected] of [['from-source',clone],['from-payload',join(root,'.harness/releases/0.7.1')]]){
    const target=await product(name);
    if(name==='from-source'){
      const legacy=exec(target,process.execPath,['tools/update-harness.mjs','plan','--source',selected],null);
      checks.push(`old 0.7.0 CLI plan exit=${legacy.status}; actual update uses the trusted new standalone CLI`);
    }
    const planned=JSON.parse(exec(target,process.execPath,[cli,'plan','--source',selected,'--target',target]).stdout);
    assert.equal(planned.fromVersion,'0.7.0');assert.equal(planned.toVersion,'0.7.1');assert.equal(planned.canApply,true);
    exec(target,process.execPath,[cli,'apply','--plan',planned.plan,'--yes','--target',target]);
    for(const f of current.managedFiles) assert.equal(sha256(await readFile(join(target,f.path))),f.sha256,f.path);
    for(const [path,data] of Object.entries(protectedFiles)) assert.equal(await readFile(join(target,path),'utf8'),data,path);
    const again=JSON.parse(exec(target,process.execPath,[cli,'plan','--source',selected,'--target',target]).stdout);
    assert.equal(again.canApply,true);assert.equal(again.counts.keep,current.managedFiles.length);
    const regression=exec(target,process.execPath,['--test','tests/publication.test.mjs']);
    checks.push(`${name}: 0.7.0 -> 0.7.1, ${current.managedFiles.length} hashes verified, all ${Object.keys(protectedFiles).length} product/local files preserved, repeat idempotent, publication tests pass`);
    console.log(checks.at(-1));
  }
  const conflict=await product('conflict');await put(conflict,'AGENTS.md','案件独自変更を保持\n');
  const before=new Map(await Promise.all(old.managedFiles.map(async f=>[f.path,sha256(await readFile(join(conflict,f.path)))])));
  const planned=JSON.parse(exec(conflict,process.execPath,[cli,'plan','--source',clone,'--target',conflict],1).stdout);
  assert.equal(planned.canApply,false);exec(conflict,process.execPath,[cli,'apply','--plan',planned.plan,'--yes','--target',conflict],2);
  for(const [path,hash] of before) assert.equal(sha256(await readFile(join(conflict,path))),hash,path);
  checks.push(`conflict refuses all writes; all ${old.managedFiles.length} managed files unchanged`);
  await verifyOld();checks.push('published 0.7.0 manifest and every payload file unchanged');
  await writeFile(`work/evidence/2026-09-16-publish-071-update-${run}.json`,JSON.stringify({status:'pass',checkedAt:new Date().toISOString(),fromVersion:old.version,toVersion:current.version,manifestSha256:sha256(await readFile('harness/base-release.json')),checks,commands,networkUsed:false,realProjectChanged:false,realRepositoryCommitted:false},null,2)+'\n',{flag:'wx'});
  console.log(checks.join('\n'));
}finally{
  assert.ok(temp.startsWith(base+sep+'publish-071-update-'));await rm(temp,{recursive:true,force:true});
}
