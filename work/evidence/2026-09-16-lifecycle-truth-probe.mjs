// Independent reproduction of LIFE-01. No external commands other than the
// local Node harness; --skip-agent-skills and no profile prevent online setup.
// The source snapshots are read-only. Only a marked, dedicated temp is changed.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { freshTemplateFixture } from "../../tests/helpers/initialization.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const published = join(repository, ".harness/runtime/publish-0.6.1-final");
const prefix = "harness-lifecycle-truth-";
const temporaryBase = resolve(await realpath(tmpdir()));
const temporary = resolve(await mkdtemp(join(temporaryBase, prefix)));
const markerName = ".lifecycle-probe-owner";
const marker = randomUUID();
let owned = false;

function assertDedicatedTemp(path) {
  const resolved = resolve(path);
  const tail = relative(temporaryBase, resolved);
  assert.equal(dirname(resolved), temporaryBase, "Temp must be directly under the resolved system temp directory.");
  assert.ok(tail.startsWith(prefix) && !tail.includes(sep), "Unexpected temp path.");
  assert.notEqual(resolved.toLowerCase(), repository.toLowerCase());
  assert.notEqual(resolved.toLowerCase(), published.toLowerCase());
  return resolved;
}

async function present(path) {
  try { await access(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function setup(target, projectName) {
  const result = spawnSync(process.execPath, [
    join(target, "tools/harness.mjs"), "setup", "--project-name", projectName,
    "--skip-agent-skills",
  ], {
    cwd: target, shell: false, encoding: "utf8", timeout: 60_000,
    env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.status;
}

try {
  assertDedicatedTemp(temporary);
  assert.equal((await lstat(temporary)).isSymbolicLink(), false);
  await writeFile(join(temporary, markerName), marker, { flag: "wx" });
  owned = true;

  const version = JSON.parse(await readFile(join(published, "package.json"), "utf8")).version;
  assert.equal(version, "0.6.1", "The published-source fixture must be the retained 0.6.1 snapshot.");
  for (const [label, source] of [["published-0.6.1", published], ["working-tree", repository]]) {
    const target = join(temporary, label);
    assert.equal(dirname(target), temporary);
    const sourceCli = await readFile(join(source, "tools/harness.mjs"));
    await freshTemplateFixture(source, target);
    const firstSetup = setup(target, label);
    const product = await readFile(join(target, "product.config.json"));
    const bundle = await readFile(join(target, "databricks.yml"));
    const custom = [".claude/skills/project-only/SKILL.md", ".github/skills/project-only/SKILL.md"];
    for (const path of custom) {
      const absolute = join(target, path);
      assert.ok(absolute.startsWith(target + sep));
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, "# Synthetic project-specific skill\n", { flag: "wx" });
    }
    assert.deepEqual(await Promise.all(custom.map(path => present(join(target, path)))), [true, true]);

    const repeatedSetup = setup(target, label);
    const customSkillsRetained = await Promise.all(custom.map(path => present(join(target, path))));
    assert.deepEqual(customSkillsRetained, [false, false], "LIFE-01 no longer reproduces; reassess the finding.");
    assert.deepEqual(await readFile(join(target, "product.config.json")), product);
    assert.deepEqual(await readFile(join(target, "databricks.yml")), bundle);
    assert.deepEqual(await readFile(join(source, "tools/harness.mjs")), sourceCli, "Source must remain unchanged.");
    console.log(JSON.stringify({ label, firstSetup, repeatedSetup, customSkillsRetained, productAndBundleRetained: true }));
  }
  console.log(JSON.stringify({ finding: "LIFE-01", reproduced: true, networkUsed: false, realProjectChanged: false }));
} finally {
  // Do not remove a path that was replaced, redirected, or lost its ownership marker.
  if (owned) {
    const checked = assertDedicatedTemp(temporary);
    assert.equal((await lstat(checked)).isSymbolicLink(), false, "Refuse redirected temp cleanup.");
    assert.equal(resolve(await realpath(checked)).toLowerCase(), checked.toLowerCase(), "Temp identity changed.");
    assert.equal(await readFile(join(checked, markerName), "utf8"), marker, "Temp ownership marker changed.");
    await rm(checked, { recursive: true, force: true });
  }
}
