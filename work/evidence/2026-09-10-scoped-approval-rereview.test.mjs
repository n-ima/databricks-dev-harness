import assert from "node:assert/strict";
import fsp, { cp, mkdir, mkdtemp, readFile, writeFile, lstat, readdir, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { recordScope, checkScope, revokeScope, scopeCommand } from "../../tools/lib/scoped-approval.mjs";

// Additive independent probes. The original 24 tests and first failure log stay unchanged.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const T0 = Date.parse("2026-09-10T10:00:00.000Z"), HOUR = 3600000, DAY = 86400000;
const GRANT = "work/approvals/scopes/clock-01.json", SESSION = "work/sessions/CLOCK.md";
const PROOF = "work/evidence/clock-human.md", REQUEST = "work/evidence/clock-request.json";
async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
}
async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "scope-clock-independent-"));
  t.after(async () => { assert.equal(dirname(root), base); assert.match(root.slice(base.length + 1), /^scope-clock-independent-/); await rm(root, { recursive: true, force: true }); });
  await cp(join(REPO, "tools"), join(root, "tools"), { recursive: true });
  await put(root, "harness.config.json", await readFile(join(REPO, "harness.config.json")));
  await put(root, "product.config.json", { name: "clock-fixture", initializedAt: "2026-09-01T00:00:00Z" });
  await put(root, "docs/product/requirements/clock.md", "---\nstatus: accepted\n---\n- AC-D01: Preserve exact local decisions.\n");
  await put(root, "docs/product/architecture/clock.md", "# Synthetic local architecture\n");
  await put(root, SESSION, "---\nid: CLOCK\nstatus: active\nrequirement: docs/product/requirements/clock.md\narchitecture: docs/product/architecture/clock.md\ngate: product-intent\ngate_status: pending\n---\n");
  await put(root, PROOF, "Synthetic human decision only; not a real grant.\n");
  await put(root, "src/clock/index.mjs", "export const fixture = true;\n");
  await put(root, REQUEST, { schemaVersion: 1, product: "clock-fixture", component: "src/clock", candidateSha256: "c".repeat(64), environment: "dev", workspace: { host: "https://fixture.invalid", id: "workspace-1", profile: "fixture" }, principal: "synthetic-owner", resources: ["resource-1"], operations: ["read"], permissions: [], cost: { currency: "JPY", maximumMinor: 0, basis: "total-candidate" } });
  return root;
}
const options = (at = T0) => ({ id: "clock-01", session: "CLOCK", request: REQUEST, actor: "synthetic-owner", evidence: PROOF, expires_at: new Date(at + HOUR).toISOString() });
const selected = { id: "clock-01", session: "CLOCK", request: REQUEST };
async function absent(root, path) { await assert.rejects(lstat(join(root, path)), { code: "ENOENT" }); }
function sequence(...values) { let calls = 0; return { now: () => { assert.ok(calls < values.length, "clock unexpectedly read multiple times per checkpoint"); return values[calls++]; }, count: () => calls }; }

test("R01 record final time equals issuedAt is valid; one millisecond below rejects without grant, lock, or input changes", async t => {
  const root = await fixture(t), session = await readFile(join(root, SESSION)), proof = await readFile(join(root, PROOF));
  const rollback = sequence(T0, T0 - 1);
  await assert.rejects(recordScope(root, options(), rollback), { code: "not-yet-valid" }); assert.equal(rollback.count(), 2);
  await absent(root, GRANT); await absent(root, GRANT + ".lock");
  assert.deepEqual(await readFile(join(root, SESSION)), session); assert.deepEqual(await readFile(join(root, PROOF)), proof);
  const equal = sequence(T0, T0); assert.equal((await recordScope(root, options(), equal)).recorded, true); assert.equal(equal.count(), 2);
});

test("R02 record reaching expiry is rejected before persistence; one millisecond before expiry remains valid", async t => {
  const root = await fixture(t), expired = sequence(T0, T0 + HOUR);
  await assert.rejects(recordScope(root, options(), expired), { code: "expired" }); assert.equal(expired.count(), 2);
  await absent(root, GRANT); await absent(root, GRANT + ".lock");
  const lastValid = sequence(T0, T0 + HOUR - 1);
  assert.equal((await recordScope(root, options(), lastValid)).recorded, true); assert.equal(lastValid.count(), 2);
});

test("R03 check permits rollback only within its valid interval and returns fixed reasons outside both bounds", async t => {
  const root = await fixture(t); await recordScope(root, options(), { now: () => T0 });
  const saved = await readFile(join(root, GRANT)), session = await readFile(join(root, SESSION));
  for (const [end, eligible, reason] of [[T0 - 1, false, "not-yet-valid"], [T0, true, "matching-record"], [T0 + HOUR - 1, true, "matching-record"], [T0 + HOUR, false, "expired"]]) {
    const now = sequence(T0 + 1, end), result = await checkScope(root, selected, now); assert.equal(now.count(), 2);
    assert.equal(result.eligibleForReuse, eligible); assert.equal(result.reason, reason); assert.equal(result.executionAuthorized, false); assert.equal(result.identityAuthenticated, false);
  }
  assert.deepEqual(await readFile(join(root, GRANT)), saved); assert.deepEqual(await readFile(join(root, SESSION)), session);
});

test("R04 invalid final clocks cannot issue a record or produce a positive reuse result", async t => {
  const root = await fixture(t);
  for (const bad of [NaN, Infinity, -1, T0 + 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const now = sequence(T0, bad); await assert.rejects(recordScope(root, options(), now), { code: "invalid-clock" }); assert.equal(now.count(), 2); await absent(root, GRANT);
  }
  await recordScope(root, options(), { now: () => T0 }); const saved = await readFile(join(root, GRANT));
  for (const bad of [NaN, Infinity, -1, T0 + 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const now = sequence(T0 + 1, bad), result = await checkScope(root, selected, now); assert.equal(now.count(), 2); assert.equal(result.eligibleForReuse, false); assert.equal(result.reason, "invalid-clock");
  }
  assert.deepEqual(await readFile(join(root, GRANT)), saved);
});

test("R05 full 30-day issuance window is accepted exactly, plus one millisecond is rejected", async t => {
  const root = await fixture(t);
  await assert.rejects(recordScope(root, { ...options(), expires_at: new Date(T0 + 30 * DAY + 1).toISOString() }, { now: () => T0 }), { code: "invalid-window" }); await absent(root, GRANT);
  await recordScope(root, { ...options(), expires_at: new Date(T0 + 30 * DAY).toISOString() }, { now: () => T0 });
  assert.equal((await checkScope(root, selected, { now: () => T0 + 30 * DAY - 1 })).eligibleForReuse, true);
  assert.equal((await checkScope(root, selected, { now: () => T0 + 30 * DAY })).reason, "expired");
});

test("R06 partial record-write failure is visible and never overwritten by retry", async t => {
  const root = await fixture(t), original = fsp.writeFile; let hit = 0;
  fsp.writeFile = async function(path, data, config) {
    if (resolve(String(path)) === resolve(join(root, GRANT))) { hit++; await original(path, "{\"partial\":", config); const error = new Error("Synthetic fixture write interruption"); error.code = "EIO"; throw error; }
    return original(path, data, config);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(recordScope(root, options(), { now: () => T0 }), { code: "EIO" }); }
  finally { fsp.writeFile = original; syncBuiltinESMExports(); }
  assert.equal(hit, 1); const partial = await readFile(join(root, GRANT)); await absent(root, GRANT + ".lock");
  await assert.rejects(recordScope(root, options(), { now: () => T0 }), { code: "already-recorded" });
  assert.deepEqual(await readFile(join(root, GRANT)), partial); assert.equal((await checkScope(root, selected, { now: () => T0 })).eligibleForReuse, false);
});

test("R07 raw public command interface still records/checks/revokes fixture decisions without changing a pending gate", async t => {
  const root = await fixture(t), before = await readFile(join(root, SESSION));
  const issued = Date.now();
  const created = await scopeCommand(root, "record", ["--id", "clock-01", "--session", "CLOCK", "--request", REQUEST, "--actor", "synthetic-owner", "--evidence", PROOF, "--expires-at", new Date(issued + HOUR).toISOString()]);
  assert.equal(created.recorded, true); assert.equal(created.executionAuthorized, false);
  const result = await scopeCommand(root, "check", ["--id", "clock-01", "--session", "CLOCK", "--request", REQUEST]);
  assert.equal(result.eligibleForReuse, true); assert.equal(result.unresolvedGate, "product-intent"); assert.equal(result.executionAuthorized, false);
  const revoked = await scopeCommand(root, "revoke", ["--id", "clock-01", "--actor", "synthetic-owner", "--evidence", PROOF]); assert.equal(revoked.revoked, true);
  assert.equal((await scopeCommand(root, "check", ["--id", "clock-01", "--session", "CLOCK", "--request", REQUEST])).reason, "revoked");
  assert.deepEqual(await readFile(join(root, SESSION)), before);
});

test("R08 revoked records stay fail-closed for ordinary, expired and rolled-back checks", async t => {
  const root = await fixture(t); await recordScope(root, options(), { now: () => T0 });
  await revokeScope(root, { id: "clock-01", actor: "synthetic-owner", evidence: PROOF }, { now: () => T0 + 100 });
  const names = await readdir(join(root, "work/approvals/scopes"));
  for (const now of [() => T0 + 101, () => T0 - 1, () => T0 + HOUR]) {
    const result = await checkScope(root, selected, { now }); assert.equal(result.eligibleForReuse, false); assert.equal(result.executionAuthorized, false);
  }
  assert.deepEqual(await readdir(join(root, "work/approvals/scopes")), names);
});
