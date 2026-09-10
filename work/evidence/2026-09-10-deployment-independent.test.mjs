import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { captureDeploymentCandidate, runDeploymentSimulation, showDeploymentSimulation, simulationIdentity, deploymentCommand } from "../../tools/lib/deployment-simulation.mjs";
import { sha256 } from "../../tools/lib/shared.mjs";

const evidence = dirname(fileURLToPath(import.meta.url));
const stages = ["validate", "deploy", "observe", "start", "health"];
const canon = v => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
const stamp = n => new Date(n).toISOString();
const validation = c => ({ runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,status:"passed",checks:["build","typecheck","lint","test"] });
async function put(root, path, value) { await mkdir(dirname(join(root,path)), {recursive:true}); await writeFile(join(root,path),value); }
async function json(root,path,value) { await put(root,path,JSON.stringify(value)); }
async function fixture(t) {
  const root = await mkdtemp(join(evidence,"deployment-review-fixture-"));
  t.after(async()=>{ assert.ok(resolve(root).startsWith(resolve(evidence)+sep) && /deployment-review-fixture-[^\\/]+$/.test(root)); await rm(root,{recursive:true,force:true}); });
  await put(root,"AGENTS.md","Synthetic review policy");
  await put(root,"harness.config.json","{}");
  await put(root,"tools/agent-hook.mjs","// synthetic");
  await put(root,"tools/harness.mjs","// synthetic dispatcher");
  await put(root,"harness/schemas/example.json","{}");
  await put(root,"app/src/main.ts","export const fixture = true;");
  await put(root,"app/tests/main.test.ts","// synthetic check input");
  await put(root,"docs/spec.md","# Fixture\n- AC-01: fixture only\n");
  await put(root,"work/sessions/S1.md","---\nid: S1\nstatus: active\nrequirement: docs/spec.md\ngate: none\ngate_status: not-applicable\n---\n");
  const input={component:"app",requirement:"docs/spec.md",session:"S1",identity:simulationIdentity()};
  async function capture(){ return captureDeploymentCandidate(root,input); }
  async function options(id="r1") {
    const candidate=await capture();
    await json(root,"work/approval.json",{schemaVersion:1,kind:"fixture-approval",mode:"simulation",decision:"approved",actor:"fixture",candidateId:candidate.id,session:"S1",identity:candidate.identity,issuedAt:stamp(Date.now()-1000),expiresAt:stamp(Date.now()+120000)});
    return {id,candidate,approval:"work/approval.json",timeoutMs:10000,stageTimeoutMs:1000};
  }
  return {root,input,capture,options,record:join(root,"work/simulations/deployments/r1.json")};
}
function adapter(calls,overrides={}) {
  const fn={validate:validation,deploy:c=>({status:"accepted",deploymentId:"sim-r1"}),observe:c=>({state:"SUCCEEDED",deploymentId:c.deploymentId}),start:c=>({state:"RUNNING",deploymentId:c.deploymentId}),health:c=>({status:"healthy",deploymentId:c.deploymentId,url:"https://review.invalid/",observedAt:stamp(Date.now())})};
  return Object.fromEntries(stages.map(stage=>[stage,async c=>{calls.push(stage);return overrides[stage]?await overrides[stage](c):{runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,...fn[stage](c)};} ]));
}

test("IR-policy-directory-link: policy input junction is rejected at capture",async t=>{
  const f=await fixture(t);
  await rename(join(f.root,"harness/schemas"),join(f.root,"harness/schema-target"));
  await symlink(join(f.root,"harness/schema-target"),join(f.root,"harness/schemas"),process.platform==="win32"?"junction":"dir");
  await assert.rejects(f.capture(),/link|unsafe/);
});
test("IR-policy-link-replacement: replacing policy directory with equal-byte junction blocks deploy",async t=>{
  const f=await fixture(t), opts=await f.options(),calls=[];
  const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{validate:async c=>{
    await rename(join(f.root,"harness/schemas"),join(f.root,"harness/schema-target"));
    await symlink(join(f.root,"harness/schema-target"),join(f.root,"harness/schemas"),process.platform==="win32"?"junction":"dir");
    return validation(c);
  }})});
  assert.deepEqual(calls,["validate"],JSON.stringify({status:run.status,calls}));
});
test("IR-policy-bytes: invalid UTF-8 policy byte change invalidates candidate",async t=>{
  const f=await fixture(t); await put(f.root,"AGENTS.md",Buffer.from([0x80]));
  const opts=await f.options(),calls=[];
  const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{validate:async c=>{await put(f.root,"AGENTS.md",Buffer.from([0x81]));return validation(c);}})});
  assert.deepEqual(calls,["validate"],JSON.stringify({status:run.status,calls}));
});
test("IR-health-secret: untrusted synthetic URL must not persist a secret-shaped payload",async t=>{
  const f=await fixture(t), opts=await f.options(),calls=[];
  const marker="synthetic-review-canary-do-not-persist";
  const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{health:c=>({runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,status:"healthy",deploymentId:c.deploymentId,url:"https://review.invalid/token="+marker,observedAt:stamp(Date.now())})})});
  assert.equal((await readFile(f.record,"utf8")).includes(marker),false,JSON.stringify({status:run.status,markerPersisted:true}));
});
test("IR-event-stage: stopped event cannot jump from validate to health",async t=>{
  const f=await fixture(t),opts=await f.options();
  await runDeploymentSimulation(f.root,opts,{adapter:adapter([],{validate:c=>({...validation(c),status:"failed"})})});
  const {integrity,...r}=JSON.parse(await readFile(f.record,"utf8"));
  r.events.at(-1).stage="health";r.stage="health";
  await json(f.root,"work/simulations/deployments/r1.json",{...r,integrity:sha256(canon(r))});
  await assert.rejects(showDeploymentSimulation(f.root,{id:"r1"}),/invalid/);
});

test("PASS: success and show preserve read-only synthetic result",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[];
  const r=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)}); const before=await readFile(f.record);
  const shown=await showDeploymentSimulation(f.root,{id:"r1"});
  assert.equal(r.status,"simulated-success"); assert.deepEqual(calls,stages);assert.equal(shown.liveDeployment,false);assert.deepEqual(await readFile(f.record),before);
});
for(const stage of ["deploy","observe","start","health"]){
  test("PASS: stale run correlation at "+stage+" stops downstream",async t=>{
    const f=await fixture(t),opts=await f.options(),calls=[];
    const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{[stage]:c=>({runId:"prior-run",candidateId:c.candidate.id,identity:c.candidate.identity,...(stage==="deploy"?{status:"accepted",deploymentId:"sim-prior"}:stage==="health"?{status:"healthy",deploymentId:c.deploymentId,url:"https://review.invalid/",observedAt:stamp(Date.now())}:{state:stage==="observe"?"SUCCEEDED":"RUNNING",deploymentId:c.deploymentId})})})});
    assert.equal(run.status,"stopped");assert.equal(calls.at(-1),stage);assert.equal(run.health,null);
  });
}
test("PASS: loss of start-result and stop writes leaves durable uncertain entry",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[]; const original=fs.promises.rename;let fail=false;
  fs.promises.rename=async(a,b)=>{if(fail && resolve(b)===resolve(f.record))throw new Error("fixture-save-failure");return original(a,b);};syncBuiltinESMExports();
  try {await assert.rejects(runDeploymentSimulation(f.root,opts,{adapter:adapter(calls,{start:c=>{fail=true;return {runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,state:"RUNNING",deploymentId:c.deploymentId};}})}),/fixture-save-failure/);}
  finally{fs.promises.rename=original;syncBuiltinESMExports();}
  const shown=await showDeploymentSimulation(f.root,{id:"r1"});assert.deepEqual(calls,["validate","deploy","observe","start"]);assert.equal(shown.reconciliationRequired,true);assert.equal(shown.health,null);assert.equal(shown.stage,"start");
});
test("PASS: failure while writing deploy-entry cannot call deploy",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[]; const original=fs.promises.rename;let failOnce=true;
  fs.promises.rename=async(a,b)=>{if(failOnce && resolve(b)===resolve(f.record)){const r=JSON.parse(await readFile(a,"utf8"));if(r.stage==="deploy"){failOnce=false;throw new Error("fixture-entry-failure");}}return original(a,b);};syncBuiltinESMExports();
  try {const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)});assert.equal(run.status,"stopped");assert.deepEqual(calls,["validate"]);}
  finally{fs.promises.rename=original;syncBuiltinESMExports();}
});
test("PASS: candidate mutation during durable entry save is caught before adapter",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[]; const original=fs.promises.rename;let changed=false;
  fs.promises.rename=async(a,b)=>{const value=await original(a,b);if(!changed&&resolve(b)===resolve(f.record)){const r=JSON.parse(await readFile(b,"utf8"));if(r.stage==="deploy"){changed=true;await put(f.root,"app/new.ts","added during save");}}return value;};syncBuiltinESMExports();
  try{const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls)});assert.equal(run.status,"stopped");assert.deepEqual(calls,["validate"]);}
  finally{fs.promises.rename=original;syncBuiltinESMExports();}
});
test("PASS: timeout at deploy and late resolution cannot mutate record",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[];let release;
  const run=await runDeploymentSimulation(f.root,{...opts,stageTimeoutMs:10},{adapter:adapter(calls,{deploy:c=>new Promise(r=>{release=()=>r({runId:c.runId,candidateId:c.candidate.id,identity:c.candidate.identity,status:"accepted",deploymentId:"sim-late"});})})});
  assert.equal(run.reason,"stage-timeout");const before=await readFile(f.record);release();await new Promise(r=>setImmediate(r));assert.deepEqual(await readFile(f.record),before);assert.deepEqual(calls,["validate","deploy"]);
});
test("PASS: expiry equality invalidates fixture approval before any call",async t=>{
  const f=await fixture(t),opts=await f.options(),calls=[],approval=JSON.parse(await readFile(join(f.root,"work/approval.json"),"utf8"));
  const now=Date.now();approval.issuedAt=stamp(now-1000);approval.expiresAt=stamp(now);await json(f.root,"work/approval.json",approval);
  const run=await runDeploymentSimulation(f.root,opts,{adapter:adapter(calls),now:()=>now});assert.equal(run.reason,"approval-expired-or-invalid");assert.deepEqual(calls,[]);
});
test("PASS: CLI malformed scalar and unsupported assignment syntax create nothing",async t=>{
  const f=await fixture(t);
  for(const args of [["--id=r1","--session","S1","--scenario","success"],["--id","r1","--session","S1","--scenario","success","trailing"],["--id","r1","--session","S1","--scenario","success","--target","simulation"]])await assert.rejects(deploymentCommand(f.root,"simulate",args),/invalid/);
  assert.equal((await readdir(join(f.root,"work"))).includes("simulations"),false);
});
test("NOTE: existing policyHash does not bind the CLI dispatcher",async t=>{
  const f=await fixture(t),a=await f.capture();await put(f.root,"tools/harness.mjs","// changed dispatcher");const b=await f.capture();assert.equal(a.policyHash,b.policyHash);assert.equal(a.id,b.id);
});
