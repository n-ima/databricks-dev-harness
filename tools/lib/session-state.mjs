import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { exists, parseFrontmatter, pathInside, sha256 } from "./shared.mjs";

export function sectionBody(text, heading) {
  const normalized = text.replaceAll("\r\n", "\n");
  const marker = "## " + heading + "\n";
  const start = normalized.indexOf("\n" + marker);
  if (start < 0) return "";
  const bodyStart = start + marker.length + 1;
  const end = normalized.indexOf("\n## ", bodyStart);
  return normalized.slice(bodyStart, end < 0 ? undefined : end).trim();
}

export function replaceSection(text, heading, body) {
  const normalized = text.replaceAll("\r\n", "\n");
  const marker = "\n## " + heading + "\n";
  const start = normalized.indexOf(marker);
  if (start < 0) return normalized + marker + "\n" + body.trim() + "\n";
  const end = normalized.indexOf("\n## ", start + marker.length);
  return normalized.slice(0, start) + marker + "\n" + body.trim() + "\n" + (end < 0 ? "" : normalized.slice(end));
}

function oneLine(text) {
  return text.replace(/^\s*[-*]\s+/gm, "").replace(/\s+/g, " ").trim();
}

export function currentCheckpoint(text) {
  const blocks = [...text.replaceAll("\r\n", "\n").matchAll(/^## Checkpoint [^\n]+\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  const latest = blocks.at(-1)?.[1] || "";
  const value = (key, body = latest) => body.match(new RegExp("^- " + key + ": (.*)$", "m"))?.[1];
  // Legacy writers appended optional blockers without refreshing the initial section.
  // Omission/blank is not clearance; an explicit "none" is retained like any other value.
  const blocker = blocks.map(block => value("blocker", block[1])).findLast(value => value?.trim());
  return {
    current: value("summary") || oneLine(sectionBody(text, "Verified current state")) || "not recorded",
    next: value("next") || oneLine(sectionBody(text, "Next actions")) || "not recorded",
    blocker: blocker || oneLine(sectionBody(text, "Blockers and human gates")) || "not recorded",
  };
}

export async function sessionRecords(root, { filterProduct = true } = {}) {
  const directory = pathInside(root, "work/sessions");
  if (!(await exists(directory))) return [];
  const result = [];
  for (const name of (await readdir(directory)).filter(n => n.endsWith(".md") && n.toLowerCase() !== "readme.md")) {
    const path = pathInside(root, join("work/sessions", name));
    const text = await readFile(path, "utf8");
    const fields = parseFrontmatter(text);
    if (fields.id) result.push({ ...fields, path, text, revision: sha256(text), ...currentCheckpoint(text) });
  }
  const productPath = pathInside(root, "product.config.json");
  const initializedAt = filterProduct && await exists(productPath) ? JSON.parse(await readFile(productPath, "utf8")).initializedAt : null;
  return result.filter(item => !(initializedAt && item.intent === "improve-harness" && (item.updated || "") < initializedAt))
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || "") || a.id.localeCompare(b.id));
}

export async function findSession(root, id, options = {}) {
  if (!id || typeof id !== "string") throw new Error("Specify a session id.");
  const records = await sessionRecords(root, options);
  const exact = records.filter(s => s.id === id);
  const matches = exact.length ? exact : records.filter(s => s.id.startsWith(id));
  if (matches.length !== 1) throw new Error("Session not found or ambiguous: " + id);
  return matches[0];
}
