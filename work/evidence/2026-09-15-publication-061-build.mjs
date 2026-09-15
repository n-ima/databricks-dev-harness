// One publication only. Generated snapshot/copies and evidence; no product or network actions.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, copyFile, access, readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve, join, dirname} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const out=join(root,'.harness/runtime/publish-0.6.1-final');
const base='0944aeb2b7ca46dde609c3d257b7419b021946d1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:67108864});
const exists=async p=>access(p).then(()=>true,()=>false);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const report=async (p,data)=>writeFile(join(root,p),JSON.stringify(data,null,2)+'\n');
const preservation=(await json(join(root,'work/evidence/2026-09-15-publication-060-assembly.json'))).preserved;
const old={'0.4.0':'90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c','0.5.0':'28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18','0.6.0':'4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c'};
async function preserved(){
  for(const [p,s] of Object.entries(preservation))assert.equal(hash(await readFile(join(root,p))),s,'Working change: '+p);
  for(const [v,s] of Object.entries(old)){
    const bytes=await readFile(join(root,'.harness/releases',v,'manifest.json'));assert.equal(hash(bytes),s);
    for(const f of JSON.parse(bytes).managedFiles)assert.equal(hash(await readFile(join(root,'.harness/releases',v,'files',f.path))),f.sha256,'Old payload: '+v+'/'+f.path);
  }
}
async function indexMatches(m){
  const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,windowsHide:true,input:m.managedFiles.map(f=>':'+f.path).join('\n')+'\n',maxBuffer:67108864});
  let offset=0;
  for(const f of m.managedFiles){const end=batch.indexOf(10,offset);const parts=batch.subarray(offset,end).toString().match(/^[a-f0-9]+ blob (\d+)$/);assert.ok(parts,f.path);const n=Number(parts[1]);offset=end+1;assert.equal(hash(batch.subarray(offset,offset+n)),f.sha256,f.path);offset+=n+1;}
  assert.equal(offset,batch.length);
}
const mode=process.argv[2];
if(mode==='prepare'){
  assert.equal(git(['rev-parse','HEAD']).toString().trim(),base);
  await preserved();assert.equal(await exists(out),false,'Snapshot must be new');
  const requirement='docs/harness/requirements/2026-09-15-safe-update-publication.md';
  const previous=git(['show',base+':'+requirement]).toString();
  assert.equal((await readFile(join(root,requirement),'utf8')).replaceAll('\r\n','\n'),previous.replaceAll('P060-','PUB-'),'Only ID spelling may change');
  const selected=['README.md','docs/USAGE.md','docs/harness/operations/SAFE_LOCAL_UPDATE.md','docs/harness/operations/VALIDATION_STATUS.md',requirement,'docs/harness/requirements/2026-09-15-publication-receipt-correction.md','harness.config.json','package.json','package-lock.json','tests/contracts.test.mjs',
    'work/plans/2026-09-15-publication-061.md','work/tasks/PUB-061.md','work/tasks/SU-PUB-060.md','work/sessions/20260915-022729-254-publish-receipt-correction-0-6-1.md','work/sessions/20260915-013942-357-publish-safe-update-0-6-0.md'];
  for(const folder of ['work/evidence','work/reviews'])for(const name of await readdir(join(root,folder)))if(name.startsWith('2026-09-15-publication-061'))selected.push(folder+'/'+name);
  for(const p of git(['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean))assert.ok(selected.includes(p),'Unexpected existing staged file: '+p);
  execFileSync('git',['add','--pathspec-from-file=-','--pathspec-file-nul'],{cwd:root,input:[...new Set(selected)].join('\0')+'\0'});
  await mkdir(out,{recursive:true});git(['checkout-index','--all','--prefix='+out.replaceAll('\\','/')+'/']);
  for(const p of ['tools/lib/scoped-approval.mjs','tests/scoped-approval.test.mjs','docs/harness/design/SCOPED_APPROVALS.md'])assert.equal(await exists(join(out,p)),false);
  for(const p of ['tools/lib/acceptance.mjs','tools/lib/evidence.mjs','tools/update-harness.mjs','tools/lib/distribution.mjs','tools/harness.mjs'])assert.deepEqual(await readFile(join(out,p)),git(['show',base+':'+p]),'No runtime change: '+p);
  const data={at:new Date().toISOString(),base,output:out,selected:[...new Set(selected)],conditionTextUnchanged:true,runtimeUnchanged:true,preserved:preservation,oldManifests:old};
  await report('work/evidence/2026-09-15-publication-061-assembly.json',data);
  await copyFile(join(root,'work/evidence/2026-09-15-publication-061-assembly.json'),join(out,'work/evidence/2026-09-15-publication-061-assembly.json'));
  console.log(JSON.stringify({status:'prepared',files:selected.length,output:out}));
}else if(mode==='materialize'){
  const release=join(out,'.harness/releases/0.6.1'), target=join(root,'.harness/releases/0.6.1');
  assert.equal(await exists(target),false,'Published payload is immutable');
  const bytes=await readFile(join(release,'manifest.json'));const m=JSON.parse(bytes);assert.equal(m.version,'0.6.1');
  assert.deepEqual(bytes,await readFile(join(out,'harness/base-release.json')));
  const proof=await json(join(out,'work/evidence/2026-09-15-publication-061-bytes.json'));assert.equal(proof.status,'pass');assert.equal(proof.manifestSha256,hash(bytes));
  const log=await readFile(join(out,'work/evidence/2026-09-15-publication-061-full.log'),'utf8');assert.match(log,/fail 0/);assert.match(log,/duration_ms/);
  await indexMatches(m);await preserved();
  for(const f of m.managedFiles){assert.equal(hash(await readFile(join(release,'files',f.path))),f.sha256);const dest=join(target,'files',f.path);await mkdir(dirname(dest),{recursive:true});await copyFile(join(release,'files',f.path),dest);}
  await copyFile(join(release,'manifest.json'),join(target,'manifest.json'));await copyFile(join(out,'harness/base-release.json'),join(root,'harness/base-release.json'));
  for(const name of ['2026-09-15-publication-061-full.log','2026-09-15-publication-061-bytes.json'])await copyFile(join(out,'work/evidence',name),join(root,'work/evidence',name));
  const data={at:new Date().toISOString(),version:m.version,manifestSha256:hash(bytes),managedFiles:m.managedFiles.length,indexPayloadParity:true,oldPayloadsAndWorkingChangesPreserved:true};
  await report('work/evidence/2026-09-15-publication-061-materialized.json',data);console.log(JSON.stringify(data));
}else if(mode==='verify-index'){
  const bytes=await readFile(join(root,'harness/base-release.json'));const m=JSON.parse(bytes);assert.equal(m.version,'0.6.1');await indexMatches(m);await preserved();assert.deepEqual(git(['show',':harness/base-release.json']),bytes);
  console.log(JSON.stringify({status:'pass',managedFiles:m.managedFiles.length,manifestSha256:hash(bytes),workingChangesPreserved:true}));
}else throw Error('Use prepare, materialize or verify-index');
