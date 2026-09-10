import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Reviewer-authored expected-success probes. Every write is confined to owned fixtures.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { checkpointSession } = await import(pathToFileURL(join(repository, "tools/lib/memory.mjs")));
const { currentCheckpoint, sectionBody, replaceSection } = await import(pathToFileURL(join(repository, "tools/lib/session-state.mjs")));
const { parseFrontmatter } = await import(pathToFileURL(join(repository, "tools/lib/shared.mjs")));
const parent = resolve(tmpdir()), owned = [];
const prefix = "harness-visibility-rereview-";
const baseCommit = "2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7";
async function put(root, name, content) {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
async function fixture() {
  const root = await mkdtemp(join(parent, prefix));
  owned.push(root);
  await cp(join(repository, "tools"), join(root, "tools"), { recursive: true });
  for (const name of ["AGENTS.md", "harness.config.json", "harness/router.json"])
    await put(root, name, await readFile(join(repository, name), "utf8"));
  await put(root, "docs/requirement.md", "---\nstatus: draft\n---\n- AC-01: Reviewer fixture only.\n");
  await put(root, "docs/design.md", "# Reviewer fixture\n");
  await put(root, "work/evidence/result.md", "# Unverified fixture evidence\n");
  await put(root, "work/sessions/S-1.md", [
    "---", "id: S-1", "title: Reviewer fixture", "status: active", "intent: investigate",
    "provider: codex", "phase: define", "gate: none", "gate_status: not-applicable",
    "updated: 2026-09-01T00:00:00Z", "last_checkpoint: 2026-09-01T00:00:00Z",
    "requirement: docs/requirement.md", "architecture: docs/design.md", "---", "",
    "# Fixture", "", "## Verified current state", "", "- Initial state", "",
    "## Next actions", "", "- Initial next", "", "## Blockers and human gates", "",
    "- Initial important blocker", "- Initial secondary detail", ""
  ].join("\n"));
  return root;
}
function command(root, args, hook = false) {
  const result = spawnSync(process.execPath, [join(root, "tools", hook ? "agent-hook.mjs" : "harness.mjs"), ...args], {
    cwd: root, shell: false, encoding: "utf8", timeout: 15000, input: hook ? "{}" : undefined,
    env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "" }
  });
  assert.ifError(result.error);
  return result;
}
function ok(result) { assert.equal(result.status, 0, result.stderr); return result; }
async function assertSurfaces(root, expected = {}) {
  const path = join(root, "work/sessions/S-1.md"), before = await readFile(path);
  for (const cmd of ["context", "status"]) {
    const state = JSON.parse(ok(command(root, [cmd, "--json"])).stdout).sessions[0];
    for (const [key, value] of Object.entries(expected)) assert.equal(state[key], value);
    assert.equal(state.gateStatus, "not-applicable");
  }
  for (const provider of ["claude", "copilot"]) {
    const payload = JSON.parse(ok(command(root, ["context", "--provider", provider], true)).stdout);
    assert.equal(payload.additionalContext, payload.hookSpecificOutput.additionalContext);
    for (const [key, value] of Object.entries(expected)) {
      const label = { current: "Current", next: "Next", blocker: "Blocker" }[key];
      assert.ok(payload.additionalContext.includes(`- ${label}: ${value}`), payload.additionalContext);
    }
    assert.match(payload.additionalContext, /Execution: not observed/);
  }
  assert.deepEqual(await readFile(path), before);
}
function create(root) {
  return JSON.parse(ok(command(root, ["task", "create", "--id", "REV-01", "--title", "Independent probe", "--session", "S-1", "--done-when", "Matches fixture expectation"])).stdout);
}
function update(root, task, status, extra = []) {
  return command(root, ["task", "update", "--id", task.id, "--status", status, "--expected-revision", task.revision, "--summary", "Independent probe update", ...extra]);
}
async function legacyWriter(root) {
  const source = spawnSync("git", ["show", `${baseCommit}:tools/lib/memory.mjs`], { cwd: repository, shell: false, encoding: "utf8" });
  assert.equal(source.status, 0, source.stderr);
  const path = join(root, "tools/lib/legacy-memory.mjs");
  await writeFile(path, source.stdout);
  return import(pathToFileURL(path));
}
const outcomes = [];
function passed(probe, details = {}) { const result = { probe, status: "pass", ...details }; outcomes.push(result); console.log(JSON.stringify(result)); }
try {
  {
    const edges = {
      planned: ["ready", "cancelled"], ready: ["running", "blocked", "cancelled"],
      running: ["verifying", "blocked", "cancelled"], verifying: ["running", "blocked", "done", "cancelled"],
      blocked: ["ready", "cancelled"]
    };
    const routes = { planned: [], ready: ["ready"], running: ["ready", "running"], verifying: ["ready", "running", "verifying"], blocked: ["ready", "blocked"] };
    let checked = 0;
    for (const [source, targets] of Object.entries(edges)) {
      for (const target of targets) {
        const root = await fixture();
        let task = create(root);
        for (const state of routes[source]) task = JSON.parse(ok(update(root, task, state)).stdout);
        const taskPath = join(root, "work/tasks/REV-01.md"), sessionPath = join(root, "work/sessions/S-1.md");
        const before = await readFile(taskPath), sessionBefore = await readFile(sessionPath);
        for (const reference of ["../outside.json", "..\\outside.json", "  ../outside.json  ", resolve(root, "../outside.json")]) {
          const result = update(root, task, target, ["--verifier-evidence", reference]);
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, /inside the repository/);
          assert.deepEqual(await readFile(taskPath), before);
          assert.deepEqual(await readFile(sessionPath), sessionBefore);
          checked++;
        }
        ok(command(root, ["task", "show", "--id", task.id]));
        await assertSurfaces(root);
      }
    }
    passed("F-01-all-public-transition-edges", { edges: 14, rejectedInputs: checked, bytesUnchanged: true, contextAndBothHooksUsable: true });
  }
  {
    const root = await fixture(), outside = await fixture();
    await mkdir(join(root, "work/reviews"), { recursive: true });
    await symlink(outside, join(root, "work/reviews/outside-link"), "junction");
    let task = create(root);
    const taskPath = join(root, "work/tasks/REV-01.md"), before = await readFile(taskPath);
    for (const flags of [
      ["--verifier-evidence"], ["--verifier-evidence="], ["--verifier-evidence", "   "],
      ["--verifier-evidence", "work/a.json", "--verifier-evidence", "work/b.json"],
      ["--verifier-evidence", "work/reviews/outside-link/receipt.json"]
    ]) {
      assert.notEqual(update(root, task, "ready", flags).status, 0);
      assert.deepEqual(await readFile(taskPath), before);
      await assertSurfaces(root);
    }
    task = JSON.parse(ok(update(root, task, "ready", ["--verifier-evidence", " work/reviews/draft.json "])).stdout);
    assert.equal(task.verifier_evidence, "work/reviews/draft.json");
    for (const state of ["running", "verifying"]) task = JSON.parse(ok(update(root, task, state)).stdout);
    const verifying = await readFile(taskPath);
    assert.notEqual(update(root, task, "done", ["--evidence", "work/evidence/result.md"]).status, 0);
    assert.deepEqual(await readFile(taskPath), verifying);
    await assertSurfaces(root);
    passed("F-01-malformed-junction-and-draft", { refusedInputs: 5, draftNormalized: true, unsealedDoneRefused: true });
  }
  for (const eol of ["\n", "\r\n"]) {
    const root = await fixture(), legacy = await legacyWriter(root), path = join(root, "work/sessions/S-1.md");
    for (const blocker of ["Waiting for owner", "none", "Waiting for renewed decision"]) {
      await legacy.checkpointSession(root, { id: "S-1", summary: "Recorded blocker", next: "Prior next", blocker });
      await legacy.checkpointSession(root, { id: "S-1", summary: "Intermediate state", next: "Intermediate next" });
      await legacy.checkpointSession(root, { id: "S-1", summary: "Latest state", next: "Latest next", blocker: "   " });
      const raw = await readFile(path, "utf8");
      await writeFile(path, raw.replaceAll("\r\n", "\n").replaceAll("\n", eol));
      await assertSurfaces(root, { current: "Latest state", next: "Latest next", blocker });
    }
    passed("F-02-real-legacy-writer", { baseCommit, lineEndings: eol === "\n" ? "LF" : "CRLF", omissionBlankNoneRenewal: true, readOnly: true });
  }
  for (const format2 of [false, true]) {
    const root = await fixture(), path = join(root, "work/sessions/S-1.md");
    let initial = await readFile(path, "utf8");
    if (format2) {
      initial = initial.replace("status: active", "status: active\ncheckpoint_format: 2");
      initial += "\n## Checkpoint 2026-09-01T00:00:00Z\n\n- summary: Initial state\n- next: Initial next\n";
    }
    await writeFile(path, initial.replaceAll("\n", "\r\n"));
    const originalBody = sectionBody(initial, "Blockers and human gates");
    await checkpointSession(root, { id: "S-1", summary: "First new state", next: "Next", blocker: "First wait" });
    let text = await readFile(path, "utf8");
    assert.ok(text.includes(`### Previous blockers and human gates\n\n${originalBody}`));
    const manualBody = "- First wait\n- Human added dependency\n\nAdditional owner detail.";
    await writeFile(path, replaceSection(text, "Blockers and human gates", manualBody));
    await checkpointSession(root, { id: "S-1", summary: "Omission", next: "Next" });
    text = await readFile(path, "utf8");
    assert.equal(sectionBody(text, "Blockers and human gates"), manualBody);
    await checkpointSession(root, { id: "S-1", summary: "Clear", next: "Next", blocker: "none" });
    text = await readFile(path, "utf8");
    assert.ok(text.includes(`### Previous blockers and human gates\n\n${manualBody}`));
    assert.equal(currentCheckpoint(text).blocker, "none");
    const count = source => [...source.matchAll(/^## Previous state archived /gm)].length;
    const archives = count(text);
    await checkpointSession(root, { id: "S-1", summary: "Same blocker", next: "Next", blocker: "none" });
    const after = await readFile(path, "utf8");
    assert.equal(count(after), archives);
    assert.equal(parseFrontmatter(after).gate_status, "not-applicable");
    assert.match(after, /summary: First new state/);
    await assertSurfaces(root, { current: "Same blocker", next: "Next", blocker: "none" });
    passed("F-03-archive-and-manual-content", { initialFormat2: format2, initialAndManualPreserved: true, omissionPreservesSection: true, noDuplicateArchive: true });
  }
  console.log(JSON.stringify({ summary: "All reviewer assertions passed", groups: outcomes.length, observedAt: new Date().toISOString() }));
} finally {
  for (const root of owned) {
    assert.ok(root.startsWith(parent + sep));
    assert.ok(root.slice(parent.length + 1).startsWith(prefix));
    assert.notEqual(root, parent);
    await rm(root, { recursive: true, force: true });
  }
}
