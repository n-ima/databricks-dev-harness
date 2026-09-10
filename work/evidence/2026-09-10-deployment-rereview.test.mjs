import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { captureDeploymentCandidate, runDeploymentSimulation, showDeploymentSimulation, simulationIdentity } from "../../tools/lib/deployment-simulation.mjs";
import { sha256 } from "../../tools/lib/shared.mjs";

const evidence=dirname(fileURLToPath(import.meta.url));
const stamp=n=>new Date(n).toISOString();
const canon=v=>Array.isArray(v)?"["+v.map(canon).join(",")+"]":v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}":JSON.stringify(v);
async function put(root,path,value){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),value);}
async function fixture(t){
  const root=await mkdtemp(join(evidence,"deployment-rereview-fixture-"));
  t.after(async()=>{assert.ok(resolve(root).startsWith(resolve(evidence)+sep)&&/deployment-rereview-fixture-[^\\/]+$/.test(root));await rm(root,{recursive:true,force:true});});
  for(const [p,v] of Object.entries({"AGENTS.md":"Synthetic policy","harness.config.json":"{}","tools/agent-hook.mjs":"// fixture","tools/harness.mjs":"// dispatcher","harness/schemas/example.json":"{}","app/main.ts":"// fixture","docs/spec.md":"# Fixture\n- AC-01: fixture only\n","work/sessions/S1.md":"---\nid: S1\nstatus: active\nrequirement: docs/spec.md\ngate: none\ngate_status: not-applicable\n---\n"}))await put(root,p,v);
  const input={component:"app",requirement:"docs/spec.md",session:"S1",identity:simulationIdentity()};
  const capture=()=>captureDeploymentCandidate(root,input);
  async function options(){const candidate=await capture();await put(root,"work/approval.json",JSON.stringify({schemaVersion:1,kind:"fixture-approval",mode:"simulation",decision:"approved",actor:"fixture",candidateId:candidate.id,session:"S1",identity:candidate.identity,issuedAt:stamp(Date.now()-1000),expiresAt:stamp(Date.now()+120000)}));return{id:"r1",candidate,approval:"work/approval.json",timeoutMs:10000,stageTimeoutMs:1000};}
  return{root,capture,options,record:join(root,"work/simulations/deployments/r1.json")};
}
const validation=c=>({runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,status:"passed",checks:["build","typecheck","lint","test"]});
function adapter(calls,overrides={}){
  const fn={validate:validation,deploy:c=>({status:"accepted",deploymentId:"sim-r1"}),observe:c=>({state:"SUCCEEDED",deploymentId:c.deploymentId}),start:c=>({state:"RUNNING",deploymentId:c.deploymentId}),health:c=>({status:"healthy",deploymentId:c.deploymentId,url:"https://review.invalid/",observedAt:stamp(Date.now())})};
  return Object.fromEntries(Object.keys(fn).map(stage=>[stage,async c=>{calls.push(stage);return overrides[stage]?await overrides[stage](c):{runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,...fn[stage](c)};}]));
}
test("dispatcher change now invalidates candidate while legacy policyHash remains stable",async t=>{
  const f=await fixture(t),a=await f.capture();await put(f.root,"tools/harness.mjs","// new dispatcher");const b=await f.capture();
  assert.equal(a.policyHash,b.policyHash);assert.notEqual(a.id,b.id);assert.notDeepEqual(a.policyInputs,b.policyInputs);assert.ok(b.policyInputs.find(x=>x.path==="tools/harness.mjs"));
});
test("dispatcher change during validation stops before deploy",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[];const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{validate:async c=>{await put(f.root,"tools/harness.mjs","// new dispatcher");return validation(c);}})});
  assert.equal(r.reason,"candidate-changed");assert.deepEqual(calls,["validate"]);
});
test("optional dispatcher deletion is part of policy inventory drift",async t=>{
  const f=await fixture(t),a=await f.capture();await rm(join(f.root,"tools/harness.mjs"));const b=await f.capture();assert.notEqual(a.id,b.id);assert.equal(a.policyHash,b.policyHash);
});
test("policy directory ancestor junction is rejected",async t=>{
  const f=await fixture(t);await rename(join(f.root,"harness"),join(f.root,"harness-target"));await symlink(join(f.root,"harness-target"),join(f.root,"harness"),process.platform==="win32"?"junction":"dir");await assert.rejects(f.capture(),/link|unsafe/);
});
test("policy entry junction is rejected even with a nonpolicy extension",async t=>{
  const f=await fixture(t);await mkdir(join(f.root,"empty-target"));await symlink(join(f.root,"empty-target"),join(f.root,"harness/schemas/ignored.txt"),process.platform==="win32"?"junction":"dir");await assert.rejects(f.capture(),/link|unsafe/);
});
test("directory posing as policy JSON is rejected as nonfile",async t=>{
  const f=await fixture(t);await mkdir(join(f.root,"harness/schemas/not-a-file.json"));await assert.rejects(f.capture(),/type|file/);
});
test("single policy file larger than 8 MiB is rejected before candidate",async t=>{
  const f=await fixture(t);await put(f.root,"AGENTS.md",Buffer.alloc(8*1024*1024+1,0x41));await assert.rejects(f.capture(),/size|byte|limit/);
});
test("aggregate policy bytes larger than 8 MiB are rejected",async t=>{
  const f=await fixture(t);await put(f.root,"harness/schemas/large-a.json",Buffer.alloc(4*1024*1024,0x41));await put(f.root,"harness/schemas/large-b.json",Buffer.alloc(4*1024*1024,0x42));await assert.rejects(f.capture(),/byte|limit/);
});
test("malformed duplicate policy inventory is rejected on read even after hashes recomputed",async t=>{
  const f=await fixture(t);await runDeploymentSimulation(f.root,await f.options(),{adapter:adapter([])});const{integrity,...r}=JSON.parse(await readFile(f.record,"utf8"));
  const{id,...candidate}=r.candidate;candidate.policyInputs.push(candidate.policyInputs.at(-1));r.candidate={...candidate,id:sha256(canon(candidate))};
  await put(f.root,"work/simulations/deployments/r1.json",JSON.stringify({...r,integrity:sha256(canon(r))}));await assert.rejects(showDeploymentSimulation(f.root,{id:"r1"}),/policy|candidate/);
});
test("existing record with path payload URL is rejected on show",async t=>{
  const f=await fixture(t);await runDeploymentSimulation(f.root,await f.options(),{adapter:adapter([])});const{integrity,...r}=JSON.parse(await readFile(f.record,"utf8"));r.health.url="https://review.invalid/token=synthetic-rereview-marker";
  await put(f.root,"work/simulations/deployments/r1.json",JSON.stringify({...r,integrity:sha256(canon(r))}));const before=await readFile(f.record);await assert.rejects(showDeploymentSimulation(f.root,{id:"r1"}),/url|secret/);assert.deepEqual(await readFile(f.record),before);
});
test("noncanonical synthetic origin URL is rejected before recording health",async t=>{
  const f=await fixture(t),opts=await f.options();const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter([],{health:c=>({runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,status:"healthy",deploymentId:c.deploymentId,url:"https://REVIEW.invalid/",observedAt:stamp(Date.now())})})});assert.equal(r.reason,"invalid-simulation-url");assert.equal(r.health,null);
});
test("legal stop at initial validation preflight remains readable",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[];await put(f.root,"app/main.ts","// changed before start");const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)}),shown=await showDeploymentSimulation(f.root,{id:"r1"});assert.equal(r.status,"stopped");assert.deepEqual(calls,[]);assert.equal(shown.stage,"validate");assert.equal(shown.reconciliationRequired,false);
});
test("legal stop at next-stage preflight after passed result remains readable",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[];const original=fs.promises.rename;let changed=false;
  fs.promises.rename=async(a,b)=>{const result=await original(a,b);if(!changed&&resolve(b)===resolve(f.record)){const r=JSON.parse(await readFile(b,"utf8"));if(r.events.at(-1)?.event==="passed"&&r.stage==="validate"){changed=true;await put(f.root,"app/new.ts","// new source");}}return result;};syncBuiltinESMExports();
  try{const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)}),shown=await showDeploymentSimulation(f.root,{id:"r1"});assert.equal(r.status,"stopped");assert.deepEqual(calls,["validate"]);assert.equal(shown.stage,"deploy");assert.equal(shown.reconciliationRequired,false);}
  finally{fs.promises.rename=original;syncBuiltinESMExports();}
});
for(const stage of ["validate","health"]){
  test("legal stop after "+stage+" passed-result save failure remains readable",async t=>{
    const f=await fixture(t),opts=await f.options(),calls=[];const original=fs.promises.rename;let failed=false;
    fs.promises.rename=async(a,b)=>{if(!failed&&resolve(b)===resolve(f.record)){const r=JSON.parse(await readFile(a,"utf8"));if(r.events.at(-1)?.event==="passed"&&r.stage===stage){failed=true;throw new Error("synthetic-one-shot-save-failure");}}return original(a,b);};syncBuiltinESMExports();
    try{const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)}),shown=await showDeploymentSimulation(f.root,{id:"r1"});assert.equal(r.status,"stopped");assert.equal(calls.at(-1),stage);assert.equal(shown.stage,stage);assert.equal(shown.health,null);assert.equal(shown.reconciliationRequired,stage!=="validate");}
    finally{fs.promises.rename=original;syncBuiltinESMExports();}
  });
}
test("strict stopped stages still reject a jump on preflight failure",async t=>{
  const f=await fixture(t),opts=await f.options();await put(f.root,"app/main.ts","// changed");await runDeploymentSimulation(f.root,opts,{adapter:adapter([])});const{integrity,...r}=JSON.parse(await readFile(f.record,"utf8"));r.events.at(-1).stage="start";r.stage="start";
  await put(f.root,"work/simulations/deployments/r1.json",JSON.stringify({...r,integrity:sha256(canon(r))}));await assert.rejects(showDeploymentSimulation(f.root,{id:"r1"}),/events/);
});
