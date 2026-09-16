import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const run=process.argv[2];
if(!/^r[1-9][0-9]*$/.test(run??'')) throw new Error('Use a unique rN evidence run.');
const prefix=`work/evidence/2026-09-16-publication-${run}`;
const checks=[];
function execute(name,command,args,timeout=180000) {
  const started=new Date().toISOString();
  const r=spawnSync(command,args,{encoding:'utf8',shell:false,timeout,maxBuffer:24*1024*1024});
  checks.push({name,command,args,started,ended:new Date().toISOString(),exitCode:r.status,error:r.error?.message??null,stdout:r.stdout??'',stderr:r.stderr??''});
  console.log(`${name}: ${r.status}`);
}
execute('harness-check',process.execPath,['tools/harness.mjs','check']);
execute('regression',process.execPath,['--test','tests/*.test.mjs'],240000);
for(const skill of ['publish-harness','improve-harness','orchestrate-work','release-work']) execute(`skill-${skill}`,'python',['-X','utf8','C:/Users/nimao/.codex/skills/.system/skill-creator/scripts/quick_validate.py',`harness/skills/${skill}`]);
await writeFile(`${prefix}.json`,JSON.stringify({checkedAt:new Date().toISOString(),checks,networkUsed:false,realProjectChanged:false,hostedCi:false},null,2)+'\n',{flag:'wx'});
console.log(checks.find(c=>c.name==='regression').stdout.slice(-1200));
process.exitCode=checks.some(c=>c.exitCode!==0)?1:0;
