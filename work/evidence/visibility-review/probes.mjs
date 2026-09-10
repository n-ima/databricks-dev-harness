import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Independent review probes: authored only here; mutations run in owned temp fixtures.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { createTask } = await import(pathToFileURL(join(repository, "tools/lib/tasks.mjs")));
const { checkpointSession } = await import(pathToFileURL(join(repository, "tools/lib/memory.mjs")));
const { currentCheckpoint } = await import(pathToFileURL(join(repository, "tools/lib/session-state.mjs")));
const base = resolve(tmpdir());
const owned = [];
async function put(root, name, text) {
  const target = join(root, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text);
}
async function fixture() {
  const root = await mkdtemp(join(base, "harness-independent-visibility-"));
  owned.push(root);
  await cp(join(repository, "tools"), join(root, "tools"), { recursive: true });
  for (const name of ["AGENTS.md", "harness.config.json", "harness/router.json"])
    await put(root, name, await readFile(join(repository, name), "utf8"));
  await put(root, "docs/requirement.md", "---\nstatus: draft\n---\n- AC-01: Review fixture only.\n");
  await put(root, "docs/design.md", "# Review fixture\n");
  await put(root, "work/sessions/S-1.md", [
    "---", "id: S-1", "title: Fixture", "status: active", "intent: investigate",
    "provider: codex", "phase: define", "gate: none", "gate_status: not-applicable",
    "updated: 2026-09-01T00:00:00Z", "last_checkpoint: 2026-09-01T00:00:00Z",
    "requirement: docs/requirement.md", "architecture: docs/design.md", "---", "",
    "# Fixture", "", "## Verified current state", "", "- Initial state", "",
    "## Next actions", "", "- Initial next", "", "## Blockers and human gates", "",
    "- Initial important blocker", ""
  ].join("\n"));
  return root;
}
function cli(root, args, input) {
  const result = spawnSync(process.execPath, [join(root, "tools", input ? "agent-hook.mjs" : "harness.mjs"), ...args], {
    cwd: root, shell: false, encoding: "utf8", timeout: 15000, input,
    env: { ...process.env, HARNESS_SESSION_ID: "", HARNESS_LOOP_ID: "" }
  });
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr, error: result.error?.message };
}
const options = { id: "REV-01", title: "Independent fixture task", session: "S-1", done_when: "Review fixture matches its expected state" };
try {
  {
    const root = await fixture();
    const task = await createTask(root, options);
    const before = await readFile(join(root, "work/tasks/REV-01.md"), "utf8");
    const result = cli(root, ["task", "update", "--id", task.id, "--status", "ready", "--summary", "Valid transition with invalid receipt reference", "--expected-revision", task.revision, "--verifier-evidence", "../outside-receipt.json"]);
    const after = await readFile(join(root, "work/tasks/REV-01.md"), "utf8");
    const show = cli(root, ["task", "show", "--id", task.id]);
    const status = cli(root, ["status", "--json"]);
    const claude = cli(root, ["context", "--provider", "claude"], "{}");
    const copilot = cli(root, ["context", "--provider", "copilot"], "{}");
    assert.equal(result.exit, 0);
    assert.notEqual(before, after);
    assert.match(after, /verifier_evidence: "\.\.\/outside-receipt.json"/);
    for (const operation of [show, status, claude, copilot]) assert.notEqual(operation.exit, 0);
    console.log(JSON.stringify({ probe: "outside-verifier-reference", reproduced: true, update: result, recordChanged: before !== after, show, status, claude, copilot }));
  }
  {
    const root = await fixture();
    const path = join(root, "work/sessions/S-1.md");
    await checkpointSession(root, { id: "S-1", summary: "New state", next: "New next", blocker: "none" });
    const after = await readFile(path, "utf8");
    console.log(JSON.stringify({ probe: "initial-blocker-history", priorBlockerRetained: after.includes("Initial important blocker"), latest: currentCheckpoint(after) }));
  }
  {
    const root = await fixture();
    const task = await createTask(root, options);
    const path = join(root, "work/tasks/REV-01.md");
    await writeFile(path, (await readFile(path, "utf8")).replace('session: "S-1"', 'session: "MISSING-SESSION"'));
    const show = cli(root, ["task", "show", "--id", task.id]);
    const status = cli(root, ["status", "--json"]);
    console.log(JSON.stringify({ probe: "orphaned-task-reader", show, status }));
  }
  {
    const root = await fixture();
    const path = join(root, "work/sessions/S-1.md");
    const legacySource = spawnSync("git", ["show", "2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7:tools/lib/memory.mjs"], { cwd: repository, shell: false, encoding: "utf8" });
    assert.equal(legacySource.status, 0, legacySource.stderr);
    const legacyPath = join(root, "tools/lib/legacy-memory.mjs");
    await writeFile(legacyPath, legacySource.stdout);
    const legacy = await import(pathToFileURL(legacyPath));
    await legacy.checkpointSession(root, { id: "S-1", summary: "Most recent state", next: "Most recent next", blocker: "Waiting for existing user decision" });
    await legacy.checkpointSession(root, { id: "S-1", summary: "Newer state", next: "Newer next" });
    const before = await readFile(path, "utf8");
    const state = JSON.parse(cli(root, ["context", "--json"]).stdout).sessions[0];
    assert.match(before, /blocker: Waiting for existing user decision/);
    assert.equal(state.blocker, "Initial important blocker");
    const claude = JSON.parse(cli(root, ["context", "--provider", "claude"], "{}").stdout).additionalContext;
    const copilot = JSON.parse(cli(root, ["context", "--provider", "copilot"], "{}").stdout).additionalContext;
    for (const output of [claude, copilot]) {
      assert.ok(output.includes("Initial important blocker"));
      assert.ok(!output.includes("Waiting for existing user decision"));
    }
    assert.equal(await readFile(path, "utf8"), before);
    console.log(JSON.stringify({ probe: "legacy-omitted-blocker", reproducedFromBaseCommit: true, state, bothHooksLostLatestBlocker: true, readOnlyPreserved: true }));
  }
} finally {
  for (const root of owned) {
    assert.ok(root.startsWith(base + sep));
    assert.match(root.slice(base.length + 1), /^harness-independent-visibility-/);
    await rm(root, { recursive: true, force: true });
  }
}
