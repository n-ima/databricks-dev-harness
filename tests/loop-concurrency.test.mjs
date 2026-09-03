import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { approveLoopGate, initLoop, policyHash, recordLoop, runLoopIteration, setLoopGate, stopLoop } from "../tools/lib/loop.mjs";
import { policyHash as sharedPolicyHash } from "../tools/lib/policy.mjs";
import { answerIntake, approveIntake, createIntake } from "../tools/lib/intake.mjs";
import { exists, parseFrontmatter, readJson, sha256, withFileLock, writeJson } from "../tools/lib/shared.mjs";

const requirement = "docs/product/requirements/concurrency.md";
const receiptPath = "work/reviews/independent.json";
const implementation = "work/evidence/checks.md";

async function fixture(t) {
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, "harness-concurrency-"));
  t.mock.method(console, "log", () => {});
  t.after(async () => {
    assert.ok(root.startsWith(`${base}${sep}`));
    assert.match(root.slice(base.length + 1), /^harness-concurrency-/);
    await rm(root, { recursive: true, force: true });
  });
  const put = async (path, content) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), typeof content === "string" ? content : JSON.stringify(content));
  };
  await put("AGENTS.md", "# Fixture policy\nIndependent verification is mandatory.\n");
  await put("tools/agent-hook.mjs", "// fixture hook\n");
  await put("harness.config.json", { loop: { maxIterations: 4, maxWallMinutes: 10, maxProcessMinutes: 1, checks: [["fixture-check"]] } });
  await put(requirement, "---\nstatus: accepted\n---\n- AC-01: Prevent duplicate execution.\n");
  await put(implementation, "The duplicate execution contract passed.\n");
  await put("work/sessions/session-one.md", `---\nid: session-one\nstatus: active\ngate_status: approved\nrequirement: ${requirement}\n---\n`);
  return { root, put };
}

const success = (stdout = "fixture passed") => ({ ok: true, status: 0, stdout, stderr: "" });
const fakeGit = (_command, args) => success({
  "rev-parse --is-inside-work-tree": "true",
  "rev-parse --verify HEAD": "a".repeat(40),
  "branch --show-current": "concurrency-fixture",
  "status --porcelain": "",
}[args.join(" ")]);

async function loopFixture(t, { linkedRequirement = true, accepted = true } = {}) {
  const context = await fixture(t);
  if (!linkedRequirement) await context.put("work/sessions/session-one.md", "---\nid: session-one\nstatus: active\ngate_status: approved\nrequirement: unassigned\n---\n");
  if (!accepted) await context.put(requirement, "---\nstatus: draft\n---\n- AC-01: Prevent duplicate execution.\n");
  const state = await initLoop(context.root, { session: "session-one", provider: "claude", verifier_provider: "copilot" }, { run: fakeGit });
  await context.put(receiptPath, {
    schemaVersion: 1, sessionId: state.sessionId, requirement, status: "pass",
    independent: true, reviewer: "independent-verifier", provider: "copilot", policyHash: state.policyHash,
    acceptance: [{ id: "AC-01", status: "pass", evidence: [implementation] }],
    artifactHashes: {
      [requirement]: sha256(await readFile(join(context.root, requirement))),
      [implementation]: sha256(await readFile(join(context.root, implementation))),
    },
  });
  return { ...context, state, path: join(context.root, "work/loops", `${state.id}.json`) };
}

const complete = (state) => ({ id: state.id, outcome: "achieved", summary: "Contracts verified", evidence: [implementation], verifier_evidence: receiptPath });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("loop exports the shared policy hash and includes policy modules in its snapshot", async (t) => {
  const { root, put } = await fixture(t);
  assert.equal(policyHash, sharedPolicyHash);
  const before = await policyHash(root);
  await put("tools/lib/policy.mjs", "// changed policy boundary\n");
  assert.notEqual(await policyHash(root), before);
});

test("an active provider run owns the loop record until checks finish", { timeout: 10_000 }, async (t) => {
  const context = await loopFixture(t);
  const entered = deferred();
  const release = deferred();
  let providerCalls = 0;
  const run = async (command) => {
    if (command === "claude") {
      providerCalls += 1;
      entered.resolve();
      await release.promise;
    }
    return success();
  };
  const active = runLoopIteration(context.root, { id: context.state.id, execute: true }, { run });
  try {
    await entered.promise;
    assert.equal(await exists(`${context.path}.lock`), true);
    const attempts = [
      () => runLoopIteration(context.root, { id: context.state.id, execute: true }, { run }),
      () => recordLoop(context.root, { id: context.state.id, outcome: "progress", summary: "racing recorder" }),
      () => setLoopGate(context.root, { id: context.state.id, gate: "ui-mock" }),
      () => approveLoopGate(context.root, { id: context.state.id, evidence: "not-used.json" }),
      () => stopLoop(context.root, { id: context.state.id, outcome: "cancelled" }),
    ];
    for (const attempt of attempts) await assert.rejects(attempt(), /locked/i);
    assert.equal(providerCalls, 1);
    assert.equal((await readJson(context.path)).iterations.length, 1);
  } finally {
    release.resolve();
    await active;
  }
  assert.equal(await exists(`${context.path}.lock`), false);
  const final = await recordLoop(context.root, complete(context.state));
  assert.equal(final.status, "achieved");
});

test("unexpected provider exceptions release the lock but cannot silently rerun an unfinished slice", async (t) => {
  const context = await loopFixture(t);
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: async () => { throw new Error("fixture transport failed"); } }), /fixture transport failed/);
  assert.equal(await exists(`${context.path}.lock`), false);
  await assert.rejects(runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: () => assert.fail("Must not retry provider") }), /unfinished/);
  assert.equal((await stopLoop(context.root, { id: context.state.id, outcome: "cancelled", reason: "Provider process already ended; inspect side effects before retry" })).status, "cancelled");
});

test("simultaneous completion records cannot both close the same iteration", async (t) => {
  const context = await loopFixture(t);
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: () => success() });
  const results = await Promise.allSettled([
    recordLoop(context.root, complete(context.state)),
    recordLoop(context.root, complete(context.state)),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(results.find((item) => item.status === "rejected").reason.message, /locked|terminal|already recorded/);
  const state = await readJson(context.path);
  assert.equal(state.status, "achieved");
  assert.equal(state.iterations.length, 1);
  assert.equal(await exists(`${context.path}.lock`), false);
});

test("all loop mutators fail closed on an existing record lock without changing state", async (t) => {
  const context = await loopFixture(t);
  const before = await readFile(context.path, "utf8");
  await withFileLock(context.path, async () => {
    for (const attempt of [
      () => setLoopGate(context.root, { id: context.state.id, gate: "ui-mock" }),
      () => approveLoopGate(context.root, { id: context.state.id, evidence: "missing.json" }),
      () => recordLoop(context.root, { id: context.state.id, outcome: "progress" }),
      () => stopLoop(context.root, { id: context.state.id, outcome: "cancelled" }),
      () => runLoopIteration(context.root, { id: context.state.id, execute: false }),
    ]) await assert.rejects(attempt(), /locked/i);
  });
  assert.equal(await readFile(context.path, "utf8"), before);
});

for (const [name, options] of [["missing requirement binding", { linkedRequirement: false }], ["draft requirement", { accepted: false }]]) {
  test(`loop completion rejects ${name}`, async (t) => {
    const context = await loopFixture(t, options);
    await runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: () => success() });
    await assert.rejects(recordLoop(context.root, complete(context.state)), /accepted requirement/);
    assert.equal((await readJson(context.path)).status, "active");
  });
}

for (const [name, mutate, error] of [
  ["missing receipt requirement", (r) => { delete r.requirement; }, /requirement mismatch/],
  ["wrong receipt requirement", (r) => { r.requirement = "another-requirement.md"; }, /requirement mismatch/],
  ["string independence", (r) => { r.independent = "false"; }, /independent/],
  ["conflicting duplicate AC", (r) => { r.acceptance.push({ ...r.acceptance[0], status: "fail" }); }, /acceptance/],
  ["extra passing AC without evidence", (r) => { r.acceptance.push({ id: "AC-99", status: "pass", evidence: [] }); }, /acceptance|evidence/i],
  ["unhashed requirement", (r) => { delete r.artifactHashes[requirement]; }, /bind.*requirement/],
]) {
  test(`loop and session completion share receipt rejection for ${name}`, async (t) => {
    const context = await loopFixture(t);
    await runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: () => success() });
    const receipt = await readJson(join(context.root, receiptPath));
    mutate(receipt);
    await writeJson(join(context.root, receiptPath), receipt);
    await assert.rejects(recordLoop(context.root, complete(context.state)), error);
    assert.equal((await readJson(context.path)).iterations[0].finishedAt, null);
  });
}

test("loop completion rejects empty implementation evidence even if not referenced by the receipt", async (t) => {
  const context = await loopFixture(t);
  await context.put("work/evidence/empty.md", "");
  await runLoopIteration(context.root, { id: context.state.id, execute: true }, { run: () => success() });
  await assert.rejects(recordLoop(context.root, { ...complete(context.state), evidence: ["work/evidence/empty.md"] }), /non-empty/);
});

async function intakeFixture(t) {
  const context = await fixture(t);
  const intake = await createIntake(context.root, { title: "Concurrent intent", name: "concurrent-intent", summary: "Document the intended business outcome." });
  return { ...context, intake, path: join(context.root, "docs/product/intake", intake.id, "intake.json") };
}

test("concurrent intake answers cannot lose an answer; a rejected writer can retry against fresh state", async (t) => {
  const context = await intakeFixture(t);
  const answers = [
    { id: context.intake.id, question: "Q-01", answer: "Reduce review time", actor: "owner" },
    { id: context.intake.id, question: "Q-02", answer: "One department only", actor: "owner" },
  ];
  const results = await Promise.allSettled(answers.map((options) => answerIntake(context.root, options)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      assert.match(result.reason.message, /locked/);
      await answerIntake(context.root, answers[index]);
    }
  }
  const intake = await readJson(context.path);
  assert.equal(intake.questions.find((q) => q.id === "Q-01").answer, answers[0].answer);
  assert.equal(intake.questions.find((q) => q.id === "Q-02").answer, answers[1].answer);
  const requirementText = await readFile(join(context.root, intake.artifacts.requirementPath), "utf8");
  for (const answer of answers) assert.ok(requirementText.includes(answer.answer));
});

test("intake cannot overwrite a concurrently checkpointed session or partially update linked documents", async (t) => {
  const context = await intakeFixture(t);
  const before = Object.fromEntries(await Promise.all(Object.values(context.intake.artifacts).map(async (path) => [path, await readFile(join(context.root, path), "utf8")])));
  const sessionPath = join(context.root, context.intake.artifacts.sessionPath);
  await withFileLock(sessionPath, async () => {
    await assert.rejects(answerIntake(context.root, { id: context.intake.id, question: "Q-01", answer: "New outcome", actor: "owner" }), /locked/);
  });
  for (const [path, content] of Object.entries(before)) assert.equal(await readFile(join(context.root, path), "utf8"), content);
  assert.equal((await readJson(context.path)).questions[0].status, "open");
  assert.equal(await exists(`${context.path}.lock`), false);
  await answerIntake(context.root, { id: context.intake.id, question: "Q-01", answer: "New outcome", actor: "owner" });
  assert.match(await readFile(join(context.root, context.intake.artifacts.requirementPath), "utf8"), /New outcome/);
});

test("intake approval and answers obey the same manifest lock", async (t) => {
  const context = await intakeFixture(t);
  for (const question of context.intake.questions) await answerIntake(context.root, { id: context.intake.id, question: question.id, answer: `Accepted answer for ${question.id}`, actor: "owner" });
  const before = await readFile(context.path, "utf8");
  await withFileLock(context.path, async () => {
    await assert.rejects(approveIntake(context.root, { id: context.intake.id, actor: "owner", evidence: "Review recorded" }), /locked/);
    await assert.rejects(answerIntake(context.root, { id: context.intake.id, question: "Q-01", answer: "Racing update", actor: "owner" }), /locked/);
  });
  assert.equal(await readFile(context.path, "utf8"), before);
  await approveIntake(context.root, { id: context.intake.id, actor: "owner", evidence: "Review recorded" });
  await answerIntake(context.root, { id: context.intake.id, question: "Q-01", answer: "Changed outcome invalidates approval", actor: "owner" });
  assert.equal((await readJson(context.path)).approval, undefined);
  assert.equal(parseFrontmatter(await readFile(join(context.root, context.intake.artifacts.sessionPath), "utf8")).gate_status, "pending");
});

test("concurrent intake creation with the same name cannot overwrite product artifacts", async (t) => {
  const { root } = await fixture(t);
  const attempts = ["First intent", "Second intent"].map((summary) => ({ title: "Same name", name: "same-name", summary }));
  const results = await Promise.allSettled(attempts.map((options) => createIntake(root, options)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(results.find((result) => result.status === "rejected").reason.message, /locked|overwrite/);
  const winner = results.find((result) => result.status === "fulfilled").value;
  assert.ok((await readFile(join(root, winner.artifacts.requirementPath), "utf8")).includes(winner.summary));
  assert.equal((await readdir(join(root, "docs/product/intake"))).length, 1);
});
