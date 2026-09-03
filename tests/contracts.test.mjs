import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";

import { connectDatabricks, doctorDatabricks } from "../tools/lib/databricks.mjs";
import { acceptanceIds } from "../tools/lib/evidence.mjs";
import { answerIntake, approveIntake, createIntake } from "../tools/lib/intake.mjs";
import { initLoop, recordLoop, runLoopIteration, setLoopGate, stopLoop } from "../tools/lib/loop.mjs";
import { applyScaffold, planScaffold } from "../tools/lib/scaffold.mjs";
import { exists, parseFrontmatter, parseOptions, pathInside, readJson, sha256, writeJson } from "../tools/lib/shared.mjs";

const DEV_HOST = "https://dev.example.cloud.databricks.com";
const OTHER_HOST = "https://other.example.cloud.databricks.com";

// These tests never run Databricks, an agent, or a project deployment. Every
// writable path is below a fresh mkdtemp directory; injected commands are fakes.
async function fixture(t, files = {}) {
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "databricks-harness-contract-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`), "cleanup must remain below the allocated temporary directory");
    await rm(root, { recursive: true, force: true });
  });
  for (const [relativePath, content] of Object.entries(files)) {
    const path = pathInside(root, relativePath, "test fixture");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
  }
  return root;
}

function commandSuccess(payload = {}) {
  return { ok: true, status: 0, signal: null, stdout: JSON.stringify(payload), stderr: "", error: null };
}

function commandFailure(message = "simulated failure") {
  return { ok: false, status: 1, signal: null, stdout: "", stderr: message, error: null };
}

function databricksRunner(overrides = {}) {
  const calls = [];
  const defaults = {
    "auth login": commandSuccess(),
    "auth profiles": commandSuccess({ profiles: [{ name: "DEV", host: DEV_HOST, valid: true }] }),
    "auth describe": commandSuccess({ status: "success", details: { host: DEV_HOST, auth_type: "databricks-cli" } }),
    "current-user me": commandSuccess({ userName: "developer@example.invalid", displayName: "Contract Developer", active: true }),
    "bundle validate": commandSuccess(),
    "catalogs get": commandSuccess(),
    "schemas get": commandSuccess(),
    "warehouses get": commandSuccess(),
  };
  const run = (command, args, options = {}) => {
    calls.push({ command, args: [...args], cwd: options.cwd, timeout: options.timeout, stdio: options.stdio });
    if (args.length === 1 && args[0] === "--version") {
      return { ...commandSuccess(), stdout: `${command} version 2.1.0` };
    }
    if (command === "databricks" && args.length === 1 && args[0] === "-v") {
      return { ...commandSuccess(), stdout: "Databricks CLI v1.6.0" };
    }
    const key = args.slice(0, 2).join(" ");
    const response = Object.hasOwn(overrides, key) ? overrides[key] : defaults[key];
    assert.ok(response, `unexpected external command: ${command} ${args.join(" ")}`);
    return typeof response === "function" ? response({ command, args, options }) : response;
  };
  return { run, calls };
}

async function doctorWithoutProcessExit(root, options, dependencies) {
  const originalExitCode = process.exitCode;
  try {
    return await doctorDatabricks(root, options, dependencies);
  } finally {
    process.exitCode = originalExitCode;
  }
}

test("shared option parsing preserves repeated assignments and rejects escaping paths", async (t) => {
  const root = await fixture(t);
  assert.deepEqual(parseOptions(["tail", "--set", "a=1", "--set=b=2", "--yes"]), {
    _: ["tail"], set: ["a=1", "b=2"], yes: true,
  });
  assert.equal(pathInside(root, "docs/product/requirement.md"), join(root, "docs", "product", "requirement.md"));
  assert.throws(() => pathInside(root, "../outside.md"), /inside the repository/);
});

test("Harness requirements expose all 20 stable acceptance IDs to the completion verifier", async () => {
  const requirement = await readFile(new URL("../docs/harness/requirements/HARNESS.md", import.meta.url), "utf8");
  assert.deepEqual(acceptanceIds(requirement), Array.from({ length: 20 }, (_, index) => `H-${String(index + 1).padStart(2, "0")}`));
});

test("Databricks connect rejects a profile/host mismatch before identity lookup or persistence", async (t) => {
  const root = await fixture(t);
  const fake = databricksRunner({ "auth profiles": commandSuccess({ profiles: [{ name: "DEV", host: OTHER_HOST, valid: true }] }) });
  await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV_HOST }, fake), /points to .*not/);
  assert.deepEqual(fake.calls.map((item) => item.args.slice(0, 2).join(" ")), ["auth profiles"]);
  assert.equal(await exists(join(root, ".harness", "local.json")), false);
});

test("Databricks connect rejects malformed auth JSON without recording a verified connection", async (t) => {
  const root = await fixture(t);
  const fake = databricksRunner({ "auth describe": { ...commandSuccess(), stdout: "not-json" } });
  await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV_HOST }, fake), /auth describe returned invalid JSON/);
  assert.equal(fake.calls.some((item) => item.args[0] === "current-user"), false);
  assert.equal(await exists(join(root, ".harness", "local.json")), false);
});

test("Databricks connect rejects auth JSON reporting an error even when the process exited zero", async (t) => {
  const root = await fixture(t);
  const fake = databricksRunner({ "auth describe": commandSuccess({ status: "error", message: "expired" }) });
  await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV_HOST }, fake), /Authentication check failed/);
  assert.equal(await exists(join(root, ".harness", "local.json")), false);
});

test("Databricks connect requires a host on the selected profile to prove workspace identity", async (t) => {
  const root = await fixture(t);
  const fake = databricksRunner({ "auth profiles": commandSuccess({ profiles: [{ name: "DEV", valid: true }] }) });
  await assert.rejects(connectDatabricks(root, { profile: "DEV", host: DEV_HOST }, fake), /host|workspace/i);
  assert.equal(await exists(join(root, ".harness", "local.json")), false);
});

test("Databricks connect persists only non-secret verified connection metadata", async (t) => {
  const root = await fixture(t);
  const sentinel = "CONTRACT_SECRET_MUST_NOT_BE_PERSISTED";
  const fake = databricksRunner({ "auth describe": commandSuccess({ status: "success", token: sentinel, details: { host: DEV_HOST, auth_type: "oauth-u2m", client_secret: sentinel } }) });
  const connected = await connectDatabricks(root, { profile: "DEV", host: `${DEV_HOST}/`, auth: true }, fake);
  const local = await readJson(join(root, ".harness", "local.json"));
  assert.equal(connected.host, DEV_HOST);
  assert.equal(local.profile, "DEV");
  assert.equal(local.host, DEV_HOST);
  assert.equal(local.authType, "oauth-u2m");
  assert.ok(local.verifiedAt);
  assert.doesNotMatch(JSON.stringify({ local, connected }), new RegExp(sentinel));
  for (const call of fake.calls.filter((item) => item.args[0] !== "auth" || item.args[1] !== "profiles")) {
    const index = call.args.indexOf("--profile");
    assert.equal(call.args[index + 1], "DEV");
  }
});

test("Databricks doctor detects project/profile host mismatch and does not validate the wrong workspace", async (t) => {
  const root = await fixture(t, {
    "harness.config.json": { harnessVersion: "test" },
    "vendor/databricks-skills.lock.json": { resolvedVersion: "test" },
    ".harness/local.json": { profile: "DEV", host: OTHER_HOST },
    "databricks.yml": "bundle:\n  name: contract-test\n",
  });
  const fake = databricksRunner();
  const report = await doctorWithoutProcessExit(root, { profile: "DEV", strict: true }, fake);
  assert.ok(report.checks.some((item) => item.id === "databricks-online" && item.status === "fail" && /differs/.test(item.detail)));
  assert.equal(fake.calls.some((item) => item.args[0] === "bundle"), false);
});

test("Databricks doctor uses strict Bundle validation with the explicitly selected profile and target", async (t) => {
  const root = await fixture(t, {
    "harness.config.json": { harnessVersion: "test" },
    "vendor/databricks-skills.lock.json": { resolvedVersion: "test" },
    "databricks.yml": "bundle:\n  name: contract-test\n",
  });
  const fake = databricksRunner();
  const report = await doctorWithoutProcessExit(root, { profile: "DEV", target: "test", strict: true }, fake);
  const validation = fake.calls.find((item) => item.args[0] === "bundle");
  assert.deepEqual(validation.args, ["bundle", "validate", "--strict", "-t", "test", "--profile", "DEV"]);
  assert.equal(validation.timeout, 120_000);
  assert.equal(report.checks.find((item) => item.id === "bundle-validate").status, "pass");
});

function appManifest() {
  return {
    version: "v0.69.1",
    scaffolding: { rules: { must: ["before init, review the selected resources"], should: ["Use an accessible layout"], never: ["Expose credentials in the browser"] } },
    plugins: {
      core: {
        requiredByTemplate: true,
        resources: { required: [{ resourceKey: "identity", type: "identity", fields: { platformId: { origin: "platform" }, localHint: { localOnly: true }, mode: { value: "managed" } } }] },
        scaffolding: { rules: { must: ["after init, validate the application"] } },
      },
      analytics: {
        requiredByTemplate: false,
        resources: {
          required: [{ resourceKey: "warehouse", type: "sql-warehouse", permission: "CAN_USE", fields: { id: { description: "Development warehouse" }, platformId: { origin: "platform" }, localHint: { localOnly: true }, mode: { value: "read-only" } } }],
          optional: [{ resourceKey: "cache", type: "volume", fields: { id: { description: "Optional cache" } } }],
        },
        scaffolding: { rules: { must: ["Use parameterized SQL"], should: ["Show data freshness"] } },
      },
      genie: { requiredByTemplate: false, scaffolding: { rules: { must: ["Display verified answer sources"] } } },
    },
  };
}

function appAuthResponse(args) {
  if (args[0] !== "auth") return null;
  if (args[1] === "profiles") {
    assert.ok(args.includes("--skip-validate"), "Do not authenticate unselected profiles during inventory");
    return commandSuccess({ profiles: [{ name: "DEV", host: DEV_HOST, valid: true }] });
  }
  assert.equal(args[1], "describe", "AppKit may only inspect authentication, never log in implicitly");
  assert.equal(args[args.indexOf("--profile") + 1], "DEV");
  return commandSuccess({ status: "success", username: "developer@example.invalid", details: { host: DEV_HOST, auth_type: "databricks-cli", configuration: { profile: { value: "DEV" } } } });
}

async function appFixture(t, manifest = appManifest()) {
  const beforeRule = manifest.scaffolding.rules.must.find((text) => /^before init\b/i.test(text));
  const ruleId = `template-${sha256(`must:${beforeRule}`).slice(0, 12)}`;
  const mockReview = "Fixture-backed mock reviewed by the product owner.\n";
  const mockFixture = "{\"orders\":[{\"id\":1,\"amount\":125}]}\n";
  const root = await fixture(t, {
    "harness/toolchain.lock.json": { appkitTemplateVersion: "v0.69.1" },
    "work/evidence/mock.md": mockReview,
    "apps/approved-mock/fixture.json": mockFixture,
    "work/evidence/rules.md": "Selected manifest rules and resource scope reviewed.\n",
    "work/approvals/mock.json": { gate: "ui-mock", decision: "approved", actor: "product-owner", evidence: "work/evidence/mock.md", artifactHashes: {
      "work/evidence/mock.md": sha256(mockReview),
      "apps/approved-mock/fixture.json": sha256(mockFixture),
    } },
    "work/approvals/rules.json": { gate: "appkit-rules", decision: "approved", actor: "engineer", evidence: "work/evidence/rules.md", manifestSha256: sha256(JSON.stringify(manifest)) },
    "work/evidence/before-init.json": { ruleId, status: "passed", summary: "Selected development resources were reviewed.", verifiedAt: new Date().toISOString() },
  });
  const calls = [];
  const run = (command, args, options = {}) => {
    calls.push({ command, args: [...args], cwd: options.cwd, timeout: options.timeout });
    assert.equal(command, "databricks");
    const auth = appAuthResponse(args);
    if (auth) return auth;
    assert.deepEqual(args.slice(0, 2), ["apps", "manifest"]);
    return { ...commandSuccess(), stdout: `AppKit manifest\n${JSON.stringify(manifest)}` };
  };
  return { root, run, calls, ruleId };
}

function appOptions(overrides = {}) {
  return {
    kind: "app", name: "sales-app", profile: "DEV", host: DEV_HOST, feature: ["analytics"],
    set: ["analytics.warehouse.id=dev-warehouse"], mock_approval: "work/approvals/mock.json",
    rules_approval: "work/approvals/rules.json",
    rule_evidence: [`template-${sha256("must:before init, review the selected resources").slice(0, 12)}=work/evidence/before-init.json`],
    data_access: "analytics", ...overrides,
  };
}

test("AppKit manifest contracts preserve required plugins, optional selection, resource origins, and scoped rules", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, appOptions(), context);
  assert.equal(plan.status, "ready");
  assert.deepEqual(plan.mandatoryFeatures, ["core"]);
  assert.deepEqual(plan.features, ["analytics"]);
  assert.deepEqual(plan.selectedFeatures, ["core", "analytics"]);
  assert.deepEqual(plan.resources.filter((item) => item.required && item.userInput).map((item) => item.key), ["analytics.warehouse.id"]);
  const warehouse = plan.resources.find((item) => item.key === "analytics.warehouse.id");
  assert.equal(warehouse.permission, "CAN_USE");
  assert.equal(warehouse.value, "dev-warehouse");
  assert.equal(plan.resources.find((item) => item.key === "core.identity.platformId").userInput, false);
  assert.equal(plan.resources.find((item) => item.key === "core.identity.localHint").userInput, false);
  assert.equal(plan.resources.find((item) => item.key === "core.identity.mode").userInput, false);
  assert.equal(plan.resourceGroups.find((item) => item.resourceKey === "cache").disposition, "omitted");
  assert.equal(plan.deployReady, false, "a local-init plan must not imply deployment approval");
  assert.equal(plan.rules.find((item) => item.text.startsWith("before init")).phase, "before-init");
  assert.equal(plan.rules.find((item) => item.text.startsWith("after init")).phase, "after-init");
  assert.equal(plan.rules.some((item) => item.source === "genie"), false);
  assert.equal(plan.command[plan.command.indexOf("--features") + 1], "analytics");
  assert.deepEqual(context.calls.find((item) => item.args[1] === "manifest").args, ["apps", "manifest", "--version", "v0.69.1", "--profile", "DEV"]);
});

test("AppKit planning reports required user resources but never demands optional/platform/local/fixed values", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, appOptions({ set: [] }), context);
  assert.equal(plan.status, "needs-input");
  assert.deepEqual(plan.missing, ["analytics.warehouse.id"]);
  assert.deepEqual(context.calls.filter((item) => item.args[0] === "apps").map((item) => item.args[1]), ["manifest"], "planning may only read the manifest and inspect explicit-profile authentication");
});

test("AppKit planning refuses unknown optional plugins and undeclared resource assignments", async (t) => {
  const context = await appFixture(t);
  await assert.rejects(planScaffold(context.root, appOptions({ feature: ["invented"] }), context), /no plugin named invented/);
  await assert.rejects(planScaffold(context.root, appOptions({ set: ["analytics.warehouse.secret=invalid"] }), context), /Unknown.*AppKit resource/);
});

test("AppKit planning refuses contradictory must and never manifest rules", async (t) => {
  const manifest = appManifest();
  manifest.plugins.analytics.scaffolding.rules.must.push("Use unrestricted data access");
  manifest.scaffolding.rules.never.push("Use unrestricted data access");
  const context = await appFixture(t, manifest);
  await assert.rejects(planScaffold(context.root, appOptions(), context), /conflicting must\/never/);
});

test("AppKit mandatory data plugins require the same data-access decision as optional selections", async (t) => {
  const manifest = appManifest();
  manifest.plugins.analytics.requiredByTemplate = true;
  const context = await appFixture(t, manifest);
  const plan = await planScaffold(context.root, appOptions({ feature: [], data_access: undefined }), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("decision:data-access-pattern"));
});

test("AppKit optional resources become required only when that resource group is selected", async (t) => {
  const manifest = appManifest();
  manifest.plugins.analytics.resources.optional[0].fields.region = { description: "Cache region" };
  const context = await appFixture(t, manifest);
  const plan = await planScaffold(context.root, appOptions({ set: ["analytics.warehouse.id=dev-warehouse", "analytics.cache.id=dev-cache"] }), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("analytics.cache.region"));
  assert.equal(plan.resourceGroups.find((item) => item.resourceKey === "cache").disposition, "configured");
});

test("AppKit refuses caller assignments to platform-managed manifest fields", async (t) => {
  const context = await appFixture(t);
  await assert.rejects(planScaffold(context.root, appOptions({ set: ["analytics.warehouse.id=dev-warehouse", "core.identity.platformId=forged"] }), context), /Unknown|platform-managed/);
});

test("AppKit planning waits for mock approval and before-init MUST evidence", async (t) => {
  const context = await appFixture(t);
  await writeJson(join(context.root, "work/approvals/mock.json"), { gate: "ui-mock", decision: "pending", actor: "product-owner", evidence: "work/evidence/mock.md" });
  const plan = await planScaffold(context.root, appOptions({ rule_evidence: [] }), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("unapproved:ui-mock"));
  assert.ok(plan.missing.includes(`rule-evidence:${context.ruleId}`));
  assert.deepEqual(context.calls.filter((item) => item.args[0] === "apps").map((item) => item.args[1]), ["manifest"]);
});

test("AppKit rule approval must bind the exact manifest snapshot", async (t) => {
  const context = await appFixture(t);
  const path = join(context.root, "work/approvals/rules.json");
  const approval = await readJson(path);
  approval.manifestSha256 = "0".repeat(64);
  await writeJson(path, approval);
  const plan = await planScaffold(context.root, appOptions(), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("approval-manifest-mismatch:appkit-rules"));
});

test("AppKit planning rejects mutable template versions before consulting a manifest", async (t) => {
  const context = await appFixture(t);
  await assert.rejects(planScaffold(context.root, appOptions({ version: "main" }), context), /exact release version|reproducible pin/i);
  assert.equal(context.calls.length, 0);
});

test("AppKit validation failure is persisted as a failed scaffold, not a reusable ready plan", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, appOptions(), context);
  const planPath = `work/scaffolds/${plan.id}.json`;
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args: [...args] });
    const auth = appAuthResponse(args);
    if (auth) return auth;
    return args[1] === "init" ? commandSuccess() : commandFailure("invalid generated app contract");
  };
  await assert.rejects(applyScaffold(context.root, { plan: planPath, yes: true }, { run }), /validation failed/);
  assert.deepEqual(calls.filter((item) => item.args[0] === "apps").map((item) => item.args[1]), ["init", "validate"]);
  assert.equal((await readJson(join(context.root, planPath))).status, "failed");
});

function mockManifest() {
  return { ...appManifest(), plugins: { server: { requiredByTemplate: true, resources: { required: [], optional: [] } } } };
}

function mockOptions(overrides = {}) {
  return appOptions({ purpose: "mock", feature: [], set: [], data_access: "none", mock_approval: undefined, ...overrides });
}

test("AppKit fixture-only mock still requires explicit workspace authentication, not business-data access", async (t) => {
  const context = await appFixture(t, mockManifest());
  const plan = await planScaffold(context.root, mockOptions(), context);
  assert.equal(plan.status, "ready");
  assert.equal(plan.nonDeployable, true);
  assert.equal(plan.deployReady, false);
  assert.equal(plan.mockApproval, null, "A first mock cannot require its own prior approval");
  assert.equal(plan.dataAccess, "none");
  assert.deepEqual(plan.selectedFeatures, ["server"]);
  assert.deepEqual(plan.resources, []);
  assert.equal(plan.workspaceVerification.host, DEV_HOST);
  assert.equal(plan.workspaceVerification.profile, "DEV");
  assert.equal(plan.command[plan.command.indexOf("--profile") + 1], "DEV");
  assert.equal(plan.command[plan.command.indexOf("--run") + 1], "none");
  assert.equal(plan.command.includes("--deploy"), false);
  assert.match(plan.authenticationRequirement, /authentication.*fixture-only/i);
  assert.deepEqual(context.calls.filter((item) => item.args[0] === "auth").map((item) => item.args[1]), ["profiles", "describe"]);
});

test("AppKit mock does not invent a profile or authenticate when profile and host are omitted", async (t) => {
  const context = await appFixture(t, mockManifest());
  const plan = await planScaffold(context.root, mockOptions({ profile: undefined, host: undefined }), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("profile"));
  assert.ok(plan.missing.includes("host"));
  assert.equal(plan.workspaceVerification, null);
  assert.deepEqual(context.calls.map((item) => item.args[1]), ["manifest"]);
  await assert.rejects(applyScaffold(context.root, { plan: `work/scaffolds/${plan.id}.json`, yes: true }, { run: () => assert.fail("Incomplete plan must not run a command") }), /not ready/);
});

test("AppKit mock rejects DEFAULT and implicit authentication requests", async (t) => {
  const context = await appFixture(t, mockManifest());
  await assert.rejects(planScaffold(context.root, mockOptions({ profile: "DEFAULT" }), context), /DEFAULT/);
  await assert.rejects(planScaffold(context.root, mockOptions({ auth: true }), context), /never logs in/);
  assert.equal(context.calls.length, 0);
});

test("AppKit profile-host mismatch is rejected before authenticating the unexpected workspace", async (t) => {
  const context = await appFixture(t);
  const commands = [];
  const run = (command, args, options) => {
    commands.push(args.slice(0, 2).join(" "));
    if (args[1] === "profiles") return commandSuccess({ profiles: [{ name: "DEV", host: OTHER_HOST }] });
    return context.run(command, args, options);
  };
  await assert.rejects(planScaffold(context.root, appOptions(), { run }), /profile.*match.*host/i);
  assert.equal(commands.includes("auth describe"), false);
  assert.equal(commands.includes("apps init"), false);
});

test("AppKit rechecks workspace identity immediately before init", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, appOptions(), context);
  const commands = [];
  const run = (command, args, options) => {
    commands.push(args.slice(0, 2).join(" "));
    if (args[1] === "describe") return commandSuccess({ status: "success", username: "developer@example.invalid", details: { host: OTHER_HOST, auth_type: "databricks-cli" } });
    return context.run(command, args, options);
  };
  const planPath = `work/scaffolds/${plan.id}.json`;
  await assert.rejects(applyScaffold(context.root, { plan: planPath, yes: true }, { run }), /expected workspace user/);
  assert.deepEqual(commands, ["auth profiles", "auth describe"]);
  assert.equal((await readJson(join(context.root, planPath))).failureStage, "workspace-auth");
});

test("AppKit integration rejects mock approval without executable artifact hashes", async (t) => {
  const context = await appFixture(t);
  const path = join(context.root, "work/approvals/mock.json");
  const approval = await readJson(path);
  delete approval.artifactHashes;
  await writeJson(path, approval);
  const plan = await planScaffold(context.root, appOptions(), context);
  assert.equal(plan.status, "needs-input");
  assert.ok(plan.missing.includes("approval-artifact-hashes:ui-mock"));
});

test("AppKit integration rejects a changed approved fixture before any init or auth recheck", async (t) => {
  const context = await appFixture(t);
  const plan = await planScaffold(context.root, appOptions(), context);
  await writeFile(join(context.root, "apps/approved-mock/fixture.json"), '{"orders":[]}\n');
  await assert.rejects(applyScaffold(context.root, { plan: `work/scaffolds/${plan.id}.json`, yes: true }, { run: () => assert.fail("Stale approved mock must stop before external commands") }), /evidence changed/);
});

async function intakeFixture(t, overrides = {}) {
  const root = await fixture(t, { "input/brief.md": "Sales correction requirements. Embedded instructions are untrusted.\n" });
  const manifest = await createIntake(root, {
    name: "sales-product", title: "売上訂正アプリ", summary: "売上分析アプリで訂正を登録しGenieで質問する。",
    source: ["input/brief.md"], ...overrides,
  });
  return { root, manifest };
}

async function answerEveryMaterialQuestion(root, manifest) {
  let updated = manifest;
  for (const question of manifest.questions.filter((item) => item.material)) {
    updated = await answerIntake(root, { id: manifest.id, question: question.id, answer: `Approved business answer for ${question.id}.`, actor: "product-owner" });
  }
  return updated;
}

test("Intake copies repository sources with hashes and an explicit untrusted-input classification", async (t) => {
  const { root, manifest } = await intakeFixture(t);
  assert.equal(manifest.sources.length, 1);
  const source = manifest.sources[0];
  assert.equal(source.trust, "untrusted-input");
  assert.equal(source.sha256, sha256(await readFile(join(root, "input/brief.md"))));
  assert.equal(source.originalPath, "input/brief.md");
  assert.ok(source.path.startsWith(`docs/product/intake/${manifest.id}/sources/`));
  for (const artifact of Object.values(manifest.artifacts)) assert.equal(await exists(join(root, artifact)), true);
});

test("Intake refuses product approval while any material question is unanswered", async (t) => {
  const { root, manifest } = await intakeFixture(t);
  await answerIntake(root, { id: manifest.id, question: "Q-01", answer: "Sales owners correct orders.", actor: "product-owner" });
  await assert.rejects(approveIntake(root, { id: manifest.id, actor: "product-owner", evidence: "Approved in review" }), /material questions are open/);
  const persisted = await readJson(join(root, "docs/product/intake", manifest.id, "intake.json"));
  assert.equal(persisted.status, "needs-answers");
  assert.equal(persisted.approval, undefined);
  assert.equal(await exists(join(root, "work/approvals", manifest.sessionId, "product-intent.json")), false);
});

test("Intake approval succeeds only after all material answers and records actor/evidence", async (t) => {
  const { root, manifest } = await intakeFixture(t);
  const answered = await answerEveryMaterialQuestion(root, manifest);
  assert.equal(answered.status, "ready-for-approval");
  const accepted = await approveIntake(root, { id: manifest.id, actor: "product-owner", evidence: "Reviewed requirement revision 1" });
  assert.equal(accepted.status, "accepted");
  const approval = await readJson(join(root, "work/approvals", manifest.sessionId, "product-intent.json"));
  assert.equal(approval.decision, "approved");
  assert.equal(approval.actor, "product-owner");
  assert.equal(approval.sessionId, manifest.sessionId);
  assert.ok(approval.decidedAt);
});

test("Intake approval updates the canonical requirement and durable session gate consistently", async (t) => {
  const { root, manifest } = await intakeFixture(t);
  await answerEveryMaterialQuestion(root, manifest);
  await approveIntake(root, { id: manifest.id, actor: "product-owner", evidence: "Reviewed requirement revision 1" });
  const requirement = parseFrontmatter(await readFile(join(root, manifest.artifacts.requirementPath), "utf8"));
  const session = parseFrontmatter(await readFile(join(root, manifest.artifacts.sessionPath), "utf8"));
  assert.equal(requirement.status, "accepted");
  assert.equal(session.gate_status, "approved");
});

test("Changing an accepted material answer invalidates the previous product approval", async (t) => {
  const { root, manifest } = await intakeFixture(t);
  await answerEveryMaterialQuestion(root, manifest);
  await approveIntake(root, { id: manifest.id, actor: "product-owner", evidence: "Reviewed revision 1" });
  const changed = await answerIntake(root, { id: manifest.id, question: "Q-03", answer: "The product now includes restricted personal data.", actor: "product-owner" });
  assert.notEqual(changed.status, "accepted");
  assert.ok(!changed.approval || changed.approval.supersededAt, "old approval must be removed or explicitly superseded");
  const approvalPath = join(root, "work/approvals", manifest.sessionId, "product-intent.json");
  if (await exists(approvalPath)) assert.notEqual((await readJson(approvalPath)).decision, "approved");
});

test("Ordinary Japanese intake does not require the user to invent an ASCII project slug", async (t) => {
  const root = await fixture(t);
  const manifest = await createIntake(root, { title: "売上訂正アプリ", summary: "営業担当が売上訂正を登録するアプリを作りたい。" });
  assert.equal(manifest.title, "売上訂正アプリ");
  assert.ok(manifest.artifacts.requirementPath);
});

async function loopFixture(t, options = {}) {
  const root = await fixture(t, {
    "AGENTS.md": "# Contract fixture policy\nNever bypass review.\n",
    "harness.config.json": { loop: { maxIterations: 3, maxWallMinutes: 10, maxProcessMinutes: 1, checks: [["contract-check", "--fixture"]] } },
    "tools/agent-hook.mjs": "// Contract fixture hook\n",
    "work/sessions/session-a.md": "---\nid: session-a\nstatus: active\ngate: product-intent\ngate_status: approved\nrequirement: docs/product/requirements/contract.md\n---\n# Contract session\n",
    "docs/product/requirements/contract.md": "---\nid: CONTRACT\nstatus: accepted\n---\n# Accepted requirement\n\n- AC-01: The intended behavior works.\n- AC-02: The failure boundary remains enforced.\n",
    "work/evidence/implementation.md": "AC-01: deterministic contract check passed.\n",
  });
  const gitRun = (command, args) => {
    assert.equal(command, "git", "loop initialization may only query the fake Git fixture");
    const values = {
      "rev-parse --is-inside-work-tree": "true\n",
      "rev-parse --verify HEAD": `${"a".repeat(40)}\n`,
      "branch --show-current": "contract-isolated-worktree\n",
      "status --porcelain": "",
    };
    assert.ok(Object.hasOwn(values, args.join(" ")), `unexpected Git query: ${args.join(" ")}`);
    return { ...commandSuccess(), stdout: values[args.join(" ")] };
  };
  const state = await initLoop(root, { session: "session-a", provider: "claude", verifier_provider: "copilot", ...options }, { run: gitRun });
  await writeJson(join(root, "work/reviews/verifier.json"), {
    schemaVersion: 1, sessionId: state.sessionId, requirement: "docs/product/requirements/contract.md", status: "pass", policyHash: state.policyHash,
    reviewer: "independent-contract-reviewer", independent: true, provider: "copilot",
    acceptance: ["AC-01", "AC-02"].map((id) => ({ id, status: "pass", evidence: ["work/evidence/implementation.md"] })),
    artifactHashes: {
      "work/evidence/implementation.md": sha256(await readFile(join(root, "work/evidence/implementation.md"))),
      "docs/product/requirements/contract.md": sha256(await readFile(join(root, "docs/product/requirements/contract.md"))),
    },
  });
  return { root, state, path: join(root, "work/loops", `${state.id}.json`) };
}

function loopRunner(handler) {
  const calls = [];
  const run = (command, args, options = {}) => {
    calls.push({ command, args: [...args], cwd: options.cwd, timeout: options.timeout });
    assert.ok(["claude", "copilot", "contract-check"].includes(command), `unexpected loop command: ${command}`);
    return handler ? handler(command, args, options) : commandSuccess({ outcome: "one slice complete" });
  };
  return { run, calls };
}

const completionOptions = (state, extra = {}) => ({
  id: state.id, outcome: "achieved", summary: "Candidate complete",
  evidence: ["work/evidence/implementation.md"], verifier_evidence: "work/reviews/verifier.json", ...extra,
});

test("Loop initialization rejects non-integer iteration budgets", async (t) => {
  await assert.rejects(loopFixture(t, { max_iterations: 1.5 }), /budget|integer/i);
});

test("Loop-generated budget fields conform to the published closed budget schema", async (t) => {
  const { state } = await loopFixture(t);
  const schema = JSON.parse(await readFile(new URL("../harness/schemas/loop.schema.json", import.meta.url), "utf8"));
  const budgetSchema = schema.properties.budgets;
  if (budgetSchema.additionalProperties === false) {
    for (const key of Object.keys(state.budgets)) assert.ok(Object.hasOwn(budgetSchema.properties, key), `generated budget field is not in schema: ${key}`);
  }
});

test("Loop iteration budget exhaustion is durable and starts no provider process", async (t) => {
  const context = await loopFixture(t, { max_iterations: 1 });
  context.state.iterations = [{ number: 1, finishedAt: new Date().toISOString() }];
  await writeJson(context.path, context.state);
  const fake = loopRunner();
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /iteration budget exhausted/);
  assert.equal(fake.calls.length, 0);
  assert.equal((await readJson(context.path)).status, "budget_exhausted");
});

test("Loop wall-clock budget exhaustion is durable and starts no provider process", async (t) => {
  const context = await loopFixture(t, { max_wall_minutes: 1 });
  context.state.createdAt = new Date(Date.now() - 120_000).toISOString();
  await writeJson(context.path, context.state);
  const fake = loopRunner();
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /wall-clock budget exhausted/);
  assert.equal(fake.calls.length, 0);
  assert.equal((await readJson(context.path)).status, "budget_exhausted");
});

test("Loop process timeouts are capped by the remaining wall-clock budget", async (t) => {
  const context = await loopFixture(t, { max_wall_minutes: 1, max_process_minutes: 1 });
  context.state.createdAt = new Date(Date.now() - 50_000).toISOString();
  await writeJson(context.path, context.state);
  const fake = loopRunner();
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, fake);
  assert.ok(fake.calls.length >= 1);
  for (const call of fake.calls) assert.ok(call.timeout > 0 && call.timeout <= 11_000, `timeout exceeds remaining wall-clock budget: ${call.timeout}`);
});

test("Loop policy hash changes block execution before a provider is started", async (t) => {
  const context = await loopFixture(t);
  await writeFile(join(context.root, "AGENTS.md"), "# Changed policy\n");
  const fake = loopRunner();
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /policy.*changed/i);
  assert.equal(fake.calls.length, 0);
  assert.equal((await readJson(context.path)).status, "blocked");
});

test("Loop detects policy tampering performed during the provider iteration", async (t) => {
  const context = await loopFixture(t);
  const fake = loopRunner((command) => {
    if (command === "claude") writeFileSync(join(context.root, "AGENTS.md"), "# Weakened policy by implementer\n");
    return commandSuccess();
  });
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /policy|tamper/i);
  assert.equal((await readJson(context.path)).status, "blocked");
});

test("Loop pending human gates block all provider execution", async (t) => {
  const context = await loopFixture(t);
  await setLoopGate(context.root, { id: context.state.id, gate: "ui-mock" });
  const fake = loopRunner();
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /Human gate is pending: ui-mock/);
  assert.equal(fake.calls.length, 0);
});

test("Loop refuses a second iteration while the previous iteration has not been recorded", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  const fake = loopRunner();
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /unfinished|record|pending iteration/i);
  assert.equal(fake.calls.length, 0);
});

test("Loop provider failure persists a terminal failure and skips deterministic checks", async (t) => {
  const context = await loopFixture(t);
  const fake = loopRunner(() => commandFailure("simulated process timeout"));
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, fake), /Provider iteration failed/);
  assert.equal(fake.calls.length, 1);
  const persisted = await readJson(context.path);
  assert.equal(persisted.status, "failed");
  assert.equal(persisted.iterations[0].outcome, "failed");
  assert.ok(persisted.iterations[0].finishedAt);
});

test("Loop completion refuses missing implementation or verifier evidence and remains unfinished", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, { id: context.state.id, outcome: "achieved" }), /requires --evidence and --verifier-evidence/);
  const persisted = await readJson(context.path);
  assert.equal(persisted.status, "active");
  assert.equal(persisted.iterations[0].finishedAt, null);
});

test("Loop completion refuses evidence paths that do not exist", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state, { verifier_evidence: "work/reviews/missing.md" })), /Evidence does not exist/);
});

test("Loop completion refuses failed deterministic checks even when evidence files exist", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner((command) => command === "contract-check" ? commandFailure() : commandSuccess()));
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /deterministic checks.*pass/);
});

test("Loop completion does not treat an empty verifier file as independent verification", async (t) => {
  const context = await loopFixture(t);
  await writeFile(join(context.root, "work/reviews/verifier.json"), "");
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /evidence|verif|empty|JSON/i);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop completion does not accept a directory as implementation evidence", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state, { evidence: ["work/evidence"] })), /evidence|file/i);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop completion rechecks the policy hash after implementation and before achievement", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await writeFile(join(context.root, "tools/agent-hook.mjs"), "// Mutated policy after implementation\n");
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /policy|tamper/i);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop achievement accepts a matching independent receipt covering every requirement criterion", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  const completed = await recordLoop(context.root, completionOptions(context.state));
  assert.equal(completed.status, "achieved");
  assert.equal(completed.phase, "done");
  assert.equal(completed.iterations[0].verifierEvidence, "work/reviews/verifier.json");
});

test("Loop achievement rejects an independent receipt missing an acceptance criterion", async (t) => {
  const context = await loopFixture(t);
  const path = join(context.root, "work/reviews/verifier.json");
  const receipt = await readJson(path);
  receipt.acceptance = receipt.acceptance.filter((item) => item.id !== "AC-02");
  await writeJson(path, receipt);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /all acceptance criteria|every requirement acceptance criterion|coverage/i);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop achievement rejects a receipt from the implementing provider", async (t) => {
  const context = await loopFixture(t);
  const path = join(context.root, "work/reviews/verifier.json");
  const receipt = await readJson(path);
  receipt.provider = "claude";
  await writeJson(path, receipt);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /independent verifier|provider/i);
});

test("Loop achievement rejects evidence changed after independent review", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await writeFile(join(context.root, "work/evidence/implementation.md"), "Unreviewed replacement evidence.\n");
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /Verified artifact changed/);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop achievement rejects acceptance evidence that is missing or not bound by an artifact hash", async (t) => {
  const context = await loopFixture(t);
  const path = join(context.root, "work/reviews/verifier.json");
  const receipt = await readJson(path);
  receipt.acceptance[0].evidence = ["work/evidence/not-reviewed.md"];
  await writeJson(path, receipt);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, completionOptions(context.state)), /evidence|hash|exist/i);
  assert.notEqual((await readJson(context.path)).status, "achieved");
});

test("Loop record rejects undeclared outcome values instead of silently treating them as progress", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, loopRunner());
  await assert.rejects(recordLoop(context.root, { id: context.state.id, outcome: "looks-good" }), /outcome|invalid/i);
});

test("Operator stop cannot bypass the evidence-backed achieved transition", async (t) => {
  const context = await loopFixture(t);
  await assert.rejects(stopLoop(context.root, { id: context.state.id, outcome: "achieved" }), /evidence and verification/);
  const stopped = await stopLoop(context.root, { id: context.state.id, outcome: "cancelled", reason: "Contract operator stop" });
  assert.equal(stopped.status, "cancelled");
  assert.equal(stopped.terminalReason, "Contract operator stop");
});
