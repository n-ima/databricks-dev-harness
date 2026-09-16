import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basisHash, reviewHash, digest, checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const ref=async path=>({path,sha256:digest(await readFile(path))});
const run=JSON.parse(await readFile('work/evidence/2026-09-16-publication-r2.json'));
assert.ok(run.checks.every(c=>c.exitCode===0));
const update=JSON.parse(await readFile('work/evidence/2026-09-16-publication-real-update-r1.json'));
assert.equal(update.status,'pass');
const sourceChecks=[];
for(const args of [['tools/harness-publication.mjs','guard-status'],['tools/harness-publication.mjs','check','--base','f06743b0c941872b6db041a88ee6fe7adb72168f']]){
  const r=spawnSync(process.execPath,args,{encoding:'utf8',shell:false,timeout:30000});assert.equal(r.status,0,r.stderr);
  sourceChecks.push({args,exitCode:r.status,result:JSON.parse(r.stdout)});
}
await writeFile('work/evidence/2026-09-16-publication-source-check.json',JSON.stringify({checkedAt:new Date().toISOString(),sourceChecks,remotePush:false,gitHubProtectionChanged:false},null,2)+'\n',{flag:'wx'});
const c=JSON.parse(await readFile('work/quality/2026-09-16-publication-contract.json'));
c.requirement=await ref(c.requirement.path);
const artifacts=[
 'docs/harness/design/HARNESS_PUBLICATION.md','docs/harness/operations/HARNESS_DEVELOPMENT.md','docs/harness/operations/CLI_REFERENCE.md','docs/harness/releases/0.7.0.md','work/plans/2026-09-16-publication-contract.md',
 'AGENTS.md','tools/lib/publication.mjs','tools/lib/distribution.mjs','tools/lib/workloads.mjs','tools/harness-publication.mjs','tests/publication.test.mjs',
 'harness/router.json','.github/workflows/harness-ci.yml','harness/base-release.json','harness.config.json','package.json','package-lock.json',
 'work/evidence/2026-09-16-publication-real-update.mjs','work/evidence/2026-09-16-publication-regression.mjs',
 ...['publish-harness','improve-harness','orchestrate-work','release-work'].flatMap(s=>[`harness/skills/${s}/SKILL.md`,`.claude/skills/${s}/SKILL.md`,`.github/skills/${s}/SKILL.md`]),
];
c.artifacts=await Promise.all(artifacts.map(ref));
for(const op of c.operations) op.document=await ref('docs/harness/design/HARNESS_PUBLICATION.md');
c.reviews=[];
const basis=basisHash(c);
const evidence={
 'PC-T01':['work/reviews/2026-09-16-publication-forward-review.md','work/evidence/2026-09-16-publication-r2.json'],
 'PC-T02':['work/evidence/2026-09-16-publication-r2.json','work/evidence/2026-09-16-publication-unstamped-rejection.json','work/evidence/2026-09-16-publication-release-bytes.json','work/evidence/2026-09-16-publication-source-check.json'],
 'PC-T03':['work/evidence/2026-09-16-publication-r2.json','work/evidence/2026-09-16-publication-source-check.json','work/reviews/2026-09-16-publication-code-review.md'],
 'PC-T04':['work/evidence/2026-09-16-publication-real-update-r1.json'],
 'PC-T05':['work/evidence/2026-09-16-publication-r2.json','work/reviews/2026-09-16-publication-code-review.md','work/reviews/2026-09-16-publication-forward-review.md','work/reviews/2026-09-16-publication-design-review.md'],
};
for(const tc of c.testCases)tc.result={status:'pass',environment:'local',basisSha256:basis,evidence:await Promise.all(evidence[tc.id].map(ref)),command:tc.id==='PC-T04'?'node work/evidence/2026-09-16-publication-real-update.mjs r1':'node work/evidence/2026-09-16-publication-regression.mjs r2 + linked independent review/source checks',versions:'Windows; Node v24.15.0; Python 3.12; local fixtures only. 721 pass / 2 file-symlink skips in full regression.'};
const path='work/quality/2026-09-16-publication-final.json';
await writeFile(path,JSON.stringify(c,null,2)+'\n',{flag:'wx'});
const report=await checkDelivery(process.cwd(),c,{phase:'verify'});
assert.deepEqual(report.findings.map(f=>f.code),['MISSING_REVIEW']);
await writeFile('work/evidence/2026-09-16-publication-pre-review-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path,basisSha256:basis,reviewedSha256:reviewHash(c),report},null,2));
