import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { validateReceipt } from '../../tools/lib/evidence.mjs';
import { checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
import { checkPublication, guardStatus } from '../../tools/lib/publication.mjs';
const root=process.cwd(),base='f06743b0c941872b6db041a88ee6fe7adb72168f';
const receipt=await validateReceipt(root,'work/reviews/20260916-010024-987-harness-publication-contract.receipt.json');
const quality=await checkDelivery(root,JSON.parse(await readFile('work/quality/2026-09-16-publication-accepted.json')),{phase:'verify'});
assert.deepEqual(quality.findings,[]);
const publication=await checkPublication(root,{base});assert.equal(publication.version,'0.7.0');
assert.equal(publication.manifestSha256,'9cfc0dd3697008330e20fe81f48c3ef712399ab42e7686a211dd4382daa49717');
const guard=await guardStatus(root);assert.equal(guard.status,'installed');
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',shell:false,timeout:60000,maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
const structure=run(process.execPath,['tools/harness.mjs','check']);
const tests=run(process.execPath,['--test','tests/publication.test.mjs']);
const status=run('git',['status','--porcelain=v1','-z','--untracked-files=all']).split('\0').filter(Boolean);
const manifest=JSON.parse(await readFile('harness/base-release.json'));
const managed=new Set([...manifest.managedFiles.map(f=>f.path),'harness/base-release.json','package.json','package-lock.json']);
const selected=[],excluded=[];
for(const item of status){
  const path=item.slice(3);
  if(path.startsWith('.harness/')){excluded.push(path);continue;}
  const record=/^work\/(evidence|reviews|quality|plans)\/2026-09-16-(publication-|publish-070)/.test(path)||/^work\/sessions\/20260916-(010024-987-harness-publication-contract|043428-743-publish-harness-0-7-0)\.md$/.test(path)||path==='work/reviews/20260916-010024-987-harness-publication-contract.receipt.json'||['work/tasks/PUBC-01.md','work/tasks/PUB-070.md'].includes(path);
  assert.ok(managed.has(path)||record,`Unrelated change, preserve and stop: ${path}`);
  selected.push(path);
}
const output='work/evidence/2026-09-16-publish-070-preflight.json';
await writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),base,receiptStatus:receipt.status,quality,publication,guard,structure,tests,selected,excludedLocalBackups:excluded.length},null,2)+'\n',{flag:'wx'});
run('git',['add','--',...selected,output]);
run('git',['diff','--cached','--check']);
console.log(JSON.stringify({status:'staged-reviewed-scope',files:selected.length+1,excludedLocalBackups:excluded.length,publication},null,2));
