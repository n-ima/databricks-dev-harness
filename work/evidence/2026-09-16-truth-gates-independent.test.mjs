// Independent FIX-02/03 probes. Only fresh temp fixtures and local Node children.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {initLoop,runLoopIteration,recordLoop,setLoopGate,approveLoopGate,stopLoop} from '../../tools/lib/loop.mjs';
import {startSession,closeSession} from '../../tools/lib/memory.mjs';
import {sealEvidence} from '../../tools/lib/evidence.mjs';
import * as shared from '../../tools/lib/shared.mjs';
import {commandResultAsync} from '../../tools/lib/command-async.mjs';
const success={ok:true,status:0,stdout:'synthetic',stderr:''};
const git=(command,args)=>{assert.equal(command,'git');return {...success,stdout:args.join(' ')==='branch --show-current'?'isolated-gates':args.join(' ')==='rev-parse --verify HEAD'?'c'.repeat(40):args.join(' ')==='status --porcelain'?'':'true'};};
const repository=resolve(new URL('../..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const memoryUrl=pathToFileURL(join(repository,'tools/lib/memory.mjs')).href;
async function fixture(t){
  const base=resolve(tmpdir()),root=await mkdtemp(join(base,'truth-gates-independent-'));
  t.mock.method(console,'log',()=>{});
  t.after(async()=>{assert.ok(root.startsWith(base+sep)&&root.slice(base.length+1).startsWith('truth-gates-independent-'));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:20});});
  const put=async(p,v)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),typeof v==='string'?v:JSON.stringify(v));};
  await put('AGENTS.md','# Synthetic policy\n');await put('tools/agent-hook.mjs','// Synthetic hook\n');
  await put('harness.config.json',{loop:{maxIterations:5,maxWallMinutes:10,maxProcessMinutes:1,checks:[['first'],['second']]}});
  await put('harness/router.json',{routes:[{id:'review'}]});
  await put('docs/product/requirements/R.md','---\nstatus: accepted\n---\n- AC-01: Synthetic scope.\n');
  const session=(id='S',status='active',gate='approved')=>`---\nid: ${id}\nstatus: ${status}\nprovider: claude\ngate: product-intent\ngate_status: ${gate}\nrequirement: docs/product/requirements/R.md\n---\n`;
  await put('work/sessions/S.md',session());await put('work/evidence/E.md','Synthetic evidence only.\n');
  await put('work/reviews/R.json',{reviewer:'fresh-reviewer',provider:'copilot',independent:true,acceptance:[{id:'AC-01',status:'pass',evidence:['work/evidence/E.md']}]});
  const seal=(id='S')=>sealEvidence(root,{session:id,requirement:'docs/product/requirements/R.md',review:'work/reviews/R.json'});
  await seal();
  const init=(id='S')=>initLoop(root,{session:id,provider:'claude',verifier_provider:'copilot'},{run:git});
  const close=(outcome='completed',id='S')=>closeSession(root,{id,outcome,summary:'Synthetic close',verifier_evidence:`work/reviews/${id}.receipt.json`});
  const loopPath=l=>join(root,'work/loops',l.id+'.json');
  const get=l=>shared.readJson(loopPath(l));
  const achieve=async l=>{await runLoopIteration(root,{id:l.id,execute:true},{run:()=>success});return recordLoop(root,{id:l.id,outcome:'achieved',summary:'Synthetic checked',evidence:['work/evidence/E.md'],verifier_evidence:'work/reviews/S.receipt.json'});};
  return {root,put,session,seal,init,close,loopPath,get,achieve};
}

test('IND-01 generated Japanese session IDs can initialize a loop',async t=>{
  const c=await fixture(t);const s=await startSession(c.root,{title:'受注更新の確認',intent:'review',provider:'claude',requirement:'docs/product/requirements/R.md'});
  assert.match(s.id,/受注/);const l=await c.init(s.id);assert.equal(l.sessionId,s.id);
});
test('IND-02 mismatched filename/frontmatter identity is rejected before loop creation',async t=>{
  const c=await fixture(t);await c.put('work/sessions/S.md',c.session('ALIAS'));
  await assert.rejects(c.init('S'),/identity|mismatch|session|invalid/i);
});
test('IND-03 a completed loop permits session completion',async t=>{
  const c=await fixture(t),l=await c.init();await c.achieve(l);await c.close();assert.equal((await c.get(l)).status,'achieved');
});
test('IND-04 completed session rejects gate mutation without rewriting its achieved loop',async t=>{
  const c=await fixture(t),l=await c.init();await c.achieve(l);await c.close();const before=await readFile(c.loopPath(l),'utf8');
  await assert.rejects(setLoopGate(c.root,{id:l.id,gate:'sensitive-data-or-permission-change'}));
  assert.equal(await readFile(c.loopPath(l),'utf8'),before);
});
test('IND-05 completed session rejects approval without rewriting its achieved loop',async t=>{
  const c=await fixture(t),l=await c.init();await c.achieve(l);await c.close();const before=await readFile(c.loopPath(l),'utf8');
  await assert.rejects(approveLoopGate(c.root,{id:l.id,evidence:'work/evidence/E.md'}));
  assert.equal(await readFile(c.loopPath(l),'utf8'),before);
});
test('IND-06 all related loops are checked even if one achieved',async t=>{
  const c=await fixture(t),first=await c.init();await c.achieve(first);const second=await c.init();
  assert.notEqual(first.id,second.id);await assert.rejects(c.close(),/loop/i);
});
test('IND-07 cancelled unfinished iteration still prevents completion',async t=>{
  const c=await fixture(t),l=await c.init();await runLoopIteration(c.root,{id:l.id,execute:true},{run:()=>success});
  await stopLoop(c.root,{id:l.id,outcome:'cancelled',reason:'Unresolved execution; explicit handoff'});await assert.rejects(c.close(),/loop/i);
});
test('IND-08 prelaunch session lock contention invokes no provider',async t=>{
  const c=await fixture(t),l=await c.init();let calls=0;
  await shared.withFileLock(join(c.root,'work/sessions/S.md'),async()=>{
    await assert.rejects(runLoopIteration(c.root,{id:l.id,execute:true},{run:()=>{calls++;return success;}}),/locked/i);
  });assert.equal(calls,0);
});
test('IND-09 actual local Node child can close blocked during runner execution',async t=>{
  const c=await fixture(t),l=await c.init();let childResult;
  const child=`import {closeSession} from ${JSON.stringify(memoryUrl)};try{await closeSession(${JSON.stringify(c.root)},{id:'S',outcome:'blocked',summary:'Local child closes fixture'});console.log('CHILD_CLOSED');}catch(e){console.error(e.message);process.exitCode=3;}`;
  const invoke=commandResultAsync;
  const calls=[];
  const run=cmd=>{calls.push(cmd);assert.equal(cmd,'claude');const pending=invoke(process.execPath,['--input-type=module','-e',child],{cwd:c.root,timeout:5000});return Promise.resolve(pending).then(r=>{childResult=r;return r;});};
  const error=await runLoopIteration(c.root,{id:l.id,execute:true},{run}).then(()=>null,e=>e);
  assert.equal(childResult.status,0,childResult.stderr);assert.match(childResult.stdout,/CHILD_CLOSED/);assert.match(error?.message??'',/session|blocked/i);assert.deepEqual(calls,['claude']);
});
test('IND-10 stop in a later check preserves previous observations and prevents achievement',async t=>{
  const c=await fixture(t),l=await c.init(),calls=[];
  await assert.rejects(runLoopIteration(c.root,{id:l.id,execute:true},{run:async cmd=>{calls.push(cmd);if(cmd==='second')await c.close('blocked');return success;}}),/session|blocked/i);
  const saved=await c.get(l);assert.equal(saved.status,'blocked');assert.equal(saved.iterations[0].providerExit,0);assert.equal(saved.iterations[0].checks.length,2);
  assert.equal(saved.iterations[0].outcome,undefined);assert.equal(saved.iterations[0].finishedAt,null);assert.deepEqual(calls,['claude','first','second']);
});
test('IND-11 new session cannot be initialized after normal blocked close',async t=>{
  const c=await fixture(t);await c.close('blocked');await assert.rejects(c.init(),/active|session/i);
});
test('IND-12 corrupted frontmatter identity cannot hide the pending loop from completion',async t=>{
  const c=await fixture(t),l=await c.init();await setLoopGate(c.root,{id:l.id,gate:'sensitive-data-or-permission-change'});
  await c.put('work/sessions/S.md',c.session('ALIAS'));await c.seal('ALIAS');
  await assert.rejects(c.close('completed','ALIAS'),/identity|mismatch|loop|session|invalid/i);
});
test('IND-13 default manual-loop check runner releases session lock during local Node execution',async t=>{
  const c=await fixture(t);
  const child=`import {closeSession} from ${JSON.stringify(memoryUrl)};await closeSession(${JSON.stringify(c.root)},{id:'S',outcome:'blocked',summary:'Default check runner child stops fixture'});`;
  await c.put('harness.config.json',{loop:{maxIterations:5,maxWallMinutes:10,maxProcessMinutes:1,checks:[[process.execPath,'--input-type=module','-e',child]]}});
  const l=await initLoop(c.root,{session:'S',provider:'manual'},{run:git});
  await assert.rejects(runLoopIteration(c.root,{id:l.id,execute:true}),/session|blocked/i);
  assert.equal(shared.parseFrontmatter(await readFile(join(c.root,'work/sessions/S.md'),'utf8')).status,'blocked');
  assert.equal((await c.get(l)).status,'blocked');
});
test('IND-14 async runner preserves supported npm invocation on Windows',async t=>{
  const c=await fixture(t);const before=shared.commandResult('npm',['--version'],{cwd:c.root,timeout:5000});
  assert.equal(before.ok,true,'fixture requires the existing synchronous npm adapter to work');
  const after=await commandResultAsync('npm',['--version'],{cwd:c.root,timeout:5000});
  assert.equal(after.ok,true,after.error??after.stderr);assert.equal(after.stdout.trim(),before.stdout.trim());
});
test('IND-15 npm works without Volta npm.exe using the existing Windows CLI adapter contract',async t=>{
  if(process.platform!=='win32'){t.skip('Windows-specific npm.cmd compatibility');return;}
  const c=await fixture(t);await c.put('npm.cmd','@exit /b 17\r\n');
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k.toLowerCase()!=='path'));env.Path=c.root;
  const before=shared.commandResult('npm',['--version'],{cwd:c.root,env,timeout:5000});
  assert.equal(before.ok,true,before.error??before.stderr);
  const after=await commandResultAsync('npm',['--version'],{cwd:c.root,env,timeout:5000});
  assert.equal(after.ok,true,after.error??after.stderr);assert.equal(after.stdout.trim(),before.stdout.trim());
});
test('IND-16 async runner reports missing executable as failure',async t=>{
  const c=await fixture(t);const result=await commandResultAsync(join(c.root,'missing-executable'),[],{cwd:c.root,timeout:1000});
  assert.equal(result.ok,false);assert.match(result.error,/ENOENT|not found/i);
});
test('IND-17 async runner bounds immediate child runtime',async t=>{
  const c=await fixture(t);const start=Date.now();const result=await commandResultAsync(process.execPath,['-e','process.stdout.write(String(process.pid));setInterval(()=>{},1000)'],{cwd:c.root,timeout:120});
  assert.equal(result.ok,false);assert.match(result.error,/timeout/i);assert.ok(Date.now()-start<5000);
  const pid=Number(result.stdout);assert.ok(Number.isInteger(pid)&&pid>0,'the synthetic child published its own PID');
  let alive=true;try{process.kill(pid,0);}catch(error){assert.equal(error.code,'ESRCH');alive=false;}
  assert.equal(alive,false,'runner must not resolve before its immediate child has exited');
});
test('IND-18 async runner bounds captured output',async t=>{
  const c=await fixture(t);const result=await commandResultAsync(process.execPath,['-e',"process.stdout.write('x'.repeat(4096))"],{cwd:c.root,timeout:2000,maxBuffer:128});
  assert.equal(result.ok,false);assert.match(result.error,/output limit/i);assert.ok(Buffer.byteLength(result.stdout+result.stderr)<=128);
});
