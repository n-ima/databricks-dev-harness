import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { connectDatabricks, doctorDatabricks, listProfiles } from "../tools/lib/databricks.mjs";
import { exists, readJson, writeJson } from "../tools/lib/shared.mjs";

const DEV = "https://dev.example.cloud.databricks.com";
const OTHER = "https://other.example.cloud.databricks.com";
const success = (payload) => ({ ok: true, status: 0, stdout: JSON.stringify(payload), stderr: "" });

async function fixture(t) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, "harness-identity-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${base}${sep}`) && root.slice(base.length + 1).startsWith("harness-identity-"));
    await rm(root, { recursive: true, force: true });
  });
  await writeJson(join(root, "harness.config.json"), { harnessVersion: "identity-test" });
  await writeJson(join(root, "vendor/databricks-skills.lock.json"), { pinned: true });
  return root;
}

function envValue(t, key, value) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

function runner(overrides = {}) {
  const calls = [];
  const run = (command, args, execution) => {
    calls.push({ command, args, execution });
    const key = args.slice(0, 2).join(" ");
    if (Object.hasOwn(overrides, key)) return overrides[key];
    if (args[0] === "-v") return { ...success({}), stdout: "Databricks CLI v1.6.0" };
    if (args[0] === "--version") return { ...success({}), stdout: `${command} 3.0.0` };
    if (key === "auth profiles") return success({ profiles: [{ name: "DEV", host: DEV }, { name: "OTHER", host: OTHER }] });
    if (key === "auth describe") return success({ status: "success", details: { host: DEV, auth_type: "databricks-cli" } });
    if (key === "current-user me") return success({ userName: "selected-user@example.invalid", active: true });
    if (key === "bundle validate") return success({});
    assert.fail(`Unexpected external operation: ${command} ${args.join(" ")}`);
  };
  return { run, calls };
}

async function doctor(root, options, fake) {
  const previous = process.exitCode;
  try { return await doctorDatabricks(root, options, fake); }
  finally { process.exitCode = previous; }
}

test("profile inventory never validates credentials and sanitizes overrides without reading their values", (t) => {
  envValue(t, "DATABRICKS_CLIENT_SECRET", "not-a-real-secret");
  envValue(t, "DATABRICKS_CONFIG_FILE", "explicit-fixture-config");
  envValue(t, "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "not-a-real-token");
  const fake = runner();
  const profiles = listProfiles({}, fake);
  assert.equal(profiles.length, 2);
  assert.deepEqual(fake.calls[0].args, ["auth", "profiles", "--skip-validate", "-o", "json"]);
  assert.equal(fake.calls[0].execution.env.DATABRICKS_CLIENT_SECRET, undefined);
  assert.equal(fake.calls[0].execution.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, undefined);
  assert.equal(fake.calls[0].execution.env.DATABRICKS_CONFIG_FILE, "explicit-fixture-config");
  assert.equal(fake.calls.length, 1);
});

test("connect accepts unvalidated inventory and authenticates only the explicitly selected profile", async (t) => {
  const root = await fixture(t);
  const fake = runner();
  const connected = await connectDatabricks(root, { profile: "DEV", host: DEV }, fake);
  assert.equal(connected.host, DEV);
  assert.deepEqual(fake.calls.map((call) => call.args.slice(0, 2).join(" ")), ["auth profiles", "auth describe", "current-user me"]);
  for (const call of fake.calls.slice(1)) assert.equal(call.args[call.args.indexOf("--profile") + 1], "DEV");
  assert.ok(fake.calls[0].args.includes("--skip-validate"));
  assert.equal((await readJson(join(root, ".harness/local.json"))).profile, "DEV");
});

test("explicit profile connection refuses expanded credential precedence before any CLI operation", async (t) => {
  const root = await fixture(t);
  for (const name of ["DATABRICKS_CLIENT_ID", "DATABRICKS_CLIENT_SECRET", "DATABRICKS_AUTH_TYPE", "DATABRICKS_ACCOUNT_ID", "DATABRICKS_WORKSPACE_ID", "DATABRICKS_OIDC_TOKEN_ENV", "DATABRICKS_OIDC_TOKEN", "ARM_CLIENT_SECRET", "GOOGLE_APPLICATION_CREDENTIALS", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) {
    const previous = process.env[name];
    process.env[name] = "SENSITIVE_SENTINEL";
    try {
      const fake = runner();
      await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV }, fake), (error) => {
        assert.ok(error.message.includes(name));
        assert.ok(!error.message.includes("SENSITIVE_SENTINEL"));
        return true;
      });
      assert.equal(fake.calls.length, 0);
    } finally { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; }
  }
  assert.equal(await exists(join(root, ".harness/local.json")), false);
});

test("connect rejects auth host drift after profile inventory before identity lookup or persistence", async (t) => {
  const root = await fixture(t);
  const fake = runner({ "auth describe": success({ status: "success", details: { host: OTHER, auth_type: "databricks-cli" } }) });
  await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV }, fake), /unexpected workspace host/);
  assert.equal(fake.calls.some((call) => call.args[0] === "current-user"), false);
  assert.equal(await exists(join(root, ".harness/local.json")), false);
});

test("doctor rejects credential overrides and never starts a selected-profile authentication", async (t) => {
  const root = await fixture(t);
  envValue(t, "DATABRICKS_OIDC_TOKEN_FILEPATH", "sensitive-fixture-path");
  const fake = runner();
  const report = await doctor(root, { profile: "DEV" }, fake);
  assert.equal(report.checks.find((item) => item.id === "credential-precedence").status, "fail");
  assert.equal(fake.calls.some((call) => call.args[0] === "auth"), false);
  assert.ok(!JSON.stringify(report).includes("sensitive-fixture-path"));
});

test("doctor enforces CLI >= 1.6.0 and < 2.0.0 before workspace operations", async (t) => {
  const root = await fixture(t);
  for (const version of ["1.5.9", "2.0.0", "3.0.1"]) {
    const fake = runner({ "-v": { ...success({}), stdout: `Databricks CLI v${version}` } });
    const report = await doctor(root, { profile: "DEV" }, fake);
    const check = report.checks.find((item) => item.id === "databricks-cli");
    assert.equal(check.status, "fail");
    assert.match(check.detail, />= 1\.6\.0 < 2\.0\.0/);
    assert.equal(fake.calls.some((call) => call.args[0] === "auth"), false);
  }
});

test("doctor without a profile only inventories unvalidated profiles and never chooses one", async (t) => {
  const root = await fixture(t);
  const fake = runner();
  const report = await doctor(root, {}, fake);
  assert.equal(report.selectedProfile, null);
  assert.deepEqual(fake.calls.filter((call) => call.args[0] === "auth").map((call) => call.args[1]), ["profiles"]);
  assert.ok(fake.calls.find((call) => call.args[1] === "profiles").args.includes("--skip-validate"));
  assert.match(report.checks.find((item) => item.id === "profile-selection").detail, /not authenticated/);
});

test("doctor does not trust stale inventory valid flags and fails closed on error JSON", async (t) => {
  const root = await fixture(t);
  const stale = runner({ "auth profiles": success({ profiles: [{ name: "DEV", host: DEV, valid: false }] }) });
  const passed = await doctor(root, { profile: "DEV" }, stale);
  assert.equal(passed.checks.find((item) => item.id === "workspace-reachability").status, "pass");
  const invalid = runner({ "auth describe": success({ status: "error", details: { host: DEV } }) });
  const failed = await doctor(root, { profile: "DEV" }, invalid);
  assert.equal(failed.checks.find((item) => item.id === "databricks-online").status, "fail");
  assert.equal(invalid.calls.some((call) => call.args[0] === "current-user"), false);
});
