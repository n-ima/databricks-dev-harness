import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { addKnowledge, checkpointSession, closeSession, sessions, startSession } from "../tools/lib/memory.mjs";
import { fileHash, sealEvidence, validateReceipt } from "../tools/lib/evidence.mjs";
import { parseFrontmatter, replaceFrontmatterField, withFileLock } from "../tools/lib/shared.mjs";

const requirement = "docs/product/requirements/orders.md";
const review = "work/reviews/independent.json";
const receiptPath = "work/reviews/sealed.json";
const evidencePath = "work/evidence/results.md";

async function put(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function fixture(t) {
  t.mock.method(console, "log", () => {});
  const temporaryBase = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryBase, "harness-memory-contract-"));
  t.after(async () => {
    assert.ok(root.startsWith(`${temporaryBase}${sep}`));
    assert.match(root.slice(temporaryBase.length + 1), /^harness-memory-contract-/);
    await rm(root, { recursive: true, force: true });
  });
  await put(root, "AGENTS.md", "# Policy\nHuman gates and independent verification are required.\n");
  await put(root, "harness.config.json", { loop: { maxIterations: 4, maxWallMinutes: 30 } });
  await put(root, "tools/agent-hook.mjs", "// pinned hook fixture\n");
  await put(root, "harness/router.json", { routes: [{ id: "build" }, { id: "define" }, { id: "mock-ui" }, { id: "improve-harness" }] });
  await put(root, requirement, "---\nstatus: accepted\n---\n# Orders\n\n- AC-01: Update an order safely.\n- [ ] AC-02: Reject invalid input.\n");
  await put(root, evidencePath, "# Test evidence\nAC-01 passed; AC-02 passed.\n");
  await put(root, review, { reviewer: "independent-reviewer", provider: "copilot", independent: true, acceptance: [
    { id: "AC-01", status: "pass", evidence: [evidencePath] },
    { id: "AC-02", status: "pass", evidence: [evidencePath] },
  ] });
  return root;
}

async function session(root, { approved = true, ...options } = {}) {
  const result = await startSession(root, { title: "注文更新の実装", intent: "build", provider: "claude", requirement, architecture: "docs/product/architecture/orders.md", plan: "work/plans/orders.md", ...options });
  if (approved) await writeFile(result.path, replaceFrontmatterField(await readFile(result.path, "utf8"), "gate_status", "approved"));
  return result;
}

async function seal(root, id) {
  return sealEvidence(root, { review, session: id, requirement, output: receiptPath });
}

async function mutateJson(root, path, mutation) {
  const value = JSON.parse(await readFile(join(root, path), "utf8"));
  mutation(value);
  await put(root, path, value);
}

test("durable sessions carry provider, linked designs, objective, and pending intent gate", async (t) => {
  const root = await fixture(t);
  const created = await session(root, { approved: false, objective: "Order correction with audit trail" });
  const records = await sessions(root);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.id, created.id);
  assert.equal(record.provider, "claude");
  assert.equal(record.requirement, requirement);
  assert.equal(record.architecture, "docs/product/architecture/orders.md");
  assert.equal(record.gate_status, "pending");
  assert.match(record.text, /Order correction with audit trail/);
  assert.ok(record.last_checkpoint);
});

test("unknown session intents are rejected without creating a durable record", async (t) => {
  const root = await fixture(t);
  await assert.rejects(startSession(root, { title: "bad", intent: "invented-route" }), /Unknown session intent/);
  assert.deepEqual(await sessions(root), []);
});

test("a checkpoint requires summary and exact next action", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root);
  const before = await readFile(path, "utf8");
  await assert.rejects(checkpointSession(root, { id, summary: "half a checkpoint" }), /summary.*next/);
  assert.equal(await readFile(path, "utf8"), before);
  await checkpointSession(root, { id, summary: "Input validation tested", next: "Run transaction concurrency fixture", evidence: evidencePath, phase: "verify" });
  const after = await readFile(path, "utf8");
  assert.match(after, /summary: Input validation tested/);
  assert.match(after, /next: Run transaction concurrency fixture/);
  assert.equal(parseFrontmatter(after).phase, "verify");
});

test("a pending intent gate cannot be skipped through checkpoint phase changes", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root, { approved: false });
  for (const phase of ["implement", "verify", "release"]) await assert.rejects(checkpointSession(root, { id, phase, summary: "premature", next: "release" }), /pending human gate/);
});

test("file locks reject concurrent writers and are released after exceptions", async (t) => {
  const root = await fixture(t);
  const target = join(root, "work/sessions/lock-fixture.md");
  await withFileLock(target, async () => {
    await assert.rejects(withFileLock(target, async () => {}), /locked/i);
  });
  await assert.rejects(withFileLock(target, async () => { throw new Error("fixture failure"); }), /fixture failure/);
  assert.equal(await withFileLock(target, async () => "unlocked"), "unlocked");
});

test("blocked sessions close without falsely claiming completed and reject later checkpoints", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root, { approved: false });
  await closeSession(root, { id, outcome: "blocked", summary: "Waiting for product owner approval" });
  assert.equal(parseFrontmatter(await readFile(path, "utf8")).status, "blocked");
  await assert.rejects(checkpointSession(root, { id, summary: "changed", next: "continue" }), /active session/);
  await assert.rejects(closeSession(root, { id, outcome: "completed", summary: "retry" }), /active session/);
});

test("completion refuses a pending gate even with a valid receipt", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root, { approved: false });
  await seal(root, id);
  await assert.rejects(closeSession(root, { id, outcome: "completed", summary: "premature", verifier_evidence: receiptPath }), /pending/);
});

test("completion refuses absent verification without mutating the active session", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root);
  await assert.rejects(closeSession(root, { id, outcome: "completed", summary: "premature" }), /verifier-evidence/);
  assert.equal(parseFrontmatter(await readFile(path, "utf8")).status, "active");
});

test("sealed independent AC evidence permits completion and records unauthenticated identity honestly", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root);
  const receipt = await seal(root, id);
  assert.equal(receipt.status, "pass");
  assert.equal(receipt.provenance.identityAuthenticated, false);
  assert.equal(receipt.artifactHashes[evidencePath], await fileHash(root, evidencePath));
  assert.equal(receipt.artifactHashes[requirement], await fileHash(root, requirement));
  await validateReceipt(root, receiptPath, { sessionId: id, requirement, implementer: "claude" });
  await closeSession(root, { id, outcome: "completed", summary: "All acceptance criteria independently checked", verifier_evidence: receiptPath });
  assert.equal(parseFrontmatter(await readFile(path, "utf8")).status, "completed");
});

for (const [name, mutation, error] of [
  ["missing acceptance criterion", (r) => r.acceptance.pop(), /every requirement/],
  ["non-independent reviewer", (r) => { r.independent = false; }, /independent reviewer/],
  ["unknown reviewer provider", (r) => { r.provider = "invented-provider"; }, /provider/],
  ["passing criterion with no evidence", (r) => { r.acceptance[0].evidence = []; }, /Invalid acceptance evidence/],
  ["directory used as evidence", (r) => { r.acceptance[0].evidence = ["work/evidence"]; }, /must be a (?:non-empty )?file/],
]) {
  test(`sealing rejects ${name}`, async (t) => {
    const root = await fixture(t);
    const { id } = await session(root);
    await mutateJson(root, review, mutation);
    await assert.rejects(seal(root, id), error);
  });
}

test("a failed AC seals as fail and cannot be used to close completed", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root);
  await mutateJson(root, review, (r) => { r.acceptance[1].status = "fail"; });
  assert.equal((await seal(root, id)).status, "fail");
  await assert.rejects(closeSession(root, { id, outcome: "completed", summary: "not done", verifier_evidence: receiptPath }), /Passing independent/);
});

test("sealing rejects an unaccepted draft requirement", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root);
  await writeFile(join(root, requirement), (await readFile(join(root, requirement), "utf8")).replace("status: accepted", "status: draft"));
  await assert.rejects(seal(root, id), /accepted|approval|draft/i);
});

test("sealing rejects an empty file advertised as passing evidence", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root);
  await put(root, evidencePath, "");
  await assert.rejects(seal(root, id), /empty|evidence/i);
});

for (const [name, mutation, error] of [
  ["wrong session", (r) => { r.sessionId = "another-session"; }, /session mismatch/],
  ["wrong requirement binding", (r) => { r.requirement = "docs/product/requirements/another.md"; }, /requirement|mismatch/i],
  ["self-review identity", (r) => { r.reviewer = "claude"; }, /own work/],
  ["stale policy", (r) => { r.policyHash = "0".repeat(64); }, /policy hash/],
  ["missing artifact hashes", (r) => { r.artifactHashes = {}; }, /artifact hashes/],
  ["unhashed acceptance evidence", (r) => { delete r.artifactHashes[evidencePath]; }, /not hashed/],
  ["missing AC coverage", (r) => { r.acceptance.pop(); }, /all acceptance/],
  ["truthy string independence", (r) => { r.independent = "false"; }, /independent/i],
  ["unknown provider in receipt", (r) => { r.provider = "invented-provider"; }, /provider|verification/i],
  ["conflicting duplicate AC result", (r) => { r.acceptance.push({ id: "AC-01", status: "fail", evidence: [evidencePath] }); }, /acceptance|duplicate|pass/i],
]) {
  test(`receipt validation rejects ${name}`, async (t) => {
    const root = await fixture(t);
    const { id } = await session(root);
    await seal(root, id);
    await mutateJson(root, receiptPath, mutation);
    await assert.rejects(validateReceipt(root, receiptPath, { sessionId: id, requirement, implementer: "claude" }), error);
  });
}

test("verified artifact changes invalidate previously sealed completion evidence", async (t) => {
  const root = await fixture(t);
  const { id } = await session(root);
  await seal(root, id);
  await put(root, evidencePath, "different test result");
  await assert.rejects(validateReceipt(root, receiptPath, { sessionId: id, requirement }), /artifact changed/);
});

const knowledgeOptions = { title: "Warehouse access convention", body: "Use the selected development profile.", source: evidencePath, confidence: "high", applies_to: "Local development only", kind: "pattern", review_after: "2027-01-15" };

test("knowledge is indexed with source, confidence, applicability, and freshness", async (t) => {
  const root = await fixture(t);
  const { path } = await addKnowledge(root, knowledgeOptions);
  const fields = parseFrontmatter(await readFile(path, "utf8"));
  assert.equal(fields.status, "current");
  assert.equal(fields.source, evidencePath);
  assert.equal(fields.confidence, "high");
  assert.equal(fields.review_after, "2027-01-15");
  assert.equal(fields.applies_to, "Local development only");
  assert.match(await readFile(join(root, "docs/product/knowledge/INDEX.md"), "utf8"), /Warehouse access convention/);
});

test("knowledge requires provenance and rejects missing source files", async (t) => {
  const root = await fixture(t);
  for (const key of ["title", "body", "source", "confidence", "applies_to"]) {
    const options = { ...knowledgeOptions };
    delete options[key];
    await assert.rejects(addKnowledge(root, options), /requires/);
  }
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, source: "missing.md" }), /ENOENT/);
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, confidence: "certain" }), /Confidence/);
});

test("knowledge supersession retains history and marks the prior entry", async (t) => {
  const root = await fixture(t);
  const prior = await addKnowledge(root, knowledgeOptions);
  const supersedes = relative(root, prior.path).replaceAll("\\", "/");
  const current = await addKnowledge(root, { ...knowledgeOptions, title: "New warehouse convention", supersedes });
  const oldFields = parseFrontmatter(await readFile(prior.path, "utf8"));
  assert.equal(oldFields.status, "superseded");
  assert.equal(oldFields.superseded_by, relative(root, current.path).replaceAll("\\", "/"));
  assert.equal(parseFrontmatter(await readFile(current.path, "utf8")).supersedes, supersedes);
});

test("knowledge supersession cannot cross scope", async (t) => {
  const root = await fixture(t);
  await put(root, "docs/harness/knowledge/prior.md", "---\nstatus: current\n---\nProtected harness knowledge.\n");
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, supersedes: "docs/harness/knowledge/prior.md" }), /same scope/);
});

test("knowledge supersession rejects a sibling directory sharing the knowledge prefix", async (t) => {
  const root = await fixture(t);
  const path = "docs/product/knowledge-private/prior.md";
  const before = "---\nstatus: current\n---\nThis is outside the knowledge collection.\n";
  await put(root, path, before);
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, supersedes: path }), /same scope|knowledge/i);
  assert.equal(await readFile(join(root, path), "utf8"), before);
});

test("knowledge review dates must be real calendar dates", async (t) => {
  const root = await fixture(t);
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, review_after: "2026-02-30" }), /date|YYYY-MM-DD/i);
});

test("knowledge rejects unsupported kinds instead of creating ungoverned records", async (t) => {
  const root = await fixture(t);
  await assert.rejects(addKnowledge(root, { ...knowledgeOptions, kind: "always-trust-unverified" }), /kind/i);
});

test("session checkpoints reject or redact recognizable credentials before persistence", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root);
  const token = "dapi" + "1".repeat(32);
  try {
    await checkpointSession(root, { id, summary: `Authentication used ${token}`, next: "Review sanitized evidence" });
  } catch (error) {
    assert.match(error.message, /secret|credential|token|sensitive/i);
  }
  assert.equal((await readFile(path, "utf8")).includes(token), false);
});

test("knowledge rejects or redacts recognizable credentials before persistence", async (t) => {
  const root = await fixture(t);
  const token = "dapi" + "2".repeat(32);
  let result;
  try {
    result = await addKnowledge(root, { ...knowledgeOptions, body: `Use ${token} for authentication.` });
  } catch (error) {
    assert.match(error.message, /secret|credential|token|sensitive/i);
  }
  if (result) assert.equal((await readFile(result.path, "utf8")).includes(token), false);
});

test("session closure rejects or redacts recognizable credentials before persistence", async (t) => {
  const root = await fixture(t);
  const { id, path } = await session(root);
  const token = "dapi" + "3".repeat(32);
  try {
    await closeSession(root, { id, outcome: "blocked", summary: `Waiting for authentication ${token}` });
  } catch (error) {
    assert.match(error.message, /secret|credential|token|sensitive/i);
  }
  assert.equal((await readFile(path, "utf8")).includes(token), false);
});
