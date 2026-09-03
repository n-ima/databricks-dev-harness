import { lstat, mkdir, readFile } from "node:fs/promises";
import { atomicWrite, cleanInline, commandResult, compactTimestamp, exists, optionList, pathInside, readJson, repoRelative, sha256, timestamp, withFileLock, writeJson } from "./shared.mjs";
import { validateSchema } from "./schema.mjs";

// Evidence model: docs/harness/research/2026-09-04-evidence-review.md and ADR-0003.
// These functions prepare and grade records; they never invoke a model or approve a release.
const ALIASES = { claude: "claude", "claude-code": "claude", copilot: "copilot", "github-copilot": "copilot" };
const RESULT_STATES = new Set(["passed", "failed", "blocked", "invalid"]);
const AC_STATES = new Set(["pass", "fail", "not-run"]);
const HEX = /^[a-f0-9]{64}$/;

function identifier(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value) || value.endsWith(".")) throw new Error(`Invalid ${label}.`);
  return value;
}

function relativePath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes(":")) throw new Error(`Invalid ${label} path.`);
  if (value.startsWith("/") || value.split("/").some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) || /[\x00-\x1f]/.test(value)) throw new Error(`Invalid ${label} path.`);
  return value;
}

async function safePath(root, value, label) {
  relativePath(value, label);
  const path = pathInside(root, value, label);
  let prefix = "";
  for (const part of value.split("/")) {
    prefix = prefix ? `${prefix}/${part}` : part;
    try { if ((await lstat(pathInside(root, prefix, label))).isSymbolicLink()) throw new Error(`${label} may not traverse a symlink.`); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return path;
}

async function artifactHash(root, value, scope) {
  if (!value.startsWith(`${scope}/`)) throw new Error(`Evidence must be copied into this run's evidence directory: ${scope}`);
  const path = await safePath(root, value, "evaluation evidence");
  const info = await lstat(path);
  if (!info.isFile() || info.size === 0) throw new Error(`Evidence must be a non-empty regular file: ${value}`);
  return sha256(await readFile(path));
}

function requestedList(value, fallback) {
  return [...new Set((value === undefined ? fallback : optionList(value).flatMap((item) => item.split(","))).map((item) => item.trim()).filter(Boolean))];
}

function verifyPlan(plan) {
  if (plan.schemaVersion !== 1 || !plan.contract || plan.contractHash !== sha256(JSON.stringify(plan.contract))) throw new Error("Evaluation plan contract hash is invalid.");
  const contract = plan.contract;
  identifier(contract.id, "evaluation id");
  if (!HEX.test(contract.taskManifestSha256 ?? "") || !cleanInline(contract.harnessVersion) || (contract.sourceRevision !== null && !/^[a-f0-9]{40,64}$/i.test(contract.sourceRevision ?? "")) || typeof contract.fullReleaseMatrix !== "boolean" || !contract.resultSchema || typeof contract.resultSchema !== "object") throw new Error("Evaluation plan metadata is invalid.");
  if (!Array.isArray(contract.runs) || !contract.runs.length || !Array.isArray(contract.providers) || !contract.providers.length || !Array.isArray(contract.tasks) || !contract.tasks.length) throw new Error("Evaluation plan has no run matrix.");
  if (contract.providers.some((provider) => !["claude", "copilot"].includes(provider)) || new Set(contract.providers).size !== contract.providers.length) throw new Error("Evaluation plan providers are invalid.");
  if (new Set(contract.tasks.map((task) => task.id)).size !== contract.tasks.length || contract.tasks.some((task) => !Array.isArray(task.acceptance) || !task.acceptance.length || task.acceptance.some((ac, index) => ac.id !== `AC-${String(index + 1).padStart(2, "0")}` || !cleanInline(ac.text)))) throw new Error("Evaluation plan tasks or acceptance are invalid.");
  if (!Number.isInteger(contract.repetitions) || contract.repetitions < 3) throw new Error("Evaluation plan needs at least three repetitions.");
  if (new Set(contract.runs.map((run) => run.runId)).size !== contract.runs.length) throw new Error("Evaluation plan has duplicate run ids.");
  const expected = new Set();
  for (const task of contract.tasks) for (const provider of contract.providers) for (let attempt = 1; attempt <= contract.repetitions; attempt++) expected.add(`${task.id}--${provider}--${attempt}`);
  if (expected.size !== contract.runs.length || contract.runs.some((run) => !expected.has(run.runId))) throw new Error("Evaluation plan is missing trials.");
  for (const run of contract.runs) {
    const task = contract.tasks.find((item) => item.id === run.taskId);
    if (run.runId !== `${run.taskId}--${run.provider}--${run.attempt}` || !task || JSON.stringify(run.acceptance) !== JSON.stringify(task.acceptance)) throw new Error("Evaluation run acceptance or identity differs from the frozen task.");
    for (const key of ["promptPath", "resultPath", "recordPath", "evidenceDirectory"]) relativePath(run[key], key);
    const directory = `work/evals/${contract.id}`;
    if (run.promptPath !== `${directory}/runs/${run.runId}/prompt.md` || run.resultPath !== `${directory}/runs/${run.runId}/result.json` || run.recordPath !== `${directory}/records/${run.runId}.json` || run.evidenceDirectory !== `${directory}/runs/${run.runId}/evidence`) throw new Error("Evaluation run paths differ from their isolated artifact scope.");
  }
  return contract;
}

async function loadPlan(root, value) {
  if (!value) throw new Error("Specify --plan (or --baseline and --candidate for comparison).");
  const plan = await readJson(await safePath(root, value, "evaluation plan"));
  verifyPlan(plan);
  return plan;
}

export async function prepareEvaluation(root, options = {}) {
  const manifestPath = "harness/evals/golden-tasks.json";
  const manifestText = await readFile(await safePath(root, manifestPath, "golden tasks"), "utf8");
  const manifest = JSON.parse(manifestText);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.tasks) || !manifest.tasks.length) throw new Error("Golden-task manifest is invalid.");
  const providerNames = requestedList(options.provider, manifest.providers ?? []);
  const providers = [...new Set(providerNames.map((name) => {
    if (!ALIASES[name]) throw new Error(`Unsupported evaluation provider: ${name}`);
    return ALIASES[name];
  }))];
  if (!providers.length) throw new Error("Evaluation requires a provider.");
  const repetitions = Number(options.repetitions ?? manifest.releasePolicy?.repetitionsPerProvider ?? 3);
  if (!Number.isInteger(repetitions) || repetitions < 3 || repetitions > 20) throw new Error("Evaluation repetitions must be an integer between 3 and 20.");
  const selected = requestedList(options.task, manifest.tasks.map((task) => task.id));
  const tasks = selected.map((id) => {
    identifier(id, "golden task id");
    const task = manifest.tasks.find((item) => item.id === id);
    if (!task || !Array.isArray(task.success) || !task.success.length || task.success.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`Unknown or invalid golden task: ${id}`);
    return { id, intent: task.intent, fixture: task.fixture, acceptance: task.success.map((text, index) => ({ id: `AC-${String(index + 1).padStart(2, "0")}`, text })) };
  });
  const config = await readJson(await safePath(root, "harness.config.json", "harness config"));
  const id = identifier(options.id ?? `eval-${compactTimestamp()}`, "evaluation id");
  const directory = `work/evals/${id}`;
  const output = `${directory}/plan.json`;
  if (await exists(await safePath(root, directory, "evaluation directory"))) throw new Error(`Evaluation already exists: ${id}`);
  const git = options.revision ? null : commandResult("git", ["rev-parse", "--verify", "HEAD"], { cwd: root });
  const revision = cleanInline(options.revision ?? (git?.ok ? git.stdout : "")) || null;
  if (revision && !/^[a-f0-9]{40,64}$/i.test(revision)) throw new Error("--revision must be an immutable full Git commit id.");
  const resultSchema = await readJson(await safePath(root, "harness/schemas/eval-result.schema.json", "result schema"));
  const runs = tasks.flatMap((task) => providers.flatMap((provider) => Array.from({ length: repetitions }, (_, index) => {
    const attempt = index + 1;
    const runId = `${task.id}--${provider}--${attempt}`;
    const runDirectory = `${directory}/runs/${runId}`;
    const checkoutPath = `.harness/runtime/evals/${id}/${runId}`;
    return {
      runId, taskId: task.id, provider, attempt, acceptance: task.acceptance,
      promptPath: `${runDirectory}/prompt.md`, resultPath: `${runDirectory}/result.json`, recordPath: `${directory}/records/${runId}.json`, evidenceDirectory: `${runDirectory}/evidence`,
      checkout: { path: checkoutPath, branch: `eval/${id}/${runId}`, revision, isolated: true },
      commands: [
        { purpose: "Create a separate checkout; inspect and run manually", command: "git", args: ["worktree", "add", "-b", `eval/${id}/${runId}`, checkoutPath, revision ?? "<approved-commit>"] },
        { purpose: "Initialize the existing loop adapter inside that checkout after creating an approved durable session", command: "npm", args: ["run", "loop", "--", "init", "--session", "<session-id>", "--provider", provider, "--verifier-provider", provider === "claude" ? "copilot" : "claude", "--isolation-evidence", "<approved-isolation-record.json>"] },
        { purpose: "Inspect one bounded iteration; --execute is a separate operator decision", command: "npm", args: ["run", "loop", "--", "run", "--id", "<loop-id>"] },
      ],
    };
  })));
  const contract = {
    id, harnessVersion: config.harnessVersion, sourceRevision: revision, taskManifestSha256: sha256(manifestText), resultSchema,
    providers, repetitions, tasks, runs,
    fullReleaseMatrix: selected.length === manifest.tasks.length && providers.length === new Set((manifest.providers ?? []).map((provider) => ALIASES[provider])).size,
    promotionPolicy: { missingTrialsAllowed: false, maximumSecurityRegressions: 0, requireAllCandidateTasksPassed: true, requireHumanReview: true },
  };
  const plan = { schemaVersion: 1, createdAt: timestamp(), contract, contractHash: sha256(JSON.stringify(contract)), executionStatus: "not-run", warning: "Preparation starts no model, checkout, credential flow, or deployment. All runs are not-run until evidence-backed records are imported." };
  verifyPlan(plan);
  await mkdir(await safePath(root, directory, "evaluation directory"), { recursive: true });
  for (const run of runs) {
    const task = tasks.find((item) => item.id === run.taskId);
    const prompt = `# Golden task ${task.id}\n\nEvaluation: ${id}\nRun: ${run.runId}\nContract: ${plan.contractHash}\nProvider: ${run.provider}\nAttempt: ${run.attempt}/${repetitions}\nSource revision: ${revision ?? "unavailable — establish a committed baseline before execution"}\n\n## Fixed task\n\n${task.fixture}\n\nIntent: ${task.intent}\n\n## Acceptance (do not weaken or edit)\n\n${run.acceptance.map((ac) => `- ${ac.id}: ${ac.text}`).join("\n")}\n\n## Execution contract\n\nUse the separate checkout declared in plan.json. Create a durable session and product requirement containing the exact acceptance above. Use the existing bounded loop adapter; never start production/destructive operations, bypass a human gate, or alter the evaluator/policy/budget to pass. Each trial uses fresh context and isolated development resources; do not reuse another trial's implementation. Obtain a fresh independent verifier. Record actual provider/model/CLI versions.\n\nCopy redacted evidence into ${run.evidenceDirectory}/ in the coordinator repository, then fill result.json and import it with evaluation record. Do not store raw transcripts, credentials, or customer rows. Missing evidence or unexecuted criteria remain not-run, not pass. The JSON template is deliberately unrecordable until completed.\n`;
    await atomicWrite(await safePath(root, run.promptPath, "evaluation prompt"), prompt);
    await writeJson(await safePath(root, run.resultPath, "evaluation result template"), {
      schemaVersion: 1, template: true, planId: id, contractHash: plan.contractHash, runId: run.runId, taskId: run.taskId, provider: run.provider, attempt: run.attempt,
      status: "blocked", startedAt: null, finishedAt: null, implementer: null,
      sourceRevision: revision, isolation: { checkoutPath: run.checkout.path, branch: run.checkout.branch, verified: false, evidence: [] },
      versions: { harness: config.harnessVersion, model: null, providerCli: null },
      metrics: { iterations: 0, wallSeconds: 0, humanInterventions: 0, credits: null, securityRegressions: 0 },
      acceptance: run.acceptance.map((ac) => ({ id: ac.id, status: "not-run", evidence: [] })),
      checks: [], verifier: { actor: null, provider: null, independent: false, evidence: [] }, evidence: [],
    });
  }
  await writeJson(await safePath(root, output, "evaluation plan"), plan);
  console.log(output);
  return { ...plan, path: output };
}

async function validateResult(root, plan, result, { sealed = false } = {}) {
  const contract = verifyPlan(plan);
  if (sealed) {
    const { recordSha256, ...snapshot } = result;
    if (!hashLike(recordSha256) || recordSha256 !== sha256(JSON.stringify(snapshot))) throw new Error("Recorded evaluation result seal is invalid.");
  }
  if (result.template) throw new Error("An unexecuted result template cannot be recorded.");
  const schemaErrors = validateSchema(contract.resultSchema, result);
  if (schemaErrors.length) throw new Error(`Invalid evaluation result: ${schemaErrors.join("; ")}`);
  if (!RESULT_STATES.has(result.status) || result.planId !== contract.id || result.contractHash !== plan.contractHash) throw new Error("Result does not match the evaluation contract.");
  const run = contract.runs.find((item) => item.runId === result.runId);
  if (!run || run.provider !== result.provider || run.taskId !== result.taskId || run.attempt !== result.attempt) throw new Error("Result is not a declared trial.");
  if (result.sourceRevision !== contract.sourceRevision) throw new Error("Result source revision differs from the frozen evaluation revision.");
  if (Date.parse(result.finishedAt) < Date.parse(result.startedAt)) throw new Error("Result finish precedes its start.");
  if (!Number.isInteger(result.metrics.securityRegressions) || result.metrics.securityRegressions < 0) throw new Error("metrics.securityRegressions must be an explicit non-negative integer.");
  if (!result.versions || result.versions.harness !== contract.harnessVersion || !cleanInline(result.versions.model) || !cleanInline(result.versions.providerCli)) throw new Error("Record actual model, provider CLI, and matching harness versions.");
  if (!cleanInline(result.implementer)) throw new Error("Result must identify its implementer.");
  const expected = new Set(run.acceptance.map((ac) => ac.id));
  if (!Array.isArray(result.acceptance) || result.acceptance.length !== expected.size || new Set(result.acceptance.map((ac) => ac.id)).size !== expected.size || result.acceptance.some((ac) => !expected.has(ac.id) || !AC_STATES.has(ac.status) || !Array.isArray(ac.evidence))) throw new Error("Result must cover every fixed acceptance criterion exactly once.");
  const references = new Set(result.evidence);
  for (const ac of result.acceptance) {
    if (ac.status === "pass" && !ac.evidence.length) throw new Error(`Passing acceptance requires evidence: ${ac.id}`);
    for (const path of ac.evidence) if (!references.has(path)) throw new Error(`Acceptance evidence is not declared: ${path}`);
  }
  if (result.status === "passed") {
    if (result.acceptance.some((ac) => ac.status !== "pass")) throw new Error("A passed trial cannot contain fail or not-run acceptance.");
    if (result.metrics.securityRegressions !== 0) throw new Error("A passed trial cannot contain security regressions.");
    if (!Array.isArray(result.checks) || !result.checks.length || result.checks.some((check) => !cleanInline(check.name) || check.status !== "pass" || !Array.isArray(check.evidence) || !check.evidence.length || check.evidence.some((path) => !references.has(path)))) throw new Error("A passed trial requires passing deterministic checks with evidence.");
    const verifier = result.verifier;
    if (!verifier || verifier.independent !== true || !cleanInline(verifier.actor) || verifier.actor === result.implementer || !["claude", "copilot", "manual"].includes(verifier.provider) || verifier.provider === result.provider || !Array.isArray(verifier.evidence) || !verifier.evidence.length || verifier.evidence.some((path) => !references.has(path))) throw new Error("A passed trial requires an independent verifier and its evidence.");
    const isolation = result.isolation;
    if (!contract.sourceRevision || !isolation || isolation.verified !== true || isolation.checkoutPath !== run.checkout.path || isolation.branch !== run.checkout.branch || !Array.isArray(isolation.evidence) || !isolation.evidence.length || isolation.evidence.some((path) => !references.has(path))) throw new Error("A passed trial requires the declared isolated checkout and its evidence.");
  }
  const hashes = {};
  for (const path of references) hashes[path] = await artifactHash(root, path, run.evidenceDirectory);
  if (sealed && (!result.artifactHashes || Object.keys(result.artifactHashes).length !== Object.keys(hashes).length || Object.entries(hashes).some(([path, hash]) => !HEX.test(result.artifactHashes[path] ?? "") || result.artifactHashes[path] !== hash))) throw new Error("Recorded evaluation evidence is missing or stale.");
  return { run, hashes };
}

function hashLike(value) { return typeof value === "string" && HEX.test(value); }

export async function recordEvaluation(root, options = {}) {
  const plan = await loadPlan(root, options.plan);
  if (!options.result) throw new Error("evaluation record requires --result.");
  const input = await readFile(await safePath(root, options.result, "evaluation result"), "utf8");
  const result = JSON.parse(input);
  const { run, hashes } = await validateResult(root, plan, result);
  const output = await safePath(root, run.recordPath, "evaluation record");
  return withFileLock(output, async () => {
    if (await exists(output)) {
      const previous = await readJson(output);
      if (previous.sourceResultSha256 === sha256(input)) { await validateResult(root, plan, previous, { sealed: true }); return previous; }
      throw new Error("Evaluation trial is already recorded; do not overwrite a failed trial or cherry-pick a retry. Prepare a new evaluation.");
    }
    const record = {
      schemaVersion: result.schemaVersion, planId: result.planId, contractHash: result.contractHash, runId: result.runId, taskId: result.taskId, provider: result.provider, attempt: result.attempt,
      status: result.status, startedAt: result.startedAt, finishedAt: result.finishedAt, implementer: result.implementer, versions: result.versions,
      sourceRevision: result.sourceRevision, isolation: result.isolation ?? null,
      metrics: result.metrics, acceptance: result.acceptance, checks: result.checks ?? [], verifier: result.verifier ?? null, evidence: result.evidence,
      artifactHashes: hashes, sourceResultSha256: sha256(input), recordedAt: timestamp(), provenance: { identityAuthenticated: false, humanReviewRequired: true },
    };
    record.recordSha256 = sha256(JSON.stringify(record));
    await writeJson(output, record);
    console.log(repoRelative(root, output));
    return record;
  });
}

async function summarize(root, plan) {
  const trials = [];
  for (const run of plan.contract.runs) {
    const path = await safePath(root, run.recordPath, "evaluation record");
    const identity = { runId: run.runId, provider: run.provider, taskId: run.taskId, attempt: run.attempt };
    if (!(await exists(path))) { trials.push({ ...identity, status: "not-run", acceptancePassed: 0, acceptanceTotal: run.acceptance.length }); continue; }
    try {
      const record = await readJson(path);
      await validateResult(root, plan, record, { sealed: true });
      trials.push({ ...identity, status: record.status, metrics: record.metrics, acceptancePassed: record.acceptance.filter((ac) => ac.status === "pass").length, acceptanceTotal: run.acceptance.length });
    } catch (error) { trials.push({ ...identity, status: "invalid", error: error.message, acceptancePassed: 0, acceptanceTotal: run.acceptance.length }); }
  }
  const counts = Object.fromEntries(["passed", "failed", "blocked", "invalid", "not-run"].map((status) => [status, trials.filter((trial) => trial.status === status).length]));
  const measured = trials.filter((trial) => trial.metrics);
  const mean = (key) => {
    const values = measured.map((trial) => trial.metrics[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const byProvider = Object.fromEntries(plan.contract.providers.map((provider) => {
    const selected = trials.filter((trial) => trial.provider === provider);
    const credits = selected.map((trial) => trial.metrics?.credits).filter((value) => typeof value === "number");
    return [provider, { expectedTrials: selected.length, passed: selected.filter((trial) => trial.status === "passed").length, notRun: selected.filter((trial) => trial.status === "not-run").length, invalid: selected.filter((trial) => trial.status === "invalid").length, meanCredits: credits.length ? credits.reduce((sum, value) => sum + value, 0) / credits.length : null, creditMeasuredTrials: credits.length }];
  }));
  return {
    id: plan.contract.id, contractHash: plan.contractHash, sourceRevision: plan.contract.sourceRevision, fullReleaseMatrix: plan.contract.fullReleaseMatrix,
    expectedTrials: trials.length, recordedTrials: trials.length - counts["not-run"], complete: counts["not-run"] === 0 && counts.invalid === 0,
    counts, successRate: counts.passed / trials.length, acceptancePassed: trials.reduce((sum, trial) => sum + trial.acceptancePassed, 0), acceptanceTotal: trials.reduce((sum, trial) => sum + trial.acceptanceTotal, 0),
    securityRegressions: measured.reduce((sum, trial) => sum + trial.metrics.securityRegressions, 0),
    means: { wallSeconds: mean("wallSeconds"), iterations: mean("iterations"), humanInterventions: mean("humanInterventions"), credits: plan.contract.providers.length === 1 ? mean("credits") : null },
    costMeasuredTrials: measured.filter((trial) => typeof trial.metrics.credits === "number").length,
    byProvider, trials,
  };
}

export async function compareEvaluations(root, options = {}) {
  const baselinePlan = await loadPlan(root, options.baseline);
  const candidatePlan = await loadPlan(root, options.candidate);
  const baseline = await summarize(root, baselinePlan);
  const candidate = await summarize(root, candidatePlan);
  const reasons = [];
  if (baselinePlan.contract.taskManifestSha256 !== candidatePlan.contract.taskManifestSha256 || JSON.stringify(baselinePlan.contract.providers) !== JSON.stringify(candidatePlan.contract.providers) || baselinePlan.contract.repetitions !== candidatePlan.contract.repetitions || JSON.stringify(baselinePlan.contract.tasks) !== JSON.stringify(candidatePlan.contract.tasks) || JSON.stringify(baselinePlan.contract.resultSchema) !== JSON.stringify(candidatePlan.contract.resultSchema)) reasons.push("Baseline and candidate do not use the same frozen task/provider/repetition/result-schema contract.");
  if (!baseline.complete || !candidate.complete) reasons.push("Missing, not-run, or invalid trials prevent promotion.");
  if (!baseline.fullReleaseMatrix || !candidate.fullReleaseMatrix) reasons.push("A selected task/provider subset is diagnostic only; release promotion requires the full matrix.");
  if (!baseline.sourceRevision || !candidate.sourceRevision) reasons.push("An immutable source revision is missing.");
  if (candidate.counts.passed !== candidate.expectedTrials) reasons.push("Every candidate trial must pass; blocked and not-run are not passes.");
  if (candidate.securityRegressions !== 0) reasons.push("Security regressions must be zero.");
  if (candidate.successRate < baseline.successRate) reasons.push("Accepted-task success regressed.");
  const report = {
    schemaVersion: 1, comparedAt: timestamp(), baseline, candidate,
    promotable: reasons.length === 0, promotionAuthorized: false, humanReviewRequired: true, reasons,
    delta: { successRate: candidate.successRate - baseline.successRate, meanWallSeconds: baseline.means.wallSeconds === null || candidate.means.wallSeconds === null ? null : candidate.means.wallSeconds - baseline.means.wallSeconds, meanHumanInterventions: baseline.means.humanInterventions === null || candidate.means.humanInterventions === null ? null : candidate.means.humanInterventions - baseline.means.humanInterventions },
    warnings: ["Local result seals prove snapshot integrity, not reviewer identity or truth. Independent and human review is still required.", "Credit units are provider-specific; do not compare a pooled credit mean as monetary cost. Review time, intervention and cost tradeoffs before promotion.", ...(baseline.costMeasuredTrials < baseline.expectedTrials || candidate.costMeasuredTrials < candidate.expectedTrials ? ["Some credit measurements are unavailable; they are not zero and no cost-improvement claim is justified."] : [])],
  };
  if (options.output) {
    const output = await safePath(root, options.output, "evaluation comparison");
    if (await exists(output)) throw new Error("Comparison output already exists.");
    await writeJson(output, report);
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}
