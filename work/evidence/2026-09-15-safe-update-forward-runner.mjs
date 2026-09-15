// Independent offline forward test. Only fixture roots and this evidence prefix are writable.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const repo = resolve('D:/projects/databricks-dev-harness');
const control = process.argv[3] === 'control';
const prefix = join(repo, `work/evidence/2026-09-15-safe-update-forward${control ? '-control' : ''}`);
const cli = join(repo, 'tools/update-harness.mjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const save = async (name, value) => writeFile(`${prefix}-${name}.json`, JSON.stringify(value, null, 2) + '\n');
const put = async (root, path, bytes) => { await mkdir(dirname(join(root,path)), {recursive:true}); await writeFile(join(root,path), bytes, {flag:'wx'}); };
async function inventory(root, paths) { return Object.fromEntries(await Promise.all(paths.map(async path => [path,sha(await readFile(join(root,path)))]))); }
async function run(label, args, cwd) {
  const result = spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:600000,maxBuffer:20*1024*1024,env:{...process.env,NO_COLOR:'1'}});
  const record={label,command:[process.execPath,...args],cwd,exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:result.stdout??'',stderr:result.stderr??'',at:new Date().toISOString()};
  await save(label,record);
  console.log(JSON.stringify({label,exitCode:record.exitCode,error:record.error,stdout:record.stdout.slice(-1800),stderr:record.stderr.slice(-1800)}));
  return record;
}
async function release(version) {
  const root=join(repo,'.harness/releases',version), manifest=await json(join(root,'manifest.json'));
  const actual=await inventory(join(root,'files'),manifest.managedFiles.map(f=>f.path));
  for(const file of manifest.managedFiles) assert.equal(actual[file.path],file.sha256,file.path);
  return {root,manifest,manifestHash:sha(await readFile(join(root,'manifest.json'))),payloadHashes:actual};
}
async function copyRelease(release,destination) {
  await mkdir(destination);
  for(const file of release.manifest.managedFiles) { await mkdir(dirname(join(destination,file.path)),{recursive:true}); await copyFile(join(release.root,'files',file.path),join(destination,file.path)); }
}
const phase=process.argv[2];
if(phase==='prepare') {
  const old=await release('0.4.0'), incoming=await release('0.5.0');
  const fixtureRoot=await mkdtemp(join(tmpdir(),'safe-update-forward-'));
  const target=join(fixtureRoot,'legacy project'),source=join(fixtureRoot,'clean source 0.5.0');
  await copyRelease(old,target); await copyRelease(incoming,source);
  await put(target,'harness/base-release.json',await readFile(join(old.root,'manifest.json')));
  await put(target,'.harness/installed-release.json',await readFile(join(old.root,'manifest.json')));
  await put(source,'harness/base-release.json',await readFile(join(incoming.root,'manifest.json')));
  const productFiles={
    'product.config.json':JSON.stringify({schemaVersion:1,name:'forward-fixture',displayName:'隔離forward案件',initializedAt:'2026-09-15T00:00:00Z'})+'\n',
    '.gitignore':'.env\n.databricks/\nnode_modules/\n.harness/local.json\n',
    'package.json':JSON.stringify({name:'forward-fixture',version:'9.8.7',private:true,type:'module',scripts:{'harness:context':'node tools/harness.mjs context','harness:check':'node tools/harness.mjs check','test:harness':'node --test tests/*.test.mjs','test:product':'node --test src/orders.test.mjs'}})+'\n',
    'package-lock.json':'{"name":"forward-fixture","version":"9.8.7","lockfileVersion":3,"requires":true,"packages":{}}\n',
    'README.md':'# 隔離検証案件\r\n\r\n既存案件の説明を保持する。\r\n',
    'docs/product/README.md':'# 案件の仕様\n\noffline fixtureのみ。\n',
    'docs/product/requirements/orders.md':'# 注文明細集計\n\n- AC-01: 数量と単価から合計を返す。\n- AC-02: 負数量を拒否する。\n',
    'docs/product/architecture/orders.md':'# 注文明細の設計\n\n整数数量と円単価の乗算。データ接続はない。\n',
    'work/sessions/forward-fixture.md':'---\nid: forward-fixture\ntitle: fixture checkpoint\nstatus: active\nintent: review\nprovider: manual\nphase: review\ngate: none\ngate_status: not-applicable\nstarted: 2026-09-15T00:00:00Z\nupdated: 2026-09-15T00:00:00Z\n---\n\n# fixture checkpoint\n\nこの隔離案件の書込み担当はforward testのみ。更新中に別agent/processを起動しない。\n',
    'src/orders.mjs':'export function total(lines) { if (lines.some(x => x.quantity < 0)) throw Error("negative quantity"); return lines.reduce((sum,x) => sum + x.quantity*x.yen,0); }\n',
    'src/orders.test.mjs':'import test from "node:test"; import assert from "node:assert/strict"; import {total} from "./orders.mjs"; test("AC-01 total",()=>assert.equal(total([{quantity:2,yen:120},{quantity:3,yen:10}]),270)); test("AC-02 rejects negative",()=>assert.throws(()=>total([{quantity:-1,yen:120}]),/negative/));\n',
    'apps/uncommitted.ts':'// 案件固有の未コミット変更を模擬\nexport const draft = true;\n',
    'resources/local.yml':'fixture: true\n',
    '.vscode/settings.json':'{"editor.tabSize":3}\n',
    '.env':'FIXTURE_ONLY=synthetic-not-a-real-secret\r\n',
    '.harness/local.json':'{"fixture":true,"connected":false}\n',
    '.github/skills/project-custom/SKILL.md':'# 案件独自スキル\n\n更新時保持のfixture。\n',
  };
  if(control) delete productFiles['.github/skills/project-custom/SKILL.md'];
  for(const name of ['DATABRICKS','FRONTEND','QUALITY','SECURITY']) productFiles[`docs/product/standards/${name}.md`]=`# 案件既存${name}基準\n\nこの隔離試験用の既存案件文書は保持する。\n`;
  for(const [path,bytes] of Object.entries(productFiles)) await put(target,path,bytes);
  const state={fixtureRoot,target,source,node:process.version,platform:process.platform,executor:cli,executorHash:sha(await readFile(cli)),oldRelease:{version:old.manifest.version,manifestHash:old.manifestHash,managedFiles:old.manifest.managedFiles.length},incomingRelease:{version:incoming.manifest.version,manifestHash:incoming.manifestHash,managedFiles:incoming.manifest.managedFiles.length},beforeManaged:await inventory(target,old.manifest.managedFiles.map(x=>x.path)),protectedPaths:Object.keys(productFiles),beforeProtected:await inventory(target,Object.keys(productFiles)),beforeBaseline:sha(await readFile(join(target,'.harness/installed-release.json'))),sourceHashes:await inventory(source,incoming.manifest.managedFiles.map(x=>x.path)),approvalScope:'明示的に許可された隔離fixtureへの計画・適用・検証のみ。未公開実行器は試験限定。実案件・push・Databricks・外部network禁止。',writers:'fresh temp target; sole test process; no provider or other writer launched',providerModelsExecuted:false};
  await save('state',state); await save('release-inputs',{old,incoming});
  await run('old-context',[join(target,'tools/harness.mjs'),'context'],target);
  await run('old-check',[join(target,'tools/harness.mjs'),'check'],target);
  await run('old-product-test',['--test',join(target,'src/orders.test.mjs')],target);
  console.log(JSON.stringify(state,null,2).slice(0,2000));
} else if(phase==='plan') {
  const s=await json(`${prefix}-state.json`);
  await run('route',[join(repo,'tools/harness.mjs'),'route','--prompt',`この案件のハーネスを、${s.source} から更新して。`],repo);
  await run('dot-harness-route',[join(repo,'tools/harness.mjs'),'route','--prompt',`この案件の.harnessを、${s.source} から更新して。`],repo);
  await run('workload',[join(repo,'tools/harness.mjs'),'workload','resolve','--prompt','この案件のハーネスを、指定したローカルフォルダーから更新して。'],repo);
  const r=await run('plan',[cli,'plan','--source',s.source,'--target',s.target],s.target);
  assert.equal(r.exitCode,0,r.stderr); const plan=JSON.parse(r.stdout);
  await save('plan-artifact',await json(join(s.target,plan.plan)));
  assert.deepEqual(await inventory(s.target,Object.keys(s.beforeManaged)),s.beforeManaged);
  assert.deepEqual(await inventory(s.target,s.protectedPaths),s.beforeProtected);
  assert.equal(sha(await readFile(join(s.target,'.harness/installed-release.json'))),s.beforeBaseline);
  await save('plan-verification',{managedUnchanged:true,protectedUnchanged:true,baselineUnchanged:true,plan});
  const releasePlan=await run('release-plan',[cli,'plan','--source',join(repo,'.harness/releases/0.5.0'),'--target',s.target],s.target);
  assert.equal(releasePlan.exitCode,0,releasePlan.stderr);
  const releaseArtifact=await json(join(s.target,JSON.parse(releasePlan.stdout).plan));
  assert.deepEqual(releaseArtifact.contract.operations,(await json(`${prefix}-plan-artifact.json`)).contract.operations);
  await save('source-equivalence',{sameOperations:true,releaseSourceKind:releaseArtifact.contract.sourceSelection.kind,cleanSourceKind:plan.source.kind,operations:releaseArtifact.contract.operations.length});
  const skills={}; for(const path of ['harness/skills/update-harness/SKILL.md','.claude/skills/update-harness/SKILL.md','.github/skills/update-harness/SKILL.md']) skills[path]=await readFile(join(repo,path),'utf8');
  assert.equal(skills['harness/skills/update-harness/SKILL.md'],skills['.claude/skills/update-harness/SKILL.md']);
  assert.equal(skills['harness/skills/update-harness/SKILL.md'],skills['.github/skills/update-harness/SKILL.md']);
  await save('provider-skills',{equalBytes:true,hashes:Object.fromEntries(Object.entries(skills).map(([p,v])=>[p,sha(v)])),skills,providerModelsExecuted:false});
} else if(phase==='apply') {
  const s=await json(`${prefix}-state.json`),p=(await json(`${prefix}-plan-verification.json`)).plan;
  assert.equal(p.canApply,true); assert.equal(p.conflicts.length,0); assert.equal(p.counts.delete??0,0);
  const r=await run('apply',[cli,'apply','--plan',p.plan,'--yes','--target',s.target],s.target);
  assert.equal(r.exitCode,0,r.stderr); const applied=JSON.parse(r.stdout);
  await save('journal',await json(join(s.target,applied.backupPath,'recovery.json')));
  await save('installed-baseline',await json(join(s.target,'.harness/installed-release.json')));
  const incoming=await release('0.5.0');
  const actual=await inventory(s.target,incoming.manifest.managedFiles.map(x=>x.path));
  assert.deepEqual(actual,s.sourceHashes); assert.deepEqual(await inventory(s.target,s.protectedPaths),s.beforeProtected);
  const plan=await json(`${prefix}-plan-artifact.json`); const backups={};
  for(const op of plan.contract.operations.filter(x=>['update','delete'].includes(x.action))) { const hash=sha(await readFile(join(s.target,applied.backupPath,'files',op.path))); assert.equal(hash,op.beforeSha256); backups[op.path]=hash; }
  assert.equal(sha(await readFile(join(s.target,applied.backupPath,'installed-release.json'))),s.beforeBaseline);
  assert.deepEqual(await inventory(s.source,Object.keys(s.sourceHashes)),s.sourceHashes);
  const original=await json(`${prefix}-release-inputs.json`), old=await release('0.4.0');
  assert.deepEqual(old,original.old); assert.deepEqual(incoming,original.incoming);
  await save('apply-verification',{allManagedMatch:true,managedCount:Object.keys(actual).length,allProtectedMatch:true,protectedCount:s.protectedPaths.length,allUpdatedBackupsMatch:true,backupCount:Object.keys(backups).length,backupHashes:backups,originalBaselineBackupMatch:true,sourceUnchanged:true,originalPublishedReleasesUnchanged:true,applied});
} else if(phase==='verify') {
  const s=await json(`${prefix}-state.json`);
  await run('new-check',[join(s.target,'tools/harness.mjs'),'check'],s.target);
  await run('new-product-test',['--test',join(s.target,'src/orders.test.mjs')],s.target);
  const tests=(await readdir(join(s.target,'tests'))).filter(x=>x.endsWith('.test.mjs')).map(x=>join(s.target,'tests',x));
  await run('new-harness-tests',['--test',...tests],s.target);
  await run('new-context',[join(s.target,'tools/harness.mjs'),'context'],s.target);
  assert.deepEqual(await inventory(s.target,s.protectedPaths),s.beforeProtected);
  await save('final-protected',{match:true,count:s.protectedPaths.length});
} else if(phase==='recheck') {
  const s=await json(`${prefix}-state.json`);
  for(const [name,prompt] of [['jp','この案件のハーネスを、指定したローカルフォルダーから更新して。'],['dot','この案件の.harnessを、指定したローカルフォルダーから更新して。'],['mixed','この案件のharnessを、指定したローカルフォルダーから更新して。'],['improve','ハーネスの更新処理を改善して']]) {
    const r=await run(`final-route-${name}`,[join(repo,'tools/harness.mjs'),'route','--prompt',prompt],repo);
    assert.equal(JSON.parse(r.stdout).route,name==='improve'?'improve-harness':'update-harness');
    assert.equal(JSON.parse(r.stdout).executionAuthorized,false);
  }
  const paths=['tools/update-harness.mjs','tools/lib/distribution.mjs','tools/lib/shared.mjs','harness/router.json','tests/update-entry.test.mjs','harness/skills/update-harness/SKILL.md','.claude/skills/update-harness/SKILL.md','.github/skills/update-harness/SKILL.md','docs/harness/operations/SAFE_LOCAL_UPDATE.md','docs/harness/operations/UPDATING_EXISTING_PROJECTS.md'];
  const texts=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await readFile(join(repo,p),'utf8')])));
  assert.equal(texts[paths[5]],texts[paths[6]]); assert.equal(texts[paths[5]],texts[paths[7]]);
  assert.ok(texts[paths[8]].includes('削除・再生成せず')); assert.ok(!texts[paths[9]].includes('\nnpm run agent-assets:sync\n'));
  const test=await run('candidate-entry-tests',['--test',join(repo,'tests/update-entry.test.mjs')],repo);
  assert.equal(test.exitCode,0,test.stderr);
  assert.deepEqual(await inventory(s.target,Object.keys(s.sourceHashes)),s.sourceHashes);
  assert.deepEqual(await inventory(s.target,s.protectedPaths),s.beforeProtected);
  await save('final-verification',{at:new Date().toISOString(),allManagedMatchAfterTests:true,managedCount:1057,allProtectedMatchAfterTests:true,protectedCount:s.protectedPaths.length,sourceHasGit:(await readdir(s.source)).includes('.git'),targetHasGit:(await readdir(s.target)).includes('.git'),providerSkillBytesEqual:true,sourceHashes:Object.fromEntries(Object.entries(texts).map(([p,t])=>[p,sha(t)])),providerModelsExecuted:false,liveProjectExecuted:false,externalNetworkUsed:false});
} else throw Error('phase must be prepare, plan, apply, verify or recheck');
