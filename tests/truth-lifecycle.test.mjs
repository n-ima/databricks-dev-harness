import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import test from 'node:test';
import {initLoop,setLoopGate,runLoopIteration,recordLoop,stopLoop} from '../tools/lib/loop.mjs';
import {closeSession} from '../tools/lib/memory.mjs';
import {sealEvidence} from '../tools/lib/evidence.mjs';
import {parseFrontmatter,readJson,withFileLock} from '../tools/lib/shared.mjs';

const success={ok:true,status:0,stdout:'synthetic only',stderr:''};
const git=(_cmd,args)=>({...success,stdout:args.join(' ')==='branch --show-current'?'isolated-audit':args.join(' ')==='rev-parse --verify HEAD'?'a'.repeat(40):args.join(' ')==='status --porcelain'?'':'true'});
async function fixture(t){
  const base=resolve(tmpdir()), root=await mkdtemp(join(base,'truth-repair-'));
  t.mock.method(console,'log',()=>{});
  t.after(async()=>{assert.ok(root.startsWith(base+sep));await rm(root,{recursive:true,force:true});});
  const put=async(p,v)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),typeof v==='string'?v:JSON.stringify(v));};
  await put('AGENTS.md','# Synthetic policy\n'); await put('tools/agent-hook.mjs','// fixture\n');
  await put('harness.config.json',{loop:{maxIterations:5,maxWallMinutes:10,maxProcessMinutes:1,checks:[['check-one'],['check-two']]}});
  await put('docs/product/requirements/test.md','---\nstatus: accepted\n---\n- AC-01: Synthetic gate invariant.\n');
  const session=(id='S',status='active',gate='approved')=>`---\nid: ${id}\nstatus: ${status}\nprovider: claude\ngate: product-intent\ngate_status: ${gate}\nrequirement: docs/product/requirements/test.md\n---\n`;
  await put('work/sessions/S.md',session());
  await put('work/evidence/test.md','Synthetic verification, not live execution.\n');
  await put('work/reviews/test.json',{reviewer:'independent-fixture',provider:'copilot',independent:true,acceptance:[{id:'AC-01',status:'pass',evidence:['work/evidence/test.md']}]});
  await sealEvidence(root,{review:'work/reviews/test.json',session:'S',requirement:'docs/product/requirements/test.md'});
  const init=(id='S')=>initLoop(root,{session:id,provider:'claude',verifier_provider:'copilot'},{run:git});
  const close=(outcome='completed')=>closeSession(root,{id:'S',outcome,summary:'Synthetic closure',verifier_evidence:'work/reviews/S.receipt.json'});
  return {root,put,session,init,close};
}
test('FIX-02 pending loop prevents completed session with an otherwise valid receipt',async t=>{
  const c=await fixture(t), loop=await c.init(); await setLoopGate(c.root,{id:loop.id,gate:'sensitive-data-or-permission-change'});
  await assert.rejects(c.close(),/loop|gate|pending/i);
  assert.equal(parseFrontmatter(await readFile(join(c.root,'work/sessions/S.md'),'utf8')).status,'active');
});
for(const status of ['blocked','completed','superseded']) test(`FIX-03 ${status} session refuses a pre-existing loop before provider invocation`,async t=>{
  const c=await fixture(t),loop=await c.init();
  if(status==='blocked') await c.close(status); else await c.put('work/sessions/S.md',c.session('S',status));
  let calls=0;await assert.rejects(runLoopIteration(c.root,{id:loop.id,execute:true},{run:()=>{calls++;return success;}}),/session|active|blocked/i);
  assert.equal(calls,0); assert.equal((await readJson(join(c.root,'work/loops',loop.id+'.json'))).status,'blocked');
});
test('FIX-03 pending session after init refuses execution',async t=>{
  const c=await fixture(t),loop=await c.init();await c.put('work/sessions/S.md',c.session('S','active','pending'));
  await assert.rejects(runLoopIteration(c.root,{id:loop.id,execute:true},{run:()=>{throw Error('must not execute');}}),/pending|session/i);
});
for(const at of ['claude','check-one']) test(`FIX-03 close during ${at} prevents following checks`,async t=>{
  const c=await fixture(t),loop=await c.init(),calls=[];
  await assert.rejects(runLoopIteration(c.root,{id:loop.id,execute:true},{run:async cmd=>{calls.push(cmd);if(cmd===at) await c.close('blocked');return success;}}),/session|blocked/i);
  assert.deepEqual(calls,at==='claude'?['claude']:['claude','check-one']);
});
test('FIX-02 no-loop session can complete; unrelated loops do not block it',async t=>{
  const c=await fixture(t);await c.put('work/sessions/OTHER.md',c.session('OTHER'));await c.init('OTHER');await c.close();
});
test('FIX-02 every related loop is checked, including cancelled unresolved gates',async t=>{
  const c=await fixture(t),loop=await c.init();await setLoopGate(c.root,{id:loop.id,gate:'sensitive-data-or-permission-change'});
  await stopLoop(c.root,{id:loop.id,outcome:'cancelled',reason:'Not approved; handoff needed'});await assert.rejects(c.close(),/loop|gate|pending/i);
});
test('FIX-02 malformed loop records fail closed without completing',async t=>{
  const c=await fixture(t);await c.put('work/loops/bad.json','{');await assert.rejects(c.close(),/loop|JSON|parse/i);
});
test('FIX-02 session lock prevents new loop creation during closure',async t=>{
  const c=await fixture(t);await withFileLock(join(c.root,'work/sessions/S.md'),async()=>{await assert.rejects(c.init(),/locked/i);});
});
test('FIX-03 achieved cannot be recorded after session stops',async t=>{
  const c=await fixture(t),loop=await c.init();await runLoopIteration(c.root,{id:loop.id,execute:true},{run:()=>success});await c.close('blocked');
  await assert.rejects(recordLoop(c.root,{id:loop.id,outcome:'achieved',evidence:['work/evidence/test.md'],verifier_evidence:'work/reviews/S.receipt.json'}),/session|blocked/i);
});
