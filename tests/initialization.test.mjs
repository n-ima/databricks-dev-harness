import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";
import { freshTemplateFixture } from "./helpers/initialization.mjs";
import { sha256 } from "../tools/lib/shared.mjs";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), "harness-init-contract-"));
  t.after(async () => {
    assert.ok(resolve(temp).startsWith(`${resolve(tmpdir())}${sep}harness-init-contract-`));
    await rm(temp, { recursive: true, force: true });
  });
  return temp;
}

test("fresh fixture excludes initialized source product state without modifying it", async (t) => {
  const temp = await fixture(t);
  const source = join(temp, "source");
  const clean = await freshTemplateFixture(repo, source);
  const sentinels = {
    "product.config.json": '{"name":"existing-product"}\n', "databricks.yml": "# product-owned Bundle\n",
    "apps/existing-app/private.txt": "synthetic product sentinel", "docs/product/requirements/private.md": "synthetic requirement",
    "work/sessions/private.md": "synthetic history", ".harness/installed-release.json": "synthetic installed baseline",
    ".env.local": "synthetic local configuration", "harness/base-release.json": "synthetic source baseline",
  };
  for (const [path, content] of Object.entries(sentinels)) {
    await mkdir(dirname(join(source, path)), { recursive: true });
    await writeFile(join(source, path), content);
  }
  const destination = join(temp, "fresh");
  const rebuilt = await freshTemplateFixture(source, destination);
  assert.deepEqual(rebuilt, clean, "source initialization must not change the fresh fixture payload");
  for (const [path, content] of Object.entries(sentinels)) {
    await assert.rejects(readFile(join(destination, path)), { code: "ENOENT" });
    assert.equal(await readFile(join(source, path), "utf8"), content);
  }
  for (const [path, hash] of Object.entries(clean.files)) {
    assert.equal(sha256(await readFile(join(source, path))), hash);
  }
});

test("fixture refuses existing, overlapping and missing-input sources without writes", async (t) => {
  const temp = await fixture(t);
  const existing = join(temp, "existing");
  await mkdir(existing);
  await writeFile(join(existing, "keep.txt"), "keep");
  await assert.rejects(freshTemplateFixture(repo, existing), /already exists/);
  assert.equal(await readFile(join(existing, "keep.txt"), "utf8"), "keep");
  await assert.rejects(freshTemplateFixture(repo, repo), /overlap/);
  await assert.rejects(freshTemplateFixture(repo, join(repo, "must-not-create")), /overlap/);
  await assert.rejects(freshTemplateFixture(existing, join(temp, "missing-input")), /ENOENT/);
  await assert.rejects(readFile(join(temp, "missing-input", "README.md")), { code: "ENOENT" });
});

test("fresh fixture excludes case aliases of local state and original baseline", async (t) => {
  const temp = await fixture(t), source = join(temp, "source"), destination = join(temp, "fresh");
  const clean = await freshTemplateFixture(repo, source);
  const excluded = ["harness/.ENV.LOCAL", "harness/BASE-RELEASE.JSON", "tools/NODE_MODULES/private.json", "docs/harness/private.LOCAL.md"];
  for (const path of excluded) {
    await mkdir(dirname(join(source, path)), { recursive: true });
    await writeFile(join(source, path), "synthetic private sentinel");
  }
  assert.deepEqual(await freshTemplateFixture(source, destination), clean);
  for (const path of excluded) {
    await assert.rejects(readFile(join(destination, path)), { code: "ENOENT" });
    assert.equal(await readFile(join(source, path), "utf8"), "synthetic private sentinel");
  }
});

test("fixture refuses source and destination ancestor junctions and dangling outputs", async (t) => {
  const temp = await fixture(t);
  const sourceLink = join(temp, "source-link");
  await symlink(repo, sourceLink, "junction");
  await assert.rejects(freshTemplateFixture(sourceLink, join(temp, "output")), /[Ss]ymlink|junction/);
  const parentLink = join(temp, "parent-link");
  const actual = join(temp, "actual");
  await mkdir(actual);
  await symlink(actual, parentLink, "junction");
  await assert.rejects(freshTemplateFixture(repo, join(parentLink, "output")), /[Ss]ymlink|junction/);
  const dangling = join(temp, "dangling");
  await symlink(join(temp, "missing"), dangling, "junction");
  await assert.rejects(freshTemplateFixture(repo, dangling), /[Ss]ymlink|junction/);
  await assert.rejects(readFile(join(actual, "output", "README.md")), { code: "ENOENT" });
});

test("fixture refuses a linked allowlisted input before creating its destination", async (t) => {
  const temp = await fixture(t);
  const source = join(temp, "source");
  await freshTemplateFixture(repo, source);
  // Add a link inside an owned fixture directory, not a real repository input.
  await symlink(join(source, "docs"), join(source, "harness", "linked-input"), "junction");
  const output = join(temp, "output");
  await assert.rejects(freshTemplateFixture(source, output), /[Ss]ymlink|junction/);
  await assert.rejects(readFile(join(output, "README.md")), { code: "ENOENT" });
});
