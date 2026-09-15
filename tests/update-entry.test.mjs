import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import * as distribution from "../tools/lib/distribution.mjs";
import { readJson, sha256, writeJson } from "../tools/lib/shared.mjs";

const cli = fileURLToPath(new URL("../tools/update-harness.mjs", import.meta.url));
const put = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
async function fixture(t) {
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "harness-update-entry-"));
  t.after(async () => { assert.ok(root.startsWith(`${base}${sep}`)); await rm(root, { recursive: true, force: true }); });
  t.mock.method(console, "log", () => {});
  const source = join(root, "source"), target = join(root, "project");
  await put(source, "harness.config.json", JSON.stringify({ harnessVersion: "1.0.0" }));
  await put(source, "AGENTS.md", "baseline\n");
  await put(source, "tools/example.mjs", "throw Error('SOURCE MUST NOT EXECUTE');\n");
  const old = await distribution.createRelease(source);
  await mkdir(target);
  const initial = await distribution.planUpdate(target, { source: join(source, old.path) });
  await distribution.applyUpdate(target, { plan: initial.path, yes: true });
  const protectedFiles = { "product.config.json": "{}", "docs/product/design.md": "日本語の案件仕様\r\n", "work/sessions/active.md": "進行中", "apps/main.ts": "uncommitted", "package.json": "{\"private\":true}", ".env": "TEST_ONLY_SECRET=fixture", ".harness/local.json": "{}", "README.md": "案件", ".github/skills/custom/SKILL.md": "独自のskill" };
  for (const [path, bytes] of Object.entries(protectedFiles)) await put(target, path, bytes);
  await put(source, "AGENTS.md", "updated\n");
  await put(source, "harness.config.json", JSON.stringify({ harnessVersion: "1.1.0" }));
  const next = await distribution.createRelease(source);
  await writeJson(join(source, "harness/base-release.json"), next.manifest);
  return { root, source, target, next, protectedFiles, payload: join(source, next.path) };
}
async function unchanged(target, files) { for (const [path, bytes] of Object.entries(files)) assert.equal(await readFile(join(target, path), "utf8"), bytes, path); }

test("SU-05 natural update requests route to the updater without granting execution permission", () => {
  const runner = fileURLToPath(new URL("../tools/harness.mjs", import.meta.url));
  for (const noun of ["ハーネス", "harness", ".harness"]) {
    const run = spawnSync(process.execPath, [runner, "route", "--prompt", `この案件の${noun}を、D:/tools/harness から更新して。`], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    assert.equal(result.route, "update-harness");
    assert.equal(result.executionAuthorized, false);
  }
  const advice = spawnSync(process.execPath, [runner, "route", "--prompt", "ハーネス更新の仕組みを改善してください"], { encoding: "utf8" });
  assert.equal(JSON.parse(advice.stdout).route, "improve-harness");
});

test("SU-01/02 source tree without Git and release payload make equivalent dry plans; defaults preserve product bytes", async t => {
  const f = await fixture(t);
  const a = await distribution.planLocalUpdate(f.target, { source: f.source });
  const b = await distribution.planLocalUpdate(f.target, { source: f.payload });
  assert.deepEqual(a.contract.operations, b.contract.operations);
  assert.equal(await readFile(join(f.target, "AGENTS.md"), "utf8"), "baseline\n");
  assert.equal(a.canApply, true);
  await unchanged(f.target, f.protectedFiles);
  const result = await distribution.applyUpdate(f.target, { plan: a.path, yes: true });
  assert.equal(result.managedFilesVerified, f.next.manifest.managedFiles.length);
  await unchanged(f.target, f.protectedFiles);
  for (const item of f.next.manifest.managedFiles) assert.equal(sha256(await readFile(join(f.target, item.path))), item.sha256);
  assert.equal(await readFile(join(f.target, result.backupPath, "files/AGENTS.md"), "utf8"), "baseline\n");
  assert.equal((await readJson(join(f.target, ".harness/installed-release.json"))).manifest.version, "1.1.0");
});
test("SU-01 clean expanded source needs no cached release; source snapshot remains fixed after original changes", async t => {
  const f = await fixture(t);
  const expanded = join(f.root, "expanded zip");
  for (const item of f.next.manifest.managedFiles) await put(expanded, item.path, await readFile(join(f.source, item.path)));
  await put(expanded, "harness/base-release.json", JSON.stringify(f.next.manifest));
  const plan = await distribution.planLocalUpdate(f.target, { source: expanded });
  await put(expanded, "AGENTS.md", "later change");
  await distribution.applyUpdate(f.target, { plan: plan.path, yes: true });
  assert.equal(await readFile(join(f.target, "AGENTS.md"), "utf8"), "updated\n");
});
test("SU-01 dirty source uses only a matching stamped immutable payload, not dirty bytes", async t => {
  const f = await fixture(t);
  await put(f.source, "AGENTS.md", "unadopted draft");
  const plan = await distribution.planLocalUpdate(f.target, { source: f.source });
  assert.equal(plan.contract.sourceSelection.kind, "stamped-release");
  await distribution.applyUpdate(f.target, { plan: plan.path, yes: true });
  assert.equal(await readFile(join(f.target, "AGENTS.md"), "utf8"), "updated\n");
});
for (const modification of ["edit", "delete", "collision"]) test(`SU-02 local ${modification} refuses all managed writes without preserve flag`, async t => {
  const f = await fixture(t);
  if (modification === "delete") await unlink(join(f.target, "AGENTS.md"));
  else if (modification === "edit") await put(f.target, "AGENTS.md", "local choice");
  else {
    await put(f.source, "tools/new.mjs", "incoming");
    await put(f.source, "harness.config.json", JSON.stringify({ harnessVersion: "1.2.0" }));
    const newer = await distribution.createRelease(f.source);
    f.payload = join(f.source, newer.path);
    await put(f.target, "tools/new.mjs", "local");
  }
  const plan = await distribution.planLocalUpdate(f.target, { source: f.payload });
  assert.equal(plan.canApply, false);
  await assert.rejects(distribution.applyUpdate(f.target, { plan: plan.path, yes: true }), /conflict/i);
  await unchanged(f.target, f.protectedFiles);
  assert.equal(JSON.parse(await readFile(join(f.target, "harness.config.json"))).harnessVersion, "1.0.0");
});
test("SU-03 unknown baseline and non-product target fail closed", async t => {
  const f = await fixture(t);
  await unlink(join(f.target, ".harness/installed-release.json"));
  await assert.rejects(distribution.planLocalUpdate(f.target, { source: f.payload }), /baseline|元版/);
  await assert.rejects(distribution.planLocalUpdate(f.source, { source: f.target }), /product.config|案件/);
});
test("SU-03 same or nested source and target are refused", async t => {
  const f = await fixture(t);
  for (const source of [f.target, f.root, parse(f.target).root, join(f.target, "upstream")]) await assert.rejects(distribution.planLocalUpdate(f.target, { source }), /重複|overlap|包含/);
});
test("SU-03 modified release and mismatched stamped cache are refused", async t => {
  const f = await fixture(t);
  await put(f.payload, "files/AGENTS.md", "tampered");
  await assert.rejects(distribution.planLocalUpdate(f.target, { source: f.payload }), /hash/);
  await assert.rejects(distribution.planLocalUpdate(f.target, { source: f.source }), /hash/);
});
test("SU-03 snapshot tampering, missing approval and stale target refuse application", async t => {
  const f = await fixture(t);
  const a = await distribution.planLocalUpdate(f.target, { source: f.payload });
  await assert.rejects(distribution.applyUpdate(f.target, { plan: a.path }), /--yes/);
  await put(a.contract.sourceRoot, "files/AGENTS.md", "tampered");
  await assert.rejects(distribution.applyUpdate(f.target, { plan: a.path, yes: true }), /hash/);
  const b = await distribution.planLocalUpdate(f.target, { source: f.payload });
  await put(f.target, "AGENTS.md", "editing after plan");
  await assert.rejects(distribution.applyUpdate(f.target, { plan: b.path, yes: true }), /changed/);
});
test("SU-03 source junction is rejected", async t => {
  const f = await fixture(t), alias = join(f.root, "alias");
  await symlink(f.source, alias, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(distribution.planLocalUpdate(f.target, { source: alias }), /Symlink|junction/);
});
test("SU-03/05 portable CLI targets cwd, rejects unknown/duplicate arguments and does not execute source code", async t => {
  const f = await fixture(t);
  for (const args of [["plan", "--source", f.source, "--force"], ["apply", "--plan", "a", "--yes", "--yes"], ["plan", "--source", f.source, "--yes"], ["apply", "--plan", "a"]]) {
    assert.notEqual(spawnSync(process.execPath, [cli, ...args], { cwd: f.target, encoding: "utf8" }).status, 0);
  }
  const run = spawnSync(process.execPath, [cli, "plan", "--source", f.source], { cwd: f.target, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.target, f.target);
  assert.equal(result.status, "計画済み");
  const apply = spawnSync(process.execPath, [cli, "apply", "--plan", result.plan, "--yes"], { cwd: f.target, encoding: "utf8" });
  assert.equal(apply.status, 0, apply.stderr);
  await unchanged(f.target, f.protectedFiles);
});

test("SU-04 post-write corruption records interruption, keeps old baseline and original backups, and rejects replay", async t => {
  const f = await fixture(t);
  const plan = await distribution.planLocalUpdate(f.target, { source: f.payload });
  const previous = await readFile(join(f.target, ".harness/installed-release.json"));
  const originalRename = fs.rename;
  let injected = false;
  const renameMock = t.mock.method(fs, "rename", async (from, to) => {
    const value = await originalRename(from, to);
    if (!injected && to === join(f.target, "AGENTS.md")) {
      injected = true;
      await put(f.target, "tools/example.mjs", "concurrent corruption of a kept file");
    }
    return value;
  });
  syncBuiltinESMExports();
  t.after(() => { renameMock.mock.restore(); syncBuiltinESMExports(); });
  await assert.rejects(distribution.applyUpdate(f.target, { plan: plan.path, yes: true }), /Post-update verification failed/);
  assert.equal(injected, true);
  assert.deepEqual(await readFile(join(f.target, ".harness/installed-release.json")), previous);
  const backup = join(f.target, ".harness/backups", plan.contract.id);
  assert.equal((await readJson(join(backup, "recovery.json"))).status, "interrupted");
  assert.equal(await readFile(join(backup, "files/AGENTS.md"), "utf8"), "baseline\n");
  await assert.rejects(distribution.applyUpdate(f.target, { plan: plan.path, yes: true }), /changed|already|interrupted/);
  await unchanged(f.target, f.protectedFiles);
});

test("SU-05 legacy project bootstraps from external runner then uses its own installed runner for next update", async t => {
  const f = await fixture(t);
  const repo = fileURLToPath(new URL("../", import.meta.url));
  for (const path of ["tools/update-harness.mjs", "tools/lib/distribution.mjs", "tools/lib/shared.mjs"]) await put(f.source, path, await readFile(join(repo, path)));
  await put(f.source, "harness.config.json", JSON.stringify({ harnessVersion: "1.2.0" }));
  const second = await distribution.createRelease(f.source);
  const external = spawnSync(process.execPath, [cli, "plan", "--source", join(f.source, second.path), "--target", f.target], { cwd: f.source, encoding: "utf8" });
  assert.equal(external.status, 0, external.stderr);
  const plan = JSON.parse(external.stdout);
  const install = spawnSync(process.execPath, [cli, "apply", "--plan", plan.plan, "--yes", "--target", f.target], { cwd: f.source, encoding: "utf8" });
  assert.equal(install.status, 0, install.stderr);
  await put(f.source, "harness.config.json", JSON.stringify({ harnessVersion: "1.3.0" }));
  const third = await distribution.createRelease(f.source);
  const local = spawnSync(process.execPath, [join(f.target, "tools/update-harness.mjs"), "plan", "--source", join(f.source, third.path)], { cwd: f.target, encoding: "utf8" });
  assert.equal(local.status, 0, local.stderr);
  assert.equal(JSON.parse(local.stdout).fromVersion, "1.2.0");
  assert.equal(JSON.parse(local.stdout).toVersion, "1.3.0");
  await unchanged(f.target, f.protectedFiles);
});
