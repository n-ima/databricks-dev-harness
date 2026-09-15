// Local candidate verification; never calls a real provider or Databricks.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join,resolve } from 'node:path';
import { writeJson,atomicWrite } from '../../tools/lib/shared.mjs';
import { digest,basisHash,checkDelivery,OPERATIONS } from '../../tools/lib/delivery-assurance.mjs';

const root=resolve(new URL('../..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const rel='work/quality/2026-09-15-ui-runtime-fidelity.json';
const prefix='work/evidence/2026-09-15-ui-fidelity';
const ref=async path=>({path,sha256:digest(await readFile(join(root,path)))});
const skills=['mock-ui','define-work','build-work','review-work','update-harness'];
const artifacts=[
 'AGENTS.md','docs/harness/design/UI_RUNTIME_FIDELITY.md','docs/harness/operations/UI_RUNTIME_FIDELITY.md','docs/harness/operations/DOCUMENTATION_STANDARD.md','docs/product/standards/FRONTEND.md','tools/harness.mjs','docs/harness/operations/CLI_REFERENCE.md',
 'tools/lib/ui-contract.mjs','tools/lib/approval.mjs','tools/lib/loop.mjs','tools/lib/scaffold.mjs','tools/lib/delivery-assurance.mjs','tools/lib/intake.mjs','tools/lib/product-documents.mjs','tools/agent-hook.mjs','tools/lib/distribution.mjs','harness/schemas/approval.schema.json',
 'tests/ui-contract.test.mjs','tests/helpers/ui-fidelity.mjs','tests/approval.test.mjs','tests/contracts.test.mjs','tests/scaffold-data.test.mjs','tests/human-documents.test.mjs',
 ...skills.map(s=>'harness/skills/'+s+'/SKILL.md'),prefix+'-independent.test.mjs',prefix+'-verify.mjs'
];
const cases=[
 {id:'UIF-T01',requirements:['UIF-01'],level:'contract',command:['node','tools/harness.mjs','check'],expected:'標準/生成コピー/参照を検査し非0の不整合がない。コピー一致は実providerの行動証明ではない。'},
 {id:'UIF-T02',requirements:['UIF-02','UIF-03','UIF-04'],level:'contract',command:['node','--test','tests/approval.test.mjs','tests/ui-contract.test.mjs'],expected:'合成正常承認は成功。不足/差替え/別app/旧承認/出力リンクは拒否し、無断書込みがない。'},
 {id:'UIF-T03',requirements:['UIF-01','UIF-03','UIF-04'],level:'contract',command:['node','--test','tests/*.test.mjs'],expected:'ローカル全回帰の失敗0。既存skipと未採用HARD-03混在を明記し、実providerや実画面の成功とはしない。'},
 {id:'UIF-T04',requirements:['UIF-02','UIF-03','UIF-04'],level:'contract',command:['node','--test',prefix+'-independent.test.mjs'],expected:'別contextの独立反例、版/共有部品/loop継続/旧init移行を合成fixtureで検証し失敗0。'}
];
const c={schemaVersion:1,producer:{actor:'/root',context:'20260915-ui-fidelity-implementation'},requirement:await ref('docs/harness/requirements/2026-09-15-ui-runtime-fidelity.md'),artifacts:await Promise.all(artifacts.map(ref)),requirements:['UIF-01','UIF-02','UIF-03','UIF-04'],
 risks:[{id:'UIF-R01',description:'近似HTMLや別appを承認済みと誤認する',testIds:['UIF-T02','UIF-T04']},{id:'UIF-R02',description:'更新/反復で古い承認を使う、または非UI経路を壊す',testIds:['UIF-T03','UIF-T04']}],interfaces:[],
 testCases:cases.map(({id,requirements,level,command,expected})=>({id,requirements,level,environment:'local',preconditions:'ハーネス開発元、既存HARD-03差分を保持したローカル作業ツリー。合成temp fixtureのみ。',steps:[command.join(' ')],expected,result:null})),
 operations:OPERATIONS.map(id=>({id,status:'applicable',reason:({ownership:'ハーネス管理者が候補の採用を判断する',monitoring:'検査失敗と停止理由をsessionへ記録する',recovery:'旧文書/承認を保持し、差分確認と再承認で移行する','data-protection':'合成データと通常fileだけを参照し、リンク出力を拒否する',cost:'ローカルhashと回帰を先に行い、有料モデルや実DBを呼ばない','dependency-updates':'依存版とlock変更は承認を無効化する'})[id],testIds:[id==='dependency-updates'?'UIF-T04':'UIF-T02'],document:null})),reviews:[]};
const runbook=await ref('docs/harness/operations/UI_RUNTIME_FIDELITY.md');c.operations.forEach(o=>o.document=runbook);
await writeJson(join(root,rel),c);
await writeJson(join(root,prefix+'-quality-design.json'),await checkDelivery(root,c,{phase:'design'}));
const basis=basisHash(c);
let failed=false;
for(let i=0;i<cases.length;i++){
 const [cmd,...args]=cases[i].command;
 const result=spawnSync(cmd==='node'?process.execPath:cmd,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,timeout:180000});
 const log=prefix+'-'+cases[i].id+'.log';await atomicWrite(join(root,log),(result.stdout??'')+(result.stderr??'')+(result.error?'\n'+result.error.message:''));
 c.testCases[i].result={status:result.status===0?'pass':'fail',environment:'local',basisSha256:basis,evidence:[await ref(log)],command:cases[i].command.join(' '),versions:process.version+' / '+process.platform};
 failed ||= result.status!==0;console.log(cases[i].id+': '+result.status+'; '+log);
}
await writeJson(join(root,rel),c);
await writeJson(join(root,prefix+'-quality-verify.json'),await checkDelivery(root,c,{phase:'verify'}));
console.log('Quality contract awaits independent review; diagnostic is not acceptance.');process.exitCode=failed?1:0;
