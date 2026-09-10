import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite, assertNoSecrets, cleanInline, exists, optionList, parseFrontmatter, pathInside, repoRelative, sha256, timestamp, withFileLock } from "./shared.mjs";
import { findSession } from "./session-state.mjs";
import { fileHash, validateReceipt } from "./evidence.mjs";

const transitions = {
  planned: ["ready", "cancelled"], ready: ["running", "blocked", "cancelled"],
  running: ["verifying", "blocked", "cancelled"], verifying: ["running", "blocked", "done", "cancelled"],
  blocked: ["ready", "cancelled"], done: [], cancelled: []
};
const fields = ["id", "title", "session", "requirement", "architecture", "done_when", "risk", "status", "depends_on", "evidence", "verifier_evidence", "created", "updated"];
const arrayFields = new Set(["depends_on", "evidence"]);
function validId(id) {
  if (typeof id !== "string" || id.length > 96 || !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(id)) throw new Error("Task id must be an uppercase stable ID, e.g. TV-01.");
  return id;
}
function inline(value, label, max = 2000) {
  if (typeof value !== "string" || !cleanInline(value) || value.length > max) throw new Error(label + " requires non-empty bounded text.");
  return cleanInline(value);
}
function list(value, label) {
  const values = optionList(value);
  if (values.some(v => !v.trim()) || new Set(values).size !== values.length) throw new Error("Invalid or duplicate " + label);
  return values;
}
function validateGraph(records) {
  const byId = new Map(records.map(t => [t.id, t]));
  if (byId.size !== records.length) throw new Error("Duplicate task id.");
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error("Task dependency cycle: " + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) {
      if (!byId.has(dependency)) throw new Error("Missing task dependency: " + dependency);
      if (byId.get(dependency).session !== byId.get(id).session) throw new Error("Task dependency must belong to the same session.");
      visit(dependency);
      if (["ready", "running", "verifying", "done"].includes(byId.get(id).status) && byId.get(dependency).status !== "done") throw new Error("Unfinished task dependency: " + dependency);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
}

export async function taskRecords(root) {
  const directory = pathInside(root, "work/tasks");
  if (!(await exists(directory))) return [];
  const records = [];
  for (const name of (await readdir(directory)).filter(n => n.endsWith(".md") && n.toLowerCase() !== "readme.md")) {
    const path = pathInside(root, join("work/tasks", name));
    const text = await readFile(path, "utf8");
    const record = parseFrontmatter(text);
    // JSON-quoted scalars are valid YAML and safely preserve colons, quotes and hashes.
    for (const field of fields.filter(field => !arrayFields.has(field))) {
      if (record[field]?.startsWith('"')) {
        try { record[field] = JSON.parse(record[field]); } catch { throw new Error("Invalid task scalar: " + field); }
        if (typeof record[field] !== "string") throw new Error("Invalid task scalar: " + field);
      }
    }
    validId(record.id);
    if (name !== record.id + ".md") throw new Error("Task filename/id mismatch: " + name);
    for (const field of fields) if (!Object.hasOwn(record, field)) throw new Error("Missing task field: " + field);
    for (const field of arrayFields) {
      try { record[field] = JSON.parse(record[field]); } catch { throw new Error("Invalid task array: " + field); }
      if (!Array.isArray(record[field]) || record[field].some(v => typeof v !== "string")) throw new Error("Invalid task array: " + field);
      list(record[field], field);
    }
    if (!Object.hasOwn(transitions, record.status)) throw new Error("Invalid task status: " + record.status);
    for (const field of ["title", "session", "requirement", "architecture", "done_when"]) inline(record[field], field);
    for (const dependency of record.depends_on) validId(dependency);
    if (!["low", "medium", "high"].includes(record.risk)) throw new Error("Invalid task risk.");
    for (const field of ["created", "updated"]) if (!Number.isFinite(Date.parse(record[field]))) throw new Error("Invalid task timestamp.");
    for (const ref of [record.requirement, record.architecture, ...record.evidence]) pathInside(root, ref);
    if (record.verifier_evidence !== "none") pathInside(root, record.verifier_evidence);
    records.push({ ...record, path, revision: sha256(text), text });
  }
  validateGraph(records);
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

async function taskSession(root, task, { active = false } = {}) {
  const session = await findSession(root, task.session);
  if (session.id !== task.session) throw new Error("Task requires an exact session id.");
  if (active && session.status !== "active") throw new Error("Task changes require an active session.");
  if (task.requirement !== session.requirement || task.architecture !== session.architecture) throw new Error("Task requirement/architecture must match its session.");
  await fileHash(root, task.requirement);
  await fileHash(root, task.architecture);
  return session;
}

export async function validateTaskCompletion(root, task) {
  const session = await taskSession(root, task);
  if (session.gate_status === "pending") throw new Error("Resolve the pending session gate.");
  if (!task.verifier_evidence || task.verifier_evidence === "none") throw new Error("Task completion requires --verifier-evidence receipt.");
  if (!task.evidence.length) throw new Error("Task completion requires evidence.");
  const receipt = await validateReceipt(root, task.verifier_evidence, { sessionId: session.id, requirement: task.requirement, implementer: session.provider });
  for (const evidence of task.evidence) if (!receipt.artifactHashes[evidence]) throw new Error("Task evidence must be included in the independent receipt: " + evidence);
}

function serialize(task, history = "") {
  return "---\n" + fields.map(field => field + ": " + JSON.stringify(arrayFields.has(field) ? task[field] : cleanInline(task[field]))).join("\n") +
    "\n---\n\n# Task " + task.id + ": " + task.title + "\n\n" + history;
}
function publicTask(task) {
  const { text, path, ...record } = task;
  return record;
}

export async function createTask(root, options) {
  assertNoSecrets(JSON.stringify(options));
  const id = validId(options.id);
  const lock = pathInside(root, "work/tasks/.collection");
  return withFileLock(lock, async () => {
    const records = await taskRecords(root);
    const target = pathInside(root, "work/tasks/" + id + ".md");
    if (await exists(target)) throw new Error("Task already exists: " + id);
    const session = await findSession(root, options.session);
    const now = timestamp();
    const task = {
      id, title: inline(options.title, "--title", 200), session: session.id,
      requirement: options.requirement || session.requirement,
      architecture: options.architecture || session.architecture,
      done_when: inline(options.done_when, "--done-when"), risk: options.risk || "low",
      status: "planned", depends_on: list(options.depends_on, "dependencies"), evidence: [],
      verifier_evidence: "none", created: now, updated: now
    };
    if (!["low", "medium", "high"].includes(task.risk)) throw new Error("Invalid task risk.");
    await taskSession(root, task, { active: true });
    for (const dependency of task.depends_on) validId(dependency);
    validateGraph([...records, task]);
    const text = serialize(task, "## History\n\n- " + now + ": created; planned\n");
    await atomicWrite(target, text);
    return publicTask({ ...task, revision: sha256(text) });
  });
}

export async function updateTask(root, options) {
  assertNoSecrets(JSON.stringify(options));
  validId(options.id);
  if (typeof options.expected_revision !== "string" || !/^[a-f0-9]{64}$/.test(options.expected_revision)) throw new Error("Task update requires --expected-revision SHA-256 from task list/show.");
  const summary = inline(options.summary, "--summary");
  // Scope fields are immutable; reject attempted mutation instead of silently ignoring it.
  for (const field of ["title", "session", "requirement", "architecture", "done_when", "risk"]) if (options[field] !== undefined) throw new Error("Immutable task field: " + field);
  return withFileLock(pathInside(root, "work/tasks/.collection"), async () => {
    const records = await taskRecords(root), original = records.find(t => t.id === options.id);
    if (!original) throw new Error("Task not found: " + options.id);
    if (original.revision !== options.expected_revision) throw new Error("Task revision changed; re-read before updating.");
    if (!transitions[original.status].includes(options.status)) throw new Error("Invalid task transition (terminal states cannot reopen): " + original.status + " -> " + options.status);
    const session = await taskSession(root, original, { active: true });
    if (session.gate_status === "pending" && ["running", "verifying", "done"].includes(options.status)) throw new Error("Resolve the pending session gate before execution.");
    if (options.depends_on !== undefined && !["planned", "blocked"].includes(original.status)) throw new Error("Dependencies may change only while planned or blocked.");
    const task = { ...original, status: options.status, updated: timestamp(),
      depends_on: options.depends_on === undefined ? original.depends_on : list(options.depends_on, "dependencies"),
      evidence: options.evidence === undefined ? original.evidence : list(options.evidence, "evidence"),
      verifier_evidence: options.verifier_evidence === undefined ? original.verifier_evidence : inline(options.verifier_evidence, "--verifier-evidence")
    };
    for (const dependency of task.depends_on) validId(dependency);
    validateGraph(records.map(t => t.id === task.id ? task : t));
    for (const evidence of task.evidence) await fileHash(root, evidence);
    // Validate the exact serialized reference before any transition can persist it.
    // A draft reference is not a verified receipt; done still requires validateTaskCompletion.
    if (task.verifier_evidence !== "none") pathInside(root, task.verifier_evidence, "Verifier evidence");
    if (["ready", "running", "verifying", "done"].includes(task.status)) {
      for (const id of task.depends_on) {
        const dependency = records.find(t => t.id === id);
        if (dependency.status !== "done") throw new Error("Unfinished task dependency: " + id);
        await validateTaskCompletion(root, dependency);
      }
    }
    if (task.status === "done") await validateTaskCompletion(root, task);
    const normalized = original.text.replaceAll("\r\n", "\n");
    const historyStart = normalized.indexOf("## History\n");
    if (historyStart < 0) throw new Error("Task history is missing; repair explicitly before update.");
    const text = serialize(task, normalized.slice(historyStart) + "\n- " + task.updated + ": " + original.status + " -> " + task.status + "; " + summary + "\n");
    // Catch same-record edits made outside this CLI while validation was running.
    if (sha256(await readFile(original.path, "utf8")) !== original.revision) throw new Error("Task revision changed during update.");
    await atomicWrite(original.path, text);
    return publicTask({ ...task, revision: sha256(text) });
  });
}

export async function listTasks(root, options = {}) {
  let tasks = await taskRecords(root);
  if (options.session) {
    const session = await findSession(root, options.session);
    tasks = tasks.filter(t => t.session === session.id);
  }
  if (options.id) {
    tasks = tasks.filter(t => t.id === options.id);
    if (tasks.length !== 1) throw new Error("Task not found: " + options.id);
  }
  return tasks.map(task => ({ ...publicTask(task), path: repoRelative(root, task.path) }));
}
