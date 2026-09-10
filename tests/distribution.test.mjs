import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";
import { createRelease, normalizeManagedText, registerBaseline, planUpdate, applyUpdate } from "../tools/lib/distribution.mjs";
import { exists, readJson, sha256, writeJson } from "../tools/lib/shared.mjs";

async function fixture(t, files = {}) {
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "harness-distribution-test-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`));
    await rm(root, { recursive: true, force: true });
  });
  for (const [path, value] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
  }
  return root;
}

async function sourceFixture(t) {
  return fixture(t, {
    "harness.config.json": JSON.stringify({ harnessVersion: "1.0.0" }),
    "AGENTS.md": "Harness instructions v1.\n",
    "tools/harness.mjs": "// Harness tool v1\n",
    "docs/harness/design/ARCHITECTURE.md": "Harness design.\n",
    "docs/product/requirements/private.md": "Product-owned requirements.\n",
    "work/sessions/private.md": "Product-owned session.\n",
    ".harness/local.json": "Local connection configuration.\n",
    "apps/customer-app.ts": "Product-owned app.\n",
    "package.json": "Product-owned dependencies.\n",
    "README.md": "Product-owned readme.\n",
  });
}

async function releaseAt(root, version) {
  await writeJson(join(root, "harness.config.json"), { harnessVersion: version });
  return createRelease(root, { version });
}

async function installedFixture(t) {
  const source = await sourceFixture(t);
  const first = await createRelease(source);
  const target = await fixture(t, { "docs/product/keep.md": "Keep product document.\n", ".harness/local.json": "Keep local connection.\n", "apps/keep.ts": "Keep app code.\n" });
  const plan = await planUpdate(target, { source: join(source, first.path) });
  await applyUpdate(target, { plan: plan.path, yes: true });
  return { source, first, target };
}

test("release owns only harness assets, hashes payload bytes and leaves product/local files out", async (t) => {
  const root = await sourceFixture(t);
  const release = await createRelease(root);
  const paths = release.manifest.managedFiles.map((item) => item.path);
  assert.ok(paths.includes("tools/harness.mjs"));
  assert.ok(paths.includes("docs/harness/design/ARCHITECTURE.md"));
  for (const path of paths) assert.ok(!path.startsWith("docs/product/") && !path.startsWith("work/") && !path.startsWith("apps/") && !path.startsWith(".harness/") && !["README.md", "package.json"].includes(path));
  for (const entry of release.manifest.managedFiles) assert.equal(sha256(await readFile(join(root, release.path, "files", entry.path))), entry.sha256);
  await assert.rejects(createRelease(root), /immutable/);
});

test("release rejects mismatched versions and escaping outputs", async (t) => {
  const root = await sourceFixture(t);
  await assert.rejects(createRelease(root, { version: "2.0.0" }), /must match/);
  await assert.rejects(createRelease(root, { output: ".harness/releases/../../escaped" }), /Invalid/);
});

test("normalization requires explicit yes, includes provider text and preserves product files and original baseline bytes", async (t) => {
  const files = {
    ".gitattributes": "* text=auto eol=lf\r\n",
    ".editorconfig": "root = true\r\n",
    "AGENTS.md": "Downstream policy customization.\r\n",
    ".claude/skills/example/SKILL.md": "Generated provider skill.\r\n",
    ".github/skills/example/SKILL.md": "Generated provider skill.\r\n",
    "scripts/setup.ps1": "Write-Host 'Japanese: 日本語'\r\n",
    "docs/harness/with-bom.md": "\uFEFFText with UTF-8 BOM.\r\n",
    "docs/product/keep.md": "Product-owned content.\r\n",
    "README.md": "Product-owned readme.\r\n",
    "harness/base-release.json": "{\r\n  \"original\": true\r\n}\r\n",
    ".harness/installed-release.json": "{\r\n  \"original\": true\r\n}\r\n",
  };
  const root = await fixture(t, files);
  await assert.rejects(normalizeManagedText(root), /--yes/);
  await assert.rejects(normalizeManagedText(root, { yes: "true" }), /--yes/);
  assert.equal(await readFile(join(root, "AGENTS.md"), "utf8"), files["AGENTS.md"]);
  const normalized = await normalizeManagedText(root, { yes: true });
  assert.equal(normalized.baselineChanged, false);
  assert.equal(normalized.humanReviewRequired, true);
  const unchanged = new Set(["docs/product/keep.md", "README.md", "harness/base-release.json", ".harness/installed-release.json"]);
  assert.deepEqual(normalized.changedFiles, Object.keys(files).filter((path) => !unchanged.has(path)).sort());
  for (const [path, content] of Object.entries(files)) assert.equal(await readFile(join(root, path), "utf8"), unchanged.has(path) ? content : content.replaceAll("\r\n", "\n"), path);
  assert.deepEqual((await normalizeManagedText(root, { yes: true })).changedFiles, []);
});

test("release refuses CRLF text until normalization, but binary extensions, NUL and invalid UTF-8 remain byte-identical", async (t) => {
  const root = await sourceFixture(t);
  const binary = {
    "tools/extension.bin": Buffer.from("ASCII bytes\r\n"),
    "tools/image.PNG": Buffer.from("ASCII image fixture\r\n"),
    "tools/with-nul.md": Buffer.from([0x41, 0x00, 0x0d, 0x0a]),
    "tools/invalid-utf8.mjs": Buffer.from([0xff, 0xc3, 0x28, 0x0d, 0x0a]),
  };
  for (const [path, bytes] of Object.entries(binary)) await writeFile(join(root, path), bytes);
  await writeFile(join(root, "AGENTS.md"), "Harness instructions v1.\r\n");
  await assert.rejects(createRelease(root), /CRLF.*AGENTS\.md.*release normalize --yes/);
  assert.equal(await exists(join(root, ".harness/releases/1.0.0")), false);
  await normalizeManagedText(root, { yes: true });
  const release = await createRelease(root);
  const agents = release.manifest.managedFiles.find((item) => item.path === "AGENTS.md");
  assert.equal(agents.sha256, sha256("Harness instructions v1.\n"));
  for (const [path, bytes] of Object.entries(binary)) {
    assert.deepEqual(await readFile(join(root, path)), bytes, path);
    assert.deepEqual(await readFile(join(root, release.path, "files", path)), bytes, path);
  }
});

test("normalization rejects managed junctions before writing any text", async (t) => {
  const root = await fixture(t, { "AGENTS.md": "Do not change before all paths pass.\r\n" });
  const outside = await fixture(t, { "external.md": "External bytes.\r\n" });
  try { await symlink(outside, join(root, "tools"), process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.skip("This host does not permit directory links."); return; } throw error; }
  await assert.rejects(normalizeManagedText(root, { yes: true }), /Symlink/);
  assert.equal(await readFile(join(root, "AGENTS.md"), "utf8"), "Do not change before all paths pass.\r\n");
  assert.equal(await readFile(join(outside, "external.md"), "utf8"), "External bytes.\r\n");
});

test("a dry-run plan makes no managed changes and application needs explicit yes", async (t) => {
  const source = await sourceFixture(t), release = await createRelease(source), target = await fixture(t);
  const plan = await planUpdate(target, { source: join(source, release.path) });
  assert.equal(plan.dryRun, true);
  assert.equal(await exists(join(target, "AGENTS.md")), false);
  await assert.rejects(applyUpdate(target, { plan: plan.path }), /--yes/);
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: "true" }), /--yes/);
  const result = await applyUpdate(target, { plan: plan.path, yes: true });
  assert.equal(result.status, "applied");
  assert.ok(await exists(join(target, ".harness/installed-release.json")));
});

test("matching first-template bytes are adopted while unmatched existing files conflict", async (t) => {
  const source = await sourceFixture(t), release = await createRelease(source);
  const target = await fixture(t, { "AGENTS.md": "Harness instructions v1.\n" });
  const plan = await planUpdate(target, { source: join(source, release.path) });
  assert.equal(plan.contract.operations.find((item) => item.path === "AGENTS.md").action, "adopt");
  const other = await fixture(t, { "AGENTS.md": "Custom downstream instructions.\n" });
  const conflict = await planUpdate(other, { source: join(source, release.path) });
  assert.equal(conflict.canApply, false);
  await assert.rejects(applyUpdate(other, { plan: conflict.path, yes: true }), /conflicts/);
  assert.equal(await readFile(join(other, "AGENTS.md"), "utf8"), "Custom downstream instructions.\n");
});

test("upgrade preserves excluded files and backs up every replaced or deleted file", async (t) => {
  const { source, target } = await installedFixture(t);
  await writeFile(join(source, "AGENTS.md"), "Harness instructions v2.\n");
  await unlink(join(source, "tools/harness.mjs"));
  const release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  const result = await applyUpdate(target, { plan: plan.path, yes: true });
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "Harness instructions v2.\n");
  assert.equal(await readFile(join(target, result.backupPath, "files/AGENTS.md"), "utf8"), "Harness instructions v1.\n");
  assert.equal(await readFile(join(target, result.backupPath, "files/tools/harness.mjs"), "utf8"), "// Harness tool v1\n");
  assert.equal(await exists(join(target, "tools/harness.mjs")), false);
  assert.deepEqual(result.deletedFiles, ["tools/harness.mjs"]);
  assert.equal(await readFile(join(target, "docs/product/keep.md"), "utf8"), "Keep product document.\n");
  assert.equal(await readFile(join(target, ".harness/local.json"), "utf8"), "Keep local connection.\n");
  assert.equal(await readFile(join(target, "apps/keep.ts"), "utf8"), "Keep app code.\n");
  assert.equal((await readJson(join(target, result.backupPath, "recovery.json"))).status, "applied");
});

test("downstream modified and deleted files are conflicts, never silently overwritten", async (t) => {
  const { source, target } = await installedFixture(t);
  await writeFile(join(target, "AGENTS.md"), "Local policy extension.\n");
  await unlink(join(target, "tools/harness.mjs"));
  const release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  assert.equal(plan.conflicts.length, 2);
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /conflicts/);
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "Local policy extension.\n");
});

test("edits after planning invalidate application before managed writes", async (t) => {
  const { source, target } = await installedFixture(t);
  await writeFile(join(source, "AGENTS.md"), "Incoming.\n");
  const release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  await writeFile(join(target, "tools/harness.mjs"), "Concurrent local change.\n");
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /changed since planning/);
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "Harness instructions v1.\n");
});

test("source payload tampering after planning is rejected", async (t) => {
  const { source, target } = await installedFixture(t), release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  await writeFile(join(source, release.path, "files/AGENTS.md"), "Tampered payload.\n");
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /hash mismatch/);
});

test("malicious manifests cannot own product, local config, case collisions or escaping paths", async (t) => {
  for (const path of ["docs/product/private.md", ".harness/local.json", "../escape.md", "tools/../../escape.md", "tools\\escape.mjs", "tools/.env", "tools/CON.txt"]) {
    const source = await sourceFixture(t), release = await createRelease(source), target = await fixture(t);
    const manifest = structuredClone(release.manifest);
    manifest.managedFiles[0].path = path;
    await writeJson(join(source, release.manifestPath), manifest);
    await assert.rejects(planUpdate(target, { source: join(source, release.path) }), /excluded|Invalid/);
  }
});

test("same-version mutation and downgrade are rejected", async (t) => {
  const { source, target, first } = await installedFixture(t);
  await writeFile(join(source, "AGENTS.md"), "Same version changed.\n");
  const repacked = await createRelease(source, { output: ".harness/releases/repacked" });
  await assert.rejects(planUpdate(target, { source: join(source, repacked.path) }), /same release version/);
  const next = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, next.path) });
  await applyUpdate(target, { plan: plan.path, yes: true });
  await assert.rejects(planUpdate(target, { source: join(source, first.path) }), /downgrade/);
});

test("update plan edits and wrong target repository are rejected", async (t) => {
  const { source, target } = await installedFixture(t), release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  const persisted = await readJson(join(target, plan.path));
  persisted.contract.operations[0].action = "delete";
  await writeJson(join(target, plan.path), persisted);
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /hash is invalid/);
  persisted.planHash = sha256(JSON.stringify(persisted.contract));
  const other = await fixture(t);
  await writeJson(join(other, ".harness/updates/copied.json"), persisted);
  await assert.rejects(applyUpdate(other, { plan: ".harness/updates/copied.json", yes: true }), /different target/);
});

test("managed symlinks and junctions are rejected in release and destination", async (t) => {
  const source = await sourceFixture(t), outside = await fixture(t, { "payload.mjs": "External payload.\n" });
  try { await symlink(join(outside, "payload.mjs"), join(source, "tools/link.mjs"), "file"); }
  catch (error) { if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.skip("This host does not permit test symlinks."); return; } throw error; }
  await assert.rejects(createRelease(source), /Symlink/);
  await unlink(join(source, "tools/link.mjs"));
  const release = await createRelease(source), target = await fixture(t);
  await symlink(join(source, "tools"), join(target, "tools"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(planUpdate(target, { source: join(source, release.path) }), /Symlink/);
});

test("directory junctions are rejected even on Windows without file-symlink privilege", async (t) => {
  const source = await sourceFixture(t), outside = await fixture(t, { "payload.mjs": "External payload.\n" });
  const link = join(source, "tools", "linked-directory");
  try { await symlink(outside, link, process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.skip("This host does not permit directory links."); return; } throw error; }
  await assert.rejects(createRelease(source), /Symlink/);
  const cleanSource = await sourceFixture(t), release = await createRelease(cleanSource), target = await fixture(t);
  await symlink(outside, join(target, "tools"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(planUpdate(target, { source: join(cleanSource, release.path) }), /Symlink/);
});

test("new upstream files do not overwrite untracked downstream additions", async (t) => {
  const { source, target } = await installedFixture(t);
  await writeFile(join(source, "tools/new-tool.mjs"), "Upstream addition.\n");
  await writeFile(join(target, "tools/new-tool.mjs"), "Local unrelated tool.\n");
  const release = await releaseAt(source, "1.1.0"), plan = await planUpdate(target, { source: join(source, release.path) });
  assert.equal(plan.conflicts[0].path, "tools/new-tool.mjs");
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /conflicts/);
});

test("installed baseline changes invalidate a previously reviewed plan", async (t) => {
  const { source, target } = await installedFixture(t), release = await releaseAt(source, "1.1.0");
  const plan = await planUpdate(target, { source: join(source, release.path) });
  const baseline = await readJson(join(target, ".harness/installed-release.json"));
  baseline.installedAt = "2026-09-04T00:00:00Z";
  await writeJson(join(target, ".harness/installed-release.json"), baseline);
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /baseline changed/);
});

test("case-colliding payload paths are rejected on every operating system", async (t) => {
  const source = await sourceFixture(t), release = await createRelease(source), target = await fixture(t);
  const manifest = structuredClone(release.manifest);
  manifest.managedFiles.push({ ...manifest.managedFiles.find((item) => item.path === "tools/harness.mjs"), path: "tools/HARNESS.mjs" });
  await writeJson(join(source, release.manifestPath), manifest);
  await assert.rejects(planUpdate(target, { source: join(source, release.path) }), /case-colliding/);
});

test("release/apply keeps provider rules, the complete harness guide and harness test files together", async (t) => {
  const source = await sourceFixture(t), target = await fixture(t);
  const required = [
    ".gitattributes", ".editorconfig",
    "vendor/README.md", "vendor/databricks-skills/LICENSE", "vendor/databricks-skills/NOTICE", "vendor/databricks-skills/THIRD_PARTY.md",
    ".claude/skills/LICENSE", ".claude/skills/NOTICE", ".github/skills/LICENSE", ".github/skills/NOTICE", "tests/vendor-legal.test.mjs",
    ".claude/rules/documentation.md", ".claude/rules/harness.md", ".claude/rules/product.md",
    ".github/instructions/documentation.instructions.md", ".github/hooks/harness.json",
    "docs/USAGE.md", "docs/site/index.html", "docs/site/guide.css", "docs/site/guide.js",
    "tests/harness.test.mjs", "tests/contracts.test.mjs", "tests/evaluation.test.mjs", "tests/distribution.test.mjs",
    "tests/hooks.test.mjs", "tests/memory.test.mjs", "tests/scaffold-data.test.mjs", "tests/docs.test.mjs", "tests/loop-concurrency.test.mjs",
    "tests/approval.test.mjs",
    "tests/initialization.test.mjs", "tests/helpers/initialization.mjs", "tests/scaffold-output.test.mjs",
    "harness/fixtures/initialization/manifest.json", "tools/lib/scaffold-output.mjs",
  ];
  for (const path of required) {
    await mkdir(dirname(join(source, path)), { recursive: true });
    await writeFile(join(source, path), `Synthetic completeness fixture for ${path}.\n`);
  }
  const release = await createRelease(source);
  const managed = new Set(release.manifest.managedFiles.map((item) => item.path));
  for (const path of required) assert.ok(managed.has(path), `Missing harness-owned file: ${path}`);
  const plan = await planUpdate(target, { source: join(source, release.path) });
  await applyUpdate(target, { plan: plan.path, yes: true });
  for (const path of required) assert.equal(await readFile(join(target, path), "utf8"), await readFile(join(source, path), "utf8"), `Release/apply lost or changed ${path}`);
});

test("registering original upstream metadata preserves pre-existing downstream changes as update conflicts", async (t) => {
  const source = await sourceFixture(t), original = await createRelease(source), target = await fixture(t);
  for (const entry of original.manifest.managedFiles) {
    await mkdir(dirname(join(target, entry.path)), { recursive: true });
    await writeFile(join(target, entry.path), await readFile(join(source, original.path, "files", entry.path)));
  }
  await writeFile(join(target, "AGENTS.md"), "Downstream changes made before initial setup.\n");
  await writeJson(join(target, "harness/base-release.json"), original.manifest);
  const registered = await registerBaseline(target, { manifest: "harness/base-release.json" });
  assert.equal(registered.status, "registered");
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "Downstream changes made before initial setup.\n");
  const baseline = await readJson(join(target, ".harness/installed-release.json"));
  assert.equal(baseline.manifest.managedFiles.find((entry) => entry.path === "AGENTS.md").sha256, original.manifest.managedFiles.find((entry) => entry.path === "AGENTS.md").sha256);
  assert.equal(baseline.provenance.currentProductFilesSnapshotted, false);
  await writeFile(join(source, "AGENTS.md"), "New upstream instructions.\n");
  const next = await releaseAt(source, "1.1.0"), plan = await planUpdate(target, { source: join(source, next.path) });
  assert.equal(plan.canApply, false);
  assert.ok(plan.conflicts.some((entry) => entry.path === "AGENTS.md"));
  await assert.rejects(applyUpdate(target, { plan: plan.path, yes: true }), /conflicts/);
});

test("baseline registration is idempotent only for the original manifest and refuses overwrite", async (t) => {
  const source = await sourceFixture(t), original = await createRelease(source), target = await fixture(t);
  await writeJson(join(target, "harness/base-release.json"), original.manifest);
  await registerBaseline(target, { manifest: "harness/base-release.json" });
  const firstBytes = await readFile(join(target, ".harness/installed-release.json"), "utf8");
  assert.equal((await registerBaseline(target, { manifest: "harness/base-release.json" })).status, "already-registered");
  assert.equal(await readFile(join(target, ".harness/installed-release.json"), "utf8"), firstBytes);
  const next = await releaseAt(source, "1.1.0");
  await writeJson(join(target, "harness/different-upstream.json"), next.manifest);
  await assert.rejects(registerBaseline(target, { manifest: "harness/different-upstream.json" }), /never overwrites/);
  assert.equal(await readFile(join(target, ".harness/installed-release.json"), "utf8"), firstBytes);
});

test("base-release metadata is excluded from snapshots to avoid self-hashing", async (t) => {
  const source = await sourceFixture(t), original = await createRelease(source);
  await writeJson(join(source, "harness/base-release.json"), original.manifest);
  const repacked = await createRelease(source, { output: ".harness/releases/with-baseline" });
  assert.ok(!repacked.manifest.managedFiles.some((entry) => entry.path === "harness/base-release.json"));
  assert.equal(await exists(join(source, repacked.path, "files/harness/base-release.json")), false);
});

test("baseline registration rejects escaping and invalid upstream manifests", async (t) => {
  const target = await fixture(t);
  await assert.rejects(registerBaseline(target, { manifest: "../outside.json" }), /Invalid/);
  await writeJson(join(target, "harness/base-release.json"), { version: "1.0.0" });
  await assert.rejects(registerBaseline(target, { manifest: "harness/base-release.json" }), /Invalid release manifest/);
  assert.equal(await exists(join(target, ".harness/installed-release.json")), false);
});
