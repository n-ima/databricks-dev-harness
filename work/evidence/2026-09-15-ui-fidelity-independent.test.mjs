// Independent synthetic contract tests. No real AppKit, provider, browser, or Databricks execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateUiContract, validateUiApproval, uiReviewHash, uiCommand } from '../../tools/lib/ui-contract.mjs';
import { createApproval } from '../../tools/lib/approval.mjs';
import { initLoop, setLoopGate, approveLoopGate, runLoopIteration, recordLoop } from '../../tools/lib/loop.mjs';
import { planScaffold, applyScaffold } from '../../tools/lib/scaffold.mjs';

const contractPath = 'docs/product/ui/test.json';
const sourcePath = 'apps/test/src/Screen.tsx';
const sharedPath = 'apps/test/src/SharedButton.tsx';
const sessionPath = 'work/sessions/synthetic.md';
const approvalPath = 'work/approvals/synthetic/ui-mock.json';
const sha = value => createHash('sha256').update(value).digest('hex');
const encode = value => JSON.stringify(value, null, 2) + '\n';
const passed = stdout => ({ok:true,status:0,stdout,stderr:''});
const git = (_command,args) => passed(args[0] === 'branch' ? 'codex/synthetic' : args[0] === 'status' ? '' : 'true');

async function fixture(t) {
  t.mock.method(console,'log',()=>{});
  const root = await mkdtemp(join(tmpdir(),'ui-fidelity-independent-'));
  t.after(async()=>{ assert.ok(root.startsWith(resolve(tmpdir())+sep));assert.match(root,/ui-fidelity-independent-/);await rm(root,{recursive:true,force:true}); });
  const put = async (path,value) => { await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),typeof value==='string'?value:encode(value)); };
  const ref = async path => ({path,sha256:sha(await readFile(join(root,path)))});
  await put('AGENTS.md','Synthetic independent test policy. No external calls.\n');
  await put('tools/agent-hook.mjs','// synthetic fixed policy\n');
  await put('harness.config.json',{humanGates:['ui-mock','product-intent','data-write'],loop:{maxIterations:8,maxWallMinutes:5,maxProcessMinutes:1,checks:[['synthetic-check']]}});
  await put(sessionPath,'---\nid: synthetic\nstatus: active\ngate: ui-mock\ngate_status: pending\nrequirement: docs/product/requirements/test.md\narchitecture: docs/product/architecture/test.md\n---\nSynthetic session\n');
  await put('docs/product/requirements/test.md','---\nstatus: accepted\n---\n- AC-01: synthetic UI requirement\n');
  await put('docs/product/architecture/test.md','Synthetic intended Databricks Apps UI.\n');
  const dependencies = {'@databricks/appkit':'1.2.3','@databricks/appkit-ui':'1.2.3'};
  await put('apps/test/package.json',{name:'synthetic-test',dependencies});
  await put('apps/test/package-lock.json',{lockfileVersion:3,packages:{'':{dependencies},'node_modules/@databricks/appkit':{version:'1.2.3'},'node_modules/@databricks/appkit-ui':{version:'1.2.3'}}});
  await put(sourcePath,"import { SharedButton } from './SharedButton'; export const Screen = () => <SharedButton />;\n");
  await put(sharedPath,"export const SharedButton = () => <button>登録</button>;\n");
  await put('apps/test/src/theme.css',':root { color: #123456; }\n');
  await put('apps/test/src/fixtures.json',{items:[]});
  await put('docs/product/ui/static.html','<button>登録</button>\n');
  for(const name of ['visual','behavior','review','human','exception'])await put('work/evidence/'+name+'.md','SYNTHETIC '+name+' evidence. Not an actual visual test or human approval.\n');
  const source=await ref(sourcePath);
  const c={schemaVersion:1,sessionId:'synthetic',producer:{actor:'synthetic-implementer',context:'synthetic-build-context'},
    requirement:await ref('docs/product/requirements/test.md'),architecture:await ref('docs/product/architecture/test.md'),
    target:{hosting:'databricks-apps',framework:'databricks-appkit',appRoot:'apps/test',exception:null},
    runtime:{version:'1.2.3',manifest:await ref('apps/test/package.json'),lockfile:await ref('apps/test/package-lock.json'),sources:[source,await ref(sharedPath)],styles:[await ref('apps/test/src/theme.css')],fixtures:[await ref('apps/test/src/fixtures.json')]},
    screens:[{id:'UI-01',source,components:['SharedButton'],states:['normal'],previews:[{state:'normal',mode:'runtime',source,runtimeSha256:source.sha256,evidence:[await ref('work/evidence/visual.md')]}],behavior:[{state:'normal',evidence:[await ref('work/evidence/behavior.md')]}]}],unresolved:[],
    review:{actor:'synthetic-reviewer',context:'synthetic-review-context',status:'pass',reviewedSha256:'',screens:['UI-01'],evidence:[await ref('work/evidence/review.md')]}};
  const save=async(rehash=true)=>{if(rehash)c.review.reviewedSha256=uiReviewHash(c);await put(contractPath,c);};
  await save();
  const approve=()=>createApproval(root,{session:'synthetic',gate:'ui-mock',actor:'synthetic-human',evidence:'work/evidence/human.md',artifact:[sourcePath],ui_contract:contractPath});
  const loop=async()=>initLoop(root,{session:'synthetic',provider:'claude',verifier_provider:'copilot',allow_unsafe_test:true},{run:git});
  return {root,c,put,ref,save,approve,loop};
}

test('independent: normal approval binds sources and explicitly does not certify appearance/identity',async t=>{
  const f=await fixture(t);const a=await f.approve();const checked=await validateUiApproval(f.root,a,{sessionId:'synthetic',appRoot:'apps/test',appkitVersion:'v1.2.3'});
  assert.equal(checked.certifiesAppearance,false);assert.equal(checked.identityAuthenticated,false);assert.equal(a.artifactHashes[sourcePath],f.c.screens[0].source.sha256);
  assert.match(await readFile(join(f.root,sessionPath),'utf8'),/gate_status: approved/);
});
for(const [name,options] of [['session',{sessionId:'other'}],['appRoot',{appRoot:'apps/other'}],['version',{appkitVersion:'1.2.4'}]])test('independent: approval rejects wrong '+name,async t=>{
  const f=await fixture(t);const a=await f.approve();await assert.rejects(validateUiApproval(f.root,a,options),/mismatch|different|differs/i);
});
for(const path of [sourcePath,'apps/test/src/theme.css','apps/test/package-lock.json','apps/test/src/fixtures.json','work/evidence/review.md'])test('independent: approval rejects changed '+path,async t=>{
  const f=await fixture(t);const a=await f.approve();await f.put(path,'changed synthetic artifact\n');await assert.rejects(validateUiApproval(f.root,a),/changed artifact|approved artifact changed/);
});
test('independent: legacy approval cannot be consumed',async t=>{
  const f=await fixture(t);await assert.rejects(validateUiApproval(f.root,{gate:'ui-mock',decision:'approved',actor:'synthetic',sessionId:'synthetic',artifactHashes:{[sourcePath]:f.c.screens[0].source.sha256}}),/legacy approval/);
});
for(const [name,mutate,pattern] of [
  ['same reviewer actor',c=>c.review.actor=c.producer.actor,/independent review/],
  ['same reviewer context',c=>c.review.context=c.producer.context,/independent review/],
  ['unresolved difference',c=>c.unresolved.push('Tree differs from production'),/unresolved/],
  ['empty screens',c=>c.screens=[],/screens/],
  ['missing behavior',c=>c.screens[0].behavior=[],/behavior/],
  ['missing preview state',c=>c.screens[0].states.push('denied'),/missing preview/],
  ['approximate HTML mode',c=>c.screens[0].previews[0].mode='approximate-html',/approximate/],
  ['unapproved external hosting',c=>c.target.hosting='external',/explicit exception/],
])test('independent: refuses '+name+' without writing approval',async t=>{
  const f=await fixture(t);mutate(f.c);await f.save();await assert.rejects(f.approve(),pattern);await assert.rejects(readFile(join(f.root,approvalPath)),/ENOENT/);assert.match(await readFile(join(f.root,sessionPath),'utf8'),/gate_status: pending/);
});
test('independent: stale review fails after the basis changes even with fresh artifact hashes',async t=>{
  const f=await fixture(t);f.c.screens[0].components.push('NewControl');await f.save(false);await assert.rejects(f.approve(),/stale review/);
});
test('independent: runtime-html is preview-only and cannot be approved as executable mock',async t=>{
  const f=await fixture(t);f.c.screens[0].previews[0].mode='runtime-html';f.c.screens[0].previews[0].source=await f.ref('docs/product/ui/static.html');f.c.screens[0].behavior=[];await f.save();
  assert.equal((await validateUiContract(f.root,contractPath,{phase:'preview'})).phase,'preview');await assert.rejects(f.approve(),/behavior|static runtime HTML/);
});
test('independent: explicit external/framework exception is bound to exact target and requirement',async t=>{
  const f=await fixture(t);f.c.target.hosting='external';f.c.target.framework='react-custom';f.c.target.exception={actor:'synthetic-human',decision:'approved',hosting:'external',framework:'react-custom',requirementSha256:f.c.requirement.sha256,evidence:await f.ref('work/evidence/exception.md')};await f.save();await f.approve();
  f.c.target.exception.framework='different';await f.save();await assert.rejects(f.approve(),/exact target/);
});
test('independent: ui-init is draft-only and does not overwrite an existing contract',async t=>{
  const f=await fixture(t);const options=['--contract','docs/product/ui/new.json','--session','synthetic','--app-root','apps/test'];
  const out=await uiCommand(f.root,'ui-init',options);assert.equal(out.ready,false);await assert.rejects(validateUiContract(f.root,'docs/product/ui/new.json'),/runtime references|reference|runtime/);await assert.rejects(uiCommand(f.root,'ui-init',options),/overwrite/);
});
test('independent: non-UI product intent needs no UI contract',async t=>{
  const f=await fixture(t);await f.put(sessionPath,(await readFile(join(f.root,sessionPath),'utf8')).replace('gate: ui-mock','gate: product-intent'));
  const a=await createApproval(f.root,{session:'synthetic',gate:'product-intent',actor:'synthetic-human',evidence:'work/evidence/human.md'});assert.equal(a.gate,'product-intent');assert.equal(a.uiContract,undefined);
});
test('independent: loop initialization rejects a legacy canonical UI approval',async t=>{
  const f=await fixture(t);await f.put(approvalPath,{gate:'ui-mock',decision:'approved',actor:'synthetic-human',sessionId:'synthetic',artifactHashes:{}});await assert.rejects(f.loop(),/legacy approval/);
});
test('independent: loop gate and later other gate cannot forget the UI receipt',async t=>{
  const f=await fixture(t);const loop=await f.loop();await f.approve();await approveLoopGate(f.root,{id:loop.id,evidence:approvalPath});await setLoopGate(f.root,{id:loop.id,gate:'data-write'});
  await f.put('work/evidence/data-decision.json',{gate:'data-write',decision:'approved',actor:'synthetic-human',sessionId:'synthetic',evidence:'work/evidence/human.md',artifactHashes:{}});await approveLoopGate(f.root,{id:loop.id,evidence:'work/evidence/data-decision.json'});
  await f.put('apps/test/src/theme.css','changed theme');let calls=0;await assert.rejects(runLoopIteration(f.root,{id:loop.id,execute:true},{run:()=>{calls++;return passed('synthetic');}}),/changed artifact/);assert.equal(calls,0);
});
test('independent: loop rechecks before a second run and never starts provider with stale UI',async t=>{
  const f=await fixture(t);await f.approve();const loop=await f.loop();let calls=0;const runner=()=>{calls++;return passed('synthetic');};
  await runLoopIteration(f.root,{id:loop.id,execute:true},{run:runner});await recordLoop(f.root,{id:loop.id,outcome:'progress'});const before=calls;await f.put(sourcePath,'changed source');await assert.rejects(runLoopIteration(f.root,{id:loop.id,execute:true},{run:runner}),/changed artifact/);assert.equal(calls,before);
});
test('independent: non-UI loop does not require UI records',async t=>{
  const f=await fixture(t);await f.put(sessionPath,(await readFile(join(f.root,sessionPath),'utf8')).replace('gate: ui-mock','gate: none').replace('gate_status: pending','gate_status: not-applicable'));
  const loop=await f.loop();let calls=0;await runLoopIteration(f.root,{id:loop.id,execute:true},{run:()=>{calls++;return passed('synthetic');}});assert.equal(calls,2);
});
test('independent: changed shared runtime component must invalidate approval',async t=>{
  const f=await fixture(t);const a=await f.approve();await f.put(sharedPath,"export const SharedButton = () => <input aria-label='changed' />;\n");await assert.rejects(validateUiApproval(f.root,a),/changed artifact|approved artifact changed|component/);
});
test('independent: loop does not record passing checks after provider changes approved UI',async t=>{
  const f=await fixture(t);await f.approve();const loop=await f.loop();let calls=0;
  await assert.rejects(runLoopIteration(f.root,{id:loop.id,execute:true},{run:async()=>{calls++;if(calls===1)await f.put('apps/test/src/theme.css','provider changed theme');return passed('synthetic');}}),/changed artifact|approved artifact changed/);assert.equal(calls,1);
});
test('independent: achieved cannot bypass UI changes between run and record',async t=>{
  const f=await fixture(t);await f.approve();const loop=await f.loop();await runLoopIteration(f.root,{id:loop.id,execute:true},{run:()=>passed('synthetic')});await f.put(sourcePath,'changed source');await assert.rejects(recordLoop(f.root,{id:loop.id,outcome:'achieved',evidence:['work/evidence/visual.md'],verifier_evidence:'work/evidence/review.md'}),/changed artifact/);
});
test('independent: incompatible manifest dependency cannot masquerade as the locked runtime version',async t=>{
  const f=await fixture(t);const manifest=JSON.parse(await readFile(join(f.root,'apps/test/package.json'),'utf8'));const lock=JSON.parse(await readFile(join(f.root,'apps/test/package-lock.json'),'utf8'));
  manifest.dependencies['@databricks/appkit']='9.9.9';lock.packages[''].dependencies['@databricks/appkit']='9.9.9';
  await f.put('apps/test/package.json',manifest);await f.put('apps/test/package-lock.json',lock);f.c.runtime.manifest=await f.ref('apps/test/package.json');f.c.runtime.lockfile=await f.ref('apps/test/package-lock.json');await f.save();
  await assert.rejects(f.approve(),/version|manifest|dependency|AppKit/);
});
for(const [spec,version,accepted] of [
  ['^1.2.0','1.2.3',true],['~1.2.0','1.2.3',true],['~1.1.0','1.2.3',false],['^2.0.0','1.2.3',false],
  ['^0.2.0','0.2.5',true],['^0.2.0','0.3.0',false],['^0.0.2','0.0.2',true],['^0.0.2','0.0.3',false],
  ['1.2.3-beta.1','1.2.3-beta.1',true],['^1.2.3-beta.1','1.2.3-beta.1',false],['npm:other@1.2.3','1.2.3',false],['>=1.0.0 <2.0.0','1.2.3',false]
])test('independent: dependency spec '+spec+' vs '+version+' is '+(accepted?'accepted':'rejected'),async t=>{
  const f=await fixture(t);const manifest=JSON.parse(await readFile(join(f.root,'apps/test/package.json'),'utf8'));const lock=JSON.parse(await readFile(join(f.root,'apps/test/package-lock.json'),'utf8'));
  for(const name of ['@databricks/appkit','@databricks/appkit-ui']){manifest.dependencies[name]=spec;lock.packages[''].dependencies[name]=spec;lock.packages['node_modules/'+name].version=version;}
  await f.put('apps/test/package.json',manifest);await f.put('apps/test/package-lock.json',lock);f.c.runtime.version=version;f.c.runtime.manifest=await f.ref('apps/test/package.json');f.c.runtime.lockfile=await f.ref('apps/test/package-lock.json');await f.save();
  if(accepted)await f.approve();else await assert.rejects(f.approve(),/version|manifest|dependency|AppKit/);
});
test('independent: integration plan always requires reuse instead of claiming new app approval',async t=>{
  const f=await fixture(t);await f.put('harness/toolchain.lock.json',{appkitTemplateVersion:'v1.2.3'});await f.put('work/evidence/manifest.json',{templateVersion:'v1.2.3',version:'v1.2.3',plugins:{server:{requiredByTemplate:true}}});let calls=0;
  const plan=await planScaffold(f.root,{kind:'app',purpose:'integration',name:'another-app',version:'v1.2.3',manifest_file:'work/evidence/manifest.json',data_access:'none'},{run:()=>{calls++;throw new Error('Unexpected external call');}});
  assert.equal(plan.status,'needs-input');assert.ok(plan.missing.some(x=>x.startsWith('reuse-reviewed-app:')));assert.equal(calls,0);await assert.rejects(applyScaffold(f.root,{plan:'work/scaffolds/'+plan.id+'.json',yes:true},{run:()=>{calls++;throw new Error('Unexpected init');}}),/reuse-reviewed-app/);assert.equal(calls,0);
});
test('independent: old ready integration plan is rejected before authentication or app writes',async t=>{
  const f=await fixture(t);const p={schemaVersion:1,id:'legacy-plan',kind:'app',purpose:'integration',name:'another-app',outputDir:'apps/another-app',status:'ready',missing:[],deployReady:false};p.integrityHash=sha(JSON.stringify(p));await f.put('work/scaffolds/legacy.json',p);let calls=0;
  await assert.rejects(applyScaffold(f.root,{plan:'work/scaffolds/legacy.json',yes:true},{run:()=>{calls++;return passed('synthetic');}}),/integration init is no longer supported/);assert.equal(calls,0);assert.deepEqual(JSON.parse(await readFile(join(f.root,'work/scaffolds/legacy.json'),'utf8')),p);await assert.rejects(readFile(join(f.root,'apps/another-app/package.json')),/ENOENT/);
});
