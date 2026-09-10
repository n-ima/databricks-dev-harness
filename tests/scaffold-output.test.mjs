import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, open } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { inspectAppOutput, preflightAppOutput, OUTPUT_LIMITS } from "../tools/lib/scaffold-output.mjs";

const plan = { name: "fixture-app", outputDir: "apps/fixture-app" };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "harness-output-contract-"));
  t.after(async () => {
    assert.ok(resolve(root).startsWith(`${resolve(tmpdir())}${sep}harness-output-contract-`));
    await rm(root, { recursive: true, force: true });
  });
  const output = join(root, plan.outputDir);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "package.json"), '{"name":"fixture-app"}\n');
  return { root, output };
}

test("expected component root with nested packages is inspected, not relocated", async (t) => {
  const { root, output } = await fixture(t);
  await mkdir(join(output, "packages/ui"), { recursive: true });
  await writeFile(join(output, "packages/ui/package.json"), '{"name":"ui"}');
  const inspection = await inspectAppOutput(root, plan);
  assert.equal(inspection.actualRoot, plan.outputDir);
  assert.deepEqual(inspection.candidateRoots, [plan.outputDir, `${plan.outputDir}/packages/ui`]);
  assert.equal(inspection.packageSha256.length, 64);
});

for (const value of ["not JSON password=synthetic-secret", "null", "[]", "1", '"text"']) {
  test(`output rejects non-object package: ${value.split(" ")[0]}`, async (t) => {
    const { root, output } = await fixture(t);
    await writeFile(join(output, "package.json"), value);
    await assert.rejects(inspectAppOutput(root, plan), (error) => {
      assert.equal(error.outputInspection.status, "failed");
      assert.doesNotMatch(JSON.stringify(error.outputInspection), /synthetic-secret/);
      return /JSON/.test(error.message);
    });
    assert.equal(await readFile(join(output, "package.json"), "utf8"), value);
  });
}

test("output rejects missing root, missing package and directory package", async (t) => {
  const { root, output } = await fixture(t);
  await rm(join(output, "package.json"));
  await assert.rejects(inspectAppOutput(root, plan), /missing at expected root/);
  await mkdir(join(output, "package.json"));
  await assert.rejects(inspectAppOutput(root, plan), /not a regular file/);
  await assert.rejects(inspectAppOutput(root, { name: "absent", outputDir: "apps/absent" }), /missing or not a directory/);
  await assert.rejects(preflightAppOutput(root, { name: "fixture-app", outputDir: "../escape" }), /Invalid component/);
});

test("invalid UTF-8 package bytes are rejected without normalization", async (t) => {
  const { root, output } = await fixture(t);
  const bytes = Buffer.concat([Buffer.from('{"name":"'), Buffer.from([0xff]), Buffer.from('"}')]);
  await writeFile(join(output, "package.json"), bytes);
  await assert.rejects(inspectAppOutput(root, plan), /valid UTF-8 JSON/);
  assert.deepEqual(await readFile(join(output, "package.json")), bytes);
});

test("output refuses ancestor, descendant and dangling junctions", async (t) => {
  const { root, output } = await fixture(t);
  const actual = join(root, "actual");
  await mkdir(actual);
  const other = { name: "other", outputDir: "apps/other" };
  await symlink(join(root, "missing"), join(root, other.outputDir), "junction");
  await assert.rejects(preflightAppOutput(root, other), /[Ss]ymlink|junction/);
  await symlink(actual, join(output, "linked"), "junction");
  await assert.rejects(inspectAppOutput(root, plan), /symlink|junction/);
  const parent = join(root, "parent");
  await mkdir(parent);
  await symlink(actual, join(parent, "apps"), "junction");
  await assert.rejects(preflightAppOutput(parent, other), /[Ss]ymlink|junction/);
});

test("output refuses hard-linked files without changing their source", async (t) => {
  const { root, output } = await fixture(t);
  const source = join(root, "keep.txt");
  await writeFile(source, "keep");
  await link(source, join(output, "linked.txt"));
  await assert.rejects(inspectAppOutput(root, plan), /hard-linked/);
  assert.equal(await readFile(source, "utf8"), "keep");
});

test("output package size and total byte limits fail closed on sparse files", async (t) => {
  const { root, output } = await fixture(t);
  for (const [path, size, pattern] of [
    ["package.json", OUTPUT_LIMITS.packageBytes + 1, /package.json size limit/],
    ["oversized.bin", OUTPUT_LIMITS.totalBytes + 1, /total byte limit/],
  ]) {
    const file = await open(join(output, path), "w");
    await file.truncate(size);
    await file.close();
    if (path !== "package.json") await writeFile(join(output, "package.json"), "{}");
    await assert.rejects(inspectAppOutput(root, plan), pattern);
  }
});

test("output depth limit is bounded", async (t) => {
  const { root, output } = await fixture(t);
  await mkdir(join(output, ...Array(OUTPUT_LIMITS.depth + 1).fill("d")), { recursive: true });
  await assert.rejects(inspectAppOutput(root, plan), /depth limit/);
});

for (const name of ["DATABRICKS.YML", "DataBricks.Fixture-Only.yml", ".HARNESS-FIXTURE-ONLY.JSON", "PACKAGE.JSON"]) {
  test(`case alias ${name} is rejected consistently on every OS`, async (t) => {
    const { root, output } = await fixture(t);
    if (name === "PACKAGE.JSON") await rm(join(output, "package.json"));
    await writeFile(join(output, name), "{}");
    await assert.rejects(inspectAppOutput(root, plan), /noncanonical.*case alias/);
    assert.equal(await readFile(join(output, name), "utf8"), "{}");
  });
}

test("root control file content reads have a separate bound", async (t) => {
  const { root, output } = await fixture(t);
  const file = await open(join(output, "databricks.yml"), "w");
  try { await file.truncate(OUTPUT_LIMITS.controlFileBytes + 1); }
  finally { await file.close(); }
  await assert.rejects(inspectAppOutput(root, plan), /databricks.yml size limit/);
});

for (const name of ["databricks.yml", "databricks.fixture-only.yml", ".harness-fixture-only.json"]) {
  test(`root control directory ${name} fails without altering the tree`, async (t) => {
    const { root, output } = await fixture(t);
    await mkdir(join(output, name));
    await assert.rejects(inspectAppOutput(root, plan), /Root control file must be a regular file/);
    const { lstat } = await import("node:fs/promises");
    assert.equal((await lstat(join(output, name))).isDirectory(), true);
  });
}

test("output entry limit is bounded", async (t) => {
  const { root, output } = await fixture(t);
  for (let offset = 0; offset < OUTPUT_LIMITS.entries; offset += 64) {
    await Promise.all(Array.from({ length: Math.min(64, OUTPUT_LIMITS.entries - offset) }, (_, index) => writeFile(join(output, `f${offset + index}`), "")));
  }
  await assert.rejects(inspectAppOutput(root, plan), /entry limit/);
});
