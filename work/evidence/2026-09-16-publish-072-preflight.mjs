import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { acceptanceIds,assertAcceptanceCoverage } from '../../tools/lib/acceptance.mjs';
import { checkPublication } from '../../tools/lib/publication.mjs';
import { sha256 } from '../../tools/lib/shared.mjs';
const root=process.cwd(),base='12a8feae976cb6b1ec0ec2b8a77c716764be6d1f';
const requirement='docs/harness/requirements/2026-09-16-publish-071.md';
const ids=acceptanceIds(await readFile(requirement,'utf8'));
const review=JSON.parse(await readFile('work/reviews/2026-09-16-publish-072-independent.json'));
assert.equal(review.independent,true);assertAcceptanceCoverage(ids,review.acceptance);
assert.ok(review.acceptance.filter(a=>a.id!=='PUB-04').every(a=>a.status==='pass'));
const publication=await checkPublication(root,{base});assert.equal(publication.version,'0.7.2');
assert.equal(publication.manifestSha256,'da753bd8d5ea6dcdb943dc0182a647d54d59ea767c7e03717fb1f9efede9c42c');
for(const name of ['bytes','update-r1','update-r2']){
 const r=JSON.parse(await readFile(`work/evidence/2026-09-16-publish-072-${name}.json`));
 assert.equal(r.status,'pass');assert.equal(r.manifestSha256,publication.manifestSha256);
}
const regression=await readFile('work/evidence/2026-09-16-publish-072-regression.tap','utf8');
for(const text of ['# tests 728','# pass 726','# fail 0','# skipped 2'])assert.ok(regression.includes(text));
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',shell:false,timeout:60000,maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
const status=run('git',['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
const allowed=new Set([requirement,'docs/harness/operations/HARNESS_DEVELOPMENT.md','docs/harness/releases/0.7.2.md','harness.config.json','harness/base-release.json','package.json','package-lock.json','work/tasks/PUB-071.md','work/sessions/20260916-091431-687-publish-harness-0-7-1.md']);
const selected=[],excluded=[];
for(const item of status){
 const path=item.slice(3);
 if(path.startsWith('.harness/')){excluded.push(path);continue;}
 assert.ok(allowed.has(path)||/^work\/(evidence|reviews)\/2026-09-16-publish-07[12]-/.test(path),`Unrelated file: ${path}`);
 assert.ok(!/^[DR]/.test(item),`Unexpected removal/rename: ${path}`);
 selected.push({path,sha256:sha256(await readFile(path))});
}
const output='work/evidence/2026-09-16-publish-072-preflight.json';
await writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),base,publication,ids,review:'work/reviews/2026-09-16-publish-072-independent.json',selected,excludedLocalBackups:excluded.length,remotePush:false},null,2)+'\n',{flag:'wx'});
run('git',['add','--',...selected.map(f=>f.path),output]);run('git',['diff','--cached','--check']);
console.log(JSON.stringify({status:'staged-scoped-files',files:selected.length+1,publication},null,2));
