import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { acceptanceIds } from "./acceptance.mjs";
import { policyHash } from "./policy.mjs";
import { pathInside, sha256, withFileLock, writeJson, exists, assertNoSecrets, parseFrontmatter } from "./shared.mjs";

const STAGES = ["validate", "deploy", "observe", "start", "health"];

const SCENARIOS = ["success", "validation-failed", "deployment-failed", "deployment-pending", "start-failed", "health-failed", "deployment-timeout", "scope-mismatch"];
// Fixed fixtures only: these results do not execute builds, CLI processes, or HTTP.
export async function runFixtureScenario(root, options) {
  keys(options, ["id", "session", "scenario"], "invalid-scenario-options");
  identifier(options.id); identifier(options.session, "invalid-session");
  if (!SCENARIOS.includes(options.scenario)) stop("unknown-scenario");
  const sessionPath = "work/sessions/" + options.session + ".md";
  const fields = parseFrontmatter((await bytes(root, sessionPath, 256 * 1024)).toString("utf8"));
  const candidate = await captureDeploymentCandidate(root, {
    component: "harness/fixtures/deployment-component", requirement: fields.requirement,
    session: options.session, identity: simulationIdentity()
  });
  const approval = "work/simulations/deployment-inputs/" + options.id + ".approval.json";
  const lock = await safePath(root, ".harness/runtime/deployment-cli/" + options.id);
  return withFileLock(lock, async () => {
    const approvalPath = await safePath(root, approval);
    if (await exists(approvalPath) || await exists(await safePath(root, recordPath(options.id)))) stop("simulation-run-already-exists");
    const issued = Date.now();
    await writeJson(approvalPath, {
      schemaVersion: 1, kind: "fixture-approval", mode: "simulation", decision: "approved", actor: "fixture-generator",
      candidateId: candidate.id, session: candidate.session,
      identity: options.scenario === "scope-mismatch" ? { ...candidate.identity, resource: "different-simulation" } : candidate.identity,
      issuedAt: new Date(issued).toISOString(), expiresAt: new Date(issued + 300_000).toISOString()
    });
    const scenario = options.scenario;
    const binding = ctx => ({ runId: ctx.runId, candidateId: ctx.candidate.id, identity: ctx.candidate.identity });
    const adapter = {
      validate: ctx => ({ ...binding(ctx), status: scenario === "validation-failed" ? "failed" : "passed", checks: CHECKS }),
      deploy: ctx => scenario === "deployment-timeout" ? new Promise(() => {}) :
        ({ ...binding(ctx), status: scenario === "deployment-failed" ? "failed" : "accepted", deploymentId: "sim-" + sha256(ctx.runId).slice(0, 24) }),
      observe: ctx => ({ ...binding(ctx), state: scenario === "deployment-pending" ? "PENDING" : "SUCCEEDED", deploymentId: ctx.deploymentId }),
      start: ctx => ({ ...binding(ctx), state: scenario === "start-failed" ? "STOPPED" : "RUNNING", deploymentId: ctx.deploymentId }),
      health: ctx => ({ ...binding(ctx), status: scenario === "health-failed" ? "unhealthy" : "healthy", deploymentId: ctx.deploymentId, url: "https://fixture-app.invalid/", observedAt: new Date().toISOString() })
    };
    await runDeploymentSimulation(root, { id: options.id, candidate, approval, stageTimeoutMs: scenario === "deployment-timeout" ? 20 : 5000 }, { adapter });
    return showDeploymentSimulation(root, { id: options.id });
  });
}
// Parse the raw argv here: shared permissive parsing must not silently ignore options.
export async function deploymentCommand(root, subcommand, args) {
  try {
    if (!["simulate", "show"].includes(subcommand)) stop("unknown-deployment-command");
    const names = subcommand === "show" ? ["id"] : ["id", "session", "scenario"];
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const token = args[i], value = args[i + 1], name = typeof token === "string" ? token.slice(2) : "";
      if (!token?.startsWith("--") || !names.includes(name) || Object.hasOwn(options, name) ||
          typeof value !== "string" || !value || value.startsWith("--")) stop("invalid-deployment-options");
      options[name] = value;
    }
    keys(options, names, "invalid-deployment-options");
    return subcommand === "show" ? await showDeploymentSimulation(root, options) : await runFixtureScenario(root, options);
  } catch (error) {
    // CLI output never echoes arbitrary paths or error text.
    throw new SimulationError(error instanceof SimulationError ? error.code : "simulation-io-or-lock-error");
  }
}
const CHECKS = ["build", "typecheck", "lint", "test"];
const EXCLUDED = [".git", "node_modules", "dist", "build", "coverage"];
const MAX_FILES = 1000, MAX_BYTES = 8 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
class SimulationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const stop = code => { throw new SimulationError(code); };
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function keys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...expected].sort().join("|")) stop(code);
}
function identifier(value, code = "invalid-id") {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) stop(code);
  return value;
}
function relativePath(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\\:\u0000-\u001f\u007f]/.test(value) ||
      value.split("/").some(p => !p || p === "." || p === "..")) stop("unsafe-path");
  return value;
}
async function safePath(root, value) {
  relativePath(value);
  const path = pathInside(root, value);
  if ((await lstat(root)).isSymbolicLink()) stop("unsafe-link");
  let current = root;
  for (const part of value.split("/")) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) stop("unsafe-link"); }
    catch (e) { if (e.code === "ENOENT") break; throw e; }
  }
  return path;
}
async function bytes(root, relative, maximum = MAX_BYTES) {
  const path = await safePath(root, relative), info = await lstat(path);
  if (!info.isFile() || info.size > maximum) stop("invalid-file-size-or-type");
  const data = await readFile(path);
  await safePath(root, relative);
  if (data.length > maximum) stop("invalid-file-size-or-type");
  return data;
}
export function simulationIdentity() {
  return { host: "https://workspace.invalid", workspaceId: "simulation-workspace", profile: "simulation-profile", target: "simulation",
    resource: "simulation-app", principal: "simulation-principal", operations: ["deploy", "start"], costLimitUsd: 0 };
}
function identity(value) {
  keys(value, Object.keys(simulationIdentity()), "invalid-simulation-identity");
  let url;
  try { url = new URL(value.host); } catch { stop("invalid-simulation-host"); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".invalid") || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash || value.host !== url.origin) stop("invalid-simulation-host");
  for (const field of ["workspaceId", "profile", "target", "resource", "principal"]) identifier(value[field], "invalid-simulation-identity");
  if (canonical(value.operations) !== canonical(["deploy", "start"]) || value.costLimitUsd !== 0) stop("invalid-simulation-scope");
  assertNoSecrets(JSON.stringify(value));
}
function freeze(value) {
  if (value && typeof value === "object") { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}
async function inventory(root, component) {
  const directory = await safePath(root, component);
  if (!(await lstat(directory)).isDirectory()) stop("invalid-component-directory");
  const files = []; let total = 0, entries = 0;
  async function visit(sub = "") {
    if (sub.split("/").length > 32) stop("inventory-depth-limit");
    for (const entry of (await readdir(join(directory, sub), { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const relative = sub ? sub + "/" + entry.name : entry.name;
      if (++entries > 2000) stop("inventory-entry-limit");
      const path = await safePath(root, component + "/" + relative);
      const info = await lstat(path); // Check links even in fixed excluded roots.
      if (info.isSymbolicLink()) stop("unsafe-link");
      if (!sub && EXCLUDED.includes(entry.name)) {
        if (!info.isDirectory()) stop("invalid-excluded-root");
        continue;
      }
      if (/^(?:\.env(?:\..+)?|\.databrickscfg|\.npmrc)$/.test(entry.name) && entry.name !== ".env.example" ||
          /\.(?:pem|key|p12)$/i.test(entry.name)) stop("secret-settings-in-component");
      if (info.isDirectory()) await visit(relative);
      else {
        if (!info.isFile() || files.length >= MAX_FILES) stop("inventory-limit-or-file-type");
        const data = await bytes(root, component + "/" + relative);
        total += data.length;
        if (total > MAX_BYTES) stop("inventory-byte-limit");
        files.push({ path: relative, bytes: data.length, sha256: sha256(data), role: /^(?:tests?|__tests__)\//.test(relative) || /\.(?:test|spec)\./.test(relative) ? "validation" : "source" });
      }
    }
  }
  await visit();
  if (!files.length) stop("empty-component");
  return files.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
// Supplement the legacy UTF-8 policy hash with bounded raw-byte inputs.
// Do not change the shared completion verifier's policy contract in this slice.
async function policyInputs(root) {
  const paths = ["AGENTS.md", "harness.config.json", "tools/agent-hook.mjs"];
  for (const path of ["tools/harness.mjs", "harness/workloads.json", "harness/router.json"]) {
    const full = await safePath(root, path);
    try { await lstat(full); paths.push(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  for (const directory of ["tools/lib", "harness/schemas", "harness/evals"]) {
    const full = await safePath(root, directory);
    let info;
    try { info = await lstat(full); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    if (!info.isDirectory()) stop("invalid-policy-directory");
    const entries = await readdir(full);
    if (entries.length > 2000) stop("policy-entry-limit");
    for (const name of entries.sort()) {
      await safePath(root, directory + "/" + name);
      if (/\.(mjs|json)$/.test(name)) paths.push(directory + "/" + name);
    }
  }
  if (paths.length > MAX_FILES) stop("policy-file-limit");
  const result = []; let total = 0;
  for (const path of paths.sort()) {
    const raw = await bytes(root, path);
    total += raw.length;
    if (total > MAX_BYTES) stop("policy-byte-limit");
    result.push({ path, bytes: raw.length, sha256: sha256(raw) });
  }
  return result;
}
async function sessionBinding(root, session, requirement) {
  const path = "work/sessions/" + identifier(session, "invalid-session") + ".md";
  const fields = parseFrontmatter((await bytes(root, path, 256 * 1024)).toString("utf8"));
  if (fields.id !== session || fields.status !== "active" || fields.requirement !== requirement ||
      !fields.gate || !["approved", "not-applicable"].includes(fields.gate_status)) stop("session-reference-or-state-changed");
  return { path, id: fields.id, status: fields.status, requirement: fields.requirement, gate: fields.gate, gateStatus: fields.gate_status };
}
export async function captureDeploymentCandidate(root, options) {
  keys(options, ["component", "requirement", "session", "identity"], "invalid-candidate-options");
  identifier(options.session, "invalid-session");
  relativePath(options.component); relativePath(options.requirement); identity(options.identity);
  const requirementBytes = await bytes(root, options.requirement);
  acceptanceIds(requirementBytes.toString("utf8"));
  const binding = await sessionBinding(root, options.session, options.requirement);
  const body = { schemaVersion: 1, mode: "simulation", adapter: "fixture-v1", session: options.session, sessionBinding: binding, component: options.component,
    requirement: { path: options.requirement, sha256: sha256(requirementBytes) }, identity: structuredClone(options.identity),
    excludedRoots: EXCLUDED, inventory: await inventory(root, options.component), policyInputs: await policyInputs(root), policyHash: await policyHash(root) };
  return freeze({ ...body, id: sha256(canonical(body)) });
}
function candidateShape(candidate) {
  keys(candidate, ["schemaVersion", "mode", "adapter", "session", "sessionBinding", "component", "requirement", "identity", "excludedRoots", "inventory", "policyInputs", "policyHash", "id"], "invalid-candidate");
  const { id, ...body } = candidate;
  if (!HASH.test(id) || id !== sha256(canonical(body)) || candidate.schemaVersion !== 1 || candidate.mode !== "simulation" || candidate.adapter !== "fixture-v1") stop("invalid-candidate");
  identity(candidate.identity);
  relativePath(candidate.component); identifier(candidate.session, "invalid-session");
  keys(candidate.requirement, ["path", "sha256"], "invalid-candidate-requirement");
  relativePath(candidate.requirement.path);
  keys(candidate.sessionBinding, ["path", "id", "status", "requirement", "gate", "gateStatus"], "invalid-candidate-session");
  if (candidate.sessionBinding.path !== "work/sessions/" + candidate.session + ".md" || candidate.sessionBinding.id !== candidate.session ||
      candidate.sessionBinding.status !== "active" || candidate.sessionBinding.requirement !== candidate.requirement.path ||
      typeof candidate.sessionBinding.gate !== "string" || !["approved", "not-applicable"].includes(candidate.sessionBinding.gateStatus)) stop("invalid-candidate-session");
  if (!HASH.test(candidate.requirement.sha256) || !HASH.test(candidate.policyHash) ||
      canonical(candidate.excludedRoots) !== canonical(EXCLUDED) || !Array.isArray(candidate.inventory) || !candidate.inventory.length || candidate.inventory.length > MAX_FILES) stop("invalid-candidate");
  for (const item of candidate.inventory) {
    keys(item, ["path","bytes","sha256","role"], "invalid-candidate-inventory"); relativePath(item.path);
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > MAX_BYTES || !HASH.test(item.sha256) || !["source","validation"].includes(item.role)) stop("invalid-candidate-inventory");
  }
  assertNoSecrets(JSON.stringify(candidate));
  if (!Array.isArray(candidate.policyInputs) || !candidate.policyInputs.length || candidate.policyInputs.length > MAX_FILES) stop("invalid-policy-inputs");
  let previous = "", total = 0;
  for (const item of candidate.policyInputs) {
    keys(item, ["path", "bytes", "sha256"], "invalid-policy-inputs"); relativePath(item.path);
    if (item.path <= previous || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > MAX_BYTES || !HASH.test(item.sha256)) stop("invalid-policy-inputs");
    previous = item.path; total += item.bytes;
  }
  if (total > MAX_BYTES) stop("invalid-policy-inputs");
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) stop("invalid-date");
  const result = Date.parse(value);
  if (!Number.isFinite(result) || new Date(result).toISOString() !== value) stop("invalid-date");
  return result;
}
async function approvalSnapshot(root, path, candidate, now, expectedHash) {
  const raw = await bytes(root, path, 64 * 1024), hash = sha256(raw);
  if (expectedHash && expectedHash !== hash) stop("approval-changed");
  let value;
  try { value = JSON.parse(raw.toString("utf8")); } catch { stop("invalid-fixture-approval"); }
  keys(value, ["schemaVersion", "kind", "mode", "decision", "actor", "candidateId", "session", "identity", "issuedAt", "expiresAt"], "invalid-fixture-approval");
  if (value.schemaVersion !== 1 || value.kind !== "fixture-approval" || value.mode !== "simulation" || value.decision !== "approved") stop("invalid-fixture-approval");
  identifier(value.actor, "invalid-fixture-actor");
  if (value.candidateId !== candidate.id || value.session !== candidate.session || canonical(value.identity) !== canonical(candidate.identity)) stop("approval-scope-mismatch");
  const issued = date(value.issuedAt), expiry = date(value.expiresAt);
  if (issued > now || expiry <= now || expiry <= issued || expiry - issued > 3600_000) stop("approval-expired-or-invalid");
  return hash;
}
function resultBinding(result, candidate, deploymentId) {
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      result.candidateId !== candidate.id || canonical(result.identity) !== canonical(candidate.identity)) stop("result-binding-mismatch");
  if (deploymentId && result.deploymentId !== deploymentId) stop("deployment-id-mismatch");
}
function validateResult(stage, result, candidate, deploymentId, now, runId) {
  const specific = { validate: ["status","checks"], deploy: ["status","deploymentId"], observe: ["state","deploymentId"], start: ["state","deploymentId"], health: ["status","deploymentId","url","observedAt"] };
  keys(result, ["runId","candidateId","identity",...specific[stage]], "invalid-stage-result");
  if (result.runId !== runId) stop("run-id-mismatch");
  resultBinding(result, candidate, ["observe", "start", "health"].includes(stage) ? deploymentId : null);
  if (stage === "validate" && (result.status !== "passed" || canonical(result.checks) !== canonical(CHECKS))) stop("validation-incomplete-or-failed");
  if (stage === "deploy" && (result.status !== "accepted" || typeof result.deploymentId !== "string" || !/^sim-[A-Za-z0-9_-]{1,100}$/.test(result.deploymentId))) stop("deployment-not-accepted");
  if (stage === "observe" && result.state !== "SUCCEEDED") stop("deployment-not-succeeded");
  if (stage === "start" && result.state !== "RUNNING") stop("start-not-running");
  if (stage === "health") {
    if (result.status !== "healthy") stop("health-not-healthy");
    const observed = date(result.observedAt);
    if (observed > now || now - observed > 60_000) stop("health-time-invalid");
    let url; try { url = new URL(result.url); } catch { stop("invalid-simulation-url"); }
    if (url.protocol !== "https:" || !url.hostname.endsWith(".invalid") || url.username || url.password || url.port || url.search || url.hash ||
        url.pathname !== "/" || result.url !== url.origin + "/") stop("invalid-simulation-url");
    assertNoSecrets(result.url);
  }
}
async function invoke(adapter, stage, context, signal, timeout, timeoutCode) {
  const controller = new AbortController();
  let timer, abort;
  const interruption = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(new SimulationError("aborted")); };
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(new SimulationError(timeoutCode)); }, timeout);
    if (signal?.aborted) abort();
  });
  try {
    return await Promise.race([interruption, Promise.resolve().then(() => {
      if (signal?.aborted) stop("aborted");
      return adapter[stage]({ ...context, signal: controller.signal });
    })]);
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
function recordPath(id) { return "work/simulations/deployments/" + identifier(id) + ".json"; }
async function persist(root, relative, record) {
  const body = structuredClone(record);
  await writeJson(await safePath(root, relative), { ...body, integrity: sha256(canonical(body)) });
}
export async function runDeploymentSimulation(root, options, dependencies = {}) {
  const allowed = ["id", "candidate", "approval", "timeoutMs", "stageTimeoutMs", "signal"];
  if (Object.keys(options).some(k => !allowed.includes(k))) stop("unknown-simulation-option");
  const { id, approval, signal } = options;
  const output = recordPath(id), candidate = freeze(structuredClone(options.candidate));
  candidateShape(candidate); relativePath(approval);
  if (signal && !(signal instanceof AbortSignal)) stop("invalid-abort-signal");
  const timeoutMs = options.timeoutMs ?? 30_000, stageTimeoutMs = options.stageTimeoutMs ?? 5000;
  if (![timeoutMs, stageTimeoutMs].every(n => Number.isSafeInteger(n) && n > 0) || timeoutMs > 120_000 || stageTimeoutMs > 30_000) stop("invalid-time-budget");
  const adapter = dependencies.adapter;
  if (!adapter || STAGES.some(s => typeof adapter[s] !== "function")) stop("simulation-adapter-required");
  const now = dependencies.now ?? Date.now;
  const lockTarget = sha256(canonical({ host: candidate.identity.host, workspaceId: candidate.identity.workspaceId, target: candidate.identity.target, resource: candidate.identity.resource }));
  const lock = ".harness/runtime/deployment-simulation/" + lockTarget;
  for (const path of [output, approval, lock]) if (path === candidate.component || path.startsWith(candidate.component + "/")) stop("simulation-record-inside-component");
  const lockPath = await safePath(root, lock), outPath = await safePath(root, output);
  return withFileLock(lockPath, () => withFileLock(outPath, async () => {
    if (await exists(outPath)) stop("simulation-run-already-exists");
    const started = performance.now(), deadline = started + timeoutMs;
    let verifiedHealth = null;
    const record = { schemaVersion: 1, mode: "simulation", liveDeployment: false, id, candidate, approvalPath: approval, approvalHash: null,
      status: "in-progress", stage: "preflight", reason: null, simulatedCalls: [], events: [], deploymentId: null, health: null,
      reconciliationRequired: false, startedAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString() };
    const guard = () => {
      if (signal?.aborted) stop("aborted");
      if (performance.now() >= deadline) stop("overall-timeout");
    };
    const save = () => { record.updatedAt = new Date(now()).toISOString(); return persist(root, output, record); };
    const event = (stage, event) => { record.events.push({ stage, event, at: new Date(now()).toISOString() }); };
    async function preflight() {
      guard();
      const current = await captureDeploymentCandidate(root, { component: candidate.component, requirement: candidate.requirement.path, session: candidate.session, identity: candidate.identity });
      if (current.id !== candidate.id) stop("candidate-changed");
      const hash = await approvalSnapshot(root, approval, candidate, now(), record.approvalHash);
      if (!record.approvalHash) record.approvalHash = hash;
      guard();
    }
    await save(); // No adapter invocation before durable intent.
    try {
      for (const stage of STAGES) {
        record.stage = stage;
        await preflight();
        event(stage, "entered"); record.simulatedCalls.push(stage);
        if (stage !== "validate") record.reconciliationRequired = true;
        await save();
        await preflight(); // Detect changes while durable entry was being saved.
        const stageStarted = performance.now(), remaining = deadline - stageStarted;
        const duration = Math.min(stageTimeoutMs, remaining);
        const result = structuredClone(await invoke(adapter, stage, { runId: id, candidate, deploymentId: record.deploymentId }, signal, duration, remaining <= stageTimeoutMs ? "overall-timeout" : "stage-timeout"));
        guard();
        if (performance.now() - stageStarted >= stageTimeoutMs) stop("stage-timeout");
        validateResult(stage, result, candidate, record.deploymentId, now(), id);
        await preflight();
        if (stage === "deploy") record.deploymentId = result.deploymentId;
        if (stage === "health") verifiedHealth = { url: result.url, observedAt: result.observedAt, validUntil: new Date(date(result.observedAt) + 60_000).toISOString(), mode: "simulation" };
        event(stage, "passed"); await save();
      }
      guard(); record.status = "simulated-success"; record.reconciliationRequired = false; record.health = verifiedHealth;
      await save();
    } catch (error) {
      record.status = "stopped"; record.reason = error instanceof SimulationError ? error.code : "adapter-error";
      record.health = null; record.reconciliationRequired = record.simulatedCalls.includes("deploy");
      event(record.stage, "stopped");
      await save(); // If storage is unavailable, the durable last entry remains uncertain.
    }
    return structuredClone(record);
  }));
}
export async function showDeploymentSimulation(root, options, dependencies = {}) {
  keys(options, ["id"], "invalid-show-options");
  const raw = await bytes(root, recordPath(options.id), 16 * 1024 * 1024);
  let record; try { record = JSON.parse(raw.toString("utf8")); } catch { stop("invalid-simulation-record"); }
  const { integrity, ...body } = record ?? {};
  keys(body, ["schemaVersion", "mode", "liveDeployment", "id", "candidate", "approvalPath", "approvalHash", "status", "stage", "reason", "simulatedCalls", "events", "deploymentId", "health", "reconciliationRequired", "startedAt", "updatedAt"], "invalid-simulation-record");
  if (integrity !== sha256(canonical(body)) || body.schemaVersion !== 1 || body.mode !== "simulation" || body.liveDeployment !== false ||
      body.id !== options.id || !["in-progress", "stopped", "simulated-success"].includes(body.status)) stop("invalid-simulation-record");
  candidateShape(body.candidate);
  relativePath(body.approvalPath);
  if (body.approvalHash !== null && !HASH.test(body.approvalHash)) stop("invalid-simulation-record");
  if (body.deploymentId !== null && (typeof body.deploymentId !== "string" || !/^sim-[A-Za-z0-9_-]{1,100}$/.test(body.deploymentId))) stop("invalid-simulation-record");
  if (!STAGES.includes(body.stage) && body.stage !== "preflight" || typeof body.reconciliationRequired !== "boolean" ||
      body.reason !== null && (typeof body.reason !== "string" || !/^[a-z][a-z-]{1,80}$/.test(body.reason))) stop("invalid-simulation-record");
  const events = body.events, expected = STAGES.flatMap(stage => [{stage,event:"entered"},{stage,event:"passed"}]);
  if (!Array.isArray(events) || events.length > 11) stop("invalid-simulation-events");
  let time = date(body.startedAt), count = 0;
  for (const [i,e] of events.entries()) {
    keys(e, ["stage","event","at"], "invalid-simulation-events");
    if (date(e.at) < time) stop("invalid-simulation-events"); time = date(e.at);
    if (e.event === "stopped") {
      if (i !== events.length - 1 || body.status !== "stopped" || !STAGES.includes(e.stage)) stop("invalid-simulation-events");
      const legal = count % 2 ? [expected[count - 1].stage] : [expected[count - 1]?.stage, expected[count]?.stage].filter(Boolean);
      if (!legal.includes(e.stage)) stop("invalid-simulation-events");
    } else {
      if (e.stage !== expected[count]?.stage || e.event !== expected[count]?.event) stop("invalid-simulation-events");
      count++;
    }
  }
  if (date(body.updatedAt) < time || canonical(body.simulatedCalls) !== canonical(events.filter(e=>e.event==="entered").map(e=>e.stage))) stop("invalid-simulation-events");
  if (body.status === "simulated-success" && (count !== 10 || !body.health || body.reconciliationRequired !== false)) stop("invalid-simulation-success");
  if (body.status === "stopped" && (events.at(-1)?.event !== "stopped" || !body.reason)) stop("invalid-simulation-events");
  if (body.status !== "stopped" && body.reason !== null) stop("invalid-simulation-record");
  if (body.stage !== (events.at(-1)?.stage ?? "preflight")) stop("invalid-simulation-stage");
  if (count >= 4 && body.deploymentId === null || count >= 1 && body.approvalHash === null) stop("invalid-simulation-correlation");
  if (body.simulatedCalls.includes("deploy") && body.status !== "simulated-success" && !body.reconciliationRequired) stop("invalid-reconciliation-state");
  if (body.status !== "simulated-success" && body.health !== null) stop("invalid-simulation-health");
  let healthFreshness = "not-observed";
  if (body.health) {
    keys(body.health, ["url","observedAt","validUntil","mode"], "invalid-simulation-health");
    const now = (dependencies.now ?? Date.now)(), observed = date(body.health.observedAt), until = date(body.health.validUntil);
    if (body.health.mode !== "simulation" || until !== observed + 60_000 || observed > date(body.updatedAt)) stop("invalid-simulation-health");
    validateResult("health", { runId: body.id, candidateId: body.candidate.id, identity: body.candidate.identity, deploymentId: body.deploymentId,
      status: "healthy", url: body.health.url, observedAt: body.health.observedAt }, body.candidate, body.deploymentId, date(body.updatedAt), body.id);
    healthFreshness = observed > now ? "unknown-clock" : now >= until ? "simulation-stale" : "simulation-fresh";
  }
  return { id: body.id, mode: "simulation", liveDeployment: false, status: body.status, stage: body.stage, reason: body.reason,
    candidateId: body.candidate.id, simulatedCalls: body.simulatedCalls, deploymentId: body.deploymentId, reconciliationRequired: body.reconciliationRequired,
    health: body.health, healthFreshness, updatedAt: body.updatedAt };
}
