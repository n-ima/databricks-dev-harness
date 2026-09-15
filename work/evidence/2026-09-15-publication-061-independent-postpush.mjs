// Read-only remote and local publication verification; outputs independent evidence only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=resolve('D:/projects/databricks-dev-harness'),snapshot=join(repo,'.harness/runtime/publish-0.6.1-final');
const commit='8bdfce99da6ca9d2829d88aa8704266a5c0b4586',parent='0944aeb2b7ca46dde609c3d257b7419b021946d1';
const expectedManifest='d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d';
const evidence='work/evidence/2026-09-15-publication-061-independent-postpush.json';
const hash=b=>createHash('sha256').update(b).digest('hex');
const observations=[];
function exec(command,args,{record=true,input}={}) {
  const r=spawnSync(command,args,{cwd:repo,input,windowsHide:true,timeout:60000,maxBuffer:40*1024*1024});
  assert.equal(r.status,0,r.stderr?.toString()??r.error?.message);
  if(record)observations.push({at:new Date().toISOString(),command:[command,...args],cwd:repo,exitCode:r.status,stdout:r.stdout.toString('utf8'),stderr:r.stderr.toString('utf8')});
  return r.stdout;
}
if(process.argv[2]==='observe') {
  const remote=exec('git',['ls-remote','origin','refs/heads/main']).toString().trim().split(/\s+/)[0];assert.equal(remote,commit);
  const repository=JSON.parse(exec('gh',['repo','view','n-ima/databricks-dev-harness','--json','nameWithOwner,isPrivate,isTemplate,defaultBranchRef']));
  assert.equal(repository.isPrivate,true);assert.equal(repository.isTemplate,true);assert.equal(repository.defaultBranchRef.name,'main');
  assert.equal(exec('git',['show','-s','--format=%P',commit]).toString().trim(),parent);
  const bytes=exec('git',['show',`${commit}:harness/base-release.json`],{record:false}),manifest=JSON.parse(bytes);
  assert.equal(hash(bytes),expectedManifest);assert.equal(manifest.version,'0.6.1');assert.equal(manifest.managedFiles.length,1068);
  assert.deepEqual(bytes,await readFile(join(snapshot,'harness/base-release.json')));
  const batch=exec('git',['cat-file','--batch'],{record:false,input:manifest.managedFiles.map(f=>`${commit}:${f.path}`).join('\n')+'\n'});
  let offset=0;
  for(const f of manifest.managedFiles){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString();assert.match(header,/^[a-f0-9]+ blob \d+$/);const count=Number(header.split(' ')[2]);const body=batch.subarray(end+1,end+1+count);assert.equal(count,f.bytes,f.path);assert.equal(hash(body),f.sha256,f.path);assert.equal(hash(await readFile(join(snapshot,f.path))),f.sha256,f.path);offset=end+2+count;}
  assert.equal(offset,batch.length);
  const paths=exec('git',['ls-tree','-r','--name-only',commit],{record:false}).toString().trim().split('\n');assert.ok(!paths.some(p=>/scoped-approval|SCOPED_APPROVALS/.test(p)));
  for(const p of ['tools/harness.mjs','tools/lib/distribution.mjs','docs/harness/operations/CLI_REFERENCE.md'])assert.doesNotMatch(exec('git',['show',`${commit}:${p}`],{record:false}).toString(),/scoped-approval|SCOPED_APPROVALS|approval-scope/);
  const runs=JSON.parse(exec('gh',['run','list','--repo','n-ima/databricks-dev-harness','--commit',commit,'--json','databaseId,headSha,name,status,conclusion,url,event']));
  const workflow=JSON.parse(exec('gh',['api',`repos/n-ima/databricks-dev-harness/actions/runs?head_sha=${commit}&per_page=100`]));
  const checks=JSON.parse(exec('gh',['api',`repos/n-ima/databricks-dev-harness/commits/${commit}/check-runs`,'-H','Accept: application/vnd.github+json']));
  const report={at:new Date().toISOString(),reviewer:'/root/publication_061_review',status:'pass',commit,parent,remoteMain:remote,repository,manifestSha256:expectedManifest,managedFiles:manifest.managedFiles.length,allPublishedBlobBytesAndSizesMatch:true,allSnapshotManagedBytesMatch:true,batchVerification:{command:['git','cat-file','--batch'],inputs:'公開commitとmanifest全管理pathを1回のbatchへ渡す',verified:1068,rawOutputSha256:hash(batch),networkPerFile:false},hard03PathsAndDispatchAbsent:true,observations,ci:{fullShaCliRuns:runs,workflowRunCount:workflow.total_count,checkRunCount:checks.total_count,workflowRuns:workflow.workflow_runs,checkRuns:checks.check_runs,meaning:'観測された状態だけを記録。0件はCI成功・失敗を示さない。手動起動していない。'},remoteMutated:false,notVerified:['hosted CI成功','実案件/実provider/Databricks','今後のwork-only追補commit/push']};
  await writeFile(join(repo,evidence),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,commit,manifestSha256:expectedManifest,managedFiles:1068,private:repository.isPrivate,workflowRuns:workflow.total_count,checkRuns:checks.total_count}));
} else if(process.argv[2]==='seal') {
  const reviewPath='work/reviews/2026-09-15-publication-061-acceptance.json';
  const output='work/reviews/2026-09-15-publication-061.receipt.json';
  const requirement='docs/harness/requirements/2026-09-15-publication-receipt-correction.md';
  const review=JSON.parse(await readFile(join(repo,reviewPath),'utf8'));
  const artifacts=['harness/base-release.json','tests/contracts.test.mjs'];
  const files=new Set([reviewPath,requirement,...artifacts,...review.acceptance.flatMap(a=>a.evidence)]);
  for(const p of files){const rootBytes=await readFile(join(repo,p));if(!p.startsWith('work/'))assert.deepEqual(rootBytes,await readFile(join(snapshot,p)),p);else{await mkdir(dirname(join(snapshot,p)),{recursive:true});await copyFile(join(repo,p),join(snapshot,p));}}
  const {sealEvidence,validateReceipt}=await import(pathToFileURL(join(snapshot,'tools/lib/evidence.mjs')));
  const {policyHash}=await import(pathToFileURL(join(snapshot,'tools/lib/policy.mjs')));
  const session='20260915-022729-254-publish-receipt-correction-0-6-1';
  const receipt=await sealEvidence(snapshot,{review:reviewPath,session,requirement,artifact:artifacts,output});
  assert.equal(receipt.status,'pass');assert.equal(receipt.policyHash,await policyHash(snapshot));
  await validateReceipt(snapshot,output,{sessionId:session,requirement});
  await copyFile(join(snapshot,output),join(repo,output));
  const result={at:new Date().toISOString(),status:'pass',sealRoot:snapshot,review:reviewPath,receipt:output,policyHash:receipt.policyHash,acceptance:receipt.acceptance.map(a=>({id:a.id,status:a.status})),validatedInFinalSnapshot:true,identityAuthenticated:false,taskSessionNotModifiedByReviewer:true};
  const resultPath='work/evidence/2026-09-15-publication-061-independent-final-seal.json';
  await writeFile(join(repo,resultPath),JSON.stringify(result,null,2)+'\n');await copyFile(join(repo,resultPath),join(snapshot,resultPath));console.log(JSON.stringify(result,null,2));
} else throw Error('Use observe or seal');
