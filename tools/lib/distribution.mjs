import { copyFile, lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { cleanInline, compactTimestamp, exists, readJson, repoRelative, sha256, timestamp, withFileLock, writeJson } from "./shared.mjs";

// Template copies have independent history. ADR-0001 / ADR-0004 require reviewed,
// hash-aware updates, never an overlay of downstream product files.
const OWNED_FILES = new Set([
  "AGENTS.md", "ARCHITECTURE.md", "CLAUDE.md", "harness.config.json", ".gitattributes", ".editorconfig",
  "vendor/databricks-skills.lock.json", "vendor/README.md", ".claude/settings.json", ".github/copilot-instructions.md",
  ".github/workflows/harness-ci.yml", ".github/workflows/copilot-setup-steps.yml",
  "tests/harness.test.mjs", "tests/contracts.test.mjs", "tests/evaluation.test.mjs", "tests/distribution.test.mjs",
  "tests/hooks.test.mjs", "tests/memory.test.mjs", "tests/scaffold-data.test.mjs", "tests/docs.test.mjs", "tests/loop-concurrency.test.mjs",
  "tests/approval.test.mjs", "tests/databricks-identity.test.mjs", "tests/vendor-legal.test.mjs",
  "tests/workloads.test.mjs", "tests/helpers/workloads.mjs",
  "tests/initialization.test.mjs", "tests/helpers/initialization.mjs", "tests/scaffold-output.test.mjs",
  "tests/delivery-assurance.test.mjs", "tests/delivery-independent.test.mjs", "tests/human-documents.test.mjs", "tests/update-entry.test.mjs",
  "docs/USAGE.md",
]);
const OWNED_DIRECTORIES = ["tools", "scripts", "harness", "docs/harness", "docs/site", "vendor/databricks-skills", ".claude/skills", ".claude/agents", ".claude/rules", ".github/skills", ".github/instructions", ".github/agents", ".github/hooks"];
const INSTALLED = ".harness/installed-release.json";
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp", ".tif", ".tiff", ".pdf",
  ".zip", ".gz", ".bz2", ".xz", ".zst", ".7z", ".rar", ".tar", ".tgz",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov", ".wav", ".ogg", ".flac", ".webm", ".avi", ".mkv",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".sqlite", ".sqlite3", ".db", ".parquet", ".arrow", ".feather", ".orc", ".avro",
  ".pyc", ".pyo", ".class", ".jar", ".wasm", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
]);

function managedUtf8Text(path, bytes) {
  if (BINARY_EXTENSIONS.has(extname(path).toLowerCase()) || bytes.includes(0)) return null;
  const text = bytes.toString("utf8");
  return Buffer.from(text, "utf8").equals(bytes) ? text : null;
}

function normalizeRelative(value, label = "managed") {
  if (typeof value !== "string" || !value || isAbsolute(value) || value.includes("\\") || value.includes(":") || /[\x00-\x1f]/.test(value)) throw new Error(`Invalid ${label} path: ${value}`);
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error(`Invalid ${label} path: ${value}`);
  return value;
}

function owned(path) {
  normalizeRelative(path);
  if (path === "harness/base-release.json") return false;
  if (path.split("/").some((part) => [".git", "node_modules", ".venv", ".databricks", ".databrickscfg"].includes(part) || /^\.env(?:\.|$)/.test(part) || /\.local\./.test(part))) return false;
  return OWNED_FILES.has(path) || OWNED_DIRECTORIES.some((directory) => path.startsWith(`${directory}/`));
}

async function assertNoSymlink(path) {
  let current = resolve(path);
  for (;;) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink or junction is not allowed: ${current}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function safePath(root, path, label = "distribution") {
  normalizeRelative(path, label);
  const base = resolve(root);
  const result = resolve(base, path);
  if (!result.startsWith(`${base}${sep}`)) throw new Error(`${label} path escapes its root.`);
  await assertNoSymlink(result);
  return result;
}

async function fileState(root, path) {
  const absolute = await safePath(root, path);
  try {
    const info = await lstat(absolute);
    if (!info.isFile()) throw new Error(`Managed destination is not a regular file: ${path}`);
    return { sha256: sha256(await readFile(absolute)), bytes: info.size, mode: info.mode & 0o777 };
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function validateManifest(manifest) {
  const keys = new Set(["schemaVersion", "version", "releasedAt", "managedFiles", "migrations"]);
  if (!manifest || manifest.schemaVersion !== 1 || !VERSION.test(manifest.version ?? "") || typeof manifest.releasedAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(manifest.releasedAt) || !Number.isFinite(Date.parse(manifest.releasedAt)) || !Array.isArray(manifest.managedFiles) || !manifest.managedFiles.length || !Array.isArray(manifest.migrations) || manifest.migrations.some((item) => !item || typeof item !== "object" || Array.isArray(item)) || Object.keys(manifest).some((key) => !keys.has(key))) throw new Error("Invalid release manifest (harness/schemas/release-manifest.schema.json).");
  if (manifest.version.split(".").some((part) => !Number.isSafeInteger(Number(part)))) throw new Error("Release version components exceed the supported integer range.");
  const paths = new Set();
  for (const item of manifest.managedFiles) {
    if (!item || !owned(item.path)) throw new Error(`Release attempts to own an excluded product/local path: ${item?.path}`);
    if (!HASH.test(item.sha256 ?? "") || item.strategy !== "replace") throw new Error(`Invalid hash or strategy for ${item.path}`);
    if ((item.bytes !== undefined && (!Number.isInteger(item.bytes) || item.bytes < 0)) || (item.executable !== undefined && typeof item.executable !== "boolean")) throw new Error(`Invalid file metadata for ${item.path}`);
    const folded = item.path.toLowerCase();
    if (paths.has(folded)) throw new Error(`Duplicate or case-colliding managed path: ${item.path}`);
    paths.add(folded);
  }
  return manifest;
}

async function collectOwned(root) {
  const paths = new Set();
  for (const file of OWNED_FILES) if (await exists(await safePath(root, file))) paths.add(file);
  async function walk(directory) {
    const absolute = await safePath(root, directory);
    if (!(await exists(absolute))) return;
    if (!(await lstat(absolute)).isDirectory()) throw new Error(`Managed directory is not a directory: ${directory}`);
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      await safePath(root, path);
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in a release: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) { if (path !== "harness/base-release.json") paths.add(path); }
      else throw new Error(`Unsupported release entry: ${path}`);
    }
  }
  for (const directory of OWNED_DIRECTORIES) await walk(directory);
  return [...paths].sort();
}

async function writeBytes(path, bytes, mode = 0o644) {
  await assertNoSymlink(path);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode, flag: "wx" });
  await rename(temporary, path);
}

async function readRelease(source) {
  if (!source || typeof source !== "string") throw new Error("Specify --source pointing to a local release directory or manifest.json.");
  const requested = resolve(source);
  await assertNoSymlink(requested);
  const info = await lstat(requested);
  const root = info.isDirectory() ? requested : dirname(requested);
  if (!info.isDirectory() && (!info.isFile() || requested !== join(root, "manifest.json"))) throw new Error("Release source must be a directory or manifest.json.");
  return readManagedSource(root, "manifest.json", "files/");
}

async function readManagedSource(root, manifestRelative, prefix) {
  const manifestPath = await safePath(root, manifestRelative, "release manifest");
  const manifestInfo = await lstat(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.size > 8 * 1024 * 1024) throw new Error("Release manifest must be a regular file within 8 MiB.");
  const text = await readFile(manifestPath, "utf8");
  const manifest = validateManifest(JSON.parse(text));
  if (manifest.managedFiles.length > 8192) throw new Error("Release exceeds 8192 managed files.");
  const contents = new Map();
  let totalBytes = 0;
  for (const item of manifest.managedFiles) {
    const path = await safePath(root, `${prefix}${item.path}`, "release payload");
    const info = await lstat(path);
    totalBytes += info.size;
    if (!info.isFile() || info.size > 64 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024) throw new Error(`Release payload is not a bounded regular file: ${item.path}`);
    const bytes = await readFile(path);
    if (sha256(bytes) !== item.sha256) throw new Error(`Release payload hash mismatch: ${item.path}`);
    if (item.bytes !== undefined && item.bytes !== bytes.length) throw new Error(`Release payload size mismatch: ${item.path}`);
    contents.set(item.path, bytes);
  }
  return { root, manifest, manifestSha256: sha256(text), contents };
}

// This entry point is for an existing product, not for initializing an empty tree.
// The older low-level API remains available for template initialization.
export async function assertUpdateProject(root) {
  await assertNoSymlink(root);
  const marker = await safePath(root, "product.config.json", "project marker");
  if (!(await exists(marker)) || !(await lstat(marker)).isFile()) throw new Error("対象は初期化済み案件ではありません: product.config.json を確認してください。");
  const baseline = await baselineState(root);
  if (!baseline.manifest) throw new Error("元版baselineがありません。真正な元版manifestから初回登録してください。現在の案件から再生成しないでください。");
  return baseline;
}

function rejectOverlappingRoots(target, source) {
  const fold = value => {
    const absolute = resolve(value).replace(/[\\/]+$/, "");
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  };
  const a = fold(target), b = fold(source);
  if (a === b || a.startsWith(`${b}${sep}`) || b.startsWith(`${a}${sep}`)) throw new Error("更新元と対象案件が重複・包含しています。別フォルダーを指定してください。");
}

export async function planLocalUpdate(root, options = {}) {
  const target = resolve(root);
  await assertUpdateProject(target);
  if (typeof options.source !== "string" || !options.source) throw new Error("ローカル更新元を --source で指定してください。");
  const requested = resolve(target, options.source);
  rejectOverlappingRoots(target, requested);
  await assertNoSymlink(requested);
  const info = await lstat(requested);
  let release, kind;
  const sourceRoot = info.isDirectory() ? requested : dirname(requested);
  rejectOverlappingRoots(target, sourceRoot);
  const stampPath = await safePath(sourceRoot, "harness/base-release.json", "source stamp");
  if (info.isDirectory() && await exists(stampPath)) {
    if (await exists(await safePath(sourceRoot, "manifest.json"))) throw new Error("更新元の形式が曖昧です。配布物かソースのどちらか一つを指定してください。");
    if (!(await lstat(stampPath)).isFile() || (await lstat(stampPath)).size > 8 * 1024 * 1024) throw new Error("Invalid source stamp size/type.");
    const stamp = validateManifest(await readJson(stampPath));
    const cached = await safePath(sourceRoot, `.harness/releases/${stamp.version}`, "stamped release");
    if (await exists(cached)) {
      release = await readRelease(cached);
      // Repackaging can change the timestamp, never the selected content or migration.
      const identity = m => JSON.stringify({ ...m, releasedAt: undefined });
      if (identity(release.manifest) !== identity(stamp)) throw new Error("固定配布物がソースの版manifestと一致しません。別版へ自動切替はしません。");
      kind = "stamped-release";
    } else {
      release = await readManagedSource(sourceRoot, "harness/base-release.json", "");
      kind = "source-tree";
    }
  } else {
    release = await readRelease(requested);
    kind = "release";
  }
  // Validate the whole source before writing even local snapshot metadata.
  const snapshotRelative = `.harness/updates/sources/source-${randomUUID()}`;
  const snapshot = await safePath(target, snapshotRelative, "source snapshot");
  await mkdir(snapshot, { recursive: true });
  for (const item of release.manifest.managedFiles) await writeBytes(await safePath(snapshot, `files/${item.path}`), release.contents.get(item.path), item.executable ? 0o755 : 0o644);
  await writeJson(await safePath(snapshot, "manifest.json"), release.manifest);
  return planUpdate(target, { source: snapshot, quiet: options.quiet, sourceSelection: { requested, resolved: release.root, kind, identityAuthenticated: false } });
}

async function baselineState(root, baselinePath = INSTALLED) {
  const path = await safePath(root, baselinePath, "installed baseline");
  if (!(await exists(path))) {
    if (baselinePath !== INSTALLED) throw new Error("Explicit baseline does not exist.");
    return { path: baselinePath, sha256: null, manifest: null };
  }
  const text = await readFile(path, "utf8");
  const value = JSON.parse(text);
  const manifest = validateManifest(value.manifest ?? value);
  if (value.manifest && value.manifestSha256 !== sha256(JSON.stringify(value.manifest))) throw new Error("Installed baseline manifest hash is invalid.");
  return { path: baselinePath, sha256: sha256(text), manifest };
}

function versionCompare(left, right) {
  const a = left.split(".").map(Number), b = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return Math.sign(a[index] - b[index]);
  return 0;
}

async function operationsFor(root, release, baseline) {
  const previous = new Map((baseline.manifest?.managedFiles ?? []).map((item) => [item.path, item]));
  const next = new Map(release.manifest.managedFiles.map((item) => [item.path, item]));
  if (baseline.manifest) {
    if (versionCompare(release.manifest.version, baseline.manifest.version) < 0) throw new Error("A release downgrade requires a separate reviewed migration; update refuses it.");
    if (release.manifest.version === baseline.manifest.version && JSON.stringify([...previous].map(([path, item]) => [path, item.sha256]).sort()) !== JSON.stringify([...next].map(([path, item]) => [path, item.sha256]).sort())) throw new Error("The same release version has different file contents; release versions must be immutable.");
  }
  const operations = [];
  for (const path of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
    const old = previous.get(path), incoming = next.get(path), current = await fileState(root, path);
    let action, reason;
    if (incoming && current?.sha256 === incoming.sha256) action = old ? "keep" : "adopt";
    else if (!old) {
      action = current ? "conflict" : "add";
      reason = current ? "Existing downstream file has no matching installed baseline." : undefined;
    } else if (current?.sha256 === old.sha256) action = incoming ? "update" : "delete";
    else if (!current && !incoming) action = "keep";
    else {
      action = "conflict";
      reason = current ? "Downstream file changed since the installed baseline." : "Downstream file was locally deleted.";
    }
    operations.push({ path, action, beforeSha256: current?.sha256 ?? null, afterSha256: incoming?.sha256 ?? null, ...(reason ? { reason } : {}) });
  }
  return operations;
}

// Formatting is an explicit working-tree change, not a new upstream baseline.
// Binary payloads and all product/local files retain their exact original bytes.
export async function normalizeManagedText(root, options = {}) {
  if (options.yes !== true) throw new Error("Review managed text normalization and pass --yes; installed/upstream baselines are never rebuilt.");
  await assertNoSymlink(root);
  const lock = await safePath(root, ".harness/update", "normalization lock");
  return withFileLock(lock, async () => {
    const changes = [];
    for (const path of await collectOwned(root)) {
      if (!owned(path)) continue;
      const absolute = await safePath(root, path, "managed text");
      const info = await lstat(absolute);
      if (!info.isFile()) throw new Error(`Managed text entry must be a regular file: ${path}`);
      const before = await readFile(absolute);
      const text = managedUtf8Text(path, before);
      if (text !== null && text.includes("\r\n")) {
        changes.push({ path, beforeSha256: sha256(before), bytes: Buffer.from(text.replaceAll("\r\n", "\n"), "utf8"), mode: info.mode & 0o777 });
      }
    }
    // All paths and types are checked before the first managed write.
    for (const change of changes) {
      const path = await safePath(root, change.path, "managed text");
      if (sha256(await readFile(path)) !== change.beforeSha256) throw new Error(`Managed file changed during normalization: ${change.path}. Stop writers and review the partial formatting diff before retrying.`);
      await writeBytes(path, change.bytes, change.mode);
    }
    const result = { status: "normalized", changedFiles: changes.map((item) => item.path), baselineChanged: false, humanReviewRequired: true };
    console.log(JSON.stringify(result, null, 2));
    return result;
  });
}

export async function createRelease(root, options = {}) {
  await assertNoSymlink(root);
  const config = await readJson(await safePath(root, "harness.config.json"));
  const version = cleanInline(options.version ?? config.harnessVersion);
  if (!VERSION.test(version)) throw new Error("Release version must be a three-part semantic version.");
  if (version !== config.harnessVersion) throw new Error("Release version must match harness.config.json; update and review the version before packaging.");
  const relativeOutput = options.output ?? `.harness/releases/${version}`;
  if (!String(relativeOutput).startsWith(".harness/releases/")) throw new Error("Release output must be under .harness/releases/.");
  const output = await safePath(root, relativeOutput, "release output");
  if (await exists(output)) throw new Error("Release output already exists; releases are immutable.");
  const payloads = [];
  for (const path of await collectOwned(root)) {
    const source = await safePath(root, path);
    const info = await lstat(source);
    if (!info.isFile()) throw new Error(`Release entry must be a file: ${path}`);
    const bytes = await readFile(source);
    if (managedUtf8Text(path, bytes)?.includes("\r\n")) throw new Error(`Managed UTF-8 text contains CRLF: ${path}. Run npm run harness -- release normalize --yes, review the diff, then retry. Do not rebuild an existing upstream baseline from downstream files.`);
    payloads.push({ path, bytes, mode: info.mode & 0o777 });
  }
  const manifest = validateManifest({
    schemaVersion: 1, version, releasedAt: timestamp(),
    managedFiles: payloads.map((item) => ({ path: item.path, sha256: sha256(item.bytes), strategy: "replace", bytes: item.bytes.length, executable: Boolean(item.mode & 0o111) })),
    migrations: [{ type: "manual-review", paths: ["package.json", "package-lock.json", "README.md", ".vscode/", "docs/product/", "work/", "apps/", "resources/", "src/"], description: "These downstream-owned files are never overlaid. Review required scripts, dependency or product migrations separately. Stop agents before applying a harness update." }],
  });
  const stagingRelative = `${relativeOutput}.staging-${randomUUID()}`;
  const staging = await safePath(root, stagingRelative, "release staging");
  await mkdir(staging, { recursive: true });
  for (const item of payloads) await writeBytes(await safePath(staging, `files/${item.path}`), item.bytes, item.mode);
  await writeJson(await safePath(staging, "manifest.json"), manifest);
  await rename(staging, output);
  console.log(repoRelative(root, join(output, "manifest.json")));
  return { manifest, path: repoRelative(root, output), manifestPath: repoRelative(root, join(output, "manifest.json")) };
}

// Register a supplied upstream snapshot, never a snapshot of the current product.
// Existing local edits must remain visible as conflicts when a later update is planned.
export async function registerBaseline(root, options = {}) {
  if (!options.manifest) throw new Error("baseline registration requires --manifest pointing to a repository-relative upstream manifest.");
  const source = await safePath(root, options.manifest, "upstream baseline manifest");
  if (!(await lstat(source)).isFile()) throw new Error("Upstream baseline manifest must be a regular file.");
  const sourceText = await readFile(source, "utf8");
  const manifest = validateManifest(JSON.parse(sourceText));
  const manifestSha256 = sha256(JSON.stringify(manifest));
  const lock = await safePath(root, ".harness/update", "baseline registration lock");
  return withFileLock(lock, async () => {
    const current = await baselineState(root);
    if (current.manifest) {
      if (sha256(JSON.stringify(current.manifest)) !== manifestSha256) throw new Error("An installed baseline already exists and differs from the supplied upstream manifest; registration never overwrites it.");
      const result = { status: "already-registered", path: INSTALLED, version: manifest.version };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    const path = await safePath(root, INSTALLED, "installed baseline");
    await writeJson(path, {
      schemaVersion: 1, installedAt: timestamp(), manifestSha256, manifest,
      provenance: { type: "supplied-upstream-manifest", path: options.manifest, sourceSha256: sha256(sourceText), currentProductFilesSnapshotted: false, identityAuthenticated: false },
    });
    const result = { status: "registered", path: INSTALLED, version: manifest.version };
    console.log(JSON.stringify(result, null, 2));
    return result;
  });
}

export async function planUpdate(root, options = {}) {
  await assertNoSymlink(root);
  const source = isAbsolute(String(options.source ?? "")) ? options.source : resolve(root, String(options.source ?? ""));
  if (!options.source) throw new Error("update plan requires --source.");
  const release = await readRelease(source);
  const baseline = await baselineState(root, options.baseline ?? INSTALLED);
  const operations = await operationsFor(root, release, baseline);
  const id = `update-${compactTimestamp()}-${randomUUID().slice(0, 8)}`;
  const contract = {
    id, targetRoot: resolve(root), sourceRoot: release.root, sourceManifestSha256: release.manifestSha256,
    fromVersion: baseline.manifest?.version ?? null, toVersion: release.manifest.version,
    baselinePath: baseline.path, baselineSha256: baseline.sha256, installedStateSha256: (await baselineState(root)).sha256,
    operations,
    ...(options.sourceSelection ? { sourceSelection: options.sourceSelection } : {}),
  };
  const plan = { schemaVersion: 1, createdAt: timestamp(), dryRun: true, contract, planHash: sha256(JSON.stringify(contract)), canApply: operations.every((item) => item.action !== "conflict"), conflicts: operations.filter((item) => item.action === "conflict"), migrations: release.manifest.migrations, warning: "No product files, remote repository, or Git history are changed. Review this plan; --yes is required for application. Baseline hashes are integrity records, not authenticated approvals." };
  const relativeOutput = options.output ?? `.harness/updates/${id}.json`;
  if (!String(relativeOutput).startsWith(".harness/updates/")) throw new Error("Update plans must be under .harness/updates/.");
  const output = await safePath(root, relativeOutput, "update plan");
  if (await exists(output)) throw new Error("Update plan output already exists.");
  await writeJson(output, plan);
  if (!options.quiet) console.log(repoRelative(root, output));
  return { ...plan, path: repoRelative(root, output) };
}

export async function applyUpdate(root, options = {}) {
  if (options.yes !== true) throw new Error("Review the dry-run plan and pass --yes to apply the update.");
  if (!options.plan) throw new Error("update apply requires --plan.");
  const plan = await readJson(await safePath(root, options.plan, "update plan"));
  if (plan.schemaVersion !== 1 || !plan.contract || plan.planHash !== sha256(JSON.stringify(plan.contract))) throw new Error("Update plan hash is invalid.");
  const contract = plan.contract;
  if (!/^update-[a-zA-Z0-9-]+$/.test(contract.id ?? "") || contract.targetRoot !== resolve(root)) throw new Error("Update plan belongs to a different target repository.");
  if (!plan.canApply || !Array.isArray(contract.operations) || contract.operations.some((item) => item.action === "conflict")) throw new Error("Update has downstream conflicts; no file was changed.");
  for (const operation of contract.operations) if (!owned(operation.path) || !["keep", "adopt", "add", "update", "delete"].includes(operation.action)) throw new Error("Update plan contains an invalid managed operation.");
  const lock = await safePath(root, ".harness/update", "update lock");
  return withFileLock(lock, async () => {
    const release = await readRelease(contract.sourceRoot);
    if (release.manifestSha256 !== contract.sourceManifestSha256) throw new Error("Source release changed since planning.");
    const baseline = await baselineState(root, contract.baselinePath);
    if (baseline.sha256 !== contract.baselineSha256 || (await baselineState(root)).sha256 !== contract.installedStateSha256) throw new Error("Installed baseline changed since planning.");
    const operations = await operationsFor(root, release, baseline);
    if (JSON.stringify(operations) !== JSON.stringify(contract.operations)) throw new Error("Downstream files changed since planning; generate a new plan.");
    const backupRelative = `.harness/backups/${contract.id}`;
    const backup = await safePath(root, backupRelative, "update backup");
    if (await exists(backup)) throw new Error("Update was already applied or interrupted; inspect its existing backup before retrying.");
    await mkdir(backup, { recursive: true });
    const journal = { schemaVersion: 1, id: contract.id, planPath: options.plan, planHash: plan.planHash, sourceManifestSha256: release.manifestSha256, startedAt: timestamp(), status: "prepared", plannedOperations: operations, backups: [], operations: [], warning: "Backups preserve pre-update bytes. Recovery is an explicit operator action; this is not an automatic rollback. Inspect every planned operation after a process crash, even if it is absent from completed operations." };
    for (const operation of operations.filter((item) => ["update", "delete"].includes(item.action))) {
      const target = await safePath(root, operation.path);
      const backupPath = await safePath(backup, `files/${operation.path}`);
      await mkdir(dirname(backupPath), { recursive: true });
      await copyFile(target, backupPath);
      if (sha256(await readFile(backupPath)) !== operation.beforeSha256) throw new Error("A downstream file changed while backing it up; no managed file was modified.");
      journal.backups.push({ path: operation.path, backupPath: `files/${operation.path}`, sha256: operation.beforeSha256 });
    }
    const installedPath = await safePath(root, INSTALLED);
    if (await exists(installedPath)) {
      await copyFile(installedPath, await safePath(backup, "installed-release.json"));
      journal.installedBaselineBackup = "installed-release.json";
    }
    const journalPath = await safePath(backup, "recovery.json");
    await writeJson(journalPath, journal);
    try {
      for (const operation of operations.filter((item) => ["add", "update", "delete"].includes(item.action))) {
        const current = await fileState(root, operation.path);
        if ((current?.sha256 ?? null) !== operation.beforeSha256) throw new Error(`Concurrent downstream change detected: ${operation.path}`);
        const target = await safePath(root, operation.path);
        if (operation.action === "delete") await unlink(target);
        else {
          const metadata = release.manifest.managedFiles.find((item) => item.path === operation.path);
          await writeBytes(target, release.contents.get(operation.path), current?.mode ?? (metadata.executable ? 0o755 : 0o644));
        }
        journal.operations.push(operation);
        journal.status = "applying";
        await writeJson(journalPath, journal);
      }
      // Verify all resulting bytes, including keep/adopt, before claiming the new baseline.
      // Concurrent writers can otherwise corrupt an earlier write while later files apply.
      for (const operation of operations) {
        const current = await fileState(root, operation.path);
        if ((current?.sha256 ?? null) !== operation.afterSha256) throw new Error(`Post-update verification failed: ${operation.path}`);
      }
      if ((await baselineState(root)).sha256 !== contract.installedStateSha256) throw new Error("Installed baseline changed during application.");
      await writeJson(installedPath, { schemaVersion: 1, installedAt: timestamp(), manifestSha256: sha256(JSON.stringify(release.manifest)), manifest: release.manifest });
      journal.status = "applied";
      journal.finishedAt = timestamp();
      await writeJson(journalPath, journal);
    } catch (error) {
      journal.status = "interrupted";
      journal.error = error.message;
      await writeJson(journalPath, journal);
      throw new Error(`Update interrupted. Inspect ${backupRelative}/recovery.json; backups are retained. ${error.message}`);
    }
    const result = { status: "applied", version: release.manifest.version, backupPath: backupRelative, changedFiles: journal.operations.length, deletedFiles: journal.operations.filter((item) => item.action === "delete").map((item) => item.path), managedFilesVerified: release.manifest.managedFiles.length, humanReviewRequired: true };
    if (!options.quiet) console.log(JSON.stringify(result, null, 2));
    return result;
  });
}
