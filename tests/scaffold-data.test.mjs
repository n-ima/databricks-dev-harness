import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";

import { applyScaffold, planScaffold } from "../tools/lib/scaffold.mjs";
import { exists, readJson, sha256, writeJson } from "../tools/lib/shared.mjs";

// Databricks calls are always injected fakes. Only generated, standard-library
// Python tests run as subprocesses; no warehouse, app, job or data is deployed.
async function fixture(t) {
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "harness-scaffold-data-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`));
    assert.match(root.slice(temporaryBase.length + 1), /^harness-scaffold-data-/);
    await rm(root, { recursive: true, force: true });
  });
  await writeJson(join(root, "harness/toolchain.lock.json"), { appkitTemplateVersion: "v0.69.1" });
  return root;
}

const planPath = (plan) => `work/scaffolds/${plan.id}.json`;
const success = (payload = {}) => ({ ok: true, status: 0, stdout: JSON.stringify(payload), stderr: "", error: null });
const failure = (message) => ({ ok: false, status: 1, stdout: "", stderr: message, error: null });

const dataOptions = (overrides = {}) => ({
  kind: "data-update", name: "orders", source_table: "dev_lake.bronze.order_updates",
  target_table: "dev_lake.silver.orders", key: ["tenant_id", "order_id"], sequence_by: "updated_at", ...overrides,
});

async function generatedData(t, overrides = {}) {
  const root = await fixture(t);
  const plan = await planScaffold(root, dataOptions(overrides));
  const applied = await applyScaffold(root, { plan: planPath(plan), yes: true }, {
    run() { assert.fail("Local data scaffold must not execute Databricks or Python"); },
  });
  return { root, plan, applied };
}

function pythonCommand() {
  const candidates = process.env.HARNESS_TEST_PYTHON
    ? [[process.env.HARNESS_TEST_PYTHON, []]]
    : [["python", []], ["python3", []], ["py", ["-3"]]];
  for (const [command, prefix] of candidates) {
    const result = spawnSync(command, [...prefix, "-c", "import sys; assert sys.version_info >= (3, 10)"], { encoding: "utf8", timeout: 10_000, shell: false });
    if (!result.error && result.status === 0) return { command, prefix };
  }
  assert.fail("Python 3.10+ is required to execute generated scaffold contracts (or set HARNESS_TEST_PYTHON).");
}

function runPython(root, args) {
  const { command, prefix } = pythonCommand();
  return spawnSync(command, [...prefix, ...args], {
    cwd: root, encoding: "utf8", timeout: 30_000, shell: false,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
}

test("data scaffold generates executable composite-key fixtures without running external tools", async (t) => {
  const { root, plan, applied } = await generatedData(t);
  assert.equal(plan.status, "ready");
  assert.equal(plan.deployReady, false);
  assert.equal(applied.status, "applied");
  assert.equal(applied.deployReady, false);
  assert.deepEqual(plan.contract, {
    nullKeys: "reject", nullSequence: "reject", sameSequenceConflict: "reject", staleUpdates: "reject",
    exactReplay: "no-op", deletes: "unsupported", schemaEvolution: "disabled", concurrentWriters: "exclusive target writer required",
  });
  const fixtures = await readJson(join(root, "tests/data_products/test_orders.fixtures.json"));
  assert.deepEqual(fixtures.keys, ["tenant_id", "order_id"]);
  assert.equal(fixtures.sequenceBy, "updated_at");
  assert.equal(fixtures.cases.length, 13);
  assert.ok(fixtures.cases.some((item) => item.id === "null-key-tenant_id"));
  assert.ok(fixtures.cases.some((item) => item.id === "null-key-order_id"));
  assert.ok(fixtures.cases.some((item) => item.id === "source-tie-conflict" && item.source.length === 3));
  assert.equal(applied.generatedFiles.length, 5);
  const job = await readFile(join(root, "resources/orders.job.yml"), "utf8");
  assert.match(job, /max_concurrent_runs: 1/);
  assert.doesNotMatch(job, /^\s*- --execute\s*$/m, "unapproved generated jobs must not authorize writes");
  assert.doesNotMatch(job, /schedule:|whenNotMatchedBySourceDelete/);
});

test("generated Python unittest executes real record transitions and the actual Delta builder", async (t) => {
  const { root } = await generatedData(t);
  const result = runPython(root, ["-m", "unittest", "discover", "-s", "tests/data_products", "-p", "test_orders.py", "-v"]);
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  assert.match(result.stderr, /test_executable_fixture_contracts.*ok/s);
  assert.match(result.stderr, /test_real_delta_builder_has_atomic_guards.*ok/s);
  assert.match(result.stderr, /Ran 4 tests/);
  assert.match(result.stderr, /\bOK\b/);
});

test("generated data job refuses execution without an explicit approved-write switch", async (t) => {
  const { root } = await generatedData(t);
  const result = runPython(root, ["src/data_products/orders/job.py", "--source-table", "dev.bronze.orders", "--target-table", "dev.silver.orders", "--keys", "id", "--sequence-by", "version"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No write performed/);
  assert.doesNotMatch(result.stderr, /No module named.*(?:pyspark|delta)/, "the guard must precede Spark/Delta imports");
});

test("fixture field generation remains correct when product columns collide with sample names", async (t) => {
  const { root } = await generatedData(t, { name: "collisions", key: ["payload", "unexpected_column"], sequence_by: "version" });
  const result = runPython(root, ["-m", "unittest", "discover", "-s", "tests/data_products", "-p", "test_collisions.py", "-v"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("data planning rejects ambiguous keys, unsafe names, identical tables and missing inputs", async (t) => {
  const root = await fixture(t);
  for (const override of [
    { key: ["id", "ID"] }, { key: ["__harness_rank"] }, { key: ["__HARNESS_RANK"] }, { sequence_by: "__HARNESS_RANK" }, { key: ["id;drop"] },
    { key: ["id"], sequence_by: "ID" }, { source_table: "dev.schema.table.extra" },
    { source_table: "DEV_LAKE.SILVER.ORDERS" },
  ]) await assert.rejects(planScaffold(root, dataOptions(override)));
  const plan = await planScaffold(root, dataOptions({ source_table: undefined, target_table: undefined, key: [], sequence_by: undefined }));
  assert.equal(plan.status, "needs-input");
  assert.deepEqual(plan.missing, ["source-table", "target-table", "merge-key", "sequence-by"]);
  await assert.rejects(applyScaffold(root, { plan: planPath(plan), yes: true }), /not ready/);
});

test("local generation preflights all paths and never overwrites an existing artifact", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, "resources"), { recursive: true });
  await writeFile(join(root, "resources/orders.job.yml"), "user-owned\n");
  const plan = await planScaffold(root, dataOptions());
  await assert.rejects(applyScaffold(root, { plan: planPath(plan), yes: true }), /Refusing to overwrite/);
  assert.equal(await readFile(join(root, "resources/orders.job.yml"), "utf8"), "user-owned\n");
  assert.equal(await exists(join(root, "src/data_products/orders/job.py")), false);
  assert.equal((await readJson(join(root, planPath(plan)))).status, "failed");
});

function serverManifest(rules) {
  return {
    version: "2.0", plugins: { server: { name: "server", requiredByTemplate: true, resources: { required: [], optional: [] } } },
    ...(rules ? { scaffolding: { rules } } : {}),
  };
}

async function appFixture(t, { integration = false, rules } = {}) {
  const root = await fixture(t);
  const manifest = serverManifest(rules);
  await mkdir(join(root, "work/evidence"), { recursive: true });
  await mkdir(join(root, "apps/mock-ui"), { recursive: true });
  const mockFixture = '{"orders":[{"id":1,"total":125}]}\n';
  const mockReview = "Fixture UI reviewed by product owner.\n";
  await writeFile(join(root, "apps/mock-ui/fixture.json"), mockFixture);
  await writeFile(join(root, "work/evidence/mock.md"), mockReview);
  await writeFile(join(root, "work/evidence/rules.md"), "Manifest rules reviewed; no deployment authorized.\n");
  await writeJson(join(root, "work/approvals/mock.json"), { gate: "ui-mock", decision: "approved", actor: "product-owner", evidence: "work/evidence/mock.md",
    artifactHashes: { "work/evidence/mock.md": sha256(mockReview), "apps/mock-ui/fixture.json": sha256(mockFixture) } });
  await writeJson(join(root, "work/approvals/rules.json"), { gate: "appkit-rules", decision: "approved", actor: "reviewer", evidence: "work/evidence/rules.md", manifestSha256: sha256(JSON.stringify(manifest)) });
  const options = { kind: "app", name: "fixture-app", purpose: integration ? "integration" : "mock",
    profile: "DEV", host: "https://dev.cloud.databricks.com",
    ...(integration ? { data_access: "none", mock_approval: "work/approvals/mock.json" } : {}),
    ...(rules ? { rules_approval: "work/approvals/rules.json" } : {}) };
  const calls = [];
  const run = async (command, args, execution) => {
    calls.push({ command, args, execution });
    if (args[0] === "auth" && args[1] === "profiles") return success({ profiles: [{ name: "DEV", host: options.host }] });
    if (args[0] === "auth" && args[1] === "describe") return success({ status: "success", username: "fixture-user", details: { host: options.host, auth_type: "databricks-cli" } });
    if (args[1] === "manifest") return success(manifest);
    if (args[1] === "init") {
      const output = join(root, args[args.indexOf("--output-dir") + 1]);
      await mkdir(output, { recursive: true });
      await writeJson(join(output, "package.json"), { name: "fixture-app", private: true });
      await writeFile(join(output, "databricks.yml"), "bundle:\n  name: fixture-app\n");
      return success();
    }
    if (args[1] === "validate") return success();
    assert.fail(`Unexpected external command: ${command} ${args.join(" ")}`);
  };
  return { root, manifest, options, calls, run };
}

test("AppKit mock requires an explicit verified workspace but no prior UI approval or data resources", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, context.options, context);
  assert.equal(plan.status, "ready");
  assert.equal(plan.mockApproval, null);
  assert.equal(plan.dataAccess, "none");
  assert.equal(plan.deployReady, false);
  assert.equal(plan.nonDeployable, true);
  assert.deepEqual(plan.selectedFeatures, ["server"]);
  await applyScaffold(context.root, { plan: planPath(plan), yes: true }, context);
  assert.equal(await exists(join(context.root, "apps/fixture-app/databricks.yml")), false);
  assert.equal(await exists(join(context.root, "apps/fixture-app/databricks.fixture-only.yml")), true);
  const init = context.calls.find((item) => item.args[0] === "apps" && item.args[1] === "init");
  assert.equal(init.args[init.args.indexOf("--profile") + 1], "DEV");
  assert.equal(init.args.includes("--deploy"), false);
  assert.equal(init.args.includes("--features"), false);
  assert.equal(init.args.includes("--set"), false);
  assert.equal(init.args.includes("--auto-approve"), false);
  assert.deepEqual(context.calls.filter((item) => item.args[0] === "auth").map((item) => item.args[1]), ["profiles", "describe", "profiles", "describe"]);
  const unselected = await planScaffold(context.root, { ...context.options, profile: undefined, host: undefined }, context);
  assert.equal(unselected.status, "needs-input");
  assert.ok(unselected.missing.includes("profile") && unselected.missing.includes("host"));
  const callsBefore = context.calls.length;
  await assert.rejects(applyScaffold(context.root, { plan: planPath(unselected), yes: true }, context), /not ready/);
  // Simulate a correctly sealed pre-fix plan; it must not regain init authority.
  const { integrityHash: oldHash, ...legacy } = unselected;
  legacy.status = "ready";
  legacy.integrityHash = sha256(JSON.stringify(legacy));
  legacy.missing = [];
  delete legacy.integrityHash;
  legacy.integrityHash = sha256(JSON.stringify(legacy));
  await writeJson(join(context.root, planPath(unselected)), legacy);
  await assert.rejects(applyScaffold(context.root, { plan: planPath(unselected), yes: true }, context), /explicitly verified development profile/);
  assert.equal(context.calls.length, callsBefore);
  assert.equal((await readJson(join(context.root, planPath(unselected)))).status, "needs-replan");
});

test("mock AppKit plans reject profiles and mandatory or optional live-data plugins", async (t) => {
  const context = await appFixture(t);
  await assert.rejects(planScaffold(context.root, { ...context.options, profile: "DEFAULT" }, context), /not DEFAULT/);
  assert.equal(context.calls.length, 0);
  await assert.rejects(planScaffold(context.root, { ...context.options, target: "prod" }, context), /only --target dev/);
  context.manifest.plugins.analytics = { name: "analytics", requiredByTemplate: true, resources: { required: [], optional: [] } };
  await assert.rejects(planScaffold(context.root, context.options, context), /mandatory server plugin/);
  context.manifest.plugins.analytics.requiredByTemplate = false;
  await assert.rejects(planScaffold(context.root, { ...context.options, feature: "analytics" }, context), /mandatory server plugin/);
  await assert.rejects(planScaffold(context.root, { ...context.options, set: "server.any.id=x" }, context), /no data plugins or resource assignments/);
});

test("AppKit validates the selected profile host before authentication and rechecks before init", async (t) => {
  const context = await appFixture(t);
  const wrongHostCalls = [];
  const wrongHost = async (command, args, execution) => {
    wrongHostCalls.push(args);
    if (args[0] === "auth" && args[1] === "profiles") return success({ profiles: [{ name: "DEV", host: "https://unexpected.cloud.databricks.com" }] });
    if (args[0] === "auth") assert.fail("Host mismatch must stop before any workspace authentication");
    return context.run(command, args, execution);
  };
  await assert.rejects(planScaffold(context.root, context.options, { run: wrongHost }), /does not match/);
  assert.ok(wrongHostCalls.some((args) => args.includes("--skip-validate")));
  const authFailure = async (command, args, execution) => args[0] === "auth" && args[1] === "describe"
    ? success({ status: "error", username: "stale-user", details: { host: context.options.host } })
    : context.run(command, args, execution);
  await assert.rejects(planScaffold(context.root, context.options, { run: authFailure }), /did not verify/);
  const plan = await planScaffold(context.root, context.options, context);
  await assert.rejects(applyScaffold(context.root, { plan: planPath(plan), yes: true }, { run: wrongHost }), /does not match/);
  const failed = await readJson(join(context.root, planPath(plan)));
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureStage, "workspace-auth");
  assert.equal(await exists(join(context.root, "apps/fixture-app")), false);
});

test("AppKit commands cannot inherit custom template overrides or resource-validation bypasses", async (t) => {
  const previous = process.env.DATABRICKS_APPKIT_TEMPLATE_PATH;
  const previousAgentic = process.env.DATABRICKS_APPS_AGENTIC_MODE;
  const previousCloudSecret = process.env.ARM_CLIENT_SECRET;
  process.env.DATABRICKS_APPKIT_TEMPLATE_PATH = "unreviewed-custom-template";
  process.env.DATABRICKS_APPS_AGENTIC_MODE = "true";
  process.env.ARM_CLIENT_SECRET = "unused-fixture-sentinel";
  t.after(() => {
    if (previous === undefined) delete process.env.DATABRICKS_APPKIT_TEMPLATE_PATH;
    else process.env.DATABRICKS_APPKIT_TEMPLATE_PATH = previous;
    if (previousAgentic === undefined) delete process.env.DATABRICKS_APPS_AGENTIC_MODE;
    else process.env.DATABRICKS_APPS_AGENTIC_MODE = previousAgentic;
    if (previousCloudSecret === undefined) delete process.env.ARM_CLIENT_SECRET;
    else process.env.ARM_CLIENT_SECRET = previousCloudSecret;
  });
  for (const integration of [false, true]) {
    const context = await appFixture(t, { integration });
    const plan = await planScaffold(context.root, context.options, context);
    await applyScaffold(context.root, { plan: planPath(plan), yes: true }, context);
    for (const call of context.calls) {
      assert.equal(call.execution.env.DATABRICKS_APPKIT_TEMPLATE_PATH, undefined);
      assert.equal(call.execution.env.DATABRICKS_APPS_AGENTIC_MODE, undefined);
      assert.equal(call.execution.env.ARM_CLIENT_SECRET, undefined);
      assert.equal(Object.keys(call.execution.env).some((key) => /^DATABRICKS_/i.test(key) && key !== "DATABRICKS_CONFIG_FILE"), false);
    }
  }
});

test("AppKit auto-approve is plan-time opt-in and nested integration bundles remain intact", async (t) => {
  const context = await appFixture(t, { integration: true });
  const plan = await planScaffold(context.root, { ...context.options, auto_approve: true }, context);
  assert.equal(plan.status, "ready");
  assert.equal(plan.command.filter((arg) => arg === "--auto-approve").length, 1);
  const applied = await applyScaffold(context.root, { plan: planPath(plan), yes: true }, context);
  assert.equal(applied.bundleTopology, "nested-component-bundle");
  assert.equal(await exists(join(context.root, "apps/fixture-app/databricks.yml")), true);
  assert.equal(await exists(join(context.root, "databricks.yml")), false);
  assert.equal(context.calls.find((item) => item.args[1] === "init").args.filter((arg) => arg === "--auto-approve").length, 1);
});

test("AppKit success remains a starter with pending after-init MUST rules, not deploy-ready", async (t) => {
  const context = await appFixture(t, { integration: true, rules: { must: ["After init, configure the plugin contract"], never: ["Deploy without approval"] } });
  const plan = await planScaffold(context.root, context.options, context);
  const applied = await applyScaffold(context.root, { plan: planPath(plan), yes: true }, context);
  assert.equal(applied.validation.status, "passed");
  assert.deepEqual(applied.pendingRules, [plan.rules.find((item) => item.phase === "after-init").id]);
  assert.equal(applied.deployReady, false);
  assert.ok(applied.remainingWork.length);
});

test("AppKit refuses changed plans and changed approval evidence before invoking init", async (t) => {
  const context = await appFixture(t, { integration: true });
  const plan = await planScaffold(context.root, context.options, context);
  const changed = await readJson(join(context.root, planPath(plan)));
  changed.command = ["databricks", "apps", "deploy", "--target", "prod"];
  await writeJson(join(context.root, planPath(plan)), changed);
  await assert.rejects(applyScaffold(context.root, { plan: planPath(plan), yes: true }, context), /changed after planning/);
  assert.equal(context.calls.filter((item) => item.args[0] === "apps").length, 1);
  const fresh = await planScaffold(context.root, context.options, context);
  await writeFile(join(context.root, "work/evidence/mock.md"), "Approval artifact changed after planning.\n");
  await assert.rejects(applyScaffold(context.root, { plan: planPath(fresh), yes: true }, context), /evidence changed/);
  assert.equal(context.calls.filter((item) => item.args[0] === "apps").length, 2);
});

test("AppKit integration binds the reviewed mock and rechecks its hashes before init", async (t) => {
  const context = await appFixture(t, { integration: true });
  const plan = await planScaffold(context.root, context.options, context);
  assert.equal(plan.status, "ready");
  assert.ok(plan.evidenceFiles.some((item) => item.path === "apps/mock-ui/fixture.json"));
  await writeFile(join(context.root, "apps/mock-ui/fixture.json"), '{"orders":[]}\n');
  const stale = await planScaffold(context.root, context.options, context);
  assert.equal(stale.status, "needs-input");
  assert.ok(stale.missing.includes("stale-approval-artifact:apps/mock-ui/fixture.json"));
  const before = context.calls.length;
  await assert.rejects(applyScaffold(context.root, { plan: planPath(plan), yes: true }, context), /evidence changed/);
  assert.equal(context.calls.length, before, "a changed approved mock must not invoke init");
  assert.equal((await readJson(join(context.root, planPath(plan)))).status, "needs-replan");
  const receipt = await readJson(join(context.root, "work/approvals/mock.json"));
  delete receipt.artifactHashes;
  await writeJson(join(context.root, "work/approvals/mock.json"), receipt);
  const unbound = await planScaffold(context.root, context.options, context);
  assert.ok(unbound.missing.includes("approval-artifact-hashes:ui-mock"));
  receipt.artifactHashes = { "work/evidence/mock.md": sha256(await readFile(join(context.root, "work/evidence/mock.md"))) };
  await writeJson(join(context.root, "work/approvals/mock.json"), receipt);
  const reviewOnly = await planScaffold(context.root, context.options, context);
  assert.ok(reviewOnly.missing.includes("approval-executable-mock-hash:ui-mock"));
});

test("AppKit init failure and post-init validation failure persist distinct failed states", async (t) => {
  const context = await appFixture(t, { integration: true });
  const plan = await planScaffold(context.root, context.options, context);
  await assert.rejects(applyScaffold(context.root, { plan: planPath(plan), yes: true }, { run: (command, args, execution) => args[0] === "apps" && args[1] === "init" ? failure("token=secret-value init failed") : context.run(command, args, execution) }), /init failed/);
  const failed = await readJson(join(context.root, planPath(plan)));
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureStage, "init");
  assert.match(failed.failure, /\[REDACTED\]/);
  assert.doesNotMatch(failed.failure, /secret-value/);
  const next = await planScaffold(context.root, context.options, context);
  const run = async (command, args, execution) => args[1] === "validate" ? failure("typecheck failed") : context.run(command, args, execution);
  await assert.rejects(applyScaffold(context.root, { plan: planPath(next), yes: true }, { run }), /validation failed/);
  const invalid = await readJson(join(context.root, planPath(next)));
  assert.equal(invalid.status, "failed");
  assert.equal(invalid.failureStage, "validate");
  assert.equal(invalid.validation.status, "failed");
  assert.deepEqual(invalid.generatedFiles, ["apps/fixture-app"]);
  assert.equal(await exists(join(context.root, "apps/fixture-app/package.json")), true);
});

test("local AppKit manifest provenance must bind the exact pinned version", async (t) => {
  const context = await appFixture(t, { integration: true });
  await writeJson(join(context.root, "manifest.json"), context.manifest);
  await assert.rejects(planScaffold(context.root, { ...context.options, manifest_file: "manifest.json" }, context), /manifest-template-version/);
  const plan = await planScaffold(context.root, { ...context.options, manifest_file: "manifest.json", manifest_template_version: "v0.69.1" }, context);
  assert.equal(plan.status, "ready");
  assert.equal(plan.manifestSource.version, "v0.69.1");
  assert.equal(context.calls.filter((item) => item.args[0] === "apps").length, 0, "local manifests must not invoke apps manifest");
  const callsBefore = context.calls.length;
  await writeJson(join(context.root, "manifest.json"), { ...context.manifest, version: "changed" });
  await assert.rejects(applyScaffold(context.root, { plan: planPath(plan), yes: true }, context), /evidence changed/);
  assert.equal((await readJson(join(context.root, planPath(plan)))).status, "needs-replan");
  assert.equal(context.calls.length, callsBefore);
});

test("Genie and metric scaffolds are explicit drafts, outside automatic deployment paths", async (t) => {
  const root = await fixture(t);
  const noExternal = { run() { assert.fail("Draft generators must not execute external commands"); } };
  const genie = await planScaffold(root, { kind: "genie", name: "sales-genie", table: ["dev.sales.orders"], question: ["売上は?", "地域別は?", "昨年比は?"] }, noExternal);
  assert.equal(genie.status, "draft-ready");
  const generatedGenie = await applyScaffold(root, { plan: planPath(genie), yes: true }, noExternal);
  assert.equal(generatedGenie.status, "draft-generated");
  assert.equal(generatedGenie.deployReady, false);
  assert.equal(await exists(join(root, "resources/sales-genie.genie_space.yml")), false);
  assert.equal(await exists(join(root, "resources/drafts/sales-genie.genie_space.yml")), true);
  const benchmark = await readJson(join(root, "tests/genie/sales-genie.benchmark.json"));
  assert.equal(benchmark.status, "draft");
  assert.equal(benchmark.deployReady, false);
  const metric = await planScaffold(root, { kind: "metric-view", name: "sales-metrics", source_table: "dev.sales.orders", dimension: ["Region=region"], measure: ["Revenue=SUM(amount)"] }, noExternal);
  assert.equal(metric.status, "draft-ready");
  const generatedMetric = await applyScaffold(root, { plan: planPath(metric), yes: true }, noExternal);
  assert.equal(generatedMetric.status, "draft-generated");
  assert.equal(await exists(join(root, "src/metrics/sales-metrics.apply.sql")), false);
  assert.match(await readFile(join(root, "src/metrics/sales-metrics.draft.sql"), "utf8"), /DRAFT ONLY/);
  assert.match(await readFile(join(root, "src/metrics/sales-metrics.metric.yml"), "utf8"), /expr: "SUM\(amount\)"/);
  await assert.rejects(planScaffold(root, { kind: "metric-view", name: "invalid", source_table: "dev.sales.orders", dimension: ["Region=region"], measure: ["Revenue=SUM(amount); DROP TABLE x"] }), /one SQL expression/);
});

for (const samePlan of [true, false]) {
  test(`AppKit parallel apply locks ${samePlan ? "the same plan" : "different plans sharing the output"}`, async (t) => {
    const context = await appFixture(t);
    const first = await planScaffold(context.root, context.options, context);
    const second = samePlan ? first : await planScaffold(context.root, context.options, context);
    let notifyInit, releaseInit;
    const reachedInit = new Promise((resolve) => { notifyInit = resolve; });
    const holdInit = new Promise((resolve) => { releaseInit = resolve; });
    let initCalls = 0;
    const run = async (command, args, execution) => {
      if (args[0] === "apps" && args[1] === "init") {
        initCalls++;
        notifyInit();
        await holdInit;
      }
      return context.run(command, args, execution);
    };
    const running = applyScaffold(context.root, { plan: planPath(first), yes: true }, { run });
    try {
      await reachedInit;
      await assert.rejects(applyScaffold(context.root, { plan: planPath(second), yes: true }, { run }), /lock|Another/i);
    } finally { releaseInit(); }
    assert.equal((await running).status, "applied");
    assert.equal(initCalls, 1);
    if (!samePlan) assert.equal((await readJson(join(context.root, planPath(second)))).status, "ready");
    await assert.rejects(applyScaffold(context.root, { plan: planPath(second), yes: true }, context), samePlan ? /not ready/ : /already exists/);
  });
}
