#!/usr/bin/env node
// Verify raw release hashes against this checkout and a fresh Git checkout with
// core.autocrlf=true. All commits are in a disposable local test repository.
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { commandResult, pathInside, readJson, sha256, writeJson } from "./lib/shared.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = await readJson(join(root, "harness/base-release.json"));
assert.equal(manifest.schemaVersion, 1);
assert.ok(Array.isArray(manifest.managedFiles) && manifest.managedFiles.length);
for (const item of manifest.managedFiles) {
  assert.equal(sha256(await readFile(pathInside(root, item.path))), item.sha256, `Source changed since stamp: ${item.path}`);
}
const temporaryBase = resolve(tmpdir());
const temporary = await mkdtemp(join(temporaryBase, "harness-release-check-"));
const source = join(temporary, "source");
const checkout = join(temporary, "checkout");
const emptyGitConfiguration = join(temporary, "empty-git-templates-and-hooks");
function git(args, cwd = source) {
  const result = commandResult("git", ["-c", `core.hooksPath=${emptyGitConfiguration}`, "-c", `init.templateDir=${emptyGitConfiguration}`, ...args], { cwd, timeout: 60_000 });
  assert.ok(result.ok, `Temporary Git validation failed: ${result.stderr || result.error?.message}`);
}
try {
  await mkdir(source);
  await mkdir(emptyGitConfiguration);
  for (const item of manifest.managedFiles) {
    const destination = pathInside(source, item.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(pathInside(root, item.path), destination);
  }
  git(["init", "--quiet"]);
  git(["config", "core.autocrlf", "true"]);
  git(["add", "--all"]);
  git(["-c", "user.name=Harness validation fixture", "-c", "user.email=harness-test@example.invalid", "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-verify", "-m", "Temporary release-byte fixture"]);
  git(["clone", "--quiet", "--no-hardlinks", "-c", "core.autocrlf=true", source, checkout], temporary);
  for (const item of manifest.managedFiles) {
    assert.equal(sha256(await readFile(pathInside(checkout, item.path))), item.sha256, `Git checkout changed release bytes: ${item.path}`);
  }
  const report = { checkedAt: new Date().toISOString(), status: "pass", version: manifest.version,
    managedFiles: manifest.managedFiles.length, sourceHashParity: true, freshGitCheckoutHashParity: true,
    checkoutCoreAutocrlf: true, networkUsed: false, realRepositoryCommitted: false,
    manifestSha256: sha256(await readFile(join(root, "harness/base-release.json"))),
    limitations: ["Local Windows Git roundtrip only; hosted Linux/macOS CI remains separate.", "Byte parity does not authenticate the release publisher or certify product functionality."] };
  await writeJson(join(root, "work/evidence/release-byte-validation.json"), report);
  console.log(JSON.stringify(report, null, 2));
} finally {
  assert.ok(temporary.startsWith(`${temporaryBase}${sep}`) && temporary.slice(temporaryBase.length + 1).startsWith("harness-release-check-"));
  await rm(temporary, { recursive: true, force: true });
}
