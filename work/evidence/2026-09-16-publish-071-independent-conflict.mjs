import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { registerBaseline } from '../../tools/lib/distribution.mjs';
import { sha256 } from '../../tools/lib/shared.mjs';

const root=process.cwd(),base=resolve(tmpdir()),temp=await mkdtemp(join(base,'pub071-independent-conflict-'));
const old=JSON.parse(await readFile(join(root,'.harness/releases/0.7.0/manifest.json')));
const next=JSON.parse(await readFile(join(root,'harness/base-release.json')));
const commands=[];
async function snapshot(dir,relative='') {
  const items={};
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=relative?`${relative}/${entry.name}`:entry.name;
    // Plan/apply bookkeeping under .harness is intentionally allowed; product and managed tree is not.
    if(path==='.harness') continue;
    assert.ok(!entry.isSymbolicLink(),'unexpected synthetic fixture link');
    if(entry.isDirectory()) Object.assign(items,await snapshot(join(dir,entry.name),path));
    else items[path]=sha256(await readFile(join(dir,entry.name)));
  }
  return items;
}
function run(args,expected) {
  const result=spawnSync(process.execPath,[join(root,'tools/update-harness.mjs'),...args],{cwd:temp,encoding:'utf8',timeout:60000,maxBuffer:16000000});
  commands.push({args,exitCode:result.status,stdout:result.stdout,stderr:result.stderr});
  assert.equal(result.status,expected,result.stderr||result.stdout);return result;
}
try {
  await cp(join(root,'.harness/releases/0.7.0/files'),temp,{recursive:true});
  await writeFile(join(temp,'old-manifest.json'),JSON.stringify(old));
  await registerBaseline(temp,{manifest:'old-manifest.json'});
  await writeFile(join(temp,'product.config.json'),'{"name":"independent-conflict-fixture"}\n');
  await writeFile(join(temp,'AGENTS.md'),'独立反例: 案件による管理file変更\n');
  await mkdir(join(temp,'apps'),{recursive:true});
  await writeFile(join(temp,'apps','unfinished.ts'),'// product work must stay intact\n');
  await writeFile(join(temp,'.env'),'FAKE_FIXTURE_ONLY=not-a-real-secret\n');
  const before=await snapshot(temp);
  const newPaths=next.managedFiles.filter(item=>!old.managedFiles.some(oldItem=>oldItem.path===item.path)).map(item=>item.path);
  for(const path of newPaths) assert.equal(before[path],undefined);
  const plan=JSON.parse(run(['plan','--source',root,'--target',temp],1).stdout);
  assert.equal(plan.canApply,false);
  run(['apply','--plan',plan.plan,'--yes','--target',temp],2);
  const after=await snapshot(temp);assert.deepEqual(after,before);
  for(const path of newPaths) assert.equal(after[path],undefined);
  const report={reviewer:'publish_071_review',context:'root/publish_071_review',status:'pass',checkedAt:new Date().toISOString(),manifestSha256:sha256(await readFile(join(root,'harness/base-release.json'))),unchangedFiles:Object.keys(before).length,newManagedPathsStillAbsent:newPaths,scope:'Every product/managed file and file set unchanged; .harness plan metadata excluded, not a claim of no filesystem writes.',commands,networkUsed:false,realProjectChanged:false};
  await writeFile(join(root,'work/evidence/2026-09-16-publish-071-independent-conflict.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,unchangedFiles:report.unchangedFiles,newPathsStillAbsent:newPaths.length,manifestSha256:report.manifestSha256},null,2));
} finally {
  assert.ok(temp.startsWith(base+sep+'pub071-independent-conflict-'));
  await rm(temp,{recursive:true,force:true});
}
