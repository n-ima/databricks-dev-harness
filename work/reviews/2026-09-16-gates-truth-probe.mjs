// Audit-only reproducer. All writes are inside a new temporary directory.
// Providers/Git/checks are injected stubs. No network, credentials, or real DB.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const repository=resolve(new URL('../..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const results=[];
const savedLog=console.log;
console.log=()=>{};
for(const [label,source] of [['local',repository],['published-0.6.1',join(repository,'.harness/releases/0.6.1/files')]]){
  const {initLoop,setLoopGate,runLoopIteration}=await import(pathToFileURL(join(source,'tools/lib/loop.mjs')));
  const {closeSession}=await import(pathToFileURL(join(source,'tools/lib/memory.mjs')));
  const {sealEvidence}=await import(pathToFileURL(join(source,'tools/lib/evidence.mjs')));
  const {parseFrontmatter}=await import(pathToFileURL(join(source,'tools/lib/shared.mjs')));
  for(const scenario of ['pending-loop-close','closed-session-run']){
    const root=await mkdtemp(join(tmpdir(),'harness-gates-truth-'));
    const put=async(p,v)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),typeof v==='string'?v:JSON.stringify(v));};
    const config={loop:{maxIterations:3,maxWallMinutes:10,maxProcessMinutes:1,checks:[['synthetic-check']]}};
    await put('AGENTS.md','# Synthetic audit policy\n');
    await put('harness.config.json',config);
    await put('tools/agent-hook.mjs','// Synthetic fixture hook\n');
    await put('work/sessions/session-a.md','---\nid: session-a\nstatus: active\nprovider: claude\ngate: product-intent\ngate_status: approved\nrequirement: docs/product/requirements/fixture.md\n---\n# Synthetic audit session\n');
    await put('docs/product/requirements/fixture.md','---\nstatus: accepted\n---\n# Synthetic accepted requirement\n\n- AC-01: Synthetic fixture assertion.\n');
    await put('work/evidence/fixture.md','Synthetic fixture observation, not real execution.\n');
    const success={ok:true,status:0,stdout:'synthetic',stderr:''};
    const gitRun=(cmd,args)=>{assert.equal(cmd,'git');const k=args.join(' ');return {...success,stdout:k==='branch --show-current'?'audit-isolated':k==='rev-parse --verify HEAD'?'a'.repeat(40):k==='status --porcelain'?'':'true'};};
    const loop=await initLoop(root,{session:'session-a',provider:'claude',verifier_provider:'copilot'},{run:gitRun});
    if(scenario==='pending-loop-close'){
      await setLoopGate(root,{id:loop.id,gate:'sensitive-data-or-permission-change'});
      await put('work/reviews/fixture.json',{reviewer:'synthetic-independent-reviewer',provider:'copilot',independent:true,acceptance:[{id:'AC-01',status:'pass',evidence:['work/evidence/fixture.md']}]});
      await sealEvidence(root,{review:'work/reviews/fixture.json',session:'session-a',requirement:'docs/product/requirements/fixture.md'});
      await closeSession(root,{id:'session-a',outcome:'completed',summary:'Synthetic closure probe',verifier_evidence:'work/reviews/session-a.receipt.json'});
      const session=parseFrontmatter(await readFile(join(root,'work/sessions/session-a.md'),'utf8'));
      const currentLoop=JSON.parse(await readFile(join(root,'work/loops',loop.id+'.json'),'utf8'));
      assert.equal(session.status,'completed');assert.equal(currentLoop.gate.status,'pending');
      results.push({label,scenario,root,sessionStatus:session.status,loopGate:currentLoop.gate});
    } else {
      await closeSession(root,{id:'session-a',outcome:'blocked',summary:'Synthetic operator blocked session'});
      const calls=[];
      await runLoopIteration(root,{id:loop.id,execute:true},{run:(cmd,args)=>{assert.ok(['claude','synthetic-check'].includes(cmd));calls.push(cmd);return success;}});
      const session=parseFrontmatter(await readFile(join(root,'work/sessions/session-a.md'),'utf8'));
      assert.equal(session.status,'blocked');assert.deepEqual(calls,['claude','synthetic-check']);
      results.push({label,scenario,root,sessionStatus:session.status,stubCalls:calls});
    }
  }
}
console.log=savedLog;
console.log(JSON.stringify({syntheticOnly:true,realProviderExecuted:false,results},null,2));
