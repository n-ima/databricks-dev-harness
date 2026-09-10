import assert from "node:assert/strict";
import { link, lstat, mkdir, mkdtemp, open, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { freshTemplateFixture } from "../../tests/helpers/initialization.mjs";
import { inspectAppOutput, OUTPUT_LIMITS } from "../../tools/lib/scaffold-output.mjs";
import { applyScaffold, planScaffold } from "../../tools/lib/scaffold.mjs";
import { readJson, writeJson } from "../../tools/lib/shared.mjs";

// Independent HARD-08 acceptance probes. All CLI calls are injected local fakes.
// No provider, Databricks binary, credential, network or external product is used.
const repository = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(await readFile(join(repository, "harness/fixtures/initialization/manifest.json"), "utf8"));
const planPath = (plan) => `work/scaffolds/${plan.id}.json`;
const success = (payload = {}) => ({ ok: true, status: 0, stdout: JSON.stringify(payload), stderr: "", error: null });
const outputPlan = { name: "independent", outputDir: "apps/independent" };
async function exists(path) { try { await lstat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
async function temporary(t) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, "hard08-independent-"));
  t.after(async () => {
    const checked = resolve(root);
    assert.equal(dirname(checked), base);
    assert.match(checked.slice(base.length + sep.length), /^hard08-independent-[A-Za-z0-9]+$/);
    await rm(checked, { recursive: true, force: true });
  });
  return root;
}
async function output(t, bytes = '{"name":"independent"}') {
  const root = await temporary(t), target = join(root, outputPlan.outputDir);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "package.json"), bytes);
  return { root, target };
}
async function minimalSource(t) {
  const parent = await temporary(t), source = join(parent, "source"), destination = join(parent, "destination");
  await mkdir(source);
  for (const path of manifest.files) { await mkdir(dirname(join(source, path)), { recursive: true }); await writeFile(join(source, path), `required input: ${path}\n`); }
  for (const path of manifest.directories) await mkdir(join(source, path), { recursive: true });
  return { parent, source, destination };
}
async function app(t, hooks = {}) {
  const root = await temporary(t), calls = [];
  const options = { kind: "app", name: "independent", purpose: "mock", profile: "DEV", host: "https://dev.cloud.databricks.com" };
  await writeJson(join(root, "harness/toolchain.lock.json"), { appkitTemplateVersion: "v0.69.1" });
  const fake = async (command, args, execution) => {
    calls.push({ command, args, execution });
    if (args[0] === "auth" && args[1] === "profiles") return success({ profiles: [{ name: "DEV", host: options.host }] });
    if (args[0] === "auth" && args[1] === "describe") { await hooks.auth?.(root); return success({ status: "success", username: "fixture-user", details: { host: options.host, auth_type: "databricks-cli" } }); }
    if (args[1] === "manifest") return success({ version: "2.0", plugins: { server: { name: "server", requiredByTemplate: true, resources: { required: [], optional: [] } } } });
    if (args[1] === "init") {
      const target = join(root, args[args.indexOf("--output-dir") + 1]);
      await mkdir(target, { recursive: true });
      await writeJson(join(target, "package.json"), { name: "independent", private: true });
      await writeFile(join(target, "databricks.yml"), "bundle:\n  name: independent\n");
      await hooks.init?.(target, root);
      return success();
    }
    if (args[1] === "validate") { await hooks.validate?.(join(root, outputPlan.outputDir), root, args); return success(); }
    assert.fail(`Unexpected external call: ${command} ${args.join(" ")}`);
  };
  const plan = await planScaffold(root, options, { run: fake });
  return { root, calls, plan, fake, apply: () => applyScaffold(root, { plan: planPath(plan), yes: true }, { run: fake }) };
}

test("HI-01: invalid UTF-8 package bytes fail before quarantine or validation", async (t) => {
  const bytes = Buffer.concat([Buffer.from('{"name":"'), Buffer.from([0x80]), Buffer.from('"}')]);
  const context = await app(t, { init: (target) => writeFile(join(target, "package.json"), bytes) });
  await assert.rejects(context.apply(), /output inspection|UTF-8|valid JSON/i);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.equal(saved.status, "failed");
  assert.equal(saved.failureStage, "output-inspection");
  assert.equal(context.calls.some((call) => call.args[1] === "validate"), false);
  assert.deepEqual(await readFile(join(context.root, outputPlan.outputDir, "package.json")), bytes);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, "databricks.yml")), true);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, ".harness-fixture-only.json")), false);
});

test("HI-02: validator root replacement must not adopt an unvalidated unquarantined root", async (t) => {
  let inspectedIdentity, replacementIdentity;
  const context = await app(t, { validate: async (target, root, args) => {
    assert.equal(args[args.indexOf("--path") + 1], outputPlan.outputDir);
    assert.equal(await exists(join(target, "databricks.fixture-only.yml")), true);
    inspectedIdentity = (await lstat(target)).ino;
    await rename(target, join(root, "validated-root-preserved"));
    await mkdir(target);
    await writeJson(join(target, "package.json"), { name: "not-validated" });
    await writeFile(join(target, "databricks.yml"), "bundle:\n  name: unvalidated\n");
    replacementIdentity = (await lstat(target)).ino;
  } });
  await assert.rejects(context.apply(), /root.*chang|output.*inspection|identity|quarantine/i);
  assert.notEqual(inspectedIdentity, replacementIdentity);
  const saved = await readJson(join(context.root, planPath(context.plan)));
  assert.equal(saved.status, "failed");
  assert.equal(saved.failureStage, "output-reinspection");
  assert.equal(saved.appliedAt, undefined);
  assert.equal(await exists(join(context.root, "validated-root-preserved/.harness-fixture-only.json")), true);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, "databricks.yml")), true);
});

test("legal same-root validate file generation and nested package preserve expected validation root", async (t) => {
  const context = await app(t, { init: async (target) => {
    await mkdir(join(target, "nested"));
    await writeJson(join(target, "nested/package.json"), { name: "nested" });
  }, validate: (target) => writeFile(join(target, "validation-cache.txt"), "local validated cache\n") });
  const result = await context.apply();
  assert.equal(result.status, "applied");
  assert.equal(result.outputInspection.actualRoot, outputPlan.outputDir);
  assert.equal(result.outputReinspection.actualRoot, outputPlan.outputDir);
  assert.deepEqual(result.outputInspection.candidateRoots, [outputPlan.outputDir, `${outputPlan.outputDir}/nested`]);
  const validate = context.calls.find((call) => call.args[1] === "validate");
  assert.equal(validate.args[validate.args.indexOf("--path") + 1], outputPlan.outputDir);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, "databricks.yml")), false);
});

test("second preflight refuses output created by apply authentication fake before init", async (t) => {
  let authCalls = 0;
  const context = await app(t, { auth: async (root) => {
    if (++authCalls === 2) { await mkdir(join(root, outputPlan.outputDir), { recursive: true }); await writeFile(join(root, outputPlan.outputDir, "sentinel.txt"), "preserve\n"); }
  } });
  await assert.rejects(context.apply(), /already exists/);
  assert.equal(context.calls.some((call) => call.args[1] === "init"), false);
  assert.equal(await readFile(join(context.root, outputPlan.outputDir, "sentinel.txt"), "utf8"), "preserve\n");
});

test("hard-linked generated Bundle refuses before quarantine or validation", async (t) => {
  const context = await app(t, { init: async (target, root) => { await rename(join(target, "databricks.yml"), join(root, "original-bundle.yml")); await link(join(root, "original-bundle.yml"), join(target, "databricks.yml")); } });
  await assert.rejects(context.apply(), /hard-linked/);
  assert.equal(context.calls.some((call) => call.args[1] === "validate"), false);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, ".harness-fixture-only.json")), false);
  assert.equal(await readFile(join(context.root, "original-bundle.yml"), "utf8"), "bundle:\n  name: independent\n");
});

test("validator linked-root replacement is rejected and external local target stays untouched", async (t) => {
  const context = await app(t, { validate: async (target, root) => {
    await rename(target, join(root, "original-root"));
    const outside = join(root, "outside");
    await mkdir(outside); await writeFile(join(outside, "package.json"), '{"name":"outside"}');
    await symlink(outside, target, "junction");
  } });
  await assert.rejects(context.apply(), /Symlink|junction/);
  assert.equal((await readJson(join(context.root, planPath(context.plan)))).failureStage, "output-reinspection");
  assert.equal(await readFile(join(context.root, "outside/package.json"), "utf8"), '{"name":"outside"}');
});

test("mock reserved directory collision preserves both original Bundle and collision", async (t) => {
  const context = await app(t, { init: (target) => mkdir(join(target, ".harness-fixture-only.json")) });
  await assert.rejects(context.apply(), /already exists|collision|overwrite/i);
  assert.equal((await readJson(join(context.root, planPath(context.plan)))).failureStage, "fixture-quarantine");
  assert.equal((await lstat(join(context.root, outputPlan.outputDir, ".harness-fixture-only.json"))).isDirectory(), true);
  assert.equal(await exists(join(context.root, outputPlan.outputDir, "databricks.yml")), true);
  assert.equal(context.calls.some((call) => call.args[1] === "validate"), false);
});

test("package exact byte limit passes and one extra byte fails", async (t) => {
  const bytes = Buffer.from(`{"x":"${"x".repeat(OUTPUT_LIMITS.packageBytes - 8)}"}`);
  assert.equal(bytes.length, OUTPUT_LIMITS.packageBytes);
  const { root, target } = await output(t, bytes);
  assert.equal((await inspectAppOutput(root, outputPlan)).status, "passed");
  await writeFile(join(target, "package.json"), Buffer.concat([bytes, Buffer.from(" ")]));
  await assert.rejects(inspectAppOutput(root, outputPlan), /size limit/);
});

test("fixture initialized-source nested local contamination is excluded deterministically", async (t) => {
  const { source, destination, parent } = await minimalSource(t);
  const clean = await freshTemplateFixture(source, destination);
  const excluded = ["product.config.json", "databricks.yml", "apps/private/value.json", "docs/product/requirements/private.md", "work/sessions/private.md", "harness/base-release.json", "harness/.env.local", "tools/node_modules/private/package.json", "docs/harness/private.local.md"];
  for (const path of excluded) { await mkdir(dirname(join(source, path)), { recursive: true }); await writeFile(join(source, path), `private sentinel ${path}\n`); }
  const dirtyDestination = join(parent, "dirty-destination");
  const dirty = await freshTemplateFixture(source, dirtyDestination);
  assert.deepEqual(dirty, clean);
  for (const path of excluded) { assert.equal(await exists(join(dirtyDestination, path)), false, path); assert.equal(await readFile(join(source, path), "utf8"), `private sentinel ${path}\n`); }
});

test("missing mandatory fixture input refuses before exclusive destination creation", async (t) => {
  const { source, destination } = await minimalSource(t);
  await rename(join(source, manifest.files[0]), join(source, "saved-required-input"));
  await assert.rejects(freshTemplateFixture(source, destination), /ENOENT/);
  assert.equal(await exists(destination), false);
});

test("fixture source depth bound refuses before destination creation", async (t) => {
  const { source, destination } = await minimalSource(t);
  await mkdir(join(source, "harness", ...Array.from({ length: 21 }, () => "deep")), { recursive: true });
  await assert.rejects(freshTemplateFixture(source, destination), /input limit/);
  assert.equal(await exists(destination), false);
});

test("fixture source byte bound refuses before destination creation", async (t) => {
  const { source, destination } = await minimalSource(t);
  const handle = await open(join(source, "harness/oversized.bin"), "w");
  try { await handle.truncate(100 * 1024 * 1024 + 1); } finally { await handle.close(); }
  await assert.rejects(freshTemplateFixture(source, destination), /size limit/);
  assert.equal(await exists(destination), false);
});

test("fixture source entry bound refuses before destination creation", async (t) => {
  const { source, destination } = await minimalSource(t);
  for (let start = 0; start < 20001; start += 250) {
    await Promise.all(Array.from({ length: Math.min(250, 20001 - start) }, (_, index) => writeFile(join(source, `harness/entry-${start + index}.txt`), "")));
  }
  await assert.rejects(freshTemplateFixture(source, destination), /input limit/);
  assert.equal(await exists(destination), false);
});
