import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIntake, answerIntake, approveIntake } from '../tools/lib/intake.mjs';
import { acceptanceIds } from '../tools/lib/acceptance.mjs';
import { installWorkloadCatalog } from './helpers/workloads.mjs';
import { documentedWorkloads } from '../tools/lib/product-documents.mjs';
import { currentCheckpoint, sectionBody, replaceSection, localizeNewSession } from '../tools/lib/session-state.mjs';
import { startSession, checkpointSession } from '../tools/lib/memory.mjs';
import { digest, basisHash, reviewHash, OPERATIONS } from '../tools/lib/delivery-assurance.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repository = fileURLToPath(new URL('..', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'harness-human-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(console, 'log', () => {});
  await installWorkloadCatalog(root);
  return root;
}

test('new Japanese UI intake exposes business, data and interaction definitions without inventing decisions', async t => {
  const root = await fixture(t);
  const m = await createIntake(root, { name: 'sales', title: '売上管理', summary: '商品を登録し売上を集計する', workload: ['rich-app', 'lakebase'] });
  const req = await readFile(join(root, m.artifacts.requirementPath), 'utf8');
  const design = await readFile(join(root, m.artifacts.architecturePath), 'utf8');
  const plan = await readFile(join(root, m.artifacts.planPath), 'utf8');
  assert.match(req, /## 目的と利用者/);
  assert.match(req, /## 業務利用/);
  assert.match(req, /未確定/);
  assert.deepEqual(acceptanceIds(req), ['AC-01','AC-02']);
  for (const label of ['用語集', '機能一覧', 'データ一覧', 'データ項目', '外部境界', '画面一覧', '画面遷移', '試験', '運用']) assert.ok(design.includes(label), label);
  assert.match(design, /未確定/);
  assert.match(plan, /delivery check/);
  assert.match(plan, /Databricks Apps/);
  assert.match(plan, /実部品からの描画/);
  assert.match(plan, /同じapp/);
  assert.equal(m.status, 'needs-answers');
  assert.equal(m.approval, undefined);
  await assert.rejects(approveIntake(root, { id:m.id, actor:'human', evidence:'synthetic' }), /questions are open/);
  await assert.rejects(createIntake(root, { name:'sales', title:'別物', summary:'上書き', workload:['api'] }), /overwrite/);
  assert.equal(await readFile(join(root,m.artifacts.requirementPath),'utf8'), req);
});

test('API-only Japanese intake skips UI design and keeps interface, test and operations definitions', async t => {
  const root = await fixture(t);
  const m = await createIntake(root, { name:'api-only', title:'受注API', summary:'UIなしの受注API', workload:['api','lakebase'] });
  const design = await readFile(join(root,m.artifacts.architecturePath),'utf8');
  const plan = await readFile(join(root,m.artifacts.planPath),'utf8');
  assert.match(design, /画面.*適用外/);
  assert.doesNotMatch(design, /\| 画面ID/);
  assert.match(design, /operationId/);
  assert.match(plan, /UI承認は不要/);
  assert.ok(!m.questions.some(q=>q.id==='Q-20'));
});

test('Japanese intake answers remain parseable and approval retains exact artifact hashes', async t => {
  const root = await fixture(t);
  const m = await createIntake(root, { name:'analysis', title:'分析', summary:'売上の探索分析', workload:['analysis'] });
  for (const q of m.questions) await answerIntake(root, {id:m.id,question:q.id,answer:'合成fixtureでの確認用回答',actor:'test-user'});
  const req = await readFile(join(root,m.artifacts.requirementPath),'utf8');
  assert.match(req, /確認済みの回答/);
  assert.deepEqual(acceptanceIds(req), ['AC-01','AC-02']);
  const approved = await approveIntake(root,{id:m.id,actor:'test-user',evidence:'合成試験内の承認記録'});
  assert.equal(approved.status,'accepted');
  assert.equal(Object.keys(approved.approval.artifactHashes).length,2);
  const changed = await answerIntake(root,{id:m.id,question:'Q-01',answer:'目的を変更',actor:'test-user'});
  assert.equal(changed.approval,undefined);
});

test('all pinned workloads have human-facing descriptions and source text is not recursively templated', async t => {
  const root=await fixture(t);
  const catalog=JSON.parse(await readFile(join(root,'harness/workloads.json'),'utf8'));
  assert.deepEqual(documentedWorkloads.sort(),catalog.workloads.map(w=>w.id).sort());
  const m=await createIntake(root,{name:'literal',title:'日本語の題名',summary:'資料の文字列 {{title}} は原文で残す',workload:['analysis']});
  const req=await readFile(join(root,m.artifacts.requirementPath),'utf8');
  assert.match(req,/資料の文字列 \{\{title\}\} は原文で残す/);
  assert.doesNotMatch(req,/資料の文字列 日本語の題名/);
});

test('new Japanese sessions and legacy English sessions retain current state on checkpoint', async t => {
  const root=await fixture(t);
  const s=await startSession(root,{title:'再開確認',intent:'improve-harness',objective:'日本語で再開する'});
  let body=await readFile(s.path,'utf8');
  assert.match(body,/## 確認済みの状態/);
  assert.equal(currentCheckpoint(body).current,'リポジトリの現状確認は未実施。');
  await checkpointSession(root,{id:s.id,summary:'確認を実施',next:'独立レビュー',blocker:'none'});
  body=await readFile(s.path,'utf8');
  assert.equal(currentCheckpoint(body).current,'確認を実施');
  assert.equal(sectionBody(body,'Next actions'),'- 独立レビュー');
  assert.equal(body.match(/^## 確認済みの状態$/gm).length,1);
  assert.doesNotMatch(body,/^## Verified current state$/m);
  const legacy='# Session\n\n## Verified current state\n\n- old\n\n## Next actions\n\n- review\n';
  assert.equal(sectionBody(replaceSection(legacy,'Verified current state','- updated'),'Verified current state'),'- updated');
  assert.deepEqual(currentCheckpoint(localizeNewSession(legacy)),currentCheckpoint(legacy));
});

test('installed harness delivery CLI is read-only and distinguishes findings from invalid input', async t => {
  const root=await fixture(t);
  await cp(join(repository,'tools'),join(root,'tools'),{recursive:true});
  const put=async (path,text) => {await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),text);return {path,sha256:digest(text)};};
  const requirement=await put('docs/requirement.md','# 要件\n\n## 受入条件\n\n- AC-01: 合成データを読める。\n');
  const artifact=await put('docs/design.md','合成設計と試験定義');
  const evidence=await put('work/evidence.md','合成の記録。本物の実環境試験ではない。');
  const c={schemaVersion:1,producer:{actor:'author',context:'first'},requirement,artifacts:[artifact],requirements:['AC-01'],risks:[],interfaces:[],
    testCases:[{id:'TC-01',requirements:['AC-01'],level:'unit',environment:'local',preconditions:'合成データ',steps:['読み取る'],expected:'一致する',result:null}],
    operations:OPERATIONS.map(id=>({id,status:'not-applicable',reason:'合成のCLI試験のみ',testIds:[],document:null})),reviews:[]};
  await put('work/contract.json',JSON.stringify(c));
  const before=await readFile(join(root,'work/contract.json'));
  const run=(...args)=>spawnSync(process.execPath,[join(root,'tools/harness.mjs'),'delivery',...args],{cwd:root,encoding:'utf8'});
  let output=run('check','--contract','work/contract.json','--phase','design');
  assert.equal(output.status,0,output.stderr);
  assert.equal(JSON.parse(output.stdout).certifiesAcceptance,false);
  assert.equal(JSON.parse(output.stdout).recordedExecutions,0);
  assert.equal(run('check','--contract','work/contract.json','--phase','verify').status,1);
  output=run('hashes','--contract','work/contract.json');
  assert.equal(output.status,0,output.stderr);
  assert.equal(JSON.parse(output.stdout).basisSha256,basisHash(c));
  assert.deepEqual(await readFile(join(root,'work/contract.json')),before);
  c.testCases[0].result={status:'pass',environment:'local',basisSha256:basisHash(c),evidence:[evidence],command:'synthetic; never executed',versions:'fixture'};
  c.reviews=[{actor:'reviewer',context:'fresh',independent:true,status:'pass',reviewedSha256:reviewHash(c),coverage:{requirements:['AC-01'],risks:[],interfaces:[],operations:[...OPERATIONS]},evidence:[evidence]}];
  await put('work/contract.json',JSON.stringify(c));
  assert.equal(run('check','--contract','work/contract.json','--phase','verify').status,0);
  assert.equal(run('check','--contract','work/contract.json','--phase','oops').status,2);
  for(const args of [['check'],['unknown'],['check','--contract','../secret'],['hashes','--contract','work/contract.json','--phase','verify'],['check','--contract','work/contract.json','--contract','other.json']]) assert.equal(run(...args).status,2,args.join(' '));
  await put('work/contract.json','{');
  assert.equal(run('check','--contract','work/contract.json').status,2);
});
