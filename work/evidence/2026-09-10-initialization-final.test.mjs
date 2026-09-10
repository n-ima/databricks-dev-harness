import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { freshTemplateFixture } from "../../tests/helpers/initialization.mjs";
import { assertOutputContinuity, inspectAppOutput, OUTPUT_LIMITS } from "../../tools/lib/scaffold-output.mjs";

// Final alias-boundary probes: local filesystem only, no process/network/provider.
const manifest = JSON.parse(await readFile(new URL("../../harness/fixtures/initialization/manifest.json", import.meta.url), "utf8"));
const plan = { name: "final-review", outputDir: "apps/final-review" };
async function temporary(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "hard08-final-"));
  t.after(async () => { const checked = resolve(root); assert.equal(dirname(checked), base); assert.match(checked.slice(base.length + sep.length), /^hard08-final-[A-Za-z0-9]+$/); await rm(checked, { recursive: true, force: true }); });
  return root;
}
async function output(t) {
  const root = await temporary(t), target = join(root, plan.outputDir);
  await mkdir(target, { recursive: true }); await writeFile(join(target, "package.json"), "{}");
  return { root, target };
}

for (const name of ["DaTaBrIcKs.YmL", "DATABRICKS.FIXTURE-ONLY.YML", ".HARNESS-FIXTURE-ONLY.JSON"]) {
  test(`noncanonical root control ${name} is rejected before bounded read`, async (t) => {
    const { root, target } = await output(t);
    await writeFile(join(target, name), Buffer.alloc(OUTPUT_LIMITS.controlFileBytes + 1, 0x78));
    await assert.rejects(inspectAppOutput(root, plan), /case alias/);
  });
}

test("noncanonical nested PACKAGE.JSON is rejected without relocating its root", async (t) => {
  const { root, target } = await output(t);
  await mkdir(join(target, "nested")); await writeFile(join(target, "nested/PACKAGE.JSON"), "{}");
  await assert.rejects(inspectAppOutput(root, plan), /case alias/);
  assert.equal(await readFile(join(target, "nested/PACKAGE.JSON"), "utf8"), "{}");
});

test("uppercase ordinary cache remains outside the reserved alias restriction", async (t) => {
  const { root, target } = await output(t);
  await writeFile(join(target, "databricks.yml"), "bundle:\n  name: ordinary\n");
  const before = await inspectAppOutput(root, plan);
  await writeFile(join(target, "BUILD-CACHE.TXT"), "cache\n");
  const after = await inspectAppOutput(root, plan);
  assert.doesNotThrow(() => assertOutputContinuity(before, after));
  assert.deepEqual(Object.keys(after.controlFiles), ["databricks.yml"]);
});

test("mixed-case excluded local inputs do not change fresh fixture bytes or source", async (t) => {
  const parent = await temporary(t), source = join(parent, "source");
  await mkdir(source);
  for (const name of manifest.files) { await mkdir(dirname(join(source, name)), { recursive: true }); await writeFile(join(source, name), `required ${name}\n`); }
  for (const name of manifest.directories) await mkdir(join(source, name), { recursive: true });
  const clean = await freshTemplateFixture(source, join(parent, "clean"));
  const sentinels = ["harness/BASE-RELEASE.JSON", "harness/.ENV.PROFILE", "tools/Node_Modules/private.txt", "harness/.HaRnEsS/private.txt", "docs/harness/synthetic.LOCAL.md", "tools/.GiT/private.txt", "harness/.DaTaBrIcKsCfG", "tools/__PYCACHE__/private.pyc"];
  for (const name of sentinels) { await mkdir(dirname(join(source, name)), { recursive: true }); await writeFile(join(source, name), `synthetic local ${name}\n`); }
  const dirtyRoot = join(parent, "dirty"), dirty = await freshTemplateFixture(source, dirtyRoot);
  assert.deepEqual(dirty, clean);
  for (const name of sentinels) { await assert.rejects(lstat(join(dirtyRoot, name)), { code: "ENOENT" }); assert.equal(await readFile(join(source, name), "utf8"), `synthetic local ${name}\n`); }
});

test("HI-04: absent root control becoming a directory must not be invisible to continuity", async (t) => {
  const { root, target } = await output(t);
  const before = await inspectAppOutput(root, plan);
  await mkdir(join(target, "databricks.yml"));
  await assert.rejects(async () => {
    const after = await inspectAppOutput(root, plan);
    assertOutputContinuity(before, after);
  }, /regular|control|inspection/);
  assert.equal((await lstat(join(target, "databricks.yml"))).isDirectory(), true);
});
