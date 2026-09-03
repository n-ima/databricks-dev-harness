import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, input = "") {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", input, shell: false });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("routes Japanese UI work to the mock-first workflow", () => {
  const output = run("node", [
    "tools/harness.mjs",
    "route",
    "--prompt",
    "売上訂正を登録するダッシュボード画面を作って",
  ]);
  const route = JSON.parse(output);
  assert.equal(route.route, "mock-ui");
  assert.equal(route.firstGate, "ui-mock");
});

test("Copilot session hook injects durable-context guidance", () => {
  const output = run("node", ["tools/agent-hook.mjs", "context", "--provider", "copilot"], "{}");
  const hook = JSON.parse(output);
  assert.match(hook.additionalContext, /work\/sessions/);
  assert.match(hook.additionalContext, /docs\/product/);
});

test("Copilot policy hook denies production deploy", () => {
  const output = run(
    "node",
    ["tools/agent-hook.mjs", "policy", "--provider", "copilot"],
    JSON.stringify({
      toolName: "powershell",
      toolArgs: { command: "databricks bundle deploy -t prod --profile PROD" },
    }),
  );
  const decision = JSON.parse(output);
  assert.equal(decision.permissionDecision, "deny");
  assert.match(decision.permissionDecisionReason, /Production/);
});

test("Copilot policy hook does not pre-approve a development deploy", () => {
  const output = run(
    "node",
    ["tools/agent-hook.mjs", "policy", "--provider", "copilot"],
    JSON.stringify({
      toolName: "powershell",
      toolArgs: { command: "databricks bundle deploy -t dev --profile DEV" },
    }),
  );
  assert.deepEqual(JSON.parse(output), {});
});

test("Claude and Copilot wire policy, stop, compaction, and failure lifecycle hooks", async () => {
  const claude = JSON.parse(await readFile(resolve(root, ".claude/settings.json"), "utf8"));
  const copilot = JSON.parse(await readFile(resolve(root, ".github/hooks/harness.json"), "utf8"));
  for (const event of ["SessionStart", "UserPromptSubmit", "PreToolUse", "Stop", "PreCompact", "PostToolUseFailure"]) assert.ok(claude.hooks[event]?.length, `Claude ${event}`);
  const claudeMatchers = claude.hooks.PreToolUse.map((group) => group.matcher).join("|");
  for (const tool of ["Bash", "PowerShell", "Write", "Edit", "MultiEdit"]) assert.ok(new RegExp(claudeMatchers).test(tool), `Claude policy hook covers ${tool}`);
  for (const groups of Object.values(claude.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        assert.doesNotMatch(hook.command, /CLAUDE_PROJECT_DIR/);
      }
    }
  }
  assert.equal(copilot.version, 1);
  for (const event of ["sessionStart", "preToolUse", "agentStop", "preCompact", "postToolUseFailure"]) assert.ok(copilot.hooks[event]?.length, `Copilot ${event}`);
  const copilotMatchers = copilot.hooks.preToolUse.map((group) => group.matcher).join("|");
  for (const tool of ["bash", "powershell", "edit", "create", "apply_patch"]) assert.ok(new RegExp(copilotMatchers).test(tool), `Copilot policy hook covers ${tool}`);
});

test("fresh template setup and gated durable session lifecycle work end to end", async () => {
  const temporaryParent = await mkdtemp(join(tmpdir(), "databricks-harness-"));
  const project = join(temporaryParent, "smoke-project");
  try {
    await cp(root, project, {
      recursive: true,
      filter: (source) =>
        !source.includes(`${sep}.git${sep}`) &&
        !source.endsWith(`${sep}.git`) &&
        !source.includes(`${sep}node_modules${sep}`) &&
        !source.endsWith(`${sep}node_modules`) &&
        !source.includes(`${sep}.harness${sep}`) &&
        !source.endsWith(`${sep}.harness`),
    });
    const originalInstructions = await readFile(join(project, "AGENTS.md"));
    const originalHash = createHash("sha256").update(originalInstructions).digest("hex");
    const upstreamManifest = {
      schemaVersion: 1, version: "0.3.0", releasedAt: "2026-09-04T00:00:00Z",
      managedFiles: [{ path: "AGENTS.md", sha256: originalHash, strategy: "replace" }], migrations: [],
    };
    await writeFile(join(project, "harness/base-release.json"), JSON.stringify(upstreamManifest));
    await writeFile(join(project, "AGENTS.md"), originalInstructions + "\n<!-- downstream customization -->\n");
    const setup = spawnSync(
      "node",
      ["tools/harness.mjs", "setup", "--project-name", "smoke-project", "--skip-agent-skills"],
      { cwd: project, encoding: "utf8", shell: false },
    );
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
    const product = JSON.parse(await readFile(join(project, "product.config.json"), "utf8"));
    assert.equal(product.name, "smoke-project");
    const baselinePath = join(project, ".harness/installed-release.json");
    const installed = JSON.parse(await readFile(baselinePath, "utf8"));
    assert.equal(installed.manifest.managedFiles[0].sha256, originalHash, "Setup registers original upstream hashes, not edited downstream bytes.");
    const baselineBefore = await readFile(baselinePath, "utf8");
    assert.match(await readFile(join(project, "databricks.yml"), "utf8"), /name: smoke-project/);
    const productBefore = await readFile(join(project, "product.config.json"), "utf8");
    const bundleWithUserChange = (await readFile(join(project, "databricks.yml"), "utf8")) + "\n# user-owned bundle customization\n";
    await writeFile(join(project, "databricks.yml"), bundleWithUserChange);
    const repeatedSetup = spawnSync(process.execPath,
      ["tools/harness.mjs", "setup", "--project-name", "smoke-project", "--skip-agent-skills"],
      { cwd: project, encoding: "utf8", shell: false });
    assert.equal(repeatedSetup.status, 0, repeatedSetup.stderr || repeatedSetup.stdout);
    assert.equal(await readFile(join(project, "product.config.json"), "utf8"), productBefore);
    assert.equal(await readFile(join(project, "databricks.yml"), "utf8"), bundleWithUserChange);
    assert.equal(await readFile(baselinePath, "utf8"), baselineBefore);
    const newerManifest = { ...upstreamManifest, version: "0.4.0" };
    const newerInstalled = JSON.stringify({ manifest: newerManifest, manifestSha256: createHash("sha256").update(JSON.stringify(newerManifest)).digest("hex") });
    await writeFile(baselinePath, newerInstalled);
    const afterUpdateSetup = spawnSync(process.execPath, ["tools/harness.mjs", "setup", "--project-name", "smoke-project", "--skip-agent-skills"], { cwd: project, encoding: "utf8", shell: false });
    assert.equal(afterUpdateSetup.status, 0, afterUpdateSetup.stderr || afterUpdateSetup.stdout);
    assert.equal(await readFile(baselinePath, "utf8"), newerInstalled, "Rerun must not restore the older embedded baseline after a reviewed update.");

    const started = spawnSync(
      "node",
      [
        "tools/harness.mjs",
        "session",
        "start",
        "--title",
        "smoke work",
        "--intent",
        "build",
        "--objective",
        "prove durable state",
      ],
      { cwd: project, encoding: "utf8", shell: false },
    );
    assert.equal(started.status, 0, started.stderr || started.stdout);
    const sessionPath = started.stdout.trim();
    const sessionId = sessionPath.split(/[\\/]/).at(-1).replace(/\.md$/, "");
    const premature = spawnSync(
      "node",
      [
        "tools/harness.mjs",
        "session",
        "close",
        "--id",
        sessionId,
        "--outcome",
        "completed",
        "--summary",
        "smoke passed",
      ],
      { cwd: project, encoding: "utf8", shell: false },
    );
    assert.notEqual(premature.status, 0, "A pending intent gate and absent receipt must not count as completed.");
    assert.match(premature.stderr + premature.stdout, /pending|verifier-evidence/i);
    assert.match(await readFile(join(project, sessionPath), "utf8"), /^status: active$/m);
    const checkpoint = spawnSync(process.execPath, [
      "tools/harness.mjs", "session", "checkpoint", "--id", sessionId,
      "--summary", "Local setup verified; intent approval is outstanding",
      "--next", "Wait for the product owner to approve scope", "--phase", "define",
    ], { cwd: project, encoding: "utf8", shell: false });
    assert.equal(checkpoint.status, 0, checkpoint.stderr || checkpoint.stdout);
    const blocked = spawnSync(process.execPath, [
      "tools/harness.mjs", "session", "close", "--id", sessionId,
      "--outcome", "blocked", "--summary", "Waiting for product intent approval",
    ], { cwd: project, encoding: "utf8", shell: false });
    assert.equal(blocked.status, 0, blocked.stderr || blocked.stdout);
    const final = await readFile(join(project, sessionPath), "utf8");
    assert.match(final, /^status: blocked$/m);
    assert.match(final, /Wait for the product owner to approve scope/);
  } finally {
    assert.ok(resolve(temporaryParent).startsWith(`${resolve(tmpdir())}${sep}`));
    assert.match(temporaryParent.slice(resolve(tmpdir()).length + 1), /^databricks-harness-/);
    await rm(temporaryParent, { recursive: true, force: true });
  }
});
