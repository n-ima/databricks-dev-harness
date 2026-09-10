import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "../../..");
const paths = [
  "tools/lib/session-state.mjs", "tools/lib/tasks.mjs", "tools/lib/work-state.mjs",
  "tools/lib/memory.mjs", "tools/harness.mjs", "tools/agent-hook.mjs",
  "harness/skills/orchestrate-work/SKILL.md", ".claude/skills/orchestrate-work/SKILL.md",
  ".github/skills/orchestrate-work/SKILL.md", "tests/task-visibility.test.mjs",
  "tests/fixtures/task-visibility/golden-task.md", "docs/harness/requirements/task-visibility.md",
  "docs/harness/design/TASK_VISIBILITY.md", "docs/harness/operations/TASK_VISIBILITY.md",
  "docs/harness/operations/CLI_REFERENCE.md", "docs/harness/operations/SESSION_AND_KNOWLEDGE.md",
  "docs/harness/operations/VALIDATION_STATUS.md", "tools/lib/shared.mjs",
  "tools/lib/evidence.mjs", "tools/lib/approval.mjs", "tools/lib/loop.mjs",
  "harness.config.json", "harness/router.json", "AGENTS.md", "package.json",
  "work/evidence/visibility-review/probes.mjs"
];
const files = {};
for (const path of paths) files[path] = createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
const mode = process.argv[2];
assert.ok(["begin", "end"].includes(mode));
const result = { observedAt: new Date().toISOString(), node: process.version, platform: process.platform, files };
if (mode === "end") {
  const parentReport = await readFile(resolve(root, "work/evidence/2026-09-10-visibility-fixes.md"), "utf8");
  const rows = [...parentReport.matchAll(/\| `([^`]+)` \| `([a-f0-9]{64})` \|/g)];
  assert.equal(rows.length, 17);
  for (const [, path, hash] of rows) assert.equal(files[path], hash, path);
  result.implementerSnapshotMatches = rows.length;
  const source = spawnSync("git", ["show", "2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7:tools/agent-hook.mjs"], { cwd: root, shell: false, encoding: "utf8" });
  assert.equal(source.status, 0, source.stderr);
  const current = (await readFile(resolve(root, "tools/agent-hook.mjs"), "utf8")).replaceAll("\r\n", "\n");
  const prior = source.stdout.replaceAll("\r\n", "\n");
  const marker = "const forbidden";
  assert.ok(current.includes(marker) && prior.includes(marker));
  assert.equal(current.slice(current.indexOf(marker)), prior.slice(prior.indexOf(marker)));
  result.hookPolicyStopTailMatchesBase = true;
}
await writeFile(resolve(directory, `snapshot-${mode}.json`), JSON.stringify(result, null, 2) + "\n");
if (mode === "end") assert.deepEqual(files, JSON.parse(await readFile(resolve(directory, "snapshot-begin.json"), "utf8")).files);
console.log(JSON.stringify({ mode, files: paths.length, unchanged: mode === "end" ? true : undefined }));
