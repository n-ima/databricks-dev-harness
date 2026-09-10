import assert from "node:assert/strict";
import { link, lstat, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { inspectAppOutput, OUTPUT_LIMITS } from "../../tools/lib/scaffold-output.mjs";
import { applyScaffold, planScaffold } from "../../tools/lib/scaffold.mjs";
import { readJson, writeJson } from "../../tools/lib/shared.mjs";

// R2 independent probes: every CLI execution is an injected local fake.
// Original HI-01/02 test/log/report are immutable and replayed separately.
const planPath = (plan) => `work/scaffolds/${plan.id}.json`;
const success = (payload = {}) => ({ ok: true, status: 0, stdout: JSON.stringify(payload), stderr: "", error: null });
const outputPlan = { name: "rereview", outputDir: "apps/rereview" };
async function exists(path) { try { await lstat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
async function temporary(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "hard08-rereview-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => { const checked = resolve(root); assert.equal(dirname(checked), base); assert.match(checked.slice(base.length + sep.length), /^hard08-rereview-[A-Za-z0-9]+$/); await rm(checked, { recursive: true, force: true }); });
  return root;
}
async function app(t, hooks = {}) {
  const root = await temporary(t), calls = [];
  const options = { kind: "app", name: "rereview", purpose: "mock", profile: "DEV", host: "https://dev.cloud.databricks.com" };
  await writeJson(join(root, "harness/toolchain.lock.json"), { appkitTemplateVersion: "v0.69.1" });
  const fake = async (command, args, execution) => {
    calls.push({ command, args, execution });
    if (args[0] === "auth" && args[1] === "profiles") return success({ profiles: [{ name: "DEV", host: options.host }] });
    if (args[0] === "auth" && args[1] === "describe") return success({ status: "success", username: "fixture-user", details: { host: options.host, auth_type: "databricks-cli" } });
    if (args[1] === "manifest") return success({ version: "2.0", plugins: { server: { name: "server", requiredByTemplate: true, resources: { required: [], optional: [] } } } });
    if (args[1] === "init") {
      const target = join(root, args[args.indexOf("--output-dir") + 1]);
      if (!hooks.missing) { await mkdir(target, { recursive: true }); await writeJson(join(target, "package.json"), { name: "rereview", private: true }); if (!hooks.noBundle) await writeFile(join(target, "databricks.yml"), "bundle:\n  name: rereview\n"); await hooks.init?.(target, root); }
      return success();
    }
    if (args[1] === "validate") { await hooks.validate?.(join(root, outputPlan.outputDir), root, args); return success(); }
    assert.fail(`Unexpected external call: ${command} ${args.join(" ")}`);
  };
  const plan = await planScaffold(root, options, { run: fake });
  return { root, calls, plan, apply: () => applyScaffold(root, { plan: planPath(plan), yes: true }, { run: fake }) };
}

test("HI-03: case-alias Bundle restoration cannot bypass Windows control continuity", async (t) => {
  if (process.platform !== "win32") return t.skip("This alias counterexample targets Windows case-insensitive paths.");
  const context = await app(t, { validate: (target) => writeFile(join(target, "DATABRICKS.YML"), "bundle:\n  name: unquarantined\n") });
  await assert.rejects(context.apply(), /control|quarantine|unsupported|inspection/i);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.equal(saved.status, "failed");
  assert.equal(saved.failureStage, "output-reinspection");
  assert.equal(saved.appliedAt, undefined);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, "databricks.yml")), true);
});

for (const mutation of ["package", "marker", "quarantine", "bundle-restore", "marker-remove"]) {
  test(`same-root ${mutation} mutation after validate is rejected without success evidence`, async (t) => {
    const context = await app(t, { validate: async (target) => {
      if (mutation === "package") await writeJson(join(target, "package.json"), { name: "mutated" });
      if (mutation === "marker") await writeJson(join(target, ".harness-fixture-only.json"), { deployReady: true });
      if (mutation === "quarantine") await writeFile(join(target, "databricks.fixture-only.yml"), "changed\n");
      if (mutation === "bundle-restore") await writeFile(join(target, "databricks.yml"), "restored\n");
      if (mutation === "marker-remove") await unlink(join(target, ".harness-fixture-only.json"));
    } });
    await assert.rejects(context.apply(), /changed/);
    const saved = await readJson(join(context.root, planPath(context.plan)));
    assert.equal(saved.failureStage, "output-reinspection");
    assert.equal(saved.status, "failed");
    assert.equal(saved.appliedAt, undefined);
    assert.equal(saved.validation.status, "passed");
    assert.equal(saved.validationInputInspection.status, "passed");
    assert.equal(saved.outputReinspection.status, "failed");
  });
}

test("root replacement with identical package and all control bytes is rejected by exact identity", async (t) => {
  let identity;
  const context = await app(t, { validate: async (target, root) => {
    identity = await lstat(target, { bigint: true });
    const preserved = join(root, "preserved-root");
    await rename(target, preserved); await mkdir(target);
    for (const name of ["package.json", ".harness-fixture-only.json", "databricks.fixture-only.yml"]) await writeFile(join(target, name), await readFile(join(preserved, name)));
  } });
  await assert.rejects(context.apply(), /root identity changed/);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.deepEqual(saved.validationInputInspection.rootIdentity, { device: identity.dev.toString(), inode: identity.ino.toString() });
  assert.notDeepEqual(saved.outputReinspection.rootIdentity, saved.validationInputInspection.rootIdentity);
  assert.equal(saved.outputInspection.packageSha256, saved.outputReinspection.packageSha256);
  assert.deepEqual(saved.validationInputInspection.controlFiles, saved.outputReinspection.controlFiles);
});

test("same-root same-content package replacement is allowed under byte continuity", async (t) => {
  const context = await app(t, { validate: async (target) => { const bytes = await readFile(join(target, "package.json")); await rename(join(target, "package.json"), join(target, "saved-package.json")); await writeFile(join(target, "package.json"), bytes); await writeFile(join(target, "cache.dat"), "cache\n"); } });
  const result = await context.apply();
  assert.equal(result.status, "applied");
  assert.deepEqual(result.outputInspection.rootIdentity, result.outputReinspection.rootIdentity);
  assert.equal(result.outputInspection.packageSha256, result.outputReinspection.packageSha256);
});

test("missing expected output records no fabricated generated artifact", async (t) => {
  const context = await app(t, { missing: true });
  await assert.rejects(context.apply(), /expected root is missing/);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.deepEqual(saved.generatedFiles, []);
  assert.equal(saved.failureStage, "output-inspection");
  assert.equal(context.calls.some((call) => call.args[1] === "validate"), false);
});

test("mock without original Bundle records only the exact generated marker and no Bundle", async (t) => {
  const context = await app(t, { noBundle: true });
  const result = await context.apply();
  assert.equal(result.status, "applied");
  assert.deepEqual(Object.keys(result.outputInspection.controlFiles), []);
  assert.deepEqual(Object.keys(result.validationInputInspection.controlFiles), [".harness-fixture-only.json"]);
  assert.deepEqual(result.validationInputInspection.controlFiles, result.outputReinspection.controlFiles);
});

test("root control exact 1MiB passes and one extra byte fails before quarantine", async (t) => {
  const root = await temporary(t), target = join(root, outputPlan.outputDir);
  await mkdir(target, { recursive: true }); await writeFile(join(target, "package.json"), "{}");
  await writeFile(join(target, "databricks.yml"), Buffer.alloc(OUTPUT_LIMITS.controlFileBytes, 0x78));
  assert.equal((await inspectAppOutput(root, outputPlan)).status, "passed");
  await writeFile(join(target, "databricks.yml"), Buffer.alloc(OUTPUT_LIMITS.controlFileBytes + 1, 0x78));
  await assert.rejects(inspectAppOutput(root, outputPlan), /size limit/);
});

test("valid Unicode and UTF-8 BOM remain valid JSON objects; truncated multibyte is rejected", async (t) => {
  const root = await temporary(t), target = join(root, outputPlan.outputDir);
  await mkdir(target, { recursive: true });
  for (const bytes of [Buffer.from('{"名前":"検証🌸"}'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"name":"bom"}')])]) {
    await writeFile(join(target, "package.json"), bytes);
    assert.equal((await inspectAppOutput(root, outputPlan)).status, "passed");
  }
  await writeFile(join(target, "package.json"), Buffer.concat([Buffer.from('{"name":"'), Buffer.from([0xe3, 0x81]), Buffer.from('"}') ]));
  await assert.rejects(inspectAppOutput(root, outputPlan), /valid UTF-8 JSON/);
});

test("post-validate marker hard link refuses despite unchanged content hash", async (t) => {
  const context = await app(t, { validate: async (target, root) => { await rename(join(target, ".harness-fixture-only.json"), join(root, "marker-source")); await link(join(root, "marker-source"), join(target, ".harness-fixture-only.json")); } });
  await assert.rejects(context.apply(), /hard-linked/);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.equal(saved.failureStage, "output-reinspection");
  assert.equal(saved.appliedAt, undefined);
});
