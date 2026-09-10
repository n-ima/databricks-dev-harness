import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";
import { checkpointSession } from "../tools/lib/memory.mjs";
import { currentCheckpoint, sectionBody, replaceSection } from "../tools/lib/session-state.mjs";
import { parseFrontmatter, sha256, withFileLock } from "../tools/lib/shared.mjs";
import { sealEvidence } from "../tools/lib/evidence.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function put(root, name, content) {
  await mkdir(dirname(join(root, name)), { recursive: true });
  await writeFile(join(root, name), typeof content === "string" ? content : JSON.stringify(content));
}
async function fixture(t, count = 1) {
  const parent = resolve(tmpdir());
  const root = await mkdtemp(join(parent, "harness-visibility-"));
  t.after(async () => {
    assert.ok(root.startsWith(parent + sep));
    assert.match(root.slice(parent.length + 1), /^harness-visibility-/);
    await rm(root, { recursive: true, force: true });
  });
  await cp(join(repository, "tools"), join(root, "tools"), { recursive: true });
  for (const file of ["AGENTS.md", "harness.config.json", "harness/router.json"]) await put(root, file, await readFile(join(repository, file), "utf8"));
  await put(root, "docs/harness/requirements/work.md", "---\nstatus: accepted\n---\n- AC-01: Fixture work is correct.\n");
  await put(root, "docs/harness/design/work.md", "# Fixture design\n");
  await put(root, "work/evidence/result.md", "# Observed fixture result\n");
  for (let index = 1; index <= count; index++) {
    const id = "S-" + index;
    await put(root, "work/sessions/" + id + ".md", [
      "---", "id: " + id, "title: Session " + index, "status: active", "intent: investigate",
      "provider: codex", "phase: define", "gate: product-intent", "gate_status: approved",
      "updated: 2026-09-" + String(index).padStart(2, "0") + "T00:00:00Z",
      "last_checkpoint: 2026-09-01T00:00:00Z",
      "requirement: docs/harness/requirements/work.md", "architecture: docs/harness/design/work.md",
      "---", "", "# Session " + index, "", "## Verified current state", "", "- Initial state " + index,
      "", "## Next actions", "", "- Initial next " + index, "", "## Blockers and human gates", "", "- none", ""
    ].join("\n"));
  }
  return root;
}
function cli(root, args, env = {}) {
  return spawnSync(process.execPath, [join(root, "tools/harness.mjs"), ...args], {
    cwd: root, shell: false, encoding: "utf8", timeout: 15000,
    env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "", ...env }
  });
}
function hook(root, provider, session) {
  return spawnSync(process.execPath, [join(root, "tools/agent-hook.mjs"), "context", "--provider", provider], {
    cwd: root, shell: false, encoding: "utf8", input: "{}", timeout: 15000,
    env: { ...process.env, HARNESS_SESSION_ID: session || "", HARNESS_LOOP_ID: "" }
  });
}
const taskOptions = { id: "TV-01", title: "Verify visible work", session: "S-1", done_when: "Observable fixture matches AC-01" };
async function api() { return import("../tools/lib/tasks.mjs"); }

test("nine-session CLI and both hooks include newest, gate/current/next and explicit truncation", async t => {
  const root = await fixture(t, 9);
  await put(root, "work/sessions/S-9.md", (await readFile(join(root, "work/sessions/S-9.md"), "utf8")).replace("gate_status: approved", "gate_status: pending"));
  const result = cli(root, ["context"]);
  assert.equal(result.status, 0, result.stderr);
  for (const output of [result.stdout, ...["claude", "copilot"].map(p => {
    const r = hook(root, p); assert.equal(r.status, 0, r.stderr);
    const payload = JSON.parse(r.stdout);
    assert.equal(payload.additionalContext, payload.hookSpecificOutput.additionalContext);
    return payload.additionalContext;
  })]) {
    assert.match(output, /S-9/);
    assert.match(output, /pending/);
    assert.match(output, /Initial state 9/);
    assert.match(output, /Initial next 9/);
    assert.match(output, /1 omitted/);
    assert.match(output, /--all/);
    assert.match(output, /Execution: not observed/);
  }
});

test("explicit focus wins over recency and environment; bad focus never falls back", async t => {
  const root = await fixture(t, 9);
  const r = cli(root, ["context", "--session", "S-1", "--json"], { HARNESS_SESSION_ID: "S-9" });
  assert.equal(r.status, 0, r.stderr);
  const state = JSON.parse(r.stdout);
  assert.equal(state.focusSessionId, "S-1");
  assert.equal(state.sessions[0].id, "S-1");
  assert.equal(state.omittedSessions, 1);
  const all = cli(root, ["context", "--all", "--json"]);
  assert.equal(JSON.parse(all.stdout).sessions.length, 9);
  assert.notEqual(cli(root, ["context", "--session", "missing"]).status, 0);
  assert.notEqual(hook(root, "claude", "missing").status, 0);
  const focused = JSON.parse(hook(root, "copilot", "S-1").stdout).additionalContext;
  assert.ok(focused.indexOf("S-1.md") < focused.indexOf("S-9.md"));
});

test("legacy latest checkpoint overrides stale initial summary in read-only context", async t => {
  const root = await fixture(t);
  const p = join(root, "work/sessions/S-1.md");
  await writeFile(p, (await readFile(p, "utf8")) + "\n## Checkpoint 2026-09-10T00:00:00Z\n\n- summary: Latest proven state\n- next: Exact next action\n");
  const before = await readFile(p, "utf8");
  const result = cli(root, ["context", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const s = JSON.parse(result.stdout).sessions[0];
  assert.equal(s.current, "Latest proven state");
  assert.equal(s.next, "Exact next action");
  assert.equal(await readFile(p, "utf8"), before);
});

test("checkpoint refreshes current sections, preserves initial history, checks revision and gate", async t => {
  const root = await fixture(t);
  const p = join(root, "work/sessions/S-1.md");
  const before = await readFile(p, "utf8");
  await assert.rejects(checkpointSession(root, { id: "S-1", summary: "New", next: "Next", expected_revision: "0".repeat(64) }), /revision/i);
  assert.equal(await readFile(p, "utf8"), before);
  await checkpointSession(root, { id: "S-1", summary: "New proven state", next: "New next", expected_revision: sha256(before) });
  const after = await readFile(p, "utf8");
  assert.match(after, /## Verified current state\s+- New proven state/);
  assert.match(after, /## Next actions\s+- New next/);
  assert.match(after, /Initial state 1/);
  await checkpointSession(root, { id: "S-1", summary: "Second state", next: "Second next" });
  assert.match(await readFile(p, "utf8"), /summary: New proven state/);
  await writeFile(p, (await readFile(p, "utf8")).replace("gate_status: approved", "gate_status: pending"));
  const pending = await readFile(p, "utf8");
  await assert.rejects(checkpointSession(root, { id: "S-1", summary: "Cannot skip", next: "None", phase: "implement" }), /pending/);
  assert.equal(await readFile(p, "utf8"), pending);
});

test("task persists linked scope and appears in context; checkpoint focus must belong to session", async t => {
  const root = await fixture(t, 2);
  const { createTask, updateTask } = await api();
  const created = await createTask(root, taskOptions);
  assert.equal(created.status, "planned");
  assert.equal(created.requirement, "docs/harness/requirements/work.md");
  const before = await readFile(join(root, "work/tasks/TV-01.md"), "utf8");
  assert.match(before, /done_when:/);
  const ready = await updateTask(root, { id: created.id, status: "ready", expected_revision: created.revision, summary: "Scope checked" });
  await updateTask(root, { id: ready.id, status: "running", expected_revision: ready.revision, summary: "Testing locally" });
  await checkpointSession(root, { id: "S-1", summary: "Testing", next: "Verify", task: "TV-01" });
  const state = JSON.parse(cli(root, ["status", "--session", "S-1", "--json"]).stdout);
  assert.equal(state.sessions[0].focusTask, "TV-01");
  assert.equal(state.sessions[0].tasks[0].status, "running");
  await assert.rejects(checkpointSession(root, { id: "S-2", summary: "Wrong", next: "Wrong", task: "TV-01" }), /session/i);
});

test("task writes reject duplicate, unknown session, secrets, outside paths, stale revisions and active locks", async t => {
  const root = await fixture(t);
  const { createTask, updateTask } = await api();
  const one = await createTask(root, taskOptions);
  const p = join(root, "work/tasks/TV-01.md"), before = await readFile(p, "utf8");
  await assert.rejects(createTask(root, taskOptions), /exists|duplicate/i);
  await assert.rejects(createTask(root, { ...taskOptions, id: "../outside" }), /id/i);
  await assert.rejects(createTask(root, { ...taskOptions, id: "TV-02", session: "missing" }), /session/i);
  await assert.rejects(createTask(root, { ...taskOptions, id: "TV-02", requirement: "../outside.md" }), /inside|requirement|session/i);
  await assert.rejects(createTask(root, { ...taskOptions, id: "TV-02", title: "dapi" + "1".repeat(32) }), /secret/i);
  await assert.rejects(updateTask(root, { id: one.id, status: "ready", expected_revision: "0".repeat(64), summary: "stale" }), /revision/i);
  await assert.rejects(updateTask(root, { id: one.id, status: "ready", summary: "no revision" }), /revision/i);
  await withFileLock(join(root, "work/tasks/.collection"), async () => {
    await assert.rejects(updateTask(root, { id: one.id, status: "ready", expected_revision: one.revision, summary: "locked" }), /locked/i);
  });
  assert.equal(await readFile(p, "utf8"), before);
});

test("dependencies and transitions are checked, including hand-edited cycles and missing IDs", async t => {
  const root = await fixture(t);
  const { createTask, updateTask, taskRecords } = await api();
  const a = await createTask(root, taskOptions);
  await assert.rejects(createTask(root, { ...taskOptions, id: "TV-02", depends_on: ["MISSING-01"] }), /dependency/i);
  const b = await createTask(root, { ...taskOptions, id: "TV-02", depends_on: [a.id] });
  await assert.rejects(updateTask(root, { id: b.id, status: "ready", expected_revision: b.revision, summary: "Too early" }), /dependency/i);
  await assert.rejects(updateTask(root, { id: a.id, status: "done", expected_revision: a.revision, summary: "Skip" }), /transition/i);
  const p = join(root, "work/tasks/TV-01.md");
  await writeFile(p, (await readFile(p, "utf8")).replace("depends_on: []", 'depends_on: ["TV-02"]'));
  await assert.rejects(taskRecords(root), /cycle/i);
});

test("done requires current independent receipt and evidence and never approves session", async t => {
  const root = await fixture(t);
  const { createTask, updateTask } = await api();
  let task = await createTask(root, taskOptions);
  for (const status of ["ready", "running", "verifying"]) task = await updateTask(root, { id: task.id, status, expected_revision: task.revision, summary: status });
  const options = { id: task.id, status: "done", expected_revision: task.revision, summary: "Reviewed", evidence: ["work/evidence/result.md"] };
  await assert.rejects(updateTask(root, options), /receipt|verifier/i);
  await put(root, "work/reviews/review.json", { reviewer: "fixture-independent-reviewer", provider: "manual", independent: true, acceptance: [{ id: "AC-01", status: "pass", evidence: ["work/evidence/result.md"] }] });
  await sealEvidence(root, { review: "work/reviews/review.json", session: "S-1", requirement: task.requirement, output: "work/reviews/receipt.json" });
  const receipt = "work/reviews/receipt.json";
  const sessionBefore = await readFile(join(root, "work/sessions/S-1.md"), "utf8");
  task = await updateTask(root, { ...options, verifier_evidence: receipt });
  assert.equal(task.status, "done");
  assert.equal(await readFile(join(root, "work/sessions/S-1.md"), "utf8"), sessionBefore);
  await assert.rejects(updateTask(root, { id: task.id, status: "running", expected_revision: task.revision, summary: "Reopen" }), /terminal|transition/i);
  await put(root, "work/evidence/result.md", "Changed after verification");
  const dependent = await createTask(root, { ...taskOptions, id: "TV-02", depends_on: [task.id] });
  await assert.rejects(updateTask(root, { id: dependent.id, status: "ready", expected_revision: dependent.revision, summary: "Stale proof" }), /changed|stale/i);
});

test("status reads do not write; explicit snapshot generation protects existing non-generated file", async t => {
  const root = await fixture(t);
  const first = cli(root, ["status"]);
  assert.equal(first.status, 0, first.stderr);
  await assert.rejects(readFile(join(root, "work/STATUS.md")), /ENOENT/);
  await put(root, "work/STATUS.md", "# User-owned document\n");
  const refusal = cli(root, ["status", "--write"]);
  assert.notEqual(refusal.status, 0);
  assert.equal(await readFile(join(root, "work/STATUS.md"), "utf8"), "# User-owned document\n");
});

test("context remains bounded and treats markdown/terminal content as data", async t => {
  const root = await fixture(t);
  const p = join(root, "work/sessions/S-1.md");
  await writeFile(p, (await readFile(p, "utf8")).replace("Initial state 1", "x".repeat(20000) + "\u001b[31m"));
  const r = cli(root, ["context"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.length < 12000);
  assert.doesNotMatch(r.stdout, /\u001b/);
  assert.match(r.stdout, /truncated/);
});

test("task focus survives task truncation, can be cleared, and status snapshot resists edits", async t => {
  const root = await fixture(t);
  const { createTask } = await api();
  for (let i = 1; i <= 9; i++) await createTask(root, { ...taskOptions, id: "TV-" + String(i).padStart(2, "0"), title: "Slice " + i });
  await checkpointSession(root, { id: "S-1", summary: "Nine tasks", next: "Review ninth", task: "TV-09" });
  let state = JSON.parse(cli(root, ["status", "--json"]).stdout);
  assert.equal(state.sessions[0].tasks[0].id, "TV-09");
  assert.equal(state.sessions[0].omittedTasks, 1);
  assert.equal(JSON.parse(cli(root, ["status", "--all", "--json"]).stdout).sessions[0].tasks.length, 9);
  const generated = cli(root, ["status", "--write", "--json"]);
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(JSON.parse(generated.stdout).sessions[0].focusTask, "TV-09");
  const p = join(root, "work/STATUS.md");
  assert.match(await readFile(p, "utf8"), /harness:work-status v1 sha256:/);
  assert.equal(cli(root, ["status", "--write"]).status, 0);
  const edited = (await readFile(p, "utf8")) + "\nManual edit\n";
  await writeFile(p, edited);
  assert.notEqual(cli(root, ["status", "--write"]).status, 0);
  assert.equal(await readFile(p, "utf8"), edited);
  await checkpointSession(root, { id: "S-1", summary: "Focus cleared", next: "Choose again", task: "none" });
  state = JSON.parse(cli(root, ["context", "--json"]).stdout);
  assert.equal(state.sessions[0].focusTask, null);
  assert.equal(state.sessions[0].focusTaskMissing, false);
});

test("inherited old harness sessions stay excluded after template initialization", async t => {
  const root = await fixture(t, 2);
  const { createTask } = await api();
  await createTask(root, taskOptions);
  const p = join(root, "work/sessions/S-1.md");
  await writeFile(p, (await readFile(p, "utf8")).replace("intent: investigate", "intent: improve-harness"));
  await put(root, "product.config.json", { name: "new-product", displayName: "New product", initializedAt: "2026-09-10T00:00:00Z" });
  const state = JSON.parse(cli(root, ["context", "--json"]).stdout);
  assert.deepEqual(state.sessions.map(s => s.id), ["S-2"]);
  assert.doesNotMatch(hook(root, "claude").stdout, /TV-01|S-1.md/);
  assert.notEqual(cli(root, ["context", "--session", "S-1"]).status, 0);
});

test("pending gates block task execution and terminal sessions cannot be used as focus", async t => {
  const root = await fixture(t);
  const { createTask, updateTask } = await api();
  let task = await createTask(root, taskOptions);
  task = await updateTask(root, { id: task.id, status: "ready", expected_revision: task.revision, summary: "Ready for decision" });
  const p = join(root, "work/sessions/S-1.md");
  await writeFile(p, (await readFile(p, "utf8")).replace("gate_status: approved", "gate_status: pending"));
  const before = await readFile(join(root, "work/tasks/TV-01.md"), "utf8");
  await assert.rejects(updateTask(root, { id: task.id, status: "running", expected_revision: task.revision, summary: "Too early" }), /pending/);
  assert.equal(await readFile(join(root, "work/tasks/TV-01.md"), "utf8"), before);
  await writeFile(p, (await readFile(p, "utf8")).replace("status: active", "status: superseded"));
  assert.notEqual(cli(root, ["context", "--session", "S-1"]).status, 0);
});

test("task CRUD works through the public CLI and supports CRLF histories", async t => {
  const root = await fixture(t);
  const created = cli(root, ["task", "create", "--id", "CLI-01", "--title", "CLI slice", "--session", "S-1", "--done-when", "Matches AC-01"]);
  assert.equal(created.status, 0, created.stderr);
  const p = join(root, "work/tasks/CLI-01.md");
  await writeFile(p, (await readFile(p, "utf8")).replaceAll("\n", "\r\n"));
  const listed = cli(root, ["task", "show", "--id", "CLI-01"]);
  const task = JSON.parse(listed.stdout)[0];
  assert.equal(task.revision, sha256(await readFile(p, "utf8")));
  const updated = cli(root, ["task", "update", "--id", task.id, "--status", "ready", "--expected-revision", task.revision, "--summary", "Ready"]);
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(JSON.parse(updated.stdout).status, "ready");
  assert.match(await readFile(p, "utf8"), /created; planned/);
  assert.notEqual(cli(root, ["context", "--write"]).status, 0);
});

test("task reader refuses duplicate dependencies and cross-session references", async t => {
  const root = await fixture(t, 2);
  const { createTask, taskRecords } = await api();
  const a = await createTask(root, taskOptions);
  await assert.rejects(createTask(root, { ...taskOptions, id: "TV-02", session: "S-2", depends_on: [a.id] }), /same session/);
  const b = await createTask(root, { ...taskOptions, id: "TV-02", depends_on: [a.id] });
  const p = join(root, "work/tasks/" + b.id + ".md");
  await writeFile(p, (await readFile(p, "utf8")).replace('depends_on: ["TV-01"]', 'depends_on: ["TV-01","TV-01"]'));
  await assert.rejects(taskRecords(root), /duplicate/);
});

test("manual current-state edits are archived on a later checkpoint rather than discarded", async t => {
  const root = await fixture(t);
  await checkpointSession(root, { id: "S-1", summary: "First verified state", next: "First next" });
  const p = join(root, "work/sessions/S-1.md");
  await writeFile(p, (await readFile(p, "utf8")).replace("## Verified current state\n\n- First verified state", "## Verified current state\n\n- Human added an important observation"));
  await checkpointSession(root, { id: "S-1", summary: "Second verified state", next: "Second next" });
  const body = await readFile(p, "utf8");
  assert.match(body, /## Verified current state\s+- Second verified state/);
  assert.match(body, /### Previous verified current state\s+- Human added an important observation/);
  assert.match(body, /summary: First verified state/);
});

test("task scalars round-trip YAML-sensitive punctuation as data", async t => {
  const root = await fixture(t);
  const { createTask, taskRecords } = await api();
  const title = '登録: "分類" #チェック';
  await createTask(root, { ...taskOptions, title, done_when: "AC-01: 保存と再読込" });
  const [task] = await taskRecords(root);
  assert.equal(task.title, title);
  const fields = parseFrontmatter(task.text);
  assert.equal(JSON.parse(fields.title), title);
  assert.equal(JSON.parse(fields.done_when), "AC-01: 保存と再読込");
});

test("boolean flags with values refuse instead of silently changing read/write intent", async t => {
  const root = await fixture(t);
  for (const flag of ["--all", "--json", "--write"]) {
    assert.notEqual(cli(root, ["status", flag, "false"]).status, 0);
  }
  await assert.rejects(readFile(join(root, "work/STATUS.md")), /ENOENT/);
});

test("F-01 rejects outside verifier references before every writable transition", async t => {
  const { createTask, updateTask } = await api();
  const paths = [[], ["ready"], ["ready", "running"], ["ready", "running", "verifying"], ["ready"], ["ready", "blocked"], [], ["ready", "running", "verifying"]];
  const targets = ["ready", "running", "verifying", "running", "blocked", "ready", "cancelled", "done"];
  for (let i = 0; i < paths.length; i++) {
    const root = await fixture(t);
    let task = await createTask(root, taskOptions);
    for (const status of paths[i]) task = await updateTask(root, { id: task.id, status, expected_revision: task.revision, summary: "Prepare transition" });
    const taskPath = join(root, "work/tasks/TV-01.md"), sessionPath = join(root, "work/sessions/S-1.md");
    const before = await readFile(taskPath, "utf8"), sessionBefore = await readFile(sessionPath, "utf8");
    for (const verifier_evidence of ["../outside-receipt.json", resolve(root, "../outside-receipt.json"), "  ../outside-receipt.json  "]) {
      await assert.rejects(updateTask(root, { id: task.id, status: targets[i], expected_revision: task.revision, summary: "Must reject before save", verifier_evidence }), /inside the repository/);
      assert.equal(await readFile(taskPath, "utf8"), before);
      assert.equal(await readFile(sessionPath, "utf8"), sessionBefore);
    }
    assert.equal(cli(root, ["task", "show", "--id", task.id]).status, 0);
    assert.equal(cli(root, ["status", "--json"]).status, 0);
  }
});

test("F-01 public CLI rejects bad verifier input and leaves both start hooks usable", async t => {
  const root = await fixture(t);
  const { createTask, updateTask } = await api();
  const task = await createTask(root, taskOptions);
  const taskPath = join(root, "work/tasks/TV-01.md"), before = await readFile(taskPath, "utf8");
  const args = ["task", "update", "--id", task.id, "--status", "ready", "--expected-revision", task.revision, "--summary", "Reject invalid reference"];
  for (const extra of [["--verifier-evidence", "../outside.json"], ["--verifier-evidence"], ["--verifier-evidence", ""], ["--verifier-evidence", "work/a.json", "--verifier-evidence", "work/b.json"]]) {
    const result = cli(root, [...args, ...extra]);
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(await readFile(taskPath, "utf8"), before);
    for (const provider of ["claude", "copilot"]) {
      const result = hook(root, provider, "S-1");
      assert.equal(result.status, 0, result.stderr);
      assert.match(JSON.parse(result.stdout).additionalContext, /TV-01/);
    }
  }
  // An in-repository draft reference is not a verified receipt or an approval.
  const sessionPath = join(root, "work/sessions/S-1.md"), sessionBefore = await readFile(sessionPath, "utf8");
  const ready = await updateTask(root, { id: task.id, status: "ready", expected_revision: task.revision, summary: "Draft receipt reference only", verifier_evidence: " work/reviews/not-yet-sealed.json " });
  assert.equal(ready.verifier_evidence, "work/reviews/not-yet-sealed.json");
  assert.equal(JSON.parse(cli(root, ["task", "show", "--id", task.id]).stdout)[0].verifier_evidence, ready.verifier_evidence);
  assert.equal(await readFile(sessionPath, "utf8"), sessionBefore);
});

test("F-02 legacy omitted blockers inherit the last explicit value, including none, without writes", async t => {
  for (const eol of ["\n", "\r\n"]) {
    const root = await fixture(t), p = join(root, "work/sessions/S-1.md");
    // Checkpoint layout emitted by memory.mjs at 2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7.
    let text = replaceSection(await readFile(p, "utf8"), "Blockers and human gates", "- Initial blocker");
    const checkpoint = (summary, blocker) => `\n## Checkpoint 2026-09-10T00:00:00Z\n\n- summary: ${summary}\n- next: Latest next\n${blocker === undefined ? "" : "- blocker: " + blocker + "\n"}`;
    text += checkpoint("First state", "Waiting for existing user decision") + checkpoint("Latest state");
    for (const expected of ["Waiting for existing user decision", "none"]) {
      if (expected === "none") text += checkpoint("Clear blocker", "none") + checkpoint("Latest state");
      // Blank optional fields are not an explicit clearance either.
      text += checkpoint("Latest state", "");
      const before = text.replaceAll("\n", eol);
      await writeFile(p, before);
      for (const command of ["context", "status"]) {
        const result = cli(root, [command, "--json"]);
        assert.equal(result.status, 0, result.stderr);
        const state = JSON.parse(result.stdout).sessions[0];
        assert.equal(state.current, "Latest state");
        assert.equal(state.blocker, expected);
      }
      for (const provider of ["claude", "copilot"]) {
        const result = hook(root, provider, "S-1");
        assert.equal(result.status, 0, result.stderr);
        assert.ok(JSON.parse(result.stdout).additionalContext.includes("- Blocker: " + expected));
      }
      assert.equal(await readFile(p, "utf8"), before);
      assert.equal(parseFrontmatter(before).gate_status, "approved");
    }
  }
});

test("F-03 initial blocker content is archived before replacement", async t => {
  const root = await fixture(t), p = join(root, "work/sessions/S-1.md");
  const oldBody = "- Initial important blocker\n- Owner decision still required";
  await writeFile(p, replaceSection(await readFile(p, "utf8"), "Blockers and human gates", oldBody).replaceAll("\n", "\r\n"));
  await checkpointSession(root, { id: "S-1", summary: "New state", next: "New next", blocker: "none" });
  const after = await readFile(p, "utf8");
  assert.equal(sectionBody(after, "Blockers and human gates"), "- none");
  assert.ok(after.includes("### Previous blockers and human gates\n\n" + oldBody));
  assert.equal(currentCheckpoint(after).blocker, "none");
});

test("F-03 manually added blockers survive later checkpoints and unchanged bodies are not rearchived", async t => {
  const root = await fixture(t), p = join(root, "work/sessions/S-1.md");
  await checkpointSession(root, { id: "S-1", summary: "First", next: "Next", blocker: "Waiting" });
  const manual = "- Waiting\n- Human added a critical dependency";
  await writeFile(p, replaceSection(await readFile(p, "utf8"), "Blockers and human gates", manual));
  // Omission does not overwrite the human's section.
  await checkpointSession(root, { id: "S-1", summary: "Second", next: "Next" });
  assert.equal(sectionBody(await readFile(p, "utf8"), "Blockers and human gates"), manual);
  await checkpointSession(root, { id: "S-1", summary: "Third", next: "Next", blocker: "none" });
  const after = await readFile(p, "utf8");
  assert.ok(after.includes("### Previous blockers and human gates\n\n" + manual));
  const archives = text => [...text.matchAll(/^## Previous state archived /gm)].length;
  await checkpointSession(root, { id: "S-1", summary: "Fourth", next: "Next", blocker: "none" });
  assert.equal(archives(await readFile(p, "utf8")), archives(after));
});

test("F-03 pre-fix format-2 sessions archive a blocker not present in earlier checkpoints", async t => {
  const root = await fixture(t), p = join(root, "work/sessions/S-1.md");
  let text = await readFile(p, "utf8");
  text = text.replace("status: active", "status: active\ncheckpoint_format: 2");
  text = replaceSection(text, "Blockers and human gates", "- Unarchived legacy blocker");
  text += "\n## Checkpoint 2026-09-10T00:00:00Z\n\n- summary: Initial state 1\n- next: Initial next 1\n";
  await writeFile(p, text);
  await checkpointSession(root, { id: "S-1", summary: "New state", next: "New next", blocker: "none" });
  const after = await readFile(p, "utf8");
  assert.match(after, /### Previous blockers and human gates\s+- Unarchived legacy blocker/);
  assert.equal(sectionBody(after, "Blockers and human gates"), "- none");
});
