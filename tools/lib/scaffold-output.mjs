import { lstat, open, opendir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathInside, redact, sha256 } from "./shared.mjs";

export const OUTPUT_LIMITS = Object.freeze({ entries: 20000, depth: 12, packageBytes: 1024 * 1024, controlFileBytes: 1024 * 1024, totalBytes: 128 * 1024 * 1024 });
const CONTROL_FILES = new Set(["databricks.yml", "databricks.fixture-only.yml", ".harness-fixture-only.json"]);

async function info(path) {
  try { return await lstat(path, { bigint: true }); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

// Reject links even when they resolve inside the repository, including dangling links.
export async function assertUnlinkedPath(path) {
  for (let current = resolve(path); ; current = dirname(current)) {
    if ((await info(current))?.isSymbolicLink()) throw new Error("Symlink or junction is not allowed in the output path.");
    if (current === dirname(current)) break;
  }
}

function expectedOutput(root, plan) {
  if (!/^[a-z][a-z0-9-]{0,25}$/.test(plan.name ?? "") || plan.outputDir !== `apps/${plan.name}`) {
    throw new Error("Invalid component output directory.");
  }
  return pathInside(root, plan.outputDir, "AppKit output directory");
}

export async function preflightAppOutput(root, plan) {
  const output = expectedOutput(root, plan);
  await assertUnlinkedPath(output);
  if (await info(output)) throw new Error(`App output already exists: ${plan.outputDir}`);
  return output;
}

export async function inspectAppOutput(root, plan) {
  const observation = { schemaVersion: 1, status: "failed", expectedRoot: plan.outputDir,
    actualRoot: null, candidateRoots: [], controlFiles: {}, inspectedEntries: 0, inspectedBytes: 0, limits: OUTPUT_LIMITS };
  const fail = (reason) => { throw new Error(reason); };
  try {
    const output = expectedOutput(root, plan);
    await assertUnlinkedPath(output);
    const rootInfo = await info(output);
    if (!rootInfo?.isDirectory()) fail("expected root is missing or not a directory");
    let packageHash = null;
    async function walk(directory, relative, depth) {
      if (depth > OUTPUT_LIMITS.depth) fail("output depth limit exceeded");
      for await (const entry of await opendir(directory)) {
        if (++observation.inspectedEntries > OUTPUT_LIMITS.entries) fail("output entry limit exceeded");
        // Names in diagnostics are paths, not instructions or arbitrary terminal content.
        if (/[\x00-\x1f\x7f\\:]/.test(entry.name) || redact(entry.name) !== entry.name) fail("unsupported output path name");
        const canonicalName = entry.name.toLowerCase();
        if (entry.name !== canonicalName && (canonicalName === "package.json" || (relative === plan.outputDir && CONTROL_FILES.has(canonicalName)))) fail("noncanonical package or control filename (case alias)");
        const absolute = join(directory, entry.name);
        const item = await lstat(absolute);
        observation.inspectedBytes += item.isFile() ? item.size : 0;
        if (observation.inspectedBytes > OUTPUT_LIMITS.totalBytes) fail("output total byte limit exceeded");
        if (item.isSymbolicLink()) fail("symlink or junction in generated output");
        if (item.isDirectory()) {
          if (entry.name === "package.json") fail("package.json is not a regular file");
          if (relative === plan.outputDir && CONTROL_FILES.has(entry.name)) {
            const error = new Error("Root control file must be a regular file, not a directory (control name collision).");
            error.mockControlCollision = entry.name !== "databricks.yml";
            throw error;
          }
          await walk(absolute, `${relative}/${entry.name}`, depth + 1);
        } else if (!item.isFile() || item.nlink > 1) fail("special or hard-linked file in generated output");
        else if (entry.name === "package.json" || (relative === plan.outputDir && CONTROL_FILES.has(entry.name))) {
          const isPackage = entry.name === "package.json";
          const maxBytes = isPackage ? OUTPUT_LIMITS.packageBytes : OUTPUT_LIMITS.controlFileBytes;
          if (isPackage) observation.candidateRoots.push(relative);
          if (item.size > maxBytes) fail(`${entry.name} size limit exceeded`);
          const handle = await open(absolute, "r");
          try {
            const opened = await handle.stat();
            if (!opened.isFile() || opened.ino !== item.ino || opened.dev !== item.dev || opened.size !== item.size) fail(`${entry.name} changed during inspection`);
            const bytes = Buffer.alloc(maxBytes + 1);
            let size = 0;
            while (size < bytes.length) {
              const chunk = await handle.read(bytes, size, bytes.length - size, size);
              if (!chunk.bytesRead) break;
              size += chunk.bytesRead;
            }
            if (size > maxBytes) fail(`${entry.name} size limit exceeded`);
            const content = bytes.subarray(0, size);
            if (isPackage) {
              let value;
              try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content)); }
              catch { fail("package.json is not valid UTF-8 JSON"); }
              if (!value || typeof value !== "object" || Array.isArray(value)) fail("package.json must be a JSON object");
              if (relative === plan.outputDir) packageHash = sha256(content);
            } else observation.controlFiles[entry.name] = sha256(content);
          } finally { await handle.close(); }
        }
      }
    }
    await walk(output, plan.outputDir, 0);
    await assertUnlinkedPath(output);
    const after = await info(output);
    if (!after?.isDirectory() || rootInfo.ino !== after.ino || rootInfo.dev !== after.dev) fail("output root changed during inspection");
    if (!packageHash) fail("package.json missing at expected root; nested roots are diagnostic only");
    observation.status = "passed";
    observation.actualRoot = plan.outputDir;
    observation.packageSha256 = packageHash;
    observation.rootIdentity = { device: rootInfo.dev.toString(), inode: rootInfo.ino.toString() };
    observation.candidateRoots.sort();
    return observation;
  } catch (error) {
    observation.candidateRoots.sort();
    observation.reason = error.code ? `filesystem inspection failed (${error.code})` : redact(error.message);
    const failure = new Error(`AppKit output inspection failed at ${plan.outputDir}: ${observation.reason}. Preserve output and re-plan; no automatic relocation.`);
    failure.outputInspection = observation;
    if (error.mockControlCollision) failure.mockControlCollision = true;
    throw failure;
  }
}

// Bind only root identity, package bytes and safety/configuration files. Build caches may change.
export function assertOutputContinuity(before, after, expectedControls = before?.controlFiles) {
  let reason;
  if (!before?.rootIdentity || !after?.rootIdentity || before.rootIdentity.device !== after.rootIdentity.device || before.rootIdentity.inode !== after.rootIdentity.inode) reason = "output root identity changed";
  else if (before.packageSha256 !== after.packageSha256) reason = "package.json changed after output inspection";
  else {
    const keys = new Set([...Object.keys(expectedControls ?? {}), ...Object.keys(after.controlFiles ?? {})]);
    if ([...keys].some((key) => expectedControls?.[key] !== after.controlFiles?.[key])) reason = "output control files or mock quarantine changed";
  }
  if (reason) {
    after.status = "failed";
    after.reason = reason;
    const error = new Error(`AppKit output inspection failed: ${reason}. Preserve output and re-plan.`);
    error.outputInspection = after;
    throw error;
  }
}
