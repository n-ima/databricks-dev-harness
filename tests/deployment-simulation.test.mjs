import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, mkdir, symlink, readdir, cp, rename } from "node:fs/promises";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { captureDeploymentCandidate, runDeploymentSimulation, showDeploymentSimulation, simulationIdentity, deploymentCommand } from "../tools/lib/deployment-simulation.mjs";
import { atomicWrite, writeJson, readJson, exists, sha256 } from "../tools/lib/shared.mjs";

const validValidation = ctx => ({ runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, status: "passed", checks: ["build", "typecheck", "lint", "test"] });
for (const change of ["reference", "inactive", "gate"]) {
  test("session " + change + " drift stops before deploy even with identical requirement bytes", async t => {
    const { root, options } = await fixture(t), calls = [];
    const original = await readFile(join(root, "work/sessions/S-1.md"), "utf8");
    await atomicWrite(join(root, "docs/identical.md"), await readFile(join(root, "docs/spec.md")));
    const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, { validate: async ctx => {
      const changed = change === "reference" ? original.replace("docs/spec.md", "docs/identical.md") :
        change === "inactive" ? original.replace("status: active", "status: completed") :
        original.replace("gate_status: not-applicable", "gate_status: pending");
      await atomicWrite(join(root, "work/sessions/S-1.md"), changed);
      return validValidation(ctx);
    } }) });
    assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate"]);
  });
}
test("session progress text can change without changing bound intent", async t => {
  const { root, options } = await fixture(t);
  const run = await runDeploymentSimulation(root, options, { adapter: adapter([], { validate: async ctx => {
    const path = join(root, "work/sessions/S-1.md");
    await atomicWrite(path, (await readFile(path, "utf8")) + "\nProgress updated.\n");
    return validValidation(ctx);
  } }) });
  assert.equal(run.status, "simulated-success");
});
for (const location of ["app/node_modules", "work/simulations", ".harness/runtime"]) {
  test("rejects junction at excluded root or output ancestor: " + location, async t => {
    const { root, options } = await fixture(t), calls = [];
    await mkdir(join(root, "link-destination"));
    await mkdir(join(root, location, ".."), { recursive: true });
    await symlink(join(root, "link-destination"), join(root, location), process.platform === "win32" ? "junction" : "dir");
    if (location.startsWith("app/")) {
      const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls) });
      assert.equal(run.status, "stopped");
    } else await assert.rejects(runDeploymentSimulation(root, options, { adapter: adapter(calls) }), /link/i);
    assert.deepEqual(calls, []);
    assert.deepEqual(await readdir(join(root, "link-destination")), []);
  });
}
test("nested src/build is source, not a generated-root exclusion", async t => {
  const { root, candidate } = await fixture(t);
  await atomicWrite(join(root, "app/src/build/rules.ts"), "source");
  const next = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  assert.notEqual(next.id, candidate.id);
  assert.equal(next.inventory.find(i => i.path === "src/build/rules.ts").role, "source");
});
test("sync work past stage deadline cannot win Promise.race", async t => {
  const { root, options } = await fixture(t), calls = [];
  const run = await runDeploymentSimulation(root, { ...options, stageTimeoutMs: 5 }, { adapter: adapter(calls, { validate: ctx => {
    const end = performance.now() + 30;
    while (performance.now() < end) { /* bounded CPU fixture */ }
    return validValidation(ctx);
  } }) });
  assert.equal(run.reason, "stage-timeout"); assert.deepEqual(calls, ["validate"]);
});
test("overall deadline includes preflight and no late result can restore success", async t => {
  const { root, options } = await fixture(t), calls = [];
  const run = await runDeploymentSimulation(root, { ...options, timeoutMs: 1 }, { adapter: adapter(calls) });
  assert.equal(run.reason, "overall-timeout"); assert.deepEqual(calls, []);
  let release;
  const lateCalls = [], late = await runDeploymentSimulation(root, { ...options, id: "late", stageTimeoutMs: 20 }, { adapter: adapter(lateCalls, {
    validate: ctx => new Promise(resolve => { release = () => resolve(validValidation(ctx)); })
  }) });
  assert.equal(late.reason, "stage-timeout");
  const path = join(root, "work/simulations/deployments/late.json"), before = await readFile(path);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await readFile(path), before); assert.deepEqual(lateCalls, ["validate"]);
});
test("lost result and stop writes leave durable deployment entry uncertain with no downstream calls", async t => {
  const { root, options } = await fixture(t), calls = [];
  const realRename = fs.promises.rename;
  let fail = false;
  fs.promises.rename = async (from, to) => {
    if (fail && resolve(to) === resolve(savedPath(root))) throw new Error("simulated disk unavailable");
    return realRename(from, to);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(runDeploymentSimulation(root, options, { adapter: adapter(calls, { deploy: ctx => {
      fail = true;
      return { runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, status: "accepted", deploymentId: "sim-001" };
    } }) }), /disk unavailable/);
  } finally { fs.promises.rename = realRename; syncBuiltinESMExports(); }
  assert.deepEqual(calls, ["validate", "deploy"]);
  const shown = await showDeploymentSimulation(root, { id: "run-1" });
  assert.equal(shown.status, "in-progress"); assert.equal(shown.stage, "deploy");
  assert.equal(shown.reconciliationRequired, true); assert.equal(shown.health, null);
  await assert.rejects(runDeploymentSimulation(root, options, { adapter: adapter([]) }), /exist/);
});
for (const invalid of ["run", "extra", "future", "old", "calendar", "live-url"]) {
  test("rejects untrusted health result: " + invalid, async t => {
    const { root, options } = await fixture(t);
    const run = await runDeploymentSimulation(root, options, { adapter: adapter([], { health: ctx => {
      const result = { runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, deploymentId: ctx.deploymentId, status: "healthy", url: "https://app.invalid/", observedAt: new Date().toISOString() };
      if (invalid === "run") result.runId = "different-run";
      if (invalid === "extra") result.currentRunning = true;
      if (invalid === "future") result.observedAt = new Date(Date.now() + 120_000).toISOString();
      if (invalid === "old") result.observedAt = new Date(Date.now() - 120_000).toISOString();
      if (invalid === "calendar") result.observedAt = "2026-02-30T00:00:00.000Z";
      if (invalid === "live-url") result.url = "https://example.com/";
      return result;
    } }) });
    assert.equal(run.status, "stopped"); assert.equal(run.health, null);
  });
}
const canonicalRecord = value => Array.isArray(value) ? "[" + value.map(canonicalRecord).join(",") + "]" :
  value && typeof value === "object" ? "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonicalRecord(value[k])).join(",") + "}" : JSON.stringify(value);
test("show rejects altered schema, event order and success fields even after hash recomputation", async t => {
  const { root, options } = await fixture(t);
  await runDeploymentSimulation(root, options, { adapter: adapter([]) });
  const original = await readJson(savedPath(root));
  for (const mutate of [
    r => { r.mode = "live"; }, r => { r.events[0].event = "passed"; },
    r => { r.stage = "validate"; }, r => { r.deploymentId = null; }, r => { r.approvalHash = null; }
  ]) {
    const { integrity, ...record } = structuredClone(original);
    mutate(record);
    await writeJson(savedPath(root), { ...record, integrity: sha256(canonicalRecord(record)) });
    const before = await readFile(savedPath(root));
    await assert.rejects(showDeploymentSimulation(root, { id: "run-1" }), /invalid/);
    assert.deepEqual(await readFile(savedPath(root)), before);
  }
});
test("CLI rejects unknown, duplicate, missing and live options before creating records", async t => {
  const { root } = await fixture(t);
  for (const args of [
    ["--id", "r", "--session", "S-1", "--scenario", "unknown"],
    ["--id", "r", "--session", "S-1", "--scenario"],
    ["--id", "r", "--id", "s", "--session", "S-1", "--scenario", "success"],
    ...["--live", "--adapter", "--mode", "--force", "--resume", "--__proto__"].map(x => ["--id", "r", "--session", "S-1", "--scenario", "success", x, "value"])
  ]) {
    await assert.rejects(deploymentCommand(root, "simulate", args), /unknown|invalid/);
    assert.equal(await exists(join(root, "work/simulations")), false);
    assert.equal(await exists(join(root, ".harness")), false);
  }
  await assert.rejects(deploymentCommand(root, "show", ["--id", "r", "--live", "true"]), /invalid/);
});
test("fixed CLI scenarios cannot promote a synthetic observation into live success", async t => {
  const { root } = await fixture(t);
  await cp(join(root, "app"), join(root, "harness/fixtures/deployment-component"), { recursive: true });
  const expected = { success: ["simulated-success", 5], "validation-failed": ["stopped", 1], "deployment-failed": ["stopped", 2],
    "deployment-pending": ["stopped", 3], "start-failed": ["stopped", 4], "health-failed": ["stopped", 5],
    "deployment-timeout": ["stopped", 2], "scope-mismatch": ["stopped", 0] };
  for (const [scenario, [status, length]] of Object.entries(expected)) {
    const record = await deploymentCommand(root, "simulate", ["--id", scenario, "--session", "S-1", "--scenario", scenario]);
    assert.equal(record.status, status); assert.equal(record.liveDeployment, false); assert.equal(record.simulatedCalls.length, length);
  }
});
test("public CLI uses real dispatcher and safe exit codes on isolated fixtures", async t => {
  const { root } = await fixture(t);
  const repository = fileURLToPath(new URL("../", import.meta.url));
  await cp(join(repository, "tools"), join(root, "tools"), { recursive: true });
  await cp(join(root, "app"), join(root, "harness/fixtures/deployment-component"), { recursive: true });
  const cli = (args) => spawnSync(process.execPath, [join(root, "tools/harness.mjs"), "deployment", ...args], { cwd: root, encoding: "utf8", timeout: 30_000 });
  const success = cli(["simulate", "--id", "public-ok", "--session", "S-1", "--scenario", "success"]);
  assert.equal(success.status, 0, success.stderr); assert.equal(JSON.parse(success.stdout).liveDeployment, false);
  const failure = cli(["simulate", "--id", "public-stop", "--session", "S-1", "--scenario", "validation-failed"]);
  assert.equal(failure.status, 1); assert.deepEqual(JSON.parse(failure.stdout).simulatedCalls, ["validate"]);
  const shown = cli(["show", "--id", "public-ok"]);
  assert.equal(shown.status, 0); assert.equal(JSON.parse(shown.stdout).status, "simulated-success");
  const bad = cli(["simulate", "--id", "bad", "--live"]);
  assert.equal(bad.status, 1); assert.match(bad.stderr, /invalid-deployment-options/);
  assert.equal(await exists(join(root, "work/simulations/deployments/bad.json")), false);
});

async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "harness-deployment-"));
  t.after(async () => {
    assert.ok(root.startsWith(base + sep) && /^harness-deployment-/.test(root.slice(base.length + 1)));
    await rm(root, { recursive: true, force: true });
  });
  await atomicWrite(join(root, "AGENTS.md"), "Fixture policy");
  await atomicWrite(join(root, "tools/agent-hook.mjs"), "// fixture");
  await atomicWrite(join(root, "tools/harness.mjs"), "// fixture dispatcher");
  await atomicWrite(join(root, "harness/schemas/fixture.json"), "{}");
  await writeJson(join(root, "harness.config.json"), { fixture: true });
  await atomicWrite(join(root, "app/src/main.ts"), "export const fixture = true;");
  await atomicWrite(join(root, "app/tests/main.test.ts"), "// validation-only fixture");
  await atomicWrite(join(root, "app/package-lock.json"), "{}");
  await atomicWrite(join(root, "docs/spec.md"), "---\nstatus: draft\n---\n# Simulation\n- AC-01: fixture only\n");
  await atomicWrite(join(root, "work/sessions/S-1.md"), "---\nid: S-1\nstatus: active\nrequirement: docs/spec.md\ngate: none\ngate_status: not-applicable\n---\nProgress is not candidate source.\n");
  const candidate = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  const approval = { schemaVersion: 1, kind: "fixture-approval", mode: "simulation", decision: "approved", actor: "fixture-owner", candidateId: candidate.id, session: "S-1", identity: candidate.identity, issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  await writeJson(join(root, "work/approval.json"), approval);
  // Non-deadline fixtures allow slower parallel disk I/O. Deadline tests override this explicitly.
  return { root, candidate, approval, options: { id: "run-1", candidate, approval: "work/approval.json", timeoutMs: 10000, stageTimeoutMs: 200 } };
}
function adapter(calls, overrides = {}) {
  const defaults = {
    validate: ctx => ({ status: "passed", checks: ["build", "typecheck", "lint", "test"] }),
    deploy: ctx => ({ status: "accepted", deploymentId: "sim-001" }),
    observe: ctx => ({ state: "SUCCEEDED", deploymentId: ctx.deploymentId }),
    start: ctx => ({ state: "RUNNING", deploymentId: ctx.deploymentId }),
    health: ctx => ({ status: "healthy", deploymentId: ctx.deploymentId, url: "https://app.invalid/", observedAt: new Date().toISOString() }),
  };
  return Object.fromEntries(Object.entries(defaults).map(([stage, fn]) => [stage, async ctx => {
    calls.push(stage);
    return overrides[stage] ? overrides[stage](ctx) : { runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, ...fn(ctx) };
  }]));
}
const savedPath = root => join(root, "work/simulations/deployments/run-1.json");

for (const timing of ["capture", "validate"]) {
  test("policy directory junction is rejected " + timing + " even with equal bytes", async t => {
    const { root, options } = await fixture(t), calls = [];
    const replace = async () => {
      await rename(join(root, "harness/schemas"), join(root, "harness/schema-target"));
      await symlink(join(root, "harness/schema-target"), join(root, "harness/schemas"), process.platform === "win32" ? "junction" : "dir");
    };
    if (timing === "capture") {
      await replace();
      await assert.rejects(captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() }), /link|unsafe/);
    } else {
      const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, { validate: async ctx => {
        await replace(); return validValidation(ctx);
      } }) });
      assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate"]);
    }
  });
}
test("policy raw byte changes invalidate candidate even when legacy UTF-8 digest collides", async t => {
  const { root, options, approval } = await fixture(t), calls = [];
  await atomicWrite(join(root, "AGENTS.md"), Buffer.from([0x80]));
  const first = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  await writeJson(join(root, "work/approval.json"), { ...approval, candidateId: first.id });
  const run = await runDeploymentSimulation(root, { ...options, candidate: first }, { adapter: adapter(calls, { validate: async ctx => {
    await atomicWrite(join(root, "AGENTS.md"), Buffer.from([0x81]));
    return validValidation(ctx);
  } }) });
  const second = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  assert.equal(first.policyHash, second.policyHash); assert.notEqual(first.id, second.id);
  assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate"]);
});
test("dispatcher bytes are bound independently of the legacy verifier policy hash", async t => {
  const { root, options, candidate } = await fixture(t), calls = [];
  const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, { validate: async ctx => {
    await atomicWrite(join(root, "tools/harness.mjs"), "// changed dispatcher");
    return validValidation(ctx);
  } }) });
  const second = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  assert.equal(candidate.policyHash, second.policyHash); assert.notEqual(candidate.id, second.id);
  assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate"]);
});
test("synthetic health cannot store a path payload", async t => {
  const { root, options } = await fixture(t), marker = "synthetic-test-canary-do-not-persist";
  const run = await runDeploymentSimulation(root, options, { adapter: adapter([], { health: ctx => ({
    runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, deploymentId: ctx.deploymentId,
    status: "healthy", url: "https://app.invalid/token=" + marker, observedAt: new Date().toISOString()
  }) }) });
  assert.equal(run.status, "stopped"); assert.equal(run.health, null);
  assert.equal((await readFile(savedPath(root), "utf8")).includes(marker), false);
});
test("stopped event cannot jump over unentered stages even with a recomputed hash", async t => {
  const { root, options } = await fixture(t);
  await runDeploymentSimulation(root, options, { adapter: adapter([], { validate: ctx => ({ ...validValidation(ctx), status: "failed" }) }) });
  const { integrity, ...record } = await readJson(savedPath(root));
  record.stage = "health"; record.events.at(-1).stage = "health";
  await writeJson(savedPath(root), { ...record, integrity: sha256(canonicalRecord(record)) });
  await assert.rejects(showDeploymentSimulation(root, { id: "run-1" }), /invalid/);
});

test("candidate binds input roles and ignores only declared generated/dependency roots", async t => {
  const { root, candidate } = await fixture(t);
  assert.equal(candidate.inventory.find(f => f.path === "tests/main.test.ts").role, "validation");
  assert.equal(candidate.inventory.find(f => f.path === "src/main.ts").role, "source");
  await atomicWrite(join(root, "app/dist/bundle.js"), "generated");
  await atomicWrite(join(root, "work/progress.md"), "outside component");
  const second = await captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() });
  assert.equal(second.id, candidate.id);
});
test("successful flow records simulation identity, ordered operations and freshness without claiming live", async t => {
  const { root, options } = await fixture(t), calls = [];
  const record = await runDeploymentSimulation(root, options, { adapter: adapter(calls) });
  assert.deepEqual(calls, ["validate", "deploy", "observe", "start", "health"]);
  assert.equal(record.status, "simulated-success");
  assert.equal(record.liveDeployment, false);
  assert.deepEqual((await readJson(savedPath(root))).simulatedCalls, calls);
  const shown = await showDeploymentSimulation(root, { id: "run-1" });
  assert.equal(shown.mode, "simulation"); assert.equal(shown.liveDeployment, false);
  assert.equal(shown.healthFreshness, "simulation-fresh");
  const stale = await showDeploymentSimulation(root, { id: "run-1" }, { now: () => Date.now() + 120_000 });
  assert.equal(stale.healthFreshness, "simulation-stale");
});
for (const [stage, outcome] of [
  ["validate", { status: "failed" }], ["validate", { status: "passed", checks: ["build", "typecheck", "lint"] }],
  ["deploy", { status: "failed" }], ["observe", { state: "PENDING", deploymentId: "sim-001" }],
  ["observe", { state: "FAILED", deploymentId: "sim-001" }], ["start", { state: "STOPPED", deploymentId: "sim-001" }],
  ["health", { status: "unhealthy", deploymentId: "sim-001" }],
]) {
  test("failure or incomplete terminal at " + stage + " stops all downstream calls " + JSON.stringify(outcome), async t => {
    const { root, options } = await fixture(t), calls = [];
    const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, { [stage]: ctx => ({ runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, ...outcome }) }) });
    assert.equal(run.status, "stopped");
    assert.deepEqual(calls, ["validate", "deploy", "observe", "start", "health"].slice(0, ["validate", "deploy", "observe", "start", "health"].indexOf(stage) + 1));
    assert.equal(run.health, null);
    assert.equal((await readJson(savedPath(root))).status, "stopped");
  });
}
for (const stage of ["validate", "deploy", "observe", "start", "health"]) {
  test(stage + " throw or timeout cannot start a later operation", async t => {
    for (const mode of ["throw", "timeout"]) {
      const { root, options } = await fixture(t), calls = [];
      const run = await runDeploymentSimulation(root, { ...options, stageTimeoutMs: 20 }, { adapter: adapter(calls, {
        [stage]: () => mode === "timeout" ? new Promise(() => {}) : Promise.reject(new Error("token=never-persist-this"))
      }) });
      assert.equal(run.status, "stopped"); assert.equal(calls.at(-1), stage);
      assert.equal(run.reason, mode === "timeout" ? "stage-timeout" : "adapter-error");
      assert.equal((await readFile(savedPath(root), "utf8")).includes("never-persist"), false);
    }
  });
}
test("already aborted invocation calls no adapter", async t => {
  const { root, options } = await fixture(t), calls = [], controller = new AbortController();
  controller.abort();
  const run = await runDeploymentSimulation(root, { ...options, signal: controller.signal }, { adapter: adapter(calls) });
  assert.equal(run.status, "stopped"); assert.equal(run.reason, "aborted"); assert.deepEqual(calls, []);
});
test("abort during deployment prevents observation and marks reconciliation required", async t => {
  const { root, options } = await fixture(t), calls = [], controller = new AbortController();
  const run = await runDeploymentSimulation(root, { ...options, signal: controller.signal }, { adapter: adapter(calls, {
    deploy: () => { controller.abort(); return new Promise(() => {}); }
  }) });
  assert.equal(run.reason, "aborted"); assert.deepEqual(calls, ["validate", "deploy"]);
  assert.equal(run.reconciliationRequired, true);
});
for (const mutation of ["modify", "add", "remove", "validation", "requirement", "policy", "approval"]) {
  test("post-validation " + mutation + " drift blocks deployment", async t => {
    const { root, options, approval } = await fixture(t), calls = [];
    const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, {
      validate: async ctx => {
        if (mutation === "modify") await atomicWrite(join(root, "app/src/main.ts"), "changed");
        if (mutation === "add") await atomicWrite(join(root, "app/src/new.ts"), "new");
        if (mutation === "remove") await rm(join(root, "app/src/main.ts"));
        if (mutation === "validation") await atomicWrite(join(root, "app/tests/main.test.ts"), "changed");
        if (mutation === "requirement") await atomicWrite(join(root, "docs/spec.md"), "# changed\n- AC-02: changed");
        if (mutation === "policy") await atomicWrite(join(root, "AGENTS.md"), "changed");
        if (mutation === "approval") await writeJson(join(root, "work/approval.json"), { ...approval, decision: "revoked" });
        return { runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, status: "passed", checks: ["build", "typecheck", "lint", "test"] };
      }
    }) });
    assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate"]);
  });
}
for (const field of ["candidateId", "session", "identity", "decision", "expiresAt", "kind"]) {
  test("unapproved or mismatching scope " + field + " calls no adapter", async t => {
    const { root, options, approval } = await fixture(t), calls = [];
    const invalid = { ...approval, [field]: field === "expiresAt" ? new Date(Date.now() - 1000).toISOString() : field === "identity" ? { ...approval.identity, resource: "another-app" } : "mismatch" };
    await writeJson(join(root, "work/approval.json"), invalid);
    const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls) });
    assert.equal(run.status, "stopped"); assert.deepEqual(calls, []);
  });
}
test("mismatched deployment identity is never accepted as terminal success", async t => {
  const { root, options } = await fixture(t), calls = [];
  const run = await runDeploymentSimulation(root, options, { adapter: adapter(calls, { observe: ctx => ({ runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, state: "SUCCEEDED", deploymentId: "sim-another" }) }) });
  assert.equal(run.status, "stopped"); assert.deepEqual(calls, ["validate", "deploy", "observe"]);
});
test("malformed candidate is rejected before any record or callback", async t => {
  const { root, options, candidate } = await fixture(t), calls = [];
  await assert.rejects(runDeploymentSimulation(root, { ...options, candidate: { ...candidate, id: "0".repeat(64) } }, { adapter: adapter(calls) }), /candidate/i);
  assert.deepEqual(calls, []); assert.equal(await exists(savedPath(root)), false);
});
test("record IDs cannot overwrite results or escape the simulation directory", async t => {
  const { root, options } = await fixture(t), calls = [];
  await runDeploymentSimulation(root, options, { adapter: adapter(calls) });
  const bytes = await readFile(savedPath(root));
  await assert.rejects(runDeploymentSimulation(root, options, { adapter: adapter(calls) }), /exist|replay/i);
  assert.deepEqual(await readFile(savedPath(root)), bytes);
  await assert.rejects(runDeploymentSimulation(root, { ...options, id: "../outside" }, { adapter: adapter(calls) }), /id/i);
});
test("concurrent candidate/target invocation is rejected without duplicate deployment", async t => {
  const { root, options } = await fixture(t), calls = [];
  let release, entered;
  const entry = new Promise(r => { entered = r; }), pause = new Promise(r => { release = r; });
  const first = runDeploymentSimulation(root, options, { adapter: adapter(calls, { validate: async ctx => {
    entered(); await pause;
    return { runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity, status: "passed", checks: ["build", "typecheck", "lint", "test"] };
  } }) });
  await entry;
  try { await assert.rejects(runDeploymentSimulation(root, { ...options, id: "run-2" }, { adapter: adapter([]) }), /locked/i); }
  finally { release(); await first; }
  assert.equal(calls.filter(s => s === "deploy").length, 1);
});
test("candidate rejects secret settings and unsafe component roots", async t => {
  const { root } = await fixture(t);
  for (const component of [".", "..", "/tmp", "app/../app"]) {
    await assert.rejects(captureDeploymentCandidate(root, { component, requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() }), /path|component/i);
  }
  await atomicWrite(join(root, "app/.env"), "TOKEN=fixture");
  await assert.rejects(captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() }), /secret/i);
});
test("candidate rejects junctions including those pointing inside the repository", async t => {
  const { root } = await fixture(t);
  await mkdir(join(root, "linked-target"));
  await symlink(join(root, "linked-target"), join(root, "app/alias"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(captureDeploymentCandidate(root, { component: "app", requirement: "docs/spec.md", session: "S-1", identity: simulationIdentity() }), /link/i);
});
