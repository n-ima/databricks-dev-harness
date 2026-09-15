// Local bounded verification; does not authenticate, deploy or call a paid provider.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeJson,atomicWrite} from '../../tools/lib/shared.mjs';
import {digest,basisHash,checkDelivery,OPERATIONS} from '../../tools/lib/delivery-assurance.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const rel='work/quality/2026-09-16-truth-repair.json',prefix='work/evidence/2026-09-16-truth';
const ref=async path=>({path,sha256:digest(await readFile(join(root,path)))});
const artifacts=[
 'docs/harness/design/TRUTH_REPAIR.md','docs/harness/operations/CLI_REFERENCE.md','docs/harness/operations/SETUP_WALKTHROUGH.md','docs/harness/operations/SAFE_LOCAL_UPDATE.md','docs/harness/operations/UPDATING_EXISTING_PROJECTS.md',
 'tools/harness.mjs','tools/lib/loop.mjs','tools/lib/session-loop.mjs','tools/lib/memory.mjs','tools/lib/command-async.mjs','tools/lib/shared.mjs','tools/lib/skill-sync.mjs','tools/lib/vendor-patches.mjs','tools/lib/scaffold.mjs','tools/lib/distribution.mjs',
 'harness/vendor-patches.json','harness/toolchain.lock.json',
 'tests/truth-assets.test.mjs','tests/truth-asset-boundaries.test.mjs','tests/truth-lifecycle.test.mjs','tests/truth-gates.test.mjs',
 prefix+'-gates-independent.test.mjs',prefix+'-assets-independent.test.mjs',prefix+'-preserve.mjs',prefix+'-verify.mjs',prefix+'-repair-baseline.json'
];
const all=['FIX-01','FIX-02','FIX-03','FIX-04','FIX-05','FIX-06'];
const cases=[
 {id:'REPAIR-T01',requirements:['FIX-01','FIX-04','FIX-06'],level:'contract',command:['node','tools/harness.mjs','check'],expected:'ハーネス構造・生成コピー・訂正版の整合検査が成功する。実provider追従の証明とはしない。'},
 {id:'REPAIR-T02',requirements:['FIX-02','FIX-03','FIX-06'],level:'contract',command:['node','--test','tests/truth-lifecycle.test.mjs','tests/truth-gates.test.mjs','tests/concurrency.test.mjs','tests/memory.test.mjs'],expected:'未解決loop/停止sessionを拒否し、正常完了・日本語ID・直下childの停止境界を保持する。'},
 {id:'REPAIR-T03',requirements:['FIX-01','FIX-04','FIX-05','FIX-06'],level:'recovery',command:['node','--test','tests/truth-assets.test.mjs','tests/truth-asset-boundaries.test.mjs'],expected:'独自skillを全providerで保持し、管理file backupと同期失敗後の再試行が成功する。vendor版/hash不一致は拒否。MetricのSQL本文と正本YAMLが一致する。'},
 {id:'REPAIR-T04',requirements:all,level:'integration',command:['node','--test',prefix+'-gates-independent.test.mjs',prefix+'-assets-independent.test.mjs'],expected:'独立作成した反例群で失敗0。実Node child・offline固定応答によるrefresh・PyYAML解析を含み、実Databricks/実provider検証とは扱わない。'},
 {id:'REPAIR-T05',requirements:all,level:'contract',command:['node','--test','tests/*.test.mjs'],expected:'通常CI全体の失敗0。skipを明記し、既存UIF/HARD候補の正式採用とはしない。'},
 {id:'REPAIR-T06',requirements:['FIX-01','FIX-06'],level:'contract',command:['node',prefix+'-preserve.mjs'],expected:'既存候補の非重複変更と公開済み全payloadのhashを保持する。重複6ファイルは自動同一性証明の対象外として列挙し、独立差分レビューを要求する。'}
];
const c={schemaVersion:1,producer:{actor:'/root',context:'20260915-153857-861-truth-repair'},requirement:await ref('docs/harness/requirements/2026-09-16-truth-repair.md'),artifacts:await Promise.all(artifacts.map(ref)),requirements:all,
 risks:[
 {id:'REPAIR-R01',description:'既存Lakebaseのrole/dataアクセスを誤った型変更で破壊する',testIds:['REPAIR-T03','REPAIR-T04']},
 {id:'REPAIR-R02',description:'承認待ち/停止と完了が分離し後続を無断実行する',testIds:['REPAIR-T02','REPAIR-T04']},
 {id:'REPAIR-R03',description:'再setupが独自skillを削除、または同期失敗後に復旧不能にする',testIds:['REPAIR-T03','REPAIR-T04']},
 {id:'REPAIR-R04',description:'Metric YAMLがSQLコメント/文字列終端で壊れる',testIds:['REPAIR-T03','REPAIR-T04']},
 {id:'REPAIR-R05',description:'修正で既存候補を壊す、検証を過大報告する',testIds:['REPAIR-T01','REPAIR-T05','REPAIR-T06']}
 ],interfaces:[],testCases:cases.map(({id,requirements,level,command,expected})=>({id,requirements,level,environment:'local',preconditions:'Windows/Node24、合成temp fixture。独立YAML検査のみローカルPython/PyYAMLを使用。HTTP fixtureの固定応答は実サービスへの通信ではない。',steps:[command.join(' ')],expected,result:null})),
 operations:OPERATIONS.map(id=>({id,status:'applicable',reason:({
 ownership:'ハーネス管理者が既存安全意図の是正を保守し、新規権限/公開は別承認にする',
 monitoring:'CLI失敗・session停止理由・iteration観測結果を保存し成功と区別する',
 recovery:'同期backupと旧sessionを保持し、失敗時は対象照合後に限定再実行/明示引継ぎする',
 'data-protection':'ローカル合成データのみ。独自file/link/実DBを無断変更しない',
 cost:'直下processの時間/出力量を制限し、今回実providerの課金呼出を行わない',
 'dependency-updates':'上流技能は版・原本hashに拘束し、未知の版/改変時には更新前に停止する'
 })[id],testIds:[id==='dependency-updates'?'REPAIR-T03':id==='cost'||id==='monitoring'?'REPAIR-T02':id==='ownership'?'REPAIR-T06':'REPAIR-T03'],document:null})),reviews:[]};
const doc=await ref('docs/harness/design/TRUTH_REPAIR.md');c.operations.forEach(o=>o.document=doc);
await writeJson(join(root,rel),c);
const design=await checkDelivery(root,c,{phase:'design'});await writeJson(join(root,prefix+'-quality-design.json'),design);
if(design.findings.length)throw Error(JSON.stringify(design.findings));
console.log('Design diagnostic: 0 findings (recorded after implementation, before final verification; not a pre-implementation gate).');
const basis=basisHash(c);let failed=false;
for(let i=0;i<cases.length;i++){
 const [cmd,...args]=cases[i].command;const run=spawnSync(cmd==='node'?process.execPath:cmd,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024});
 const log=prefix+'-'+cases[i].id+'.log';await atomicWrite(join(root,log),(run.stdout??'')+(run.stderr??'')+(run.error?'\n'+run.error.message:''));
 c.testCases[i].result={status:run.status===0?'pass':'fail',environment:'local',basisSha256:basis,evidence:[await ref(log)],command:cases[i].command.join(' '),versions:process.version+' / '+process.platform};
 failed ||= run.status!==0;await writeJson(join(root,rel),c);console.log(cases[i].id+': '+run.status+'; '+log);
}
for(const a of [c.requirement,...c.artifacts])if((await ref(a.path)).sha256!==a.sha256){failed=true;console.error('Snapshot changed during tests: '+a.path);}
const verify=await checkDelivery(root,c,{phase:'verify'});await writeJson(join(root,prefix+'-quality-before-review.json'),verify);
console.log('Result still requires independent review; no completion/real-provider certification.');process.exitCode=failed?1:0;
