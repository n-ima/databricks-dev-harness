// One-shot, explicitly scoped publication assembly. Not a product updater.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, mkdir, lstat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, writeJson } from "../../tools/lib/shared.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = join(root, ".harness/runtime/publish-0.6.0");
const base = "a37f3321188ce11f455f5d76793a24fe16ad78e1";
function git(args, input) {
  const r = spawnSync("git", args, { cwd: root, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr || r.error?.message || args.join(" "));
  return r.stdout.trimEnd();
}
assert.equal(git(["rev-parse", "HEAD"]), base, "Recheck publication base before rebuilding.");
assert.equal(git(["diff", "--cached", "--name-only"]), "", "Index must start empty; preserve existing staged work.");
assert.ok(output.startsWith(`${join(root, ".harness/runtime")}${sep}`));
try { await lstat(output); throw new Error("Publication directory already exists; never overwrite it."); } catch (e) { if (e.code !== "ENOENT") throw e; }

const exact = new Set([
  "README.md", "package.json", "package-lock.json", "harness.config.json", "docs/USAGE.md", "docs/site/index.html",
  "docs/harness/operations/VALIDATION_STATUS.md", "docs/harness/operations/UPDATING_EXISTING_PROJECTS.md",
  "docs/harness/operations/SAFE_LOCAL_UPDATE.md", "docs/harness/design/SAFE_LOCAL_UPDATE.md",
  "docs/harness/decisions/ADR-0011-safe-local-update-adoption.md",
  "docs/harness/requirements/2026-09-15-safe-local-update.md", "docs/harness/requirements/2026-09-15-safe-update-publication.md",
  "harness/router.json", "harness/skills/orchestrate-work/SKILL.md", "harness/skills/update-harness/SKILL.md",
  ".claude/skills/orchestrate-work/SKILL.md", ".github/skills/orchestrate-work/SKILL.md",
  ".claude/skills/update-harness/SKILL.md", ".github/skills/update-harness/SKILL.md",
  "tools/update-harness.mjs", "tests/update-entry.test.mjs",
  "work/quality/safe-local-update.json", "work/plans/2026-09-15-safe-local-update.md", "work/plans/2026-09-15-safe-update-publication.md",
  "work/sessions/20260915-010502-538-safe-local-harness-update.md", "work/sessions/20260915-013942-357-publish-safe-update-0-6-0.md",
  "work/tasks/SU-WORK-01.md", "work/tasks/SU-PUB-060.md",
]);
const observed = [...new Set([...git(["diff", "--name-only"]).split("\n"), ...git(["ls-files", "--others", "--exclude-standard"]).split("\n")])].filter(Boolean);
const allowedRecord = p => /^work\/(evidence|reviews)\/2026-09-15-(safe-update|safe-local-update|publication-060)[a-zA-Z0-9._-]*\.(md|mjs|json|log)$/.test(p);
const selected = observed.filter(p => exact.has(p) || allowedRecord(p));
for (const p of selected) assert.ok((await lstat(join(root, p))).isFile(), p);
git(["add", "--", ...selected]);

const removals = new Map([
  ["tools/lib/distribution.mjs", '  "tests/scoped-approval.test.mjs",\n'],
  ["docs/harness/operations/CLI_REFERENCE.md", '案件の環境・操作・権限・費用・期限を持つ新しい承認台帳のローカル候補は\n[SCOPED_APPROVALS](SCOPED_APPROVALS.md)を参照。`approval-scope record/check/revoke`は\n旧gateを解除せず、実行許可・実CLI/DB操作を行わない。正式採用前の限定機能である。\n\n'],
]);
const preserved = {};
for (const p of ["tools/harness.mjs", "tools/lib/scoped-approval.mjs", "tests/scoped-approval.test.mjs", "docs/harness/design/SCOPED_APPROVALS.md", "docs/harness/operations/SCOPED_APPROVALS.md", "work/STATUS.md", "work/plans/2026-09-10-retrospective-hardening.md", "work/sessions/20260909-214048-619-retrospective-hardening.md", "work/tasks/HARD-03.md", ...removals.keys()]) preserved[p] = sha256(await readFile(join(root, p)));
for (const [p, remove] of removals) {
  const original = (await readFile(join(root, p), "utf8")).replaceAll("\r\n", "\n");
  assert.equal(original.split(remove).length, 2, `Expected exactly one unadopted hunk in ${p}`);
  const content = original.replace(remove, "");
  const oid = git(["hash-object", "-w", "--stdin"], content);
  git(["update-index", "--add", "--cacheinfo", `100644,${oid},${p}`]);
}
const staged = git(["diff", "--cached", "--name-only"]).split("\n");
assert.ok(staged.every(p => exact.has(p) || allowedRecord(p) || removals.has(p)));
assert.ok(!staged.some(p => /SCOPED_APPROVALS|scoped-approval|HARD-03/.test(p)));
await mkdir(output, { recursive: true });
git(["checkout-index", "--all", `--prefix=${output.replaceAll("\\", "/")}/`]);
for (const [p, hash] of Object.entries(preserved)) assert.equal(sha256(await readFile(join(root, p))), hash, `Working file changed: ${p}`);
const record = { version: "0.6.0", base, output, staged, preserved, writtenAt: new Date().toISOString(), realProductChanged: false, pushed: false };
await writeJson(join(root, "work/evidence/2026-09-15-publication-060-assembly.json"), record);
console.log(JSON.stringify({ version: record.version, output, stagedFiles: staged.length, preservedFiles: Object.keys(preserved).length }, null, 2));
