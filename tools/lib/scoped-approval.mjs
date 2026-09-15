import { lstat, mkdir, open, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { assertNoSecrets, parseFrontmatter, sha256, withFileLock } from "./shared.mjs";
import { acceptanceIds } from "./acceptance.mjs";

const LIMIT = 1024 * 1024, WINDOW = 30 * 24 * 3600 * 1000;
const CONTROL = ["tools/lib/scoped-approval.mjs", "tools/lib/shared.mjs", "tools/lib/acceptance.mjs", "tools/harness.mjs", "harness.config.json"];
const HASH = /^[a-f0-9]{64}$/;
function stop(code) { const error = new Error("Scope approval: " + code); error.code = code; throw error; }
function keys(value, names) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(k => !Object.hasOwn(value, k))) stop("invalid-schema");
}
function text(value, maximum = 200) {
  if (typeof value !== "string" || !value || value.length > maximum || value.trim() !== value || /[\p{Cc}\p{Cf}\p{Cs}*?]/u.test(value)) stop("invalid-text");
  assertNoSecrets(value); return value;
}
function id(value) { if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(value)) stop("invalid-id"); return value; }
function sessionId(value) { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value)) stop("invalid-session"); return value; }
function digest(value) { if (typeof value !== "string" || !HASH.test(value)) stop("invalid-digest"); return value; }
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) stop("invalid-time");
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  const result = Date.parse(value);
  if (!Number.isFinite(result) || new Date(result).toISOString() !== normalized) stop("invalid-time");
  return result;
}
function clock(now) { const value = now(); if (!Number.isSafeInteger(value) || value < 0) stop("invalid-clock"); return value; }
function validAt(issued, expires, current) {
  if (current < issued) stop("not-yet-valid");
  if (current >= expires) stop("expired");
}
function relativePath(value) {
  text(value, 400);
  if (value.includes("\\") || value.includes(":")) stop("invalid-path");
  const parts = value.split("/");
  if (parts.some(p => !p || p === "." || p === ".." || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) || /^(\.git|\.harness|node_modules|\.databrickscfg)$/i.test(p) || /^\.env(?:\.|$)/i.test(p))) stop("invalid-path");
  return parts;
}
async function safePath(root, path) {
  const parts = relativePath(path); let current = await realpath(resolve(root));
  for (let index = 0; index < parts.length; index++) {
    current = join(current, parts[index]);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) stop("linked-path");
      if (index < parts.length - 1 && !info.isDirectory()) stop("invalid-parent");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return current;
}
function stamp(info) { return [info.dev, info.ino, info.size, info.mtimeNs].join(":"); }
async function bytes(root, path, snapshots) {
  const target = await safePath(root, path), before = await lstat(target, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(LIMIT)) stop("invalid-file");
  const handle = await open(target, "r"); let buffer;
  try {
    if (stamp(await handle.stat({ bigint: true })) !== stamp(before)) stop("input-changed");
    buffer = Buffer.alloc(LIMIT + 1); let used = 0;
    for (;;) { const result = await handle.read(buffer, used, buffer.length - used, used); used += result.bytesRead; if (!result.bytesRead || used === buffer.length) break; }
    if (used > LIMIT || stamp(await handle.stat({ bigint: true })) !== stamp(before)) stop("input-changed");
    buffer = buffer.subarray(0, used);
  } finally { await handle.close(); }
  await safePath(root, path);
  if (stamp(await lstat(target, { bigint: true })) !== stamp(before)) stop("input-changed");
  let decoded; try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { stop("invalid-utf8"); }
  // Control files are hashed, never copied into records. Their code includes
  // secret-detection expressions; scan user inputs/evidence, not those expressions.
  if (!CONTROL.includes(path)) assertNoSecrets(decoded);
  if (snapshots) {
    const hash = sha256(buffer);
    if (snapshots.has(path) && snapshots.get(path) !== hash) stop("input-changed");
    snapshots.set(path, hash);
  }
  return { buffer, decoded };
}
function strictJson(source) {
  let value; try { value = JSON.parse(source); } catch { stop("invalid-json"); }
  const stack = [];
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]/gs)) {
    const token = match[0], top = stack.at(-1);
    if (token === "{") stack.push({ object: true, key: true, seen: new Set() });
    else if (token === "[") stack.push({ object: false });
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && top?.object) top.key = true;
    else if (token.startsWith('"') && top?.object && top.key) {
      const key = JSON.parse(token); if (top.seen.has(key)) stop("duplicate-key"); top.seen.add(key); top.key = false;
    }
  }
  return value;
}
async function json(root, path, snapshots) { return strictJson((await bytes(root, path, snapshots)).decoded); }
function list(value, minimum, maximum, validate = text) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) stop("invalid-list");
  const result = value.map(item => validate(item));
  if (new Set(result.map(canonical)).size !== result.length) stop("duplicate-item");
  return result.sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
}
function request(value) {
  keys(value, ["schemaVersion", "product", "component", "candidateSha256", "environment", "workspace", "principal", "resources", "operations", "permissions", "cost"]);
  if (value.schemaVersion !== 1 || value.environment !== "dev") stop("unsupported-scope");
  if (typeof value.product !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.product)) stop("invalid-product");
  relativePath(value.component); if (!/^(apps|src|resources)\/.+/.test(value.component)) stop("invalid-component");
  digest(value.candidateSha256); keys(value.workspace, ["host", "id", "profile"]);
  for (const v of Object.values(value.workspace)) text(v);
  let host; try { host = new URL(value.workspace.host); } catch { stop("invalid-host"); }
  if (host.protocol !== "https:" || host.origin !== value.workspace.host || host.username || host.password || host.search || host.hash) stop("invalid-host");
  text(value.principal); const resources = list(value.resources, 1, 64);
  const operations = list(value.operations, 1, 32, v => { text(v, 80); if (!/^[a-z][a-z0-9-]*$/.test(v)) stop("invalid-operation"); return v; });
  const permissions = list(value.permissions, 0, 64, v => { keys(v, ["resource", "privilege"]); text(v.resource); text(v.privilege); if (!resources.includes(v.resource)) stop("foreign-permission"); return v; });
  keys(value.cost, ["currency", "maximumMinor", "basis"]);
  if (!["USD", "JPY"].includes(value.cost.currency) || !Number.isSafeInteger(value.cost.maximumMinor) || value.cost.maximumMinor < 0 || value.cost.basis !== "total-candidate") stop("invalid-cost");
  return { ...value, resources, operations, permissions };
}
async function context(root, selected, scope, snapshots, active = true) {
  sessionId(selected);
  const product = await json(root, "product.config.json", snapshots);
  if (!product || product.name !== scope.product) stop("product-mismatch");
  const fields = parseFrontmatter((await bytes(root, `work/sessions/${selected}.md`, snapshots)).decoded);
  if (fields.id !== selected || !["active", "completed", "blocked", "superseded"].includes(fields.status) || active && fields.status !== "active") stop("invalid-session-state");
  if (!fields.requirement?.startsWith("docs/product/requirements/") || !fields.architecture?.startsWith("docs/product/architecture/")) stop("invalid-product-context");
  const requirement = await bytes(root, fields.requirement, snapshots);
  if (parseFrontmatter(requirement.decoded).status !== "accepted") stop("unaccepted-requirement");
  acceptanceIds(requirement.decoded); await bytes(root, fields.architecture, snapshots);
  if (!(await lstat(await safePath(root, scope.component))).isDirectory()) stop("invalid-component");
  for (const path of CONTROL) await bytes(root, path, snapshots);
  const binding = Object.fromEntries(["product.config.json", fields.requirement, fields.architecture, ...CONTROL].map(path => [path, snapshots.get(path)]));
  if (!["pending", "approved", "not-applicable"].includes(fields.gate_status)) stop("invalid-session-gate");
  text(fields.gate, 80);
  return { binding, requirement: fields.requirement, architecture: fields.architecture, pendingGate: fields.gate_status === "pending" ? fields.gate : null };
}
async function unchanged(root, snapshots) {
  for (const [path, expected] of snapshots) if (sha256((await bytes(root, path)).buffer) !== expected) stop("input-changed");
}
function pathFor(value, revoked = false) { return `work/approvals/scopes/${id(value)}${revoked ? ".revocation" : ""}.json`; }
async function present(root, path) {
  try { await lstat(await safePath(root, path)); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
function sealed(body) { return { ...body, integritySha256: sha256(canonical(body)) }; }
function verifySeal(value, names) {
  keys(value, [...names, "integritySha256"]);
  const { integritySha256, ...body } = value; digest(integritySha256);
  if (sha256(canonical(body)) !== integritySha256) stop("invalid-integrity");
  return body;
}
function evidence(value) { keys(value, ["path", "sha256"]); relativePath(value.path); digest(value.sha256); }
function approval(value, expected) {
  const body = verifySeal(value, ["schemaVersion", "kind", "id", "issuedBySession", "issuer", "issuedAt", "expiresAt", "request", "binding", "requirement", "architecture", "decisionEvidence"]);
  if (body.schemaVersion !== 1 || body.kind !== "scoped-operation-decision" || id(body.id) !== expected) stop("invalid-record");
  sessionId(body.issuedBySession); text(body.issuer); request(body.request); evidence(body.decisionEvidence);
  const issued = date(body.issuedAt), expires = date(body.expiresAt);
  if (expires <= issued || expires - issued > WINDOW) stop("invalid-window");
  relativePath(body.requirement); relativePath(body.architecture);
  const names = ["product.config.json", body.requirement, body.architecture, ...CONTROL];
  keys(body.binding, names); for (const value of Object.values(body.binding)) digest(value);
  return body;
}
async function exclusive(root, path, value) {
  const target = await safePath(root, path); await mkdir(dirname(target), { recursive: true });
  await safePath(root, path);
  await writeFile(target, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
}
async function lock(root, value, action) {
  const path = pathFor(value), target = await safePath(root, path);
  await safePath(root, path + ".lock");
  return withFileLock(target, action);
}
export async function recordScope(root, options, { now = Date.now } = {}) {
  const selected = sessionId(options.session), name = id(options.id), snapshots = new Map();
  text(options.actor); const current = clock(now), expires = date(options.expires_at);
  if (expires <= current || expires - current > WINDOW) stop("invalid-window");
  const scope = request(await json(root, options.request, snapshots));
  const ctx = await context(root, selected, scope, snapshots);
  const proof = await bytes(root, options.evidence, snapshots);
  if (!proof.decoded.trim()) stop("empty-evidence");
  const body = { schemaVersion: 1, kind: "scoped-operation-decision", id: name, issuedBySession: selected,
    issuer: options.actor, issuedAt: new Date(current).toISOString(), expiresAt: options.expires_at,
    request: scope, binding: ctx.binding, requirement: ctx.requirement, architecture: ctx.architecture,
    decisionEvidence: { path: options.evidence, sha256: sha256(proof.buffer) } };
  const record = sealed(body); approval(record, name);
  return lock(root, name, async () => {
    if (await present(root, pathFor(name)) || await present(root, pathFor(name, true))) stop("already-recorded");
    await unchanged(root, snapshots); validAt(current, expires, clock(now));
    await exclusive(root, pathFor(name), record);
    return { id: name, path: pathFor(name), recorded: true, executionAuthorized: false, identityAuthenticated: false };
  });
}
export async function checkScope(root, options, { now = Date.now } = {}) {
  const result = { eligibleForReuse: false, executionAuthorized: false, identityAuthenticated: false, candidateVerified: false, costEnforced: false, reason: "invalid-input" };
  try {
    const name = id(options.id), selected = sessionId(options.session), snapshots = new Map();
    result.id = name; result.sessionId = selected;
    const scope = request(await json(root, options.request, snapshots));
    const record = approval(await json(root, pathFor(name), snapshots), name);
    result.expiresAt = record.expiresAt;
    const current = clock(now);
    validAt(date(record.issuedAt), date(record.expiresAt), current);
    if (canonical(scope) !== canonical(request(record.request))) stop("scope-mismatch");
    const ctx = await context(root, selected, scope, snapshots);
    const origin = await context(root, record.issuedBySession, scope, snapshots, false);
    if (ctx.requirement !== record.requirement || ctx.architecture !== record.architecture || origin.requirement !== record.requirement || origin.architecture !== record.architecture || canonical(ctx.binding) !== canonical(record.binding) || canonical(origin.binding) !== canonical(record.binding)) stop("context-changed");
    if (sha256((await bytes(root, record.decisionEvidence.path, snapshots)).buffer) !== record.decisionEvidence.sha256) stop("evidence-changed");
    const revocationPath = pathFor(name, true);
    if (await present(root, revocationPath)) {
      const rev = verifySeal(await json(root, revocationPath, snapshots), ["schemaVersion", "kind", "approvalId", "approvalSha256", "revokedAt", "issuer", "evidence"]);
      if (rev.schemaVersion !== 1 || rev.kind !== "scoped-operation-revocation" || rev.approvalId !== name || rev.approvalSha256 !== snapshots.get(pathFor(name)) || date(rev.revokedAt) < date(record.issuedAt) || date(rev.revokedAt) > clock(now)) stop("invalid-revocation");
      text(rev.issuer); evidence(rev.evidence);
      if (sha256((await bytes(root, rev.evidence.path)).buffer) !== rev.evidence.sha256) stop("invalid-revocation");
      stop("revoked");
    }
    await unchanged(root, snapshots);
    if (await present(root, revocationPath)) stop("revocation-changed");
    validAt(date(record.issuedAt), date(record.expiresAt), clock(now));
    return { ...result, eligibleForReuse: true, reason: "matching-record", unresolvedGate: ctx.pendingGate };
  } catch (error) {
    const code = error.code;
    result.reason = typeof code === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(code) ? code : "invalid-input";
    return result;
  }
}
export async function revokeScope(root, options, { now = Date.now } = {}) {
  const name = id(options.id); text(options.actor);
  return lock(root, name, async () => {
    const snapshots = new Map(), original = approval(await json(root, pathFor(name), snapshots), name);
    const proof = await bytes(root, options.evidence, snapshots), current = clock(now);
    if (!proof.decoded.trim() || current < date(original.issuedAt)) stop("invalid-revocation");
    if (await present(root, pathFor(name, true))) stop("already-revoked");
    const record = sealed({ schemaVersion: 1, kind: "scoped-operation-revocation", approvalId: name,
      approvalSha256: snapshots.get(pathFor(name)), revokedAt: new Date(current).toISOString(), issuer: options.actor,
      evidence: { path: options.evidence, sha256: sha256(proof.buffer) } });
    await unchanged(root, snapshots); await exclusive(root, pathFor(name, true), record);
    return { id: name, revoked: true, executionAuthorized: false, identityAuthenticated: false };
  });
}
export async function scopeCommand(root, action, argv) {
  const allowed = { record: ["id", "session", "request", "actor", "evidence", "expires-at"], check: ["id", "session", "request"], revoke: ["id", "actor", "evidence"] };
  if (!Object.hasOwn(allowed, action)) stop("unknown-command");
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.slice(2), value = argv[index + 1];
    if (!argv[index]?.startsWith("--") || !allowed[action].includes(name) || Object.hasOwn(options, name.replaceAll("-", "_")) || typeof value !== "string" || !value || value.startsWith("--")) stop("invalid-options");
    options[name.replaceAll("-", "_")] = value;
  }
  if (Object.keys(options).length !== allowed[action].length) stop("missing-options");
  return { record: recordScope, check: checkScope, revoke: revokeScope }[action](root, options);
}
