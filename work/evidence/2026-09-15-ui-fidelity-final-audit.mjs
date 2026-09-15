// Independent read-only source audit and synthetic test runner. Generates evidence only.
import { readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest,reviewHash,basisHash,checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const prefix='work/evidence/2026-09-15-ui-fidelity-final';
const bytes=p=>readFile(join(root,p));
const json=async p=>JSON.parse(await bytes(p));
const c=await json('work/quality/2026-09-15-ui-runtime-fidelity.json');
const report={actor:'/root/ui_fidelity_design_review',context:'20260916-ui-fidelity-final-review',at:new Date().toISOString(),syntheticOnly:true,reviewedSha256:reviewHash(c),basisSha256:basisHash(c),artifacts:[],providerCopies:[],preserved:[],releases:[],findings:[]};
for(const a of [c.requirement,...c.artifacts,...c.testCases.flatMap(t=>t.result.evidence)]){
  const current=digest(await bytes(a.path));report.artifacts.push({...a,current,match:current===a.sha256});if(current!==a.sha256)report.findings.push('stale '+a.path);
}
for(const skill of ['mock-ui','define-work','build-work','review-work','update-harness']){
  const canonical=await bytes('harness/skills/'+skill+'/SKILL.md');
  for(const provider of ['.claude','.github']){const path=provider+'/skills/'+skill+'/SKILL.md',match=canonical.equals(await bytes(path));report.providerCopies.push({path,match});if(!match)report.findings.push('provider copy '+path);}
}
const previous=await json('work/evidence/2026-09-15-publication-061-assembly.json');
for(const [path,expected] of Object.entries(previous.preserved)){
  if(['tools/harness.mjs','tools/lib/distribution.mjs','docs/harness/operations/CLI_REFERENCE.md'].includes(path))continue;
  const current=digest(await bytes(path));report.preserved.push({path,expected,current,match:current===expected});if(current!==expected)report.findings.push('preservation '+path);
}
for(const [path,pattern] of [
 ['tools/harness.mjs',/^  delivery ui-(?:init|check|hash|approval-check)[^\r\n]*\r?\n|^                  \[--ui-contract[^\r\n]*\r?\n/gm],
 ['tools/lib/distribution.mjs',/^  "tests\/ui-contract.test.mjs", "tests\/helpers\/ui-fidelity.mjs",\r?\n/gm]
]){
  const current=digest((await bytes(path)).toString('utf8').replace(pattern,'')),expected=previous.preserved[path];
  report.preserved.push({path,scope:'original bytes after removing only this UI addition',expected,current,match:current===expected});if(current!==expected)report.findings.push('mixed preservation '+path);
}
const cliText=(await bytes('docs/harness/operations/CLI_REFERENCE.md')).toString('utf8');
report.cliScopedHunkPresent=cliText.includes('案件の環境・操作・権限・費用・期限を持つ新しい承認台帳のローカル候補は\n[SCOPED_APPROVALS](SCOPED_APPROVALS.md)を参照。`approval-scope record/check/revoke`は\n旧gateを解除せず、実行許可・実CLI/DB操作を行わない。正式採用前の限定機能である。');
if(!report.cliScopedHunkPresent)report.findings.push('CLI scoped hunk absent');
for(const [version,expected] of Object.entries({...previous.oldManifests,'0.6.1':'d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d'})){
  const path='.harness/releases/'+version,manifestBytes=await bytes(path+'/manifest.json'),manifest=JSON.parse(manifestBytes),current=digest(manifestBytes);let mismatches=0;
  for(const f of manifest.managedFiles)if(digest(await bytes(path+'/files/'+f.path))!==f.sha256)mismatches++;
  report.releases.push({version,manifestMatches:current===expected,fileCount:manifest.managedFiles.length,mismatches});if(current!==expected||mismatches)report.findings.push('release '+version);
}
report.design=await checkDelivery(root,c,{phase:'design'});if(report.design.findings.length)report.findings.push('quality design');
const tests=['work/evidence/2026-09-15-ui-fidelity-final-independent.test.mjs','work/evidence/2026-09-15-ui-fidelity-independent.test.mjs','tests/ui-contract.test.mjs','tests/approval.test.mjs'];
const run=spawnSync(process.execPath,['--test',...tests],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
const output=(run.stdout??'')+(run.stderr??'');await writeFile(join(root,prefix+'-independent.log'),output);
report.execution={command:['node','--test',...tests],exitCode:run.status,log:prefix+'-independent.log',logSha256:digest(output)};
if(run.status!==0)report.findings.push('independent tests failed');
report.extraEvidence=[];
for(const path of [prefix+'-independent.test.mjs',prefix+'-audit.mjs','work/evidence/2026-09-15-ui-fidelity-forward-design.md'])report.extraEvidence.push({path,sha256:digest(await bytes(path))});
await writeFile(join(root,prefix+'-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reviewedSha256:report.reviewedSha256,artifacts:report.artifacts.length,providerCopies:report.providerCopies,preserved:report.preserved,releases:report.releases,execution:report.execution,findings:report.findings},null,2));
process.exitCode=report.findings.length?1:0;
