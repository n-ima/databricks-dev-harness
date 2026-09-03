import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import process from "node:process";
import {
  cleanInline,
  commandResult,
  compactTimestamp,
  exists,
  optionList,
  pathInside,
  readJson,
  repoRelative,
  sha256,
  timestamp,
  writeJson,
  parseFrontmatter,
  withFileLock,
} from "./shared.mjs";
import { policyHash } from "./policy.mjs";
import { fileHash, validateReceipt } from "./evidence.mjs";

export { policyHash } from "./policy.mjs";

const TERMINAL = new Set(["achieved", "blocked", "budget_exhausted", "failed", "cancelled"]);

async function sessionPath(root, id) {
  const directory = join(root, "work", "sessions");
  const matches = (await readdir(directory)).filter((name) => name.endsWith(".md") && (name === `${id}.md` || name.startsWith(id)));
  if (matches.length !== 1) throw new Error(matches.length ? `Session id is ambiguous: ${id}` : `Session not found: ${id}`);
  return join(directory, matches[0]);
}

async function currentGitIsolation(root, allowUnsafe = false, run = commandResult) {
  const inside = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
  const head = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: root });
  const branchResult = run("git", ["branch", "--show-current"], { cwd: root });
  const branch = cleanInline(branchResult.stdout);
  const status = run("git", ["status", "--porcelain"], { cwd: root });
  const verified = inside.ok && head.ok && branch && !["main", "master"].includes(branch.toLowerCase());
  if (!verified && !allowUnsafe) {
    throw new Error("Autonomous loops require a committed, non-main Git worktree. Use a feature worktree first.");
  }
  return {
    verified,
    branch: branch || null,
    head: head.ok ? cleanInline(head.stdout) : null,
    initialDirtyFiles: status.ok ? status.stdout.trim().split(/\r?\n/).filter(Boolean).length : null,
    unsafeTestOverride: !verified && allowUnsafe,
  };
}

async function resolveLoop(root, id) {
  const cleaned = cleanInline(id);
  if (!cleaned) throw new Error("Specify --id.");
  const directory = join(root, "work", "loops");
  if (!(await exists(directory))) throw new Error(`Loop not found: ${cleaned}`);
  const matches = (await readdir(directory)).filter((name) => name.endsWith(".json") && (name === `${cleaned}.json` || name.startsWith(cleaned)));
  if (matches.length !== 1) throw new Error(matches.length ? `Loop id is ambiguous: ${cleaned}` : `Loop not found: ${cleaned}`);
  const path = join(directory, matches[0]);
  return { path, state: await readJson(path) };
}

async function withLockedLoop(root, id, action) {
  const { path } = await resolveLoop(root, id);
  return withFileLock(path, async () => action({ path, state: await readJson(path) }));
}

function budgetState(state) {
  const elapsedMs = Date.now() - Date.parse(state.createdAt);
  if (state.iterations.length >= state.budgets.maxIterations) return { exhausted: true, reason: "iteration budget exhausted" };
  if (elapsedMs >= state.budgets.maxWallMinutes * 60_000) return { exhausted: true, reason: "wall-clock budget exhausted" };
  return { exhausted: false, elapsedMs };
}

function nextPrompt(state) {
  return [
    `Continue bounded loop ${state.id} for durable session ${state.sessionId}.`,
    "Read AGENTS.md, the full orchestrate-work skill, the session, linked requirement/design/plan, and prior evidence.",
    "Perform exactly one smallest complete vertical slice. Do not change acceptance criteria, budgets, policy, or verifier to make work pass.",
    "Stop at any human gate. Run deterministic checks and checkpoint decisions, evidence, next action, and blockers.",
    "Never deploy to production or perform destructive/permission-changing operations.",
    `Current phase: ${state.phase}. Iterations already recorded: ${state.iterations.length}/${state.budgets.maxIterations}.`,
  ].join("\n");
}

function providerInvocation(state, prompt) {
  if (state.provider === "claude") {
    const args = [
      "-p", prompt,
      "--permission-mode", "auto",
      "--output-format", "json",
      "--no-session-persistence",
      "--name", `harness-${state.id}`,
    ];
    if (state.budgets.maxUsd != null) args.push("--max-budget-usd", String(state.budgets.maxUsd));
    return { command: "claude", args };
  }
  if (state.provider === "copilot") {
    const args = [
      "-p", prompt,
      "--autopilot",
      `--max-autopilot-continues=${Math.min(8, state.budgets.maxIterations)}`,
      `--max-ai-credits=${state.budgets.maxAiCredits ?? 5}`,
      "--sandbox",
      "--no-ask-user",
      "--no-remote",
      "--no-remote-export",
      "--allow-all-tools",
      "--output-format=json",
      `--name=harness-${state.id}`,
    ];
    return { command: "copilot", args };
  }
  throw new Error("Manual loops do not have an executable provider adapter.");
}

export async function initLoop(root, options, dependencies = {}) {
  const sessionId = cleanInline(options.session);
  if (!sessionId) throw new Error("loop init requires --session.");
  const session = await sessionPath(root, sessionId);
  const sessionText = await readFile(session, "utf8");
  if (!/^status:\s*active\s*$/m.test(sessionText)) throw new Error("Loop session must be active.");
  const config = await readJson(join(root, "harness.config.json"));
  const provider = cleanInline(options.provider, "manual");
  const verifierProvider = cleanInline(options.verifier_provider, provider === "claude" ? "copilot" : provider === "copilot" ? "claude" : "manual");
  if (!["claude", "copilot", "manual"].includes(provider) || !["claude", "copilot", "manual"].includes(verifierProvider)) {
    throw new Error("--provider and --verifier-provider must be claude, copilot, or manual.");
  }
  if (provider !== "manual" && provider === verifierProvider) throw new Error("Implementer and verifier providers must differ for executable loops.");
  const isolation = await currentGitIsolation(root, provider === "manual" || Boolean(options.allow_unsafe_test), dependencies.run);
  const id = `${compactTimestamp()}-${provider}`;
  const now = timestamp();
  const state = {
    schemaVersion: 1,
    id,
    sessionId: basename(session, ".md"),
    status: "active",
    phase: cleanInline(options.phase, "implement"),
    provider,
    verifierProvider,
    autoContinue: Boolean(options.auto_continue),
    isolationEvidence: cleanInline(options.isolation_evidence) || null,
    gate: null,
    budgets: {
      maxIterations: Number(options.max_iterations ?? config.loop.maxIterations),
      maxWallMinutes: Number(options.max_wall_minutes ?? config.loop.maxWallMinutes),
      maxProcessMinutes: Number(options.max_process_minutes ?? config.loop.maxProcessMinutes ?? 30),
      maxUsd: options.max_usd === undefined ? null : Number(options.max_usd),
      maxAiCredits: options.max_ai_credits === undefined ? null : Number(options.max_ai_credits),
    },
    isolation,
    policyHash: await policyHash(root),
    checks: config.loop.checks ?? [["npm", "run", "harness:check"], ["npm", "run", "test:harness"]],
    iterations: [],
    createdAt: now,
    updatedAt: now,
  };
  for (const [key, value] of Object.entries(state.budgets)) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) throw new Error(`Invalid loop budget: ${key}`);
  }
  if (!Number.isInteger(state.budgets.maxIterations) || state.budgets.maxIterations > 32 || state.budgets.maxWallMinutes > 1440 || state.budgets.maxProcessMinutes > 240) throw new Error("Loop budgets exceed supported limits (32 iterations, 1440 wall minutes, 240 process minutes).");
  const sessionFields = parseFrontmatter(sessionText);
  if (sessionFields.gate_status === "pending") state.gate = { id: sessionFields.gate || "product-intent", status: "pending", evidence: null };
  if (sessionFields.requirement && sessionFields.requirement !== "unassigned") {
    const requirement = pathInside(root, sessionFields.requirement);
    state.requirement = { path: sessionFields.requirement, sha256: sha256(await readFile(requirement)) };
  }
  const path = join(root, "work", "loops", `${id}.json`);
  await withFileLock(path, async () => {
    if (await exists(path)) throw new Error("Loop identity already exists; retry initialization instead of overwriting a record.");
    await writeJson(path, state);
  });
  console.log(repoRelative(root, path));
  return state;
}

export async function showLoop(root, options) {
  const { state } = await resolveLoop(root, options.id);
  console.log(JSON.stringify({ ...state, budget: budgetState(state), nextPrompt: TERMINAL.has(state.status) ? null : nextPrompt(state) }, null, 2));
  return state;
}

export async function setLoopGate(root, options) {
  return withLockedLoop(root, options.id, (record) => setLoopGateLocked(root, options, record));
}

async function setLoopGateLocked(root, options, { path, state }) {
  if (TERMINAL.has(state.status)) throw new Error(`Loop is terminal: ${state.status}`);
  const gate = cleanInline(options.gate);
  if (!gate) throw new Error("loop gate requires --gate.");
  state.gate = { id: gate, status: "pending", evidence: null };
  state.updatedAt = timestamp();
  await writeJson(path, state);
  console.log(JSON.stringify(state.gate, null, 2));
  return state;
}

export async function recordLoop(root, options) {
  return withLockedLoop(root, options.id, (record) => recordLoopLocked(root, options, record));
}

async function recordLoopLocked(root, options, { path, state }) {
  const outcome = cleanInline(options.outcome, "progress");
  if (TERMINAL.has(state.status)) throw new Error(`Loop is terminal: ${state.status}`);
  if (!["progress", "needs-human", "failed", "achieved"].includes(outcome)) throw new Error("Unknown iteration outcome.");
  await assertPolicy(root, path, state);
  if (!state.iterations.length) throw new Error("No started iteration exists to record.");
  const iteration = state.iterations.at(-1);
  if (iteration.finishedAt) throw new Error("The latest iteration is already recorded.");
  iteration.finishedAt = timestamp();
  iteration.outcome = outcome;
  iteration.summary = cleanInline(options.summary, "No summary supplied.");
  iteration.evidence = optionList(options.evidence);
  state.updatedAt = iteration.finishedAt;
  if (outcome === "needs-human") {
    const gate = cleanInline(options.gate);
    if (!gate) throw new Error("--gate is required for needs-human.");
    state.gate = { id: gate, status: "pending", evidence: null };
    state.phase = "mock";
  } else if (outcome === "failed") state.status = "failed";
  else if (outcome === "achieved") {
    if (state.gate?.status === "pending") throw new Error(`Human gate is pending: ${state.gate.id}`);
    const verifierEvidence = cleanInline(options.verifier_evidence);
    if (!iteration.evidence.length || !verifierEvidence) {
      throw new Error("Achieved requires --evidence and --verifier-evidence.");
    }
    for (const evidence of [...iteration.evidence, verifierEvidence]) {
      const evidencePath = pathInside(root, evidence, "loop evidence");
      if (!(await exists(evidencePath))) throw new Error(`Evidence does not exist: ${evidence}`);
      await fileHash(root, evidence);
    }
    if (!iteration.checks?.length || iteration.checks.some((item) => item.status !== "pass")) {
      throw new Error("Achieved requires deterministic checks from loop run to pass.");
    }
    if (!state.requirement?.path) throw new Error("Loop completion requires a linked accepted requirement.");
    const receipt = await validateReceipt(root, verifierEvidence, {
      sessionId: state.sessionId, requirement: state.requirement.path, implementer: state.provider,
    });
    if (receipt.provider !== state.verifierProvider || (state.provider !== "manual" && receipt.provider === state.provider)) throw new Error("Verifier provider does not match the independent verifier contract.");
    iteration.verifierEvidence = verifierEvidence;
    state.status = "achieved";
    state.phase = "done";
  }
  const budget = budgetState(state);
  if (!TERMINAL.has(state.status) && budget.exhausted) {
    state.status = "budget_exhausted";
    state.terminalReason = budget.reason;
  }
  await writeJson(path, state);
  console.log(JSON.stringify({ id: state.id, status: state.status, iteration: iteration.number }, null, 2));
  return state;
}

export async function runLoopIteration(root, options, dependencies = {}) {
  // Hold the record lock throughout provider/check execution. A second runner,
  // recorder, or stop request must fail visibly instead of overwriting this run.
  return withLockedLoop(root, options.id, (record) => runLoopIterationLocked(root, options, dependencies, record));
}

async function runLoopIterationLocked(root, options, dependencies, { path, state }) {
  if (TERMINAL.has(state.status)) throw new Error(`Loop is terminal: ${state.status}`);
  if (state.gate?.status === "pending") throw new Error(`Human gate is pending: ${state.gate.id}`);
  if (state.iterations.at(-1) && !state.iterations.at(-1).finishedAt) throw new Error("The previous iteration is unfinished. Record its outcome or cancel the loop; do not silently rerun it.");
  const budget = budgetState(state);
  if (budget.exhausted) {
    state.status = "budget_exhausted";
    state.terminalReason = budget.reason;
    state.updatedAt = timestamp();
    await writeJson(path, state);
    throw new Error(budget.reason);
  }
  await assertPolicy(root, path, state);
  if (!state.isolation.verified && !state.isolation.unsafeTestOverride) throw new Error("Loop isolation is not verified.");
  const prompt = nextPrompt(state);
  const invocation = state.provider === "manual" ? { command: null, args: [] } : providerInvocation(state, prompt);
  if (!options.execute) {
    console.log(JSON.stringify({ dryRun: true, id: state.id, invocation: { command: invocation.command, args: invocation.args }, prompt }, null, 2));
    return state;
  }
  if (state.provider !== "manual" && !dependencies.run) {
    if (!state.isolation.verified) throw new Error("Test-only isolation overrides cannot execute real providers.");
    const current = await currentGitIsolation(root);
    if (current.branch !== state.isolation.branch) throw new Error("Git branch changed after loop initialization.");
    if (!state.isolationEvidence) throw new Error("Headless execution needs --isolation-evidence at init: a reviewed development-only credential and OS/container sandbox record.");
    const isolationRecord = await readJson(pathInside(root, state.isolationEvidence));
    if (isolationRecord.status !== "approved" || isolationRecord.credentialScope !== "development-only" || !isolationRecord.sandbox || !isolationRecord.actor) throw new Error("Isolation evidence is not approved or lacks sandbox/credential scope.");
  }

  const number = state.iterations.length + 1;
  const iteration = { number, provider: state.provider, startedAt: timestamp(), finishedAt: null, checks: [] };
  state.iterations.push(iteration);
  state.updatedAt = iteration.startedAt;
  await writeJson(path, state);
  const run = dependencies.run ?? commandResult;
  const providerResult = state.provider === "manual" ? { ok: true, status: 0, stdout: "manual work checked", stderr: "" } : await run(invocation.command, invocation.args, {
    cwd: root,
    timeout: remainingTimeout(state),
    env: { ...process.env, HARNESS_LOOP_ID: state.id, HARNESS_SESSION_ID: state.sessionId },
  });
  await assertPolicy(root, path, state);
  iteration.providerExit = providerResult.status;
  iteration.providerOutputSha256 = sha256(`${providerResult.stdout}\n${providerResult.stderr}`);
  iteration.providerOutputBytes = Buffer.byteLength(`${providerResult.stdout}\n${providerResult.stderr}`);
  if (!providerResult.ok) {
    iteration.finishedAt = timestamp();
    iteration.outcome = "failed";
    iteration.failure = `exit ${providerResult.status ?? "unavailable"}; output hash retained, raw credential-bearing output omitted`;
    state.status = "failed";
    state.updatedAt = iteration.finishedAt;
    await writeJson(path, state);
    throw new Error(`Provider iteration failed: ${iteration.failure}`);
  }

  for (const check of state.checks) {
    if (!Array.isArray(check) || check.length < 1) throw new Error("Loop checks must be argv arrays.");
    if (Date.now() - Date.parse(state.createdAt) >= state.budgets.maxWallMinutes * 60_000) {
      state.status = "budget_exhausted"; state.terminalReason = "wall-clock budget exhausted";
      iteration.finishedAt = timestamp(); iteration.outcome = "budget_exhausted";
      await writeJson(path, state); throw new Error(state.terminalReason);
    }
    const result = await run(check[0], check.slice(1), { cwd: root, timeout: remainingTimeout(state) });
    iteration.checks.push({ command: check, status: result.ok ? "pass" : "fail", outputSha256: sha256(`${result.stdout}\n${result.stderr}`) });
    await assertPolicy(root, path, state);
  }
  iteration.agentOutputRecorded = false;
  state.phase = iteration.checks.every((item) => item.status === "pass") ? "verify" : "implement";
  state.updatedAt = timestamp();
  await writeJson(path, state);
  console.log(JSON.stringify({ id: state.id, iteration: number, phase: state.phase, checks: iteration.checks }, null, 2));
  return state;
}

function remainingTimeout(state) {
  const wall = state.budgets.maxWallMinutes * 60_000 - (Date.now() - Date.parse(state.createdAt));
  return Math.max(1, Math.floor(Math.min(wall, state.budgets.maxProcessMinutes * 60_000)));
}

async function assertPolicy(root, path, state) {
  const changed = state.policyHash !== await policyHash(root) || (state.requirement && state.requirement.sha256 !== sha256(await readFile(pathInside(root, state.requirement.path))));
  if (!changed) return;
  state.status = "blocked";
  state.terminalReason = "Harness policy or accepted requirement changed after initialization; independent review and a new loop are required.";
  state.updatedAt = timestamp();
  await writeJson(path, state);
  throw new Error(state.terminalReason);
}

export async function approveLoopGate(root, options) {
  return withLockedLoop(root, options.id, (record) => approveLoopGateLocked(root, options, record));
}

async function approveLoopGateLocked(root, options, { path, state }) {
  if (TERMINAL.has(state.status) || state.gate?.status !== "pending") throw new Error("No active pending gate exists.");
  const evidence = cleanInline(options.evidence);
  const receipt = await readJson(pathInside(root, evidence, "gate approval"));
  if (receipt.decision !== "approved" || receipt.sessionId !== state.sessionId || receipt.gate !== state.gate.id || !receipt.actor || !receipt.evidence) throw new Error("A matching human approval record is required.");
  for (const [artifact, hash] of Object.entries(receipt.artifactHashes ?? {})) {
    if (sha256(await readFile(pathInside(root, artifact))) !== hash) throw new Error(`Approval is stale: ${artifact}`);
  }
  state.gate = { ...state.gate, status: "approved", evidence };
  state.updatedAt = timestamp();
  await writeJson(path, state);
  return state;
}

export async function stopLoop(root, options) {
  return withLockedLoop(root, options.id, (record) => stopLoopLocked(root, options, record));
}

async function stopLoopLocked(root, options, { path, state }) {
  const outcome = cleanInline(options.outcome, "cancelled");
  if (!TERMINAL.has(outcome)) throw new Error("--outcome must be achieved, blocked, budget_exhausted, failed, or cancelled.");
  if (outcome === "achieved") throw new Error("Use loop record --outcome achieved so evidence and verification are enforced.");
  state.status = outcome;
  state.terminalReason = cleanInline(options.reason, "Stopped by operator.");
  state.updatedAt = timestamp();
  await writeJson(path, state);
  console.log(JSON.stringify({ id: state.id, status: state.status, reason: state.terminalReason }, null, 2));
  return state;
}

export async function activeAutoLoop(root) {
  const directory = join(root, "work", "loops");
  if (!(await exists(directory))) return null;
  for (const name of (await readdir(directory)).filter((item) => item.endsWith(".json")).sort().reverse()) {
    const state = await readJson(join(directory, name));
    if (process.env.HARNESS_LOOP_ID && process.env.HARNESS_LOOP_ID !== state.id) continue;
    if (!process.env.HARNESS_LOOP_ID && process.env.HARNESS_SESSION_ID && process.env.HARNESS_SESSION_ID !== state.sessionId) continue;
    if (state.status === "active" && state.autoContinue) return { path: join(directory, name), state, budget: budgetState(state) };
  }
  return null;
}
