import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateReceipt } from '../../tools/lib/evidence.mjs';
import { checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
import { checkPublication, guardStatus } from '../../tools/lib/publication.mjs';
import { sha256 } from '../../tools/lib/shared.mjs';
const root=process.cwd(),base='6fedb4a4dd6f3bc9db1982cd195166f078864b0a';
const output='work/evidence/2026-09-16-publish-071-preflight.json';
const receipt=await validateReceipt(root,'work/reviews/20260916-071045-256-purpose-driven-delivery.receipt.json');
const quality=await checkDelivery(root,JSON.parse(await readFile('work/quality/2026-09-16-purpose-adopted.json')),{phase:'verify'});
assert.deepEqual(quality.findings,[]);
const publication=await checkPublication(root,{base});
assert.equal(publication.version,'0.7.1');
assert.equal(publication.manifestSha256,'44c108e6190995de279842e8c237cfa89d65d5710b895fe558273790fa918bbb');
const guard=await guardStatus(root);assert.equal(guard.status,'installed');
for(const path of ['work/evidence/2026-09-16-publish-071-update-r1.json','work/evidence/2026-09-16-publish-071-bytes.json']){
 const result=JSON.parse(await readFile(path));
 assert.equal(result.status,'pass');assert.equal(result.manifestSha256,publication.manifestSha256);
}
const regression=await readFile('work/evidence/2026-09-16-publish-071-regression.tap','utf8');
assert.match(regression,/# tests 728\r?\n/);
assert.match(regression,/# pass 726\r?\n/);
assert.match(regression,/# fail 0\r?\n/);
assert.match(regression,/# skipped 2\r?\n/);
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',shell:false,timeout:60000,maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
const structure=run(process.execPath,['tools/harness.mjs','check']);
const status=run('git',['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
const manifest=JSON.parse(await readFile('harness/base-release.json'));
const managed=new Set([...manifest.managedFiles.map(f=>f.path),'harness/base-release.json','package.json','package-lock.json','docs/product/standards/FRONTEND.md','docs/product/standards/QUALITY.md']);
const selected=[],excluded=[];
for(const item of status){
 const path=item.slice(3);
 if(path.startsWith('.harness/')){excluded.push(path);continue;}
 const record=/^work\/(evidence|reviews|quality|plans)\/2026-09-16-(purpose-|publish-071)/.test(path)
 || /^work\/sessions\/(20260916-071045-256-purpose-driven-delivery|20260916-091431-687-publish-harness-0-7-1)\.md$/.test(path)
 || path==='work/reviews/20260916-071045-256-purpose-driven-delivery.receipt.json'
 || ['work/tasks/PDD-01.md','work/tasks/PUB-071.md'].includes(path);
 const scopedTest=path==='tests/purpose-ui-probe.test.mjs'||path.startsWith('tests/fixtures/purpose-ui/');
 assert.ok(managed.has(path)||record||scopedTest,`Unrelated change; preserve and stop: ${path}`);
 assert.ok(!item.startsWith('R')&&!item.startsWith('D'),`Unexpected rename/deletion: ${path}`);
 selected.push({path,sha256:sha256(await readFile(path))});
}
assert.ok(selected.length);
await writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),base,receiptStatus:receipt.status,quality,publication,guard,structure,regression:{tests:728,pass:726,fail:0,skip:2},selected,excludedLocalBackups:excluded.length,remotePush:false},null,2)+'\n',{flag:'wx'});
run('git',['add','--',...selected.map(f=>f.path),output]);
run('git',['diff','--cached','--check']);
console.log(JSON.stringify({status:'staged-scoped-files',files:selected.length+1,excludedLocalBackups:excluded.length,publication},null,2));
