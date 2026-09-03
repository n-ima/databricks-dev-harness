import { access, mkdir, readFile, rename, writeFile, open, unlink } from "node:fs/promises";
import { constants, existsSync, realpathSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import process from "node:process";

export async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

export function parseOptions(args) {
  const options = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replaceAll("-", "_");
    let value;
    if (inlineValue !== undefined) value = inlineValue;
    else if (args[index + 1] && !args[index + 1].startsWith("--")) value = args[++index];
    else value = true;
    if (Object.hasOwn(options, key)) {
      options[key] = Array.isArray(options[key]) ? [...options[key], value] : [options[key], value];
    } else {
      options[key] = value;
    }
  }
  return options;
}

export function optionList(value) {
  if (value === undefined || value === false) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

export function cleanInline(value, fallback = "") {
  return String(value ?? fallback).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function slugify(value, maxLength = 60) {
  const slug = cleanInline(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return slug || "work";
}

export function asciiSlug(value, maxLength = 63) {
  const slug = cleanInline(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  if (!slug || !/^[a-z0-9]/.test(slug)) {
    throw new Error("Name must contain an ASCII letter or number.");
  }
  return slug;
}

export function timestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function compactTimestamp() {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}-${iso.slice(20, 23)}`;
}

export function pathInside(root, candidate, label = "path") {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(root, candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`${label} must stay inside the repository: ${candidate}`);
  }
  let ancestor = resolvedCandidate;
  while (!existsSync(ancestor) && ancestor !== dirname(ancestor)) ancestor = dirname(ancestor);
  const actualRoot = realpathSync(resolvedRoot);
  const actualAncestor = realpathSync(ancestor);
  if (actualAncestor !== actualRoot && !actualAncestor.startsWith(`${actualRoot}${sep}`)) {
    throw new Error(`${label} traverses a symlink outside the repository: ${candidate}`);
  }
  return resolvedCandidate;
}

export function repoRelative(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function commandResult(command, args = [], options = {}) {
  let executable = command;
  let argv = args;
  // Run npm's JS entrypoint directly on Windows; never interpolate argv into cmd.exe.
  if (process.platform === "win32" && ["npm", "npx"].includes(command)) {
    const entrypoint = resolve(dirname(process.execPath), "node_modules", "npm", "bin", `${command}-cli.js`);
    if (existsSync(entrypoint)) { executable = process.execPath; argv = [entrypoint, ...args]; }
  }
  const result = spawnSync(executable, argv, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    env: options.env,
    shell: false,
    timeout: options.timeout ?? 30_000,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    stdio: options.stdio,
  });
  return {
    command,
    args,
    ok: !result.error && result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? null,
  };
}

export function redact(value) {
  return String(value ?? "")
    .replace(/\b(?:dapi[a-zA-Z0-9]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9_-]{16,})\b/g, "[REDACTED]")
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:access_token|refresh_token|client_secret|password|token)\s*["']?\s*[:=]\s*["']?)[^\s,"';}]+/gi, "$1[REDACTED]");
}

export function assertNoSecrets(value) {
  if (redact(value) !== String(value ?? "")) throw new Error("Possible secret detected. Remove credentials before persisting durable memory.");
}

// Exclusive per-record lock. A crashed writer leaves a visible lock: inspect it before removing.
export async function withFileLock(path, action) {
  await mkdir(dirname(path), { recursive: true });
  let handle;
  try { handle = await open(`${path}.lock`, "wx"); }
  catch (error) { if (error.code === "EEXIST") throw new Error(`Record is locked: ${path}`); throw error; }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: timestamp() })); return await action(); }
  finally { await handle.close(); await unlink(`${path}.lock`); }
}

export function requireCommand(command, args, options = {}) {
  const result = commandResult(command, args, options);
  if (!result.ok) {
    const detail = cleanInline(result.stderr || result.stdout || result.error || `exit ${result.status}`);
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result;
}

export function parseVersion(text) {
  const match = String(text).match(/(?:^|\s)v?(\d+)\.(\d+)\.(\d+)(?:[-+\s]|$)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function versionAtLeast(actual, minimum) {
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

export function parseFrontmatter(text) {
  if (!String(text).startsWith("---\n") && !String(text).startsWith("---\r\n")) return {};
  const normalized = String(text).replaceAll("\r\n", "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return {};
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

export function replaceFrontmatterField(text, key, value) {
  const pattern = new RegExp(`^${key}:\\s*.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, `${key}: ${cleanInline(value)}`);
  const normalized = String(text).replaceAll("\r\n", "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Markdown file has no valid frontmatter block.");
  return `${normalized.slice(0, end)}\n${key}: ${cleanInline(value)}${normalized.slice(end)}`;
}
