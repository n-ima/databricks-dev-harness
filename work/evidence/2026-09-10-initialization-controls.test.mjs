import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { inspectAppOutput } from "../../tools/lib/scaffold-output.mjs";
import { applyScaffold, planScaffold } from "../../tools/lib/scaffold.mjs";
import { readJson, writeJson } from "../../tools/lib/shared.mjs";

// Final control-type probes. Fakes only; no subprocess/authentication/network.
const planPath = (plan) => `work/scaffolds/${plan.id}.json`;
const outputPlan = { name: "control-review", outputDir: "apps/control-review" };
const success = (payload = {}) => ({ ok: true, status: 0, stdout: JSON.stringify(payload), stderr: "", error: null });
async function temporary(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "hard08-controls-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => { const checked = resolve(root); assert.equal(dirname(checked), base); assert.match(checked.slice(base.length + sep.length), /^hard08-controls-[A-Za-z0-9]+$/); await rm(checked, { recursive: true, force: true }); });
  return root;
}
async function app(t, hooks = {}) {
  const root = await temporary(t), calls = [];
  const options = { kind: "app", name: outputPlan.name, purpose: "mock", profile: "DEV", host: "https://dev.cloud.databricks.com" };
  await writeJson(join(root, "harness/toolchain.lock.json"), { appkitTemplateVersion: "v0.69.1" });
  const run = async (command, args) => {
    calls.push(args);
    if (args[0] === "auth" && args[1] === "profiles") return success({ profiles: [{ name: "DEV", host: options.host }] });
    if (args[0] === "auth" && args[1] === "describe") return success({ status: "success", username: "fixture-user", details: { host: options.host, auth_type: "databricks-cli" } });
    if (args[1] === "manifest") return success({ version: "2.0", plugins: { server: { name: "server", requiredByTemplate: true, resources: { required: [], optional: [] } } } });
    const target = join(root, outputPlan.outputDir);
    if (args[1] === "init") {
      await mkdir(target, { recursive: true }); await writeFile(join(target, "package.json"), "{}");
      if (!hooks.noBundle) await writeFile(join(target, "databricks.yml"), "bundle:\n  name: control-review\n");
      await hooks.init?.(target); return success();
    }
    if (args[1] === "validate") { await hooks.validate?.(target); return success(); }
    assert.fail(`Unexpected external call: ${command} ${args.join(" ")}`);
  };
  const plan = await planScaffold(root, options, { run });
  return { root, plan, calls, apply: () => applyScaffold(root, { plan: planPath(plan), yes: true }, { run }) };
}

for (const name of ["databricks.yml", "databricks.fixture-only.yml", ".harness-fixture-only.json"]) {
  test(`root ${name} directory fails pure inspection and is preserved`, async (t) => {
    const root = await temporary(t), target = join(root, outputPlan.outputDir);
    await mkdir(target, { recursive: true }); await writeFile(join(target, "package.json"), "{}"); await mkdir(join(target, name));
    await assert.rejects(inspectAppOutput(root, outputPlan), /regular|control/);
    assert.equal((await lstat(join(target, name))).isDirectory(), true);
  });
}

for (const name of ["databricks.fixture-only.yml", ".harness-fixture-only.json"]) {
  test(`initial mock ${name} directory preserves fixture collision diagnostic without writes`, async (t) => {
    const context = await app(t, { init: (target) => mkdir(join(target, name)) });
    await assert.rejects(context.apply(), /regular|overwrite|control/);
    const saved = await readJson(join(context.root, planPath(context.plan)));
    assert.equal(saved.failureStage, "fixture-quarantine");
    assert.equal(saved.outputInspection.status, "failed");
    assert.equal(saved.appliedAt, undefined);
    assert.equal(context.calls.some((args) => args[1] === "validate"), false);
    const target = join(context.root, outputPlan.outputDir);
    assert.equal((await lstat(join(target, name))).isDirectory(), true);
    assert.equal(await readFile(join(target, "databricks.yml"), "utf8"), "bundle:\n  name: control-review\n");
  });
}

test("initial mock Bundle directory fails inspection before marker or validate", async (t) => {
  const context = await app(t, { noBundle: true, init: (target) => mkdir(join(target, "databricks.yml")) });
  await assert.rejects(context.apply(), /regular|control/);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.equal(saved.failureStage, "output-inspection");
  assert.equal(saved.outputInspection.status, "failed");
  assert.equal(context.calls.some((args) => args[1] === "validate"), false);
  await assert.rejects(lstat(join(context.root, outputPlan.outputDir, ".harness-fixture-only.json")), { code: "ENOENT" });
});

for (const name of ["databricks.yml", "databricks.fixture-only.yml"]) {
  test(`validate cannot make absent ${name} into an invisible directory`, async (t) => {
    const context = await app(t, { noBundle: true, validate: (target) => mkdir(join(target, name)) });
    await assert.rejects(context.apply(), /regular|control/);
    const saved = await readJson(join(context.root, planPath(context.plan)));
    assert.equal(saved.failureStage, "output-reinspection");
    assert.equal(saved.outputReinspection.status, "failed");
    assert.equal(saved.validation.status, "passed");
    assert.equal(saved.appliedAt, undefined);
  });
}

test("normal cache directories and nested control-looking names remain allowed", async (t) => {
  const context = await app(t, { validate: async (target) => { await mkdir(join(target, "CACHE/databricks.yml"), { recursive: true }); await writeFile(join(target, "CACHE/databricks.yml/data.txt"), "cache data\n"); } });
  const result = await context.apply();
  assert.equal(result.status, "applied");
  assert.equal(result.outputReinspection.status, "passed");
});
