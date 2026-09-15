import assert from "node:assert/strict";
import fsp, { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile, lstat, link, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { recordScope, checkScope, revokeScope, scopeCommand } from "../../tools/lib/scoped-approval.mjs";
import { approveLoopGate } from "../../tools/lib/loop.mjs";

// Independent, synthetic local fixtures only. No provider, network, Git or DB calls.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const T0 = Date.parse("2026-09-10T10:00:00.000Z"), HOUR = 3600000;
const REQUEST = "work/evidence/request.json", PROOF = "work/evidence/human.md";
const GRANT = "work/approvals/scopes/grant-01.json", REV = "work/approvals/scopes/grant-01.revocation.json";
const REQ = "docs/product/requirements/orders.md", ARC = "docs/product/architecture/orders.md";
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
function reseal(value) { const { integritySha256, ...body } = value; return { ...body, integritySha256: hash(canonical(body)) }; }
async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
}
async function snapshot(root) {
  const files = {};
  async function visit(path) {
    for (const item of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const child = path ? `${path}/${item.name}` : item.name;
      if (item.isDirectory()) { files[child + "/"] = "directory"; await visit(child); }
      else if (item.isSymbolicLink()) files[child] = "link";
      else files[child] = hash(await readFile(join(root, child)));
    }
  }
  await visit(""); return files;
}
async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "scope-independent-"));
  t.after(async () => {
    assert.equal(dirname(root), base); assert.ok(root.startsWith(base + sep)); assert.match(root.slice(base.length + 1), /^scope-independent-/);
    await rm(root, { recursive: true, force: true });
  });
  await cp(join(REPO, "tools"), join(root, "tools"), { recursive: true });
  for (const path of ["AGENTS.md", "harness.config.json"]) await put(root, path, await readFile(join(REPO, path)));
  await put(root, "product.config.json", { name: "orders", initializedAt: "2026-09-01T00:00:00Z" });
  await put(root, REQ, "---\nstatus: accepted\n---\n## Acceptance criteria\n- AC-D01: Keep fixture scope exact.\n");
  await put(root, ARC, "---\nstatus: proposed\n---\n# Synthetic orders design\n");
  await put(root, PROOF, "Synthetic owner decision for the exact fixture. No real execution authorization.\n");
  await put(root, "apps/orders/index.mjs", "export const synthetic = true;\n");
  for (const session of ["SOURCE", "TARGET"]) await put(root, `work/sessions/${session}.md`, `---\nid: ${session}\nstatus: active\nrequirement: ${REQ}\narchitecture: ${ARC}\ngate: sensitive-data-or-permission-change\ngate_status: pending\n---\nFixture progress.\n`);
  const request = { schemaVersion: 1, product: "orders", component: "apps/orders", candidateSha256: "d".repeat(64), environment: "dev",
    workspace: { host: "https://fixture.invalid", id: "workspace-1", profile: "dev-fixture" }, principal: "synthetic-principal",
    resources: ["table-b", "table-a"], operations: ["write", "read"], permissions: [{ resource: "table-b", privilege: "MODIFY" }, { resource: "table-a", privilege: "SELECT" }],
    cost: { currency: "JPY", maximumMinor: 100, basis: "total-candidate" } };
  await put(root, REQUEST, request);
  return { root, request };
}
const options = (at = T0) => ({ id: "grant-01", session: "SOURCE", request: REQUEST, actor: "synthetic-owner", evidence: PROOF, expires_at: new Date(at + HOUR).toISOString() });
const target = { id: "grant-01", session: "TARGET", request: REQUEST };
const issue = (root, at = T0) => recordScope(root, options(at), { now: () => at });
const check = (root, at = T0 + 1) => checkScope(root, target, { now: () => at });
async function absent(root, path) { await assert.rejects(lstat(join(root, path)), { code: "ENOENT" }); }
function denied(value) { assert.equal(value.eligibleForReuse, false); assert.equal(value.executionAuthorized, false); assert.equal(value.identityAuthenticated, false); }
async function atOpen(path, nth, mutation, action) {
  const original = fsp.open; let hits = 0;
  fsp.open = async function (...args) {
    if (resolve(String(args[0])) === resolve(path) && args[1] === "r" && ++hits === nth) await mutation();
    return original(...args);
  };
  syncBuiltinESMExports();
  try { return await action(); }
  finally { fsp.open = original; syncBuiltinESMExports(); assert.ok(hits >= nth, `real read hook reached ${hits}/${nth}`); }
}

test("I01 public read-only CLI: same scope crosses sessions but never clears pending gate or writes any bytes", async t => {
  const { root } = await fixture(t); await issue(root, Date.now());
  const before = await snapshot(root);
  const result = spawnSync(process.execPath, [join(root, "tools/harness.mjs"), "approval-scope", "check", "--id", "grant-01", "--session", "TARGET", "--request", REQUEST], { cwd: root, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); const value = JSON.parse(result.stdout);
  assert.equal(value.eligibleForReuse, true); assert.equal(value.unresolvedGate, "sensitive-data-or-permission-change");
  for (const key of ["executionAuthorized", "identityAuthenticated", "candidateVerified", "costEnforced"]) assert.equal(value[key], false);
  assert.deepEqual(await snapshot(root), before);
});

test("I02 semantic array permutation is accepted; lower cost and resource subset still require a new decision", async t => {
  const { root, request } = await fixture(t); await issue(root);
  request.resources.reverse(); request.operations.reverse(); request.permissions.reverse(); await put(root, REQUEST, request);
  assert.equal((await check(root)).eligibleForReuse, true);
  request.cost.maximumMinor = 99; await put(root, REQUEST, request); denied(await check(root));
  request.cost.maximumMinor = 100; request.resources.pop(); request.permissions = request.permissions.filter(v => request.resources.includes(v.resource));
  await put(root, REQUEST, request); denied(await check(root));
});

test("I03 origin progress/terminal state permits handoff, but origin pointer or missing source invalidates it", async t => {
  const { root } = await fixture(t); await issue(root); const path = "work/sessions/SOURCE.md", original = await readFile(join(root, path), "utf8");
  for (const status of ["completed", "blocked", "superseded"]) {
    await put(root, path, original.replace("status: active", `status: ${status}`) + "More progress.\n");
    assert.equal((await check(root)).eligibleForReuse, true);
  }
  await put(root, "docs/product/requirements/alias.md", await readFile(join(root, REQ)));
  await put(root, path, original.replace(REQ, "docs/product/requirements/alias.md")); denied(await check(root));
  await put(root, path, "---\nid: OTHER\n---\n"); denied(await check(root));
});

test("I04 completed target, unaccepted requirement, empty AC or control drift never fallback to a similar scope", async t => {
  const { root } = await fixture(t); await issue(root); const path = "work/sessions/TARGET.md", session = await readFile(join(root, path), "utf8");
  await put(root, path, session.replace("status: active", "status: completed")); denied(await check(root)); await put(root, path, session);
  const requirement = await readFile(join(root, REQ), "utf8");
  await put(root, REQ, requirement.replace("status: accepted", "status: draft")); denied(await check(root));
  await put(root, REQ, "---\nstatus: accepted\n---\nNo criteria.\n"); denied(await check(root)); await put(root, REQ, requirement);
  const control = "tools/harness.mjs"; await put(root, control, (await readFile(join(root, control), "utf8")) + "\n// synthetic drift\n"); denied(await check(root));
});

test("I05 sensitive scope dimensions each reject exact reuse without altering the grant", async t => {
  const { root, request } = await fixture(t); await issue(root); const saved = await readFile(join(root, GRANT));
  for (const mutate of [r => r.workspace.id += "-other", r => r.workspace.profile += "-other", r => r.workspace.host = "https://other.invalid", r => r.principal += "-other", r => r.operations.push("delete"), r => r.permissions[0].privilege = "OWN", r => r.component = "apps/other", r => r.candidateSha256 = "e".repeat(64), r => r.environment = "prod", r => r.product = "other"]) {
    const input = structuredClone(request); mutate(input); await put(root, REQUEST, input); const before = await snapshot(root);
    denied(await check(root)); assert.deepEqual(await snapshot(root), before);
  }
  assert.deepEqual(await readFile(join(root, GRANT)), saved);
});

test("I06 record duplicate writers produce exactly one immutable record", async t => {
  const { root } = await fixture(t);
  const results = await Promise.allSettled([issue(root), issue(root)]);
  assert.equal(results.filter(v => v.status === "fulfilled").length, 1); assert.equal(results.filter(v => v.status === "rejected").length, 1);
  assert.equal((await check(root)).eligibleForReuse, true); await absent(root, GRANT + ".lock");
  const saved = await readFile(join(root, GRANT)); await assert.rejects(issue(root)); assert.deepEqual(await readFile(join(root, GRANT)), saved);
});

test("I07 revocation is immutable, bound to original bytes, and no check mutation repairs it", async t => {
  const { root } = await fixture(t); await issue(root); const saved = await readFile(join(root, GRANT));
  await revokeScope(root, { id: "grant-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 100 });
  const revoked = await readFile(join(root, REV)); assert.equal(JSON.parse(revoked).approvalSha256, hash(saved));
  const before = await snapshot(root); assert.equal((await check(root, T0 + 101)).reason, "revoked"); assert.deepEqual(await snapshot(root), before);
  await assert.rejects(revokeScope(root, { id: "grant-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 102 }));
  assert.deepEqual(await readFile(join(root, GRANT)), saved); assert.deepEqual(await readFile(join(root, REV)), revoked);
});

test("I08 corrupt, wrong-grant and future revocations all fail closed even with recomputed content hash", async t => {
  const { root } = await fixture(t); await issue(root); await revokeScope(root, { id: "grant-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 100 });
  const rev = JSON.parse(await readFile(join(root, REV), "utf8"));
  for (const mutate of [v => v.approvalSha256 = "f".repeat(64), v => v.revokedAt = new Date(T0 + HOUR).toISOString(), v => v.approvalId = "other", v => v.evidence.sha256 = "f".repeat(64)]) {
    const altered = structuredClone(rev); mutate(altered); await put(root, REV, reseal(altered)); const before = await snapshot(root);
    denied(await check(root, T0 + 101)); assert.deepEqual(await snapshot(root), before);
  }
  await put(root, REV, "{"); denied(await check(root));
});

test("I09 grant closed schema/kind/hash and duplicate keys reject fabricated legacy shapes", async t => {
  const { root } = await fixture(t); await issue(root); const saved = JSON.parse(await readFile(join(root, GRANT), "utf8"));
  for (const value of [reseal({ ...saved, actor: "owner", decision: "approved", gate: "sensitive-data-or-permission-change", sessionId: "SOURCE", evidence: PROOF }), reseal({ ...saved, kind: "simulation-approval" }), { ...saved, expiresAt: new Date(T0 + 2 * HOUR).toISOString() }]) {
    await put(root, GRANT, value); denied(await check(root));
  }
  const duplicate = JSON.stringify(saved).replace('"principal":"synthetic-principal"', '"principal":"other","princ\\u0069pal":"synthetic-principal"');
  await put(root, GRANT, duplicate); assert.equal((await check(root)).reason, "duplicate-key");
});

test("I10 new grant and revocation cannot unlock a legacy loop gate", async t => {
  const { root } = await fixture(t); await issue(root);
  await revokeScope(root, { id: "grant-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 100 });
  const loopPath = "work/loops/independent-loop.json";
  await put(root, loopPath, { id: "independent-loop", status: "active", sessionId: "SOURCE", gate: { id: "sensitive-data-or-permission-change", status: "pending", evidence: null } });
  const original = await snapshot(root);
  for (const evidence of [GRANT, REV]) await assert.rejects(approveLoopGate(root, { id: "independent-loop", evidence }), /matching human approval/);
  assert.deepEqual(await snapshot(root), original);
});

test("I11 nested escaped duplicate keys, invisible strings, wildcard and excessive lists refuse record before persistence", async t => {
  const { root, request } = await fixture(t);
  const duplicate = JSON.stringify(request).replace('"maximumMinor":100', '"maximumMinor":999,"maximumMino\\u0072":100');
  for (const raw of [duplicate, JSON.stringify({ ...request, principal: "principal\u200b" }), JSON.stringify({ ...request, principal: "\ud800" }), JSON.stringify({ ...request, resources: ["table-*"] }), JSON.stringify({ ...request, resources: Array.from({ length: 65 }, (_, i) => `resource-${i}`) })]) {
    await put(root, REQUEST, raw); await assert.rejects(issue(root)); await absent(root, GRANT);
  }
});

test("I12 canonical path boundaries and reserved paths never issue a record", async t => {
  const { root } = await fixture(t);
  for (const evidence of ["../human.md", "work/evidence/../evidence/human.md", "work\\evidence\\human.md", "work/evidence/human.md:stream", "work/evidence/CON.txt", "work/evidence/.env.local"]) {
    await assert.rejects(recordScope(root, { ...options(), evidence }, { now: () => T0 })); await absent(root, GRANT);
  }
});

test("I13 hardlinked file, linked component and linked output ancestor reject fixture writes", async t => {
  const { root, request } = await fixture(t);
  await link(join(root, PROOF), join(root, "work/evidence/hard.md")); await assert.rejects(issue(root), /invalid-file/); await absent(root, GRANT);
  await put(root, "work/evidence/fresh.md", "Synthetic replacement evidence.\n");
  await symlink(join(root, "apps/orders"), join(root, "apps/link"), "junction");
  await put(root, REQUEST, { ...request, component: "apps/link" }); await assert.rejects(recordScope(root, { ...options(), evidence: "work/evidence/fresh.md" }, { now: () => T0 }), /linked-path/);
  await put(root, REQUEST, request); await mkdir(join(root, "output")); await symlink(join(root, "output"), join(root, "work/approvals"), "junction");
  await assert.rejects(recordScope(root, { ...options(), evidence: "work/evidence/fresh.md" }, { now: () => T0 }), /linked-path/); assert.deepEqual(await readdir(join(root, "output")), []);
});

test("I14 UTF-8/size/empty/known secret evidence boundaries fail closed", async t => {
  const { root } = await fixture(t);
  for (const value of [Buffer.from([0xC3, 0x28]), Buffer.alloc(1024 * 1024 + 1, 0x61), "  \n", "token=" + "synthetic-sensitive-value"]) {
    await put(root, PROOF, value); await assert.rejects(issue(root)); await absent(root, GRANT);
  }
});

test("I15 raw CLI surface refuses missing, duplicate, unknown, normalized and positional options", async t => {
  const { root } = await fixture(t); const argv = ["--id", "grant-01", "--session", "TARGET", "--request", REQUEST];
  for (const args of [argv.concat("--force", "true"), argv.concat("--id", "other"), argv.slice(0, -1), argv.concat("position"), argv.concat("--now", String(T0)), ["--id=grant-01", ...argv.slice(2)], ["--ID", "grant-01", ...argv.slice(2)]]) await assert.rejects(scopeCommand(root, "check", args));
  await assert.rejects(scopeCommand(root, "toString", [])); await absent(root, GRANT);
  const result = spawnSync(process.execPath, [join(root, "tools/harness.mjs"), "approval-scope", "check", ...argv, "--ignore-expiry", "true"], { cwd: root, encoding: "utf8", timeout: 15000 });
  assert.notEqual(result.status, 0); await absent(root, GRANT);
});

test("I16 exact issue/expiry/30-day boundaries reject stale reuse without extending its original expiry", async t => {
  const { root } = await fixture(t); await issue(root); const saved = await readFile(join(root, GRANT));
  assert.equal((await check(root, T0)).eligibleForReuse, true); assert.equal((await check(root, T0 - 1)).reason, "not-yet-valid");
  assert.equal((await check(root, T0 + HOUR - 1)).eligibleForReuse, true); assert.equal((await check(root, T0 + HOUR)).reason, "expired");
  for (const expires_at of ["2026-02-30T10:00:00Z", new Date(T0 + 30 * 86400000 + 1).toISOString()]) await assert.rejects(recordScope(root, { ...options(), id: "other", expires_at }, { now: () => T0 }));
  assert.deepEqual(await readFile(join(root, GRANT)), saved);
});

test("I17 record rejects a request changed after parsing and before snapshot validation", async t => {
  const { root, request } = await fixture(t);
  await atOpen(join(root, PROOF), 1, () => put(root, REQUEST, { ...request, principal: "changed" }), () => assert.rejects(issue(root), /input-changed/));
  await absent(root, GRANT);
});

test("I18 record rejects source requirement-pointer change during evidence read", async t => {
  const { root } = await fixture(t); const path = "work/sessions/SOURCE.md";
  await put(root, "docs/product/requirements/alias.md", await readFile(join(root, REQ)));
  await atOpen(join(root, PROOF), 1, async () => put(root, path, (await readFile(join(root, path), "utf8")).replace(REQ, "docs/product/requirements/alias.md")), () => assert.rejects(issue(root), /input-changed/));
  await absent(root, GRANT);
});

test("I19 drift between target and origin repeated input reads is rejected", async t => {
  const { root } = await fixture(t); await issue(root);
  const value = await atOpen(join(root, REQ), 2, async () => put(root, REQ, (await readFile(join(root, REQ), "utf8")) + "\nChanged.\n"), () => check(root));
  denied(value); assert.equal(value.reason, "input-changed");
});

test("I20 revocation appearing during final snapshot validation prevents a positive check", async t => {
  const { root } = await fixture(t); await issue(root);
  const value = await atOpen(join(root, PROOF), 2, () => put(root, REV, "{}"), () => check(root));
  denied(value); assert.equal(value.reason, "revocation-changed");
});

test("I21 revoke rejects original record changed during proof read; original is not repaired", async t => {
  const { root } = await fixture(t); await issue(root);
  const saved = await readFile(join(root, GRANT));
  await atOpen(join(root, PROOF), 1, () => put(root, GRANT, Buffer.concat([saved, Buffer.from("\n")])), () => assert.rejects(revokeScope(root, { id: "grant-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 100 }), /input-changed/));
  await absent(root, REV); assert.deepEqual(await readFile(join(root, GRANT)), Buffer.concat([saved, Buffer.from("\n")]));
});

test("I22 check reaching expiry during final read is denied", async t => {
  const { root } = await fixture(t); await issue(root); let calls = 0;
  const value = await checkScope(root, target, { now: () => ++calls === 1 ? T0 + 1 : T0 + HOUR });
  denied(value); assert.equal(value.reason, "expired"); assert.ok(calls >= 2);
});

test("I23 check clock rollback before issuedAt during I/O cannot return eligibleForReuse", async t => {
  const { root } = await fixture(t); await issue(root); let calls = 0; const before = await snapshot(root);
  const value = await checkScope(root, target, { now: () => ++calls === 1 ? T0 + 1 : T0 - 1 });
  assert.ok(calls >= 2); assert.deepEqual(await snapshot(root), before); denied(value);
});

test("I24 record clock rollback before its issuedAt during I/O cannot persist a future-issued decision", async t => {
  const { root } = await fixture(t); let calls = 0;
  await assert.rejects(recordScope(root, options(), { now: () => ++calls === 1 ? T0 : T0 - 1 }));
  assert.ok(calls >= 2); await absent(root, GRANT);
});
