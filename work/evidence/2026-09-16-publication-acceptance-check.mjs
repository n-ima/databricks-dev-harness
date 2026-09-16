import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { sha256 } from '../../tools/lib/shared.mjs';
import { checkPublication, guardStatus } from '../../tools/lib/publication.mjs';
import { reviewHash, checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const root=process.cwd(),contractPath='work/quality/2026-09-16-publication-review-ready.json';
const contract=JSON.parse(await readFile(contractPath));
const expectedReview='f3b721ebfe127feabd8e27ccb925bd14a0d7b6ed7c0e7ed00a16c3516755b030';
const expectedStamp='9cfc0dd3697008330e20fe81f48c3ef712399ab42e7686a211dd4382daa49717';
assert.equal(reviewHash(contract),expectedReview);
const snapshot=new Map();
async function ref(path,expected){const bytes=await readFile(path),hash=sha256(bytes);if(expected)assert.equal(hash,expected,path);const value={path,sha256:hash,bytes:bytes.length};snapshot.set(path,value);return value;}
async function references(value){
  if(!value||typeof value!=='object')return;
  if(typeof value.path==='string'&&typeof value.sha256==='string')await ref(value.path,value.sha256);
  for(const item of Object.values(value))await references(item);
}
await references(contract);await ref(contractPath);await ref('harness/base-release.json',expectedStamp);
const provider=JSON.parse(await readFile('work/evidence/2026-09-16-publication-provider-ci-snapshot.json'));
for(const item of provider.snapshots)await ref(item.path,item.sha256);
for(const skill of ['publish-harness','improve-harness','orchestrate-work','release-work']){
  const canonical=await ref(`harness/skills/${skill}/SKILL.md`);
  for(const owner of ['.claude','.github'])await ref(`${owner}/skills/${skill}/SKILL.md`,canonical.sha256);
}
const source=await checkPublication(root,{base:'f06743b0c941872b6db041a88ee6fe7adb72168f'});
assert.equal(source.manifestSha256,expectedStamp);assert.equal(source.managedFiles,1102);assert.equal(source.committed,false);
const guard=await guardStatus(root);assert.equal(guard.status,'installed');
const diagnostic=await checkDelivery(root,contract,{phase:'verify'});
assert.deepEqual(diagnostic.findings.map(f=>f.code),['MISSING_REVIEW']);assert.equal(diagnostic.recordedExecutions,5);
const canaryPath='work/evidence/2026-09-16-publication-real-update-r2.json',canary=JSON.parse(await readFile(canaryPath));
assert.equal(canary.status,'pass');assert.equal(canary.manifestSha256,expectedStamp);assert.equal(canary.fromVersion,'0.6.1');assert.equal(canary.toVersion,'0.7.0');
assert.equal(canary.networkUsed,false);assert.equal(canary.realProjectChanged,false);assert.equal(canary.realRepositoryCommitted,false);await ref(canaryPath);
const regression=JSON.parse(await readFile('work/evidence/2026-09-16-publication-r2.json'));
for(const check of regression.checks){assert.equal(check.exitCode,0,check.name);assert.equal(check.error,null,check.name);}
const all=regression.checks.find(c=>c.name==='regression').stdout;
for(const pattern of [/tests 723/,/pass 721/,/fail 0/,/skipped 2/])assert.match(all,pattern);
const commands=[];
for(const args of [['work/evidence/2026-09-16-publication-deleted-file-probe.mjs','--expect-fixed'],['work/evidence/2026-09-16-publication-review-probes.mjs']]){
  await ref(args[0]);const r=spawnSync(process.execPath,args,{encoding:'utf8',shell:false,timeout:30000,maxBuffer:8*1024*1024});
  commands.push({command:process.execPath,args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message??null});assert.equal(r.status,0,r.stderr);
}
const markdown='work/reviews/2026-09-16-publication-acceptance.md';await ref(markdown);await ref('work/evidence/2026-09-16-publication-acceptance-check.mjs');
const rawPath='work/evidence/2026-09-16-publication-acceptance-verification.json';
const observation={status:'pass',checkedAt:new Date().toISOString(),reviewer:'/root/publication_code_review',scope:'PUBC-01 through PUBC-05, local safeguards and release preparation only',source,guard,diagnostic,commands,canary:await ref(canaryPath),snapshot:[...snapshot.values()],remotePushed:false,databricksUsed:false,realProjectChanged:false};
await writeFile(rawPath,JSON.stringify(observation,null,2)+'\n',{flag:'wx'});const rawRef=await ref(rawPath);
const mapped={
 'PUBC-01':['docs/harness/operations/HARNESS_DEVELOPMENT.md','harness/skills/publish-harness/SKILL.md','work/reviews/2026-09-16-publication-forward-review.md'],
 'PUBC-02':['work/evidence/2026-09-16-publication-unstamped-rejection.json','work/evidence/2026-09-16-publication-release-bytes.json','work/evidence/2026-09-16-publication-r2.json'],
 'PUBC-03':['work/reviews/2026-09-16-publication-code-review.md','work/evidence/2026-09-16-publication-source-check.json','work/evidence/2026-09-16-publication-provider-ci-snapshot.json'],
 'PUBC-04':[canaryPath,'work/evidence/2026-09-16-publication-real-update.mjs','docs/harness/releases/0.7.0.md'],
 'PUBC-05':['work/evidence/2026-09-16-publication-r2.json','work/reviews/2026-09-16-publication-design-review.md','work/reviews/2026-09-16-publication-code-review.md','work/reviews/2026-09-16-publication-forward-review.md']
};
const review={schemaVersion:1,reviewer:'/root/publication_code_review',actor:'publication-code-review',provider:'codex',context:'/root/publication_code_review',independent:true,status:'pass',reviewedSha256:expectedReview,coverage:{requirements:contract.requirements,risks:contract.risks.map(r=>r.id),interfaces:[],operations:contract.operations.map(o=>o.id)},acceptance:Object.entries(mapped).map(([id,evidence])=>({id,status:'pass',evidence:[markdown,rawPath,...evidence]})),evidence:[await ref(markdown),rawRef],snapshot:{version:'0.7.0',manifestSha256:expectedStamp,managedFiles:1102,contract:await ref(contractPath),files:[...snapshot.values()]},scope:'対策実装・ローカル配布準備のみ。GitHub公開・実案件適用・Databricks配備は対象外。',limitations:['Windows only; 2 file-symlink tests skipped','Hosted CI and branch protection not verified','Live Claude Code/Copilot and Databricks not tested','Uncommitted local candidate; no remote push'],createdAt:new Date().toISOString()};
await writeFile('work/reviews/2026-09-16-publication-acceptance.json',JSON.stringify(review,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'pass',acceptance:review.acceptance.map(a=>a.id),reviewedSha256:expectedReview,snapshotFiles:snapshot.size,rawEvidence:rawPath},null,2));
