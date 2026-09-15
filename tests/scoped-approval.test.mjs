import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, readdir, symlink, link, rename } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";
import { recordScope, checkScope, revokeScope } from "../tools/lib/scoped-approval.mjs";
import { initLoop, setLoopGate, approveLoopGate } from "../tools/lib/loop.mjs";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
}
async function fixture(t) {
  const parent = resolve(tmpdir()), root = await mkdtemp(join(parent, "harness-scope-"));
  t.after(async () => { assert.ok(root.startsWith(parent + sep)); assert.match(root.slice(parent.length + 1), /^harness-scope-/); await rm(root, { recursive: true, force: true }); });
  await cp(join(repo, "tools"), join(root, "tools"), { recursive: true });
  for (const path of ["AGENTS.md", "harness.config.json"]) await put(root, path, await readFile(join(repo, path)));
  await put(root, "product.config.json", { name: "orders", initializedAt: "2026-09-01T00:00:00Z" });
  await put(root, "docs/product/requirements/orders.md", "---\nstatus: accepted\n---\n- AC-01: Orders are saved safely.\n");
  await put(root, "docs/product/architecture/orders.md", "# Orders architecture\n");
  await put(root, "work/evidence/decision.md", "The owner approved the exact fixture scope, not real execution.\n");
  await put(root, "apps/orders/index.ts", "export const fixture = true;\n");
  for (const id of ["S-1", "S-2"]) await put(root, `work/sessions/${id}.md`, `---\nid: ${id}\nstatus: active\nrequirement: docs/product/requirements/orders.md\narchitecture: docs/product/architecture/orders.md\ngate: product-intent\ngate_status: approved\n---\n# Fixture session\n`);
  const request = { schemaVersion: 1, product: "orders", component: "apps/orders", candidateSha256: "a".repeat(64), environment: "dev",
    workspace: { host: "https://fixture.invalid", id: "workspace-1", profile: "fixture-dev" }, principal: "app-1",
    resources: ["table-1", "app-1"], operations: ["deploy", "read"], permissions: [{ resource: "table-1", privilege: "SELECT" }],
    cost: { currency: "USD", maximumMinor: 100, basis: "total-candidate" } };
  await put(root, "work/evidence/request.json", request);
  return { root, request };
}
function cli(root, args) {
  return spawnSync(process.execPath, [join(root, "tools/harness.mjs"), "approval-scope", ...args], { cwd: root, encoding: "utf8", timeout: 15000 });
}
function record(root, id = "scope-1") {
  return cli(root, ["record", "--id", id, "--session", "S-1", "--request", "work/evidence/request.json", "--actor", "fixture-owner", "--evidence", "work/evidence/decision.md", "--expires-at", new Date(Date.now() + 3600000).toISOString()]);
}
function check(root, id = "scope-1", session = "S-2") {
  return cli(root, ["check", "--id", id, "--session", session, "--request", "work/evidence/request.json"]);
}
test("same exact scoped decision survives session handoff without claiming execution authority", async t => {
  const { root } = await fixture(t);
  const before = await readFile(join(root, "work/sessions/S-1.md"));
  const created = record(root); assert.equal(created.status, 0, created.stderr);
  const saved = await readFile(join(root, "work/approvals/scopes/scope-1.json"));
  const result = check(root); assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout); assert.equal(value.eligibleForReuse, true);
  assert.equal(value.executionAuthorized, false); assert.equal(value.identityAuthenticated, false);
  assert.equal(value.sessionId, "S-2");
  assert.deepEqual(await readFile(join(root, "work/sessions/S-1.md")), before);
  assert.deepEqual(await readFile(join(root, "work/approvals/scopes/scope-1.json")), saved);
});
test("same ID never overwrites the original approval", async t => {
  const { root } = await fixture(t); assert.equal(record(root).status, 0);
  const before = await readFile(join(root, "work/approvals/scopes/scope-1.json"));
  assert.notEqual(record(root).status, 0);
  assert.deepEqual(await readFile(join(root, "work/approvals/scopes/scope-1.json")), before);
});
for (const [name, mutate] of [
  ["environment", r => r.environment = "prod"], ["resource", r => r.resources.push("table-2")],
  ["principal", r => r.principal = "admin"], ["operation", r => r.operations.push("delete")],
  ["permission", r => r.permissions[0].privilege = "MODIFY"], ["cost", r => r.cost.maximumMinor++],
  ["candidate", r => r.candidateSha256 = "b".repeat(64)], ["workspace", r => r.workspace.id = "workspace-2"],
  ["profile", r => r.workspace.profile = "other"], ["host", r => r.workspace.host = "https://other.invalid"],
  ["product", r => r.product = "other"], ["currency", r => r.cost.currency = "JPY"],
  ["smaller scope", r => r.operations.pop()],
]) test(`changed ${name} does not inherit approval`, async t => {
  const { root, request } = await fixture(t); assert.equal(record(root).status, 0);
  mutate(request); await put(root, "work/evidence/request.json", request);
  const result = check(root); assert.notEqual(result.status, 0);
  const value = JSON.parse(result.stdout); assert.equal(value.eligibleForReuse, false); assert.equal(value.executionAuthorized, false);
});
test("array ordering is not a scope expansion", async t => {
  const { root, request } = await fixture(t); assert.equal(record(root).status, 0);
  request.resources.reverse(); request.operations.reverse(); await put(root, "work/evidence/request.json", request);
  assert.equal(check(root).status, 0);
});
for (const path of ["product.config.json", "docs/product/requirements/orders.md", "docs/product/architecture/orders.md", "work/evidence/decision.md"])
  test(`changed bound bytes invalidate scope: ${path}`, async t => {
    const { root } = await fixture(t); assert.equal(record(root).status, 0);
    await put(root, path, (await readFile(join(root, path), "utf8")) + "\n");
    assert.notEqual(check(root).status, 0);
  });
test("revocation is append-only and cannot be undone by duplicate record", async t => {
  const { root } = await fixture(t); assert.equal(record(root).status, 0);
  const path = "work/approvals/scopes/scope-1.json", before = await readFile(join(root, path));
  const args = ["revoke", "--id", "scope-1", "--actor", "fixture-owner", "--evidence", "work/evidence/decision.md"];
  assert.equal(cli(root, args).status, 0); assert.notEqual(cli(root, args).status, 0);
  assert.equal(JSON.parse(check(root).stdout).reason, "revoked");
  assert.deepEqual(await readFile(join(root, path)), before); assert.notEqual(record(root).status, 0);
});
for (const [name, mutate] of [
  ["unknown field", r => r.force = true], ["duplicate resource", r => r.resources.push(r.resources[0])],
  ["wildcard", r => r.operations = ["*"]], ["negative cost", r => r.cost.maximumMinor = -1],
  ["unsafe integer", r => r.cost.maximumMinor = Number.MAX_SAFE_INTEGER + 1],
  ["foreign permission", r => r.permissions[0].resource = "table-not-in-scope"],
  ["credential URL", r => r.workspace.host = "https://user:pass@fixture.invalid"],
  ["URL query", r => r.workspace.host = "https://fixture.invalid/?token=example"],
  ["component root", r => r.component = "."], ["harness component", r => r.component = "harness"],
]) test(`malformed request rejected before persistence: ${name}`, async t => {
  const { root, request } = await fixture(t); mutate(request); await put(root, "work/evidence/request.json", request);
  assert.notEqual(record(root).status, 0);
  assert.deepEqual(await readdir(join(root, "work/approvals/scopes")).catch(e => e.code === "ENOENT" ? [] : Promise.reject(e)), []);
});
test("unknown/duplicate/missing CLI options fail without issuing a record", async t => {
  const { root } = await fixture(t);
  for (const args of [["check", "--id", "scope-1", "--force"], ["check", "--id", "scope-1", "--id", "scope-2"], ["record", "--id"], ["check", "positional"], ["check", "--now", "2099-01-01T00:00:00Z"]]) assert.notEqual(cli(root, args).status, 0);
});
const epoch = Date.parse("2026-09-10T10:00:00Z");
const options = () => ({ id: "scope-1", session: "S-1", request: "work/evidence/request.json", actor: "fixture-owner", evidence: "work/evidence/decision.md", expires_at: new Date(epoch + 3600000).toISOString() });
test("expiry is strict at equality and does not renew on check", async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const original = await readFile(join(root, "work/approvals/scopes/scope-1.json"));
  assert.equal((await checkScope(root, options(), { now: () => epoch + 3599999 })).eligibleForReuse, true);
  assert.equal((await checkScope(root, options(), { now: () => epoch + 3600000 })).reason, "expired");
  assert.equal((await checkScope(root, options(), { now: () => epoch - 1 })).reason, "not-yet-valid");
  assert.deepEqual(await readFile(join(root, "work/approvals/scopes/scope-1.json")), original);
});
test("check clock rollback below issuedAt during reads denies reuse without changing original bytes", async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const path = join(root, "work/approvals/scopes/scope-1.json"), original = await readFile(path);
  let calls = 0;
  const result = await checkScope(root, options(), { now: () => ++calls === 1 ? epoch + 1 : epoch - 1 });
  assert.ok(calls >= 2); assert.equal(result.eligibleForReuse, false); assert.equal(result.reason, "not-yet-valid");
  assert.equal(result.executionAuthorized, false); assert.deepEqual(await readFile(path), original);
});
test("record clock rollback below its issuedAt rejects before persistence", async t => {
  const { root } = await fixture(t); let calls = 0;
  await assert.rejects(recordScope(root, options(), { now: () => ++calls === 1 ? epoch : epoch - 1 }), /not-yet-valid/);
  assert.ok(calls >= 2);
  assert.deepEqual(await readdir(join(root, "work/approvals/scopes")), []);
});
test("invalid calendar, expired and excessive approval windows reject", async t => {
  const { root } = await fixture(t);
  for (const expires_at of ["2026-02-30T00:00:00Z", "2026-09-10T10:00:00Z", "2026-10-11T10:00:00Z", "2026-09-10T11:00:00+00:00"])
    await assert.rejects(recordScope(root, { ...options(), expires_at }, { now: () => epoch }), /time|window/);
});
for (const status of ["completed", "blocked", "superseded"]) test(`origin ${status} can hand off its exact scope to active target`, async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const path = "work/sessions/S-1.md";
  await put(root, path, (await readFile(join(root, path), "utf8")).replace("status: active", `status: ${status}`));
  const checked = await checkScope(root, { ...options(), session: "S-2" }, { now: () => epoch + 1 });
  assert.equal(checked.eligibleForReuse, true);
  assert.equal((await checkScope(root, options(), { now: () => epoch + 1 })).eligibleForReuse, false);
});
test("session progress is not scope; pending gate remains a separate decision", async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const path = "work/sessions/S-2.md";
  await put(root, path, (await readFile(join(root, path), "utf8")).replace("gate_status: approved", "gate_status: pending") + "\nProgress was updated.\n");
  const checked = await checkScope(root, { ...options(), session: "S-2" }, { now: () => epoch });
  assert.equal(checked.eligibleForReuse, true); assert.equal(checked.unresolvedGate, "product-intent"); assert.equal(checked.executionAuthorized, false);
  assert.match(await readFile(join(root, path), "utf8"), /gate_status: pending/);
});
test("harness source without product initialization cannot record product authority", async t => {
  const { root } = await fixture(t);
  await rename(join(root, "product.config.json"), join(root, "saved-product.json"));
  assert.notEqual(record(root).status, 0);
});
test("wrong or missing product context never falls back to another active session", async t => {
  const { root } = await fixture(t); assert.equal(record(root).status, 0);
  assert.equal(JSON.parse(check(root, "scope-1", "S-3").stdout).eligibleForReuse, false);
  const path = "work/sessions/S-2.md";
  await put(root, path, (await readFile(join(root, path), "utf8")).replace("docs/product/requirements/orders.md", "docs/harness/requirements/orders.md"));
  assert.equal(JSON.parse(check(root).stdout).eligibleForReuse, false);
});
for (const [name, encoded] of [
  ["top-level", r => JSON.stringify(r).replace('"environment":"dev"', '"environment":"prod","environment":"dev"')],
  ["nested", r => JSON.stringify(r).replace('"maximumMinor":100', '"maximumMinor":500,"maximumMinor":100')],
  ["escaped", r => JSON.stringify(r).replace('"environment":"dev"', '"environm\\u0065nt":"prod","environment":"dev"')],
]) test(`duplicate JSON keys rejected: ${name}`, async t => {
  const { root, request } = await fixture(t); await put(root, "work/evidence/request.json", encoded(request));
  assert.match(record(root).stderr, /duplicate-key/);
});
test("invalid UTF-8 and over-limit user evidence are rejected", async t => {
  const { root } = await fixture(t);
  await put(root, "work/evidence/decision.md", Buffer.from([0x61, 0x80])); assert.match(record(root).stderr, /utf8/);
  await put(root, "work/evidence/decision.md", "a".repeat(1024 * 1024 + 1)); assert.match(record(root).stderr, /file/);
  await put(root, "work/evidence/decision.md", "a".repeat(1024 * 1024)); assert.equal(record(root).status, 0);
});
test("hardlinked evidence and linked input ancestors are refused without record writes", async t => {
  const { root } = await fixture(t);
  await link(join(root, "work/evidence/decision.md"), join(root, "work/evidence/linked.md")); assert.match(record(root).stderr, /invalid-file/);
  await put(root, "safe/decision.md", "Fixture decision\n");
  await symlink(join(root, "safe"), join(root, "shortcut"), "junction");
  await assert.rejects(recordScope(root, { ...options(), evidence: "shortcut/decision.md" }, { now: () => epoch }), /linked-path/);
});
test("append-only lock rejects contention and keeps existing lock untouched", async t => {
  const { root } = await fixture(t); const path = "work/approvals/scopes/scope-1.json.lock";
  await put(root, path, "existing owner");
  await assert.rejects(recordScope(root, options(), { now: () => epoch }), /locked/);
  assert.equal(await readFile(join(root, path), "utf8"), "existing owner");
});
test("corrupted or mismatched revocation never re-enables approval", async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  await put(root, "work/approvals/scopes/scope-1.revocation.json", "{}");
  assert.equal((await checkScope(root, options(), { now: () => epoch + 1 })).eligibleForReuse, false);
});
test("control-code drift invalidates prior local scope without changing it", async t => {
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const path = "tools/lib/acceptance.mjs";
  await put(root, path, (await readFile(join(root, path), "utf8")) + "\n// changed\n");
  assert.equal((await checkScope(root, options(), { now: () => epoch })).reason, "context-changed");
});
test("new scope records are not legacy loop approvals", async t => {
  t.mock.method(console, "log", () => {});
  const { root } = await fixture(t); await recordScope(root, options(), { now: () => epoch });
  const state = await initLoop(root, { session: "S-1", provider: "manual" });
  await setLoopGate(root, { id: state.id, gate: "sensitive-data-or-permission-change" });
  const path = join(root, `work/loops/${state.id}.json`), before = await readFile(path);
  await assert.rejects(approveLoopGate(root, { id: state.id, evidence: "work/approvals/scopes/scope-1.json" }), /matching human approval/);
  assert.deepEqual(await readFile(path), before);
});
test("old approval JSON is not a scoped decision", async t => {
  const { root } = await fixture(t);
  await put(root, "work/approvals/scopes/scope-1.json", { schemaVersion: 1, sessionId: "S-1", gate: "product-intent", decision: "approved", actor: "owner", evidence: "work/evidence/decision.md" });
  assert.equal((await checkScope(root, options(), { now: () => epoch })).eligibleForReuse, false);
});
