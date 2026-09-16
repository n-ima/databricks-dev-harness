import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const ref = async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
const design = await ref('docs/harness/design/HARNESS_PUBLICATION.md');
const cases = [
  ['PC-T01',['PUBC-01','PUBC-05'],'自然言語のハーネス公開/案件配備/相談を分類し、独立forward担当が公開手順を辿る','案件配備と誤分類せず、公開をstamp前で完了せず、相談から書込をしない'],
  ['PC-T02',['PUBC-02'],'stampあり/なし/改変/列挙漏れ/版差のsourceを検査する','完全一致だけ成功、旧cacheで最新sourceの不一致を隠さない'],
  ['PC-T03',['PUBC-03'],'temp Git remoteへ各ref/commit状態でpushする','正常版のmain送信だけ許容、未stamp/未commit/別HEAD/main削除/既存hook衝突は拒否'],
  ['PC-T04',['PUBC-04'],'sourceと固定payloadから合成案件へ更新し、独自変更を加えて再試行する','正常更新後hash一致、案件doc/code/秘密を保持し、競合時に管理fileも変更しない'],
  ['PC-T05',['PUBC-05'],'両provider同期・構造検査・既存回帰・独立レビューを行う','不一致と未解消の阻害指摘がない。skipと未実環境試験を区別する'],
];
const contract = {
  schemaVersion:1, producer:{actor:'codex',context:'20260916-010024-987-harness-publication-contract'},
  requirement:await ref('docs/harness/requirements/2026-09-16-publication-contract.md'),
  artifacts:[design,await ref('work/plans/2026-09-16-publication-contract.md')],
  requirements:['PUBC-01','PUBC-02','PUBC-03','PUBC-04','PUBC-05'],
  risks:cases.map(([id,,steps,expected],i)=>({id:`PC-R0${i+1}`,description:expected,testIds:[id]})),
  interfaces:[],
  testCases:cases.map(([id,requirements,steps,expected])=>({id,requirements,level:'integration',environment:'local',preconditions:'隔離fixture/ローカルGitのみ。実案件・Databricks・モデル課金は行わない。',steps:[steps],expected,result:null})),
  operations:['ownership','monitoring','recovery','data-protection','cost','dependency-updates'].map(id=>({id,status:'applicable',reason:({ownership:'ハーネス保守担当が公開を所有し案件適用は案件側が所有する',monitoring:'checkの非0終了と日本語診断を記録する',recovery:'公開前は作業branchへ残し旧版を改変しない。既存hookを保持する','data-protection':'合成案件のみ。秘密と案件固有を保持する',cost:'ネットワーク無しのローカル試験、モデル呼出/課金なし','dependency-updates':'版/依存変更後はstampと更新経路を再検証する'})[id],testIds:[id==='data-protection'?'PC-T04':id==='cost'?'PC-T05':'PC-T03'],document:design})),
  reviews:[],
};
await writeFile('work/quality/2026-09-16-publication-contract.json',JSON.stringify(contract,null,2)+'\n',{flag:'wx'});
const report=await checkDelivery(process.cwd(),contract,{phase:'design'});
await writeFile('work/evidence/2026-09-16-publication-design-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
process.exitCode=report.findings.length?1:0;
