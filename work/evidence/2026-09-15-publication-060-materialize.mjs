// Copy only generated, verified release artifacts. Never rebuild from the dirty root.
import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256, writeJson } from "../../tools/lib/shared.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(root, ".harness/runtime/publish-0.6.0");
const payload = join(source, ".harness/releases/0.6.0");
const target = join(root, ".harness/releases/0.6.0");
assert.ok(target.startsWith(`${join(root, ".harness/releases")}${sep}`));
try { await lstat(target); throw new Error("Existing release is immutable."); } catch (e) { if (e.code !== "ENOENT") throw e; }
const manifest = await readJson(join(payload, "manifest.json"));
assert.equal(manifest.version, "0.6.0");
assert.equal(sha256(await readFile(join(payload, "manifest.json"))), sha256(await readFile(join(source, "harness/base-release.json"))));
const report = await readJson(join(source, "work/evidence/2026-09-15-publication-060-byte-validation.json"));
assert.equal(report.status, "pass");
assert.equal(report.manifestSha256, sha256(await readFile(join(payload, "manifest.json"))));
const full = await readFile(join(source, "work/evidence/2026-09-15-publication-060-full.log"), "utf8");
assert.match(full, /fail 0/);
assert.match(full, /duration_ms/);
const assembly = await readJson(join(root, "work/evidence/2026-09-15-publication-060-assembly.json"));
for (const [p, hash] of Object.entries(assembly.preserved)) assert.equal(sha256(await readFile(join(root, p))), hash, `Unexpected working file drift: ${p}`);
for (const item of manifest.managedFiles) {
  assert.ok(!/SCOPED_APPROVALS|scoped-approval/.test(item.path));
  const indexed = spawnSync("git", ["show", `:${item.path}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(indexed.status, 0, item.path);
  assert.equal(sha256(indexed.stdout), item.sha256, `Index/source mismatch: ${item.path}`);
  assert.equal(sha256(await readFile(join(source, item.path))), item.sha256);
  assert.equal(sha256(await readFile(join(payload, "files", item.path))), item.sha256);
}
for (const item of manifest.managedFiles) {
  const destination = join(target, "files", item.path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(payload, "files", item.path), destination);
}
await copyFile(join(payload, "manifest.json"), join(target, "manifest.json"));
await copyFile(join(source, "harness/base-release.json"), join(root, "harness/base-release.json"));
for (const p of ["work/evidence/2026-09-15-publication-060-full.log", "work/evidence/2026-09-15-publication-060-byte-validation.json"]) await copyFile(join(source, p), join(root, p));
await writeJson(join(root, "work/evidence/2026-09-15-publication-060-materialized.json"), { version: manifest.version, managedFiles: manifest.managedFiles.length, manifestSha256: report.manifestSha256, stageMatches: true, workingCandidatePreserved: true, createdAt: new Date().toISOString() });
console.log(JSON.stringify({ version: manifest.version, managedFiles: manifest.managedFiles.length, target }, null, 2));
