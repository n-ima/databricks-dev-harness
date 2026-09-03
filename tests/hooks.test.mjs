import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function fixture(t) {
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "harness-hook-contract-"));
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`));
    assert.match(root.slice(temporaryBase.length + 1), /^harness-hook-contract-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, "tools"), { recursive: true });
  await cp(join(repository, "tools/agent-hook.mjs"), join(root, "tools/agent-hook.mjs"));
  await cp(join(repository, "tools/lib"), join(root, "tools/lib"), { recursive: true });
  return root;
}

async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof content === "string" ? content : JSON.stringify(content));
}

function invoke(root, provider, action, payload, env = {}) {
  // Commands in payloads are untrusted TEXT; only the hook process is executed.
  const result = spawnSync(process.execPath, [join(root, "tools/agent-hook.mjs"), action, "--provider", provider], {
    cwd: root, encoding: "utf8", shell: false, timeout: 10_000,
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: { ...process.env, HARNESS_LOOP_ID: "", HARNESS_SESSION_ID: "", ...env },
  });
  const text = result.stdout.trim();
  return { ...result, output: text ? JSON.parse(text) : {} };
}

function commandPayload(provider, command) {
  return provider === "claude"
    ? { tool_name: "Bash", tool_input: { command } }
    : { toolName: "powershell", toolArgs: { command } };
}

function editPayload(provider, path, content = "safe application change") {
  return provider === "claude"
    ? { tool_name: "Write", tool_input: { file_path: path, content } }
    : { toolName: "create", toolArgs: { path, content } };
}

function assertDenied(result, message) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.permissionDecision ?? result.output.hookSpecificOutput?.permissionDecision, "deny", message);
}

function assertAllowed(result, message) {
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, {}, message);
}

const safeCommands = [
  "npm run test:harness", "node --test tests/data.test.mjs", "git -C app diff --stat",
  "git -C app push origin feature/report", "databricks --profile DEV bundle validate --target dev",
  "databricks --profile DEV bundle deploy --target dev", "databricks bundle deploy -t dev --profile DEV",
  "Remove-Item -LiteralPath ./work/evidence/temporary.txt", "SELECT id, total FROM sales LIMIT 20",
];

const deniedCommands = [
  ["production deployment with CLI global options", "databricks --profile PROD bundle deploy --target prod"],
  ["unspecified target", "databricks --profile DEV bundle deploy"],
  ["prod profile on a dev target", "databricks -p PROD bundle deploy -t dev"],
  ["App deployment with CLI prefix", "databricks --profile DEV apps deploy sales"],
  ["destructive bundle prefix", "databricks --profile DEV bundle destroy -t dev"],
  ["production npm wrapper", "npm --prefix apps/report run deploy:prod"],
  ["production PowerShell script wrapper", "pwsh -File scripts/deploy-prod.ps1"],
  ["compound dev token cannot authorize a different deployment", "echo --target dev; databricks bundle deploy --profile DEV"],
  ["compound dev deployment cannot authorize another deployment", "databricks bundle deploy -t dev --profile DEV; databricks bundle deploy --profile DEV"],
  ["piped dev deployment cannot authorize another deployment", "databricks bundle deploy -t dev --profile DEV | databricks bundle deploy --profile DEV"],
  ["background dev deployment cannot authorize another deployment", "databricks bundle deploy -t dev --profile DEV & databricks bundle deploy --profile DEV"],
  ["force push with Git prefix", "git -C apps/report push origin feature --force-with-lease"],
  ["short force push with Git config prefix", "git -c core.hooksPath=/dev/null push -f origin feature"],
  ["destructive Git reset prefix", "git -C app reset --hard HEAD"],
  ["destructive Git cleanup prefix", "git -C app clean -fdx"],
  ["DDL drop table", "DROP TABLE sales.orders"],
  ["DDL truncate", "TRUNCATE TABLE sales.orders"],
  ["DDL truncate quoted name", "TRUNCATE `orders`"],
  ["DDL interleaved comment", "DROP /* audited elsewhere */ TABLE sales.orders"],
  ["broad grant", "GRANT ALL PRIVILEGES ON CATALOG sales TO `agent`"],
  ["owner change", "ALTER TABLE sales.orders OWNER TO `agent`"],
  ["encoded PowerShell", "powershell -NoProfile -EncodedCommand ZQBjAGgAbwA="],
  ["short encoded pwsh", "pwsh -enc ZQBjAGgAbwA="],
  ["dynamic expression", "Invoke-Expression $untrustedCommand"],
  ["Claude permission bypass", "claude --dangerously-skip-permissions -p test"],
  ["Copilot all-permission bypass", "copilot --allow-all -p test"],
  ["sandbox bypass", "copilot --no-sandbox -p test"],
  ["POSIX recursive delete", "rm -rf ./data"],
  ["PowerShell recursive delete", "Remove-Item -LiteralPath ./data -Recurse -Force"],
  ["cmd recursive delete", "cmd /c rmdir /s /q data"],
];

for (const provider of ["claude", "copilot"]) {
  test(`${provider} preserves safe development commands without granting approval`, async (t) => {
    const root = await fixture(t);
    for (const command of safeCommands) assertAllowed(invoke(root, provider, "policy", commandPayload(provider, command)), command);
  });

  for (const [name, command] of deniedCommands) {
    test(`${provider} denies ${name}`, async (t) => {
      const root = await fixture(t);
      assertDenied(invoke(root, provider, "policy", commandPayload(provider, command)), command);
    });
  }

  test(`${provider} inspects JSON-encoded tool arguments`, async (t) => {
    const root = await fixture(t);
    const payload = commandPayload(provider, "git -C project push --force origin feature");
    const field = provider === "claude" ? "tool_input" : "toolArgs";
    payload[field] = JSON.stringify(payload[field]);
    assertDenied(invoke(root, provider, "policy", payload));
  });

  test(`${provider} fails closed for malformed JSON`, async (t) => {
    const root = await fixture(t);
    assertDenied(invoke(root, provider, "policy", '{"toolName":'));
  });

  for (const [name, payload] of [["null payload", null], ["array payload", []], ["primitive payload", 12], ["empty payload", {}], ["invalid command type", { toolName: "bash", toolArgs: { command: { hidden: "DROP TABLE orders" } } }]]) {
    test(`${provider} fails closed for ${name}`, async (t) => {
      const root = await fixture(t);
      assertDenied(invoke(root, provider, "policy", payload));
    });
  }

  for (const path of ["AGENTS.md", "harness.config.json", "tools/agent-hook.mjs", "harness/evals/route-cases.json", "harness/schemas/loop.schema.json", ".claude/settings.json", ".github/hooks/harness.json", ".claude\\settings.json", "tools/lib/evidence.mjs", "tools/lib/loop.mjs"]) {
    test(`${provider} protects loop control file ${path}`, async (t) => {
      const root = await fixture(t);
      assertDenied(invoke(root, provider, "policy", editPayload(provider, path), { HARNESS_LOOP_ID: "loop-under-test" }));
    });
  }

  test(`${provider} allows separate harness maintenance outside an autonomous loop`, async (t) => {
    const root = await fixture(t);
    assertAllowed(invoke(root, provider, "policy", editPayload(provider, "AGENTS.md")));
  });

  test(`${provider} does not mistake application content for a protected edit target`, async (t) => {
    const root = await fixture(t);
    assertAllowed(invoke(root, provider, "policy", editPayload(provider, "apps/help/page.tsx", "<p>Read AGENTS.md for team instructions.</p>"), { HARNESS_LOOP_ID: "loop-under-test" }));
  });

  test(`${provider} inspects raw apply_patch targets inside an autonomous loop`, async (t) => {
    const root = await fixture(t);
    const patch = "*** Begin Patch\n*** Update File: tools/lib/evidence.mjs\n@@\n-export const gate = true;\n+export const gate = false;\n*** End Patch";
    const payload = provider === "claude" ? { tool_name: "apply_patch", tool_input: patch } : { toolName: "apply_patch", toolArgs: patch };
    assertDenied(invoke(root, provider, "policy", payload, { HARNESS_LOOP_ID: "loop-under-test" }));
  });
}

async function stopFixture(t, options = {}) {
  const root = await fixture(t);
  const checkpoint = options.checkpoint ?? new Date(Date.now() - 120_000).toISOString();
  await put(root, "work/sessions/session-one.md", `---\nid: session-one\nstatus: active\n${checkpoint ? `last_checkpoint: ${checkpoint}\n` : ""}---\n`);
  const loop = {
    id: "loop-one", sessionId: "session-one", status: "active", autoContinue: true,
    createdAt: new Date().toISOString(), gate: null,
    budgets: { maxIterations: 4, maxWallMinutes: 30 },
    iterations: [{ number: 1, startedAt: new Date().toISOString(), finishedAt: null }],
    ...options.loop,
  };
  await put(root, "work/loops/loop-one.json", loop);
  return { root, loop };
}

test("Stop requests a semantic checkpoint for its own active iteration", async (t) => {
  const { root } = await stopFixture(t);
  const result = invoke(root, "claude", "stop", {}, { HARNESS_LOOP_ID: "loop-one" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.decision, "block");
  assert.match(result.output.reason, /Checkpoint/);
});

test("Stop respects an existing stop-hook block to prevent an infinite hook loop", async (t) => {
  const { root } = await stopFixture(t);
  assertAllowed(invoke(root, "claude", "stop", { stop_hook_active: true }, { HARNESS_LOOP_ID: "loop-one" }));
});

test("Stop does not continue across a pending human gate or exhausted budget", async (t) => {
  for (const loop of [{ gate: { status: "pending", id: "ui-mock" } }, { budgets: { maxIterations: 1, maxWallMinutes: 30 } }]) {
    const { root } = await stopFixture(t, { loop });
    assertAllowed(invoke(root, "copilot", "stop", {}, { HARNESS_LOOP_ID: "loop-one" }));
  }
});

test("Stop does not interfere with an unrelated task", async (t) => {
  const { root } = await stopFixture(t);
  assertAllowed(invoke(root, "claude", "stop", {}, { HARNESS_LOOP_ID: "another-loop" }));
});

test("Stop permits a checkpoint written after the current iteration started", async (t) => {
  const { root } = await stopFixture(t, { checkpoint: new Date(Date.now() + 1000).toISOString() });
  assertAllowed(invoke(root, "claude", "stop", {}, { HARNESS_SESSION_ID: "session-one" }));
});

test("Stop treats a missing checkpoint as stale", async (t) => {
  const { root } = await stopFixture(t, { checkpoint: "" });
  assert.equal(invoke(root, "claude", "stop", {}, { HARNESS_LOOP_ID: "loop-one" }).output.decision, "block");
});

test("Stop selects the matching loop even when a newer unrelated loop exists", async (t) => {
  const { root, loop } = await stopFixture(t);
  await put(root, "work/loops/z-newer-loop.json", { ...loop, id: "z-newer-loop", sessionId: "another-session" });
  assert.equal(invoke(root, "claude", "stop", {}, { HARNESS_LOOP_ID: "loop-one" }).output.decision, "block");
});

for (const action of ["compact", "failure"]) {
  test(`${action} retains only sanitized event metadata in the isolated fixture`, async (t) => {
    const root = await fixture(t);
    const secret = "dapi01234567890123456789012345678901";
    const result = invoke(root, "copilot", action, { prompt: `private prompt ${secret}`, toolArgs: { command: secret }, toolResponse: secret }, { HARNESS_SESSION_ID: "session-one" });
    assert.equal(result.status, 0, result.stderr);
    const event = JSON.parse(await readFile(join(root, `work/hook-events/session-one-${action}.json`), "utf8"));
    assert.deepEqual(Object.keys(event).sort(), ["checkpointRequired", "event", "observedAt", "schemaVersion", "sessionId"]);
    assert.equal(event.checkpointRequired, true);
    assert.doesNotMatch(JSON.stringify(event) + result.stdout + result.stderr, /dapi0123|private prompt/);
  });

  test(`${action} rejects an environment session path escape`, async (t) => {
    const root = await fixture(t);
    const result = invoke(root, "copilot", action, {}, { HARNESS_SESSION_ID: "../escaped" });
    assert.notEqual(result.status, 0);
    assert.equal((await readdir(root)).includes("escaped-compact.json"), false);
  });
}
