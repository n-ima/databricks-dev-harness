import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";
import { prepareEvaluation, recordEvaluation, compareEvaluations } from "../tools/lib/evaluation.mjs";
import { exists, readJson, sha256, writeJson } from "../tools/lib/shared.mjs";

const REVISION = "a".repeat(40);
const schemaText = await readFile(new URL("../harness/schemas/eval-result.schema.json", import.meta.url), "utf8");

async function fixture(t) {
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "harness-evaluation-test-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`));
    await rm(root, { recursive: true, force: true });
  });
  await writeJson(join(root, "harness.config.json"), { harnessVersion: "0.2.0" });
  await writeJson(join(root, "harness/evals/golden-tasks.json"), {
    schemaVersion: 1, providers: ["claude-code", "github-copilot"], releasePolicy: { repetitionsPerProvider: 3 },
    tasks: [{ id: "safe-update", intent: "build", fixture: "Synthetic fixture only; no external execution.", success: ["Rerun is idempotent", "Permission boundary remains enforced"] }],
  });
  await mkdir(join(root, "harness/schemas"), { recursive: true });
  await writeFile(join(root, "harness/schemas/eval-result.schema.json"), schemaText);
  return root;
}

async function prepare(root, id, extra = {}) {
  return prepareEvaluation(root, { id, revision: REVISION, ...extra });
}

async function resultFixture(root, plan, run = plan.contract.runs[0], overrides = {}) {
  const evidence = `${run.evidenceDirectory}/independent-proof.md`;
  await mkdir(dirname(join(root, evidence)), { recursive: true });
  await writeFile(join(root, evidence), `Synthetic test evidence for ${run.runId}. This is not a real model evaluation.\n`);
  const result = {
    schemaVersion: 1, planId: plan.contract.id, contractHash: plan.contractHash, runId: run.runId, taskId: run.taskId, provider: run.provider, attempt: run.attempt,
    status: "passed", startedAt: "2026-09-04T00:00:00Z", finishedAt: "2026-09-04T00:01:00Z", implementer: "test-implementer",
    sourceRevision: plan.contract.sourceRevision, isolation: { checkoutPath: run.checkout.path, branch: run.checkout.branch, verified: true, evidence: [evidence] },
    versions: { harness: "0.2.0", model: "test-fake-model", providerCli: "test-fake-cli" },
    metrics: { iterations: 1, wallSeconds: 60, humanInterventions: 0, credits: null, securityRegressions: 0 },
    acceptance: run.acceptance.map((ac) => ({ id: ac.id, status: "pass", evidence: [evidence] })),
    checks: [{ name: "fixture-check", status: "pass", evidence: [evidence] }],
    verifier: { actor: "test-independent-reviewer", provider: "manual", independent: true, evidence: [evidence] }, evidence: [evidence], ...overrides,
  };
  await writeJson(join(root, run.resultPath), result);
  return result;
}

async function recordAll(root, plan, override = () => ({})) {
  for (const run of plan.contract.runs) {
    await resultFixture(root, plan, run, override(run));
    await recordEvaluation(root, { plan: plan.path, result: run.resultPath });
  }
}

test("evaluation prepares the full provider x task x 3 immutable plan without executing checkouts or models", async (t) => {
  const root = await fixture(t);
  const plan = await prepare(root, "full-plan");
  assert.equal(plan.contract.runs.length, 6);
  assert.deepEqual(plan.contract.providers, ["claude", "copilot"]);
  assert.equal(plan.executionStatus, "not-run");
  assert.equal(plan.contract.fullReleaseMatrix, true);
  assert.equal(await exists(join(root, ".harness/runtime")), false);
  for (const run of plan.contract.runs) {
    assert.ok((await readFile(join(root, run.promptPath), "utf8")).includes("AC-02"));
    assert.ok(run.commands.some((item) => item.command === "npm" && item.args.includes("loop")));
    assert.equal((await readJson(join(root, run.resultPath))).template, true);
  }
});

test("evaluation rejects undersampling, unsupported providers, unknown tasks, floating revisions and duplicate plans", async (t) => {
  const root = await fixture(t);
  await assert.rejects(prepare(root, "two-runs", { repetitions: 2 }), /between 3 and 20/);
  await assert.rejects(prepare(root, "unknown-provider", { provider: "other" }), /Unsupported/);
  await assert.rejects(prepare(root, "unknown-task", { task: "unknown" }), /Unknown/);
  await assert.rejects(prepare(root, "floating", { revision: "main" }), /immutable/);
  await prepare(root, "repeat");
  await assert.rejects(prepare(root, "repeat"), /already exists/);
});

test("unexecuted templates and malformed JSON schema fields cannot be recorded", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "invalid-record"), run = plan.contract.runs[0];
  await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /unexecuted/);
  await resultFixture(root, plan, run, { metrics: { iterations: -1, wallSeconds: 1, humanInterventions: 0, securityRegressions: 0 } });
  await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /minimum|numeric bounds/);
  assert.equal(await exists(join(root, run.recordPath)), false);
});

test("passed results require complete acceptance and distinguish not-run from pass", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "coverage"), run = plan.contract.runs[0];
  const result = await resultFixture(root, plan, run);
  result.acceptance.pop();
  await writeJson(join(root, run.resultPath), result);
  await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /every fixed acceptance/);
  const full = await resultFixture(root, plan, run);
  full.acceptance[0].status = "not-run";
  await writeJson(join(root, run.resultPath), full);
  await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /not-run/);
});

test("blocked results can preserve unexecuted criteria but are not counted as passes", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "blocked"), run = plan.contract.runs[0];
  const result = await resultFixture(root, plan, run, { status: "blocked" });
  result.acceptance = result.acceptance.map((ac) => ({ ...ac, status: "not-run", evidence: [] }));
  await writeJson(join(root, run.resultPath), result);
  const record = await recordEvaluation(root, { plan: plan.path, result: run.resultPath });
  assert.equal(record.status, "blocked");
  assert.ok(record.acceptance.every((ac) => ac.status === "not-run"));
});

test("passing trials require independent verifier, deterministic checks, versions and explicit security metrics", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "proof"), run = plan.contract.runs[0];
  for (const [changes, message] of [
    [{ verifier: { actor: "test-implementer", provider: run.provider, independent: true, evidence: [] } }, /independent verifier/],
    [{ checks: [] }, /deterministic/],
    [{ versions: { harness: "0.2.0" } }, /actual model/],
    [{ sourceRevision: "c".repeat(40) }, /source revision/],
    [{ isolation: { verified: false } }, /isolated checkout/],
    [{ metrics: { iterations: 1, wallSeconds: 1, humanInterventions: 0 } }, /securityRegressions/],
    [{ metrics: { iterations: 1, wallSeconds: 1, humanInterventions: 0, securityRegressions: 1 } }, /security regressions/],
  ]) {
    await resultFixture(root, plan, run, changes);
    await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), message);
  }
});

test("trial imports reject cross-run evidence, missing files and path traversal", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "paths"), run = plan.contract.runs[0];
  for (const evidence of ["work/other-proof.md", `${run.evidenceDirectory}/missing.md`, `${run.evidenceDirectory}/../../escape.md`]) {
    const result = await resultFixture(root, plan, run);
    result.evidence = [evidence];
    result.acceptance.forEach((ac) => { ac.evidence = [evidence]; });
    result.checks[0].evidence = [evidence];
    result.verifier.evidence = [evidence];
    result.isolation.evidence = [evidence];
    await writeJson(join(root, run.resultPath), result);
    await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /directory|ENOENT|Invalid/);
  }
});

test("records are immutable and identical re-import is idempotent", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "immutable"), run = plan.contract.runs[0];
  await resultFixture(root, plan, run);
  const first = await recordEvaluation(root, { plan: plan.path, result: run.resultPath });
  const repeat = await recordEvaluation(root, { plan: plan.path, result: run.resultPath });
  assert.equal(repeat.recordedAt, first.recordedAt);
  await resultFixture(root, plan, run, { status: "failed" });
  await assert.rejects(recordEvaluation(root, { plan: plan.path, result: run.resultPath }), /already recorded/);
});

test("missing trials cannot promote and unavailable credits are not reported as zero", async (t) => {
  const root = await fixture(t), baseline = await prepare(root, "base-missing"), candidate = await prepare(root, "candidate-missing");
  const report = await compareEvaluations(root, { baseline: baseline.path, candidate: candidate.path });
  assert.equal(report.promotable, false);
  assert.equal(report.candidate.counts["not-run"], 6);
  assert.equal(report.candidate.means.credits, null);
  assert.equal(report.candidate.successRate, 0);
});

test("complete synthetic records can be eligible but cannot self-authorize promotion", async (t) => {
  const root = await fixture(t), baseline = await prepare(root, "base-complete"), candidate = await prepare(root, "candidate-complete", { revision: "b".repeat(40) });
  await recordAll(root, baseline);
  await recordAll(root, candidate);
  const report = await compareEvaluations(root, { baseline: baseline.path, candidate: candidate.path });
  assert.equal(report.promotable, true);
  assert.equal(report.promotionAuthorized, false);
  assert.equal(report.humanReviewRequired, true);
  assert.ok(report.warnings.some((warning) => warning.includes("unavailable")));
});

test("stale evidence invalidates previously passing records", async (t) => {
  const root = await fixture(t), baseline = await prepare(root, "base-stale"), candidate = await prepare(root, "candidate-stale");
  await recordAll(root, baseline);
  await recordAll(root, candidate);
  await writeFile(join(root, `${candidate.contract.runs[0].evidenceDirectory}/independent-proof.md`), "Changed after review.");
  const report = await compareEvaluations(root, { baseline: baseline.path, candidate: candidate.path });
  assert.equal(report.promotable, false);
  assert.equal(report.candidate.counts.invalid, 1);
});

test("editing a sealed result invalidates it even when evidence bytes are unchanged", async (t) => {
  const root = await fixture(t), baseline = await prepare(root, "base-seal"), candidate = await prepare(root, "candidate-seal");
  await recordAll(root, baseline);
  await recordAll(root, candidate);
  const path = join(root, candidate.contract.runs[0].recordPath);
  const record = await readJson(path);
  record.metrics.humanInterventions = 99;
  await writeJson(path, record);
  const report = await compareEvaluations(root, { baseline: baseline.path, candidate: candidate.path });
  assert.equal(report.promotable, false);
  assert.equal(report.candidate.counts.invalid, 1);
});

test("security regression and diagnostic subsets cannot promote", async (t) => {
  const root = await fixture(t), baseline = await prepare(root, "base-security"), candidate = await prepare(root, "candidate-security");
  await recordAll(root, baseline);
  await recordAll(root, candidate, (run) => run === candidate.contract.runs[0] ? { status: "failed", metrics: { iterations: 1, wallSeconds: 1, humanInterventions: 0, securityRegressions: 1 } } : {});
  const report = await compareEvaluations(root, { baseline: baseline.path, candidate: candidate.path });
  assert.equal(report.promotable, false);
  assert.ok(report.reasons.some((reason) => reason.includes("Security")));
  const subset = await prepare(root, "subset", { provider: "claude" });
  await recordAll(root, subset);
  const subsetReport = await compareEvaluations(root, { baseline: subset.path, candidate: subset.path });
  assert.equal(subsetReport.promotable, false);
});

test("a rehashed plan cannot redirect record writes outside the per-run scope", async (t) => {
  const root = await fixture(t), plan = await prepare(root, "redirect");
  const persisted = await readJson(join(root, plan.path));
  persisted.contract.runs[0].recordPath = "tools/forged.json";
  persisted.contractHash = sha256(JSON.stringify(persisted.contract));
  await writeJson(join(root, plan.path), persisted);
  await assert.rejects(compareEvaluations(root, { baseline: plan.path, candidate: plan.path }), /artifact scope/);
});
