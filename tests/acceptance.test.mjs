import test from "node:test";
import assert from "node:assert/strict";
import fsp, { mkdtemp, rm, readFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { acceptanceIds, sealEvidence, validateReceipt } from "../tools/lib/evidence.mjs";
import { createApproval } from "../tools/lib/approval.mjs";
import { createIntake, answerIntake, approveIntake } from "../tools/lib/intake.mjs";
import { closeSession } from "../tools/lib/memory.mjs";
import { atomicWrite, writeJson, readJson, exists, parseFrontmatter } from "../tools/lib/shared.mjs";
import { installWorkloadCatalog } from "./helpers/workloads.mjs";

const requirement = "docs/product/requirements/fixture.md";
const review = "work/reviews/fixture.json";
const output = "work/reviews/fixture.receipt.json";
const evidence = "work/evidence/fixture.md";
const req = body => "---\nstatus: accepted\n---\n# Fixture\n\n" + body;
async function fixture(t, body = "- AC-01: outcome.\n- AC-D01: denied access.\n") {
  t.mock.method(console, "log", () => {});
  const base = resolve(tmpdir()), root = await mkdtemp(join(base, "harness-acceptance-"));
  t.after(async () => {
    assert.ok(root.startsWith(base + sep));
    assert.match(root.slice(base.length + 1), /^harness-acceptance-/);
    await rm(root, { recursive: true, force: true });
  });
  await atomicWrite(join(root, "AGENTS.md"), "# Fixture policy\n");
  await atomicWrite(join(root, "tools/agent-hook.mjs"), "// Fixture policy\n");
  await writeJson(join(root, "harness.config.json"), { humanGates: ["product-intent"], loop: { maxIterations: 3 } });
  await atomicWrite(join(root, requirement), req(body));
  await atomicWrite(join(root, evidence), "Synthetic evidence, no live operation.\n");
  await atomicWrite(join(root, "work/sessions/S.md"), "---\nid: S\nstatus: active\nprovider: claude\ngate: none\ngate_status: not-applicable\nrequirement: " + requirement + "\n---\n");
  return root;
}
const sealOptions = { session: "S", requirement, review, output };
async function putReview(root, ids) {
  await writeJson(join(root, review), { reviewer: "independent-fixture", provider: "copilot", independent: true,
    acceptance: ids.map(id => ({ id, status: "pass", evidence: [evidence] })) });
}

test("acceptance grammar preserves legacy IDs and recognizes namespaced IDs and checkboxes", () => {
  assert.deepEqual(acceptanceIds(req("- H-01: legacy.\n* [X] AC-D01: scoped.\n+ [ ] AC-DATA-02: nested.\n")), ["H-01", "AC-D01", "AC-DATA-02"]);
  assert.deepEqual(acceptanceIds("## 受入条件\r\n\r\n- AC-D01: 日本語。\r\n"), ["AC-D01"]);
});
test("acceptance examples in fenced blocks are not live criteria", () => {
  assert.deepEqual(acceptanceIds("~~~md\n## Acceptance criteria\n- EX-01: example.\n~~~\n## Acceptance criteria\n- AC-01: real.\n"), ["AC-01"]);
});
test("frontmatter and comments are inert, and setext/ATX section boundaries are explicit", () => {
  const body = "---\nstatus: accepted\nexample: |\n  - AC-99: metadata.\n---\n<!--\n- AC-99: hidden.\n-->\nAcceptance criteria\n-------------------\n- AC-D01: real.\n### Detail\n- AC-D02: also real.\n## Notes\n- ordinary explanation.\n";
  assert.deepEqual(acceptanceIds(body), ["AC-D01", "AC-D02"]);
  assert.throws(() => acceptanceIds(body + "- AC-D03: outside.\n"), /Invalid acceptance location/);
});
for (const tail of [
  "- ac-02: lowercase.\n", "1. AC-D01: ordered.\n", "| AC-D01 | table |\n",
  "- **AC-D01**: formatted.\n", "- AC-D01：fullwidth colon.\n",
  "    - AC-D01: indented.\n", "> - AC-D01: quoted.\n",
  "- [✓] AC-D01: unsupported checkbox.\n", "- AC\u200b-02: hidden character.\n",
  "- ＡＣ-０２: non-ASCII.\n", "  - AC-D01: nested.\n",
  "### AC-D01: heading.\n", "<div>\n- AC-D01: HTML.\n</div>\n",
  "# H-D01 must be verified\n", "# **AC-D01** must be verified\n",
  "• AC-D01: Unicode bullet requirement\n", "\u200b• AC-D01: hidden prefix\n",
]) {
  test("legacy headingless mode rejects ambiguous definition " + JSON.stringify(tail), () => {
    assert.throws(() => acceptanceIds("- AC-01: real.\n" + tail), /Invalid acceptance/);
  });
}
test("malformed metadata, comments and example fences are rejected, not used to hide criteria", () => {
  for (const body of ["---\nstatus: accepted\n- AC-01: hidden.", "- AC-01: real.\n<!--", "- AC-01: real.\n\x60\x60\x60md\x60\n- AC-02: hidden.\n\x60\x60\x60\n"]) {
    assert.throws(() => acceptanceIds(body), /(?:Invalid|Unclosed) acceptance/);
  }
});
const invalidBodies = [
  ["empty", "## Acceptance criteria\n\n", /No acceptance criteria/],
  ["invalid ID", "- AC-01: valid.\n- AC-Dx: invalid.\n", /Invalid acceptance.*line 7/i],
  ["duplicate", "- AC-01: first.\n- AC-01: second.\n", /Duplicate acceptance.*AC-01/],
  ["empty body", "- AC-01: \n", /Empty acceptance.*AC-01/],
  ["lowercase", "- AC-01: valid.\n- ac-02: invalid.\n", /Invalid acceptance/],
  ["missing colon", "## Acceptance criteria\n- AC-01: valid.\n- AC-D01 missing colon.\n", /Invalid acceptance/],
  ["numbered", "## Acceptance criteria\n- AC-01: valid.\n1. AC-D01: unrecognized format.\n", /Invalid acceptance/],
  ["table", "## Acceptance criteria\n- AC-01: valid.\n| AC-D01 | outcome |\n", /Invalid acceptance/],
  ["formatted", "## Acceptance criteria\n- AC-01: valid.\n- **AC-D01**: formatted.\n", /Invalid acceptance/],
  ["plain bullet", "## Acceptance criteria\n- AC-01: valid.\n- Users can save data.\n", /Invalid acceptance/],
  ["unclosed fence", "- AC-01: valid.\n~~~\n- AC-D01: hidden.\n", /Unclosed.*fence/],
];
for (const [name, body, error] of invalidBodies) {
  test("acceptance rejects " + name + " rather than silently dropping criteria", () => assert.throws(() => acceptanceIds(req(body)), error));
}

test("AC-D01 survives seal, validate, and session completion with full independent fixture evidence", async t => {
  const root = await fixture(t);
  await putReview(root, ["AC-01", "AC-D01"]);
  const receipt = await sealEvidence(root, sealOptions);
  assert.deepEqual(receipt.acceptance.map(x => x.id), ["AC-01", "AC-D01"]);
  await validateReceipt(root, output, { sessionId: "S", requirement, implementer: "claude" });
  await closeSession(root, { id: "S", outcome: "completed", summary: "Fixture only.", verifier_evidence: output });
  assert.equal(parseFrontmatter(await readFile(join(root, "work/sessions/S.md"), "utf8")).status, "completed");
});
for (const [name, ids, error] of [
  ["mixed omitted", ["AC-01"], /Missing acceptance.*AC-D01/],
  ["extra", ["AC-01", "AC-D01", "AC-99"], /Unexpected acceptance.*AC-99/],
  ["invalid", ["AC-01", "ac-d01"], /Invalid acceptance/],
  ["duplicate review", ["AC-01", "AC-D01", "AC-D01"], /Duplicate acceptance/],
]) {
  test("seal rejects " + name + " without writing a receipt or changing session", async t => {
    const root = await fixture(t), before = await readFile(join(root, "work/sessions/S.md"));
    await putReview(root, ids);
    await assert.rejects(sealEvidence(root, sealOptions), error);
    assert.equal(await exists(join(root, output)), false);
    assert.deepEqual(await readFile(join(root, "work/sessions/S.md")), before);
  });
}
test("duplicate requirement definitions cannot be sealed", async t => {
  const root = await fixture(t, "- AC-01: first.\n- AC-01: second.\n");
  await putReview(root, ["AC-01"]);
  await assert.rejects(sealEvidence(root, sealOptions), /Duplicate acceptance/);
  assert.equal(await exists(join(root, output)), false);
});
test("receipt use revalidates exact coverage and refuses completing a forged incomplete receipt", async t => {
  const root = await fixture(t);
  await putReview(root, ["AC-01", "AC-D01"]);
  await sealEvidence(root, sealOptions);
  const receipt = await readJson(join(root, output));
  receipt.acceptance = receipt.acceptance.filter(x => x.id === "AC-01");
  await writeJson(join(root, output), receipt);
  await assert.rejects(closeSession(root, { id: "S", outcome: "completed", summary: "Must fail.", verifier_evidence: output }), /Missing acceptance.*AC-D01/);
  assert.equal(parseFrontmatter(await readFile(join(root, "work/sessions/S.md"), "utf8")).status, "active");
});
test("existing requirement approval rejects invalid definitions before any record changes", async t => {
  const root = await fixture(t, "- AC-01: valid.\n- AC-Dx: invalid.\n");
  const before = await readFile(join(root, "work/sessions/S.md"));
  await assert.rejects(createApproval(root, { session: "S", gate: "product-intent", actor: "fixture-owner", evidence }), /Invalid acceptance/);
  assert.equal(await exists(join(root, "work/approvals/S/product-intent.json")), false);
  assert.deepEqual(await readFile(join(root, "work/sessions/S.md")), before);
});
test("intake generation uses valid IDs and approval rejects malformed edited requirements before mutation", async t => {
  const root = await fixture(t);
  await installWorkloadCatalog(root);
  const intake = await createIntake(root, { title: "Safe intake", summary: "Analyze fixture data", name: "safe-intake" });
  const rp = intake.artifacts.requirementPath;
  assert.deepEqual(acceptanceIds(await readFile(join(root, rp), "utf8")), ["AC-01", "AC-02"]);
  for (const q of intake.questions.filter(x => x.material)) {
    await answerIntake(root, { id: intake.id, question: q.id, answer: "Fixture only, no live access.", actor: "fixture-owner" });
  }
  await atomicWrite(join(root, rp), (await readFile(join(root, rp), "utf8")).replace("- AC-02:", "- AC-Dx:"));
  const paths = [...Object.values(intake.artifacts), "docs/product/intake/" + intake.id + "/intake.json"];
  const before = await Promise.all(paths.map(p => readFile(join(root, p))));
  await assert.rejects(approveIntake(root, { id: intake.id, actor: "fixture-owner", evidence: "Fixture approval request." }), /Invalid acceptance/);
  for (let i = 0; i < paths.length; i++) assert.deepEqual(await readFile(join(root, paths[i])), before[i]);
  assert.equal(await exists(join(root, "work/approvals/" + intake.sessionId + "/product-intent.json")), false);
});
test("intake validates its final rendered answer ledger before changing any artifact or existing approval", async t => {
  const root = await fixture(t);
  await installWorkloadCatalog(root);
  const intake = await createIntake(root, { title: "Final render", summary: "Analyze fixture data", name: "final-render" });
  for (const q of intake.questions.filter(x => x.material)) {
    await answerIntake(root, { id: intake.id, question: q.id, answer: "- AC-01: another unreviewed outcome.", actor: "fixture-owner" });
  }
  const rp = intake.artifacts.requirementPath;
  const document = await readFile(join(root, rp), "utf8");
  await atomicWrite(join(root, rp), document.replace(/<!-- intake-answers:start -->[\s\S]*?<!-- intake-answers:end -->/, "<!-- intake-answers:start -->\n## Refined answers\nSafe manually edited text.\n<!-- intake-answers:end -->"));
  assert.deepEqual(acceptanceIds(await readFile(join(root, rp), "utf8")), ["AC-01", "AC-02"]);
  const approvalPath = "work/approvals/" + intake.sessionId + "/product-intent.json";
  await writeJson(join(root, approvalPath), { decision: "revoked", fixture: true });
  const paths = [...Object.values(intake.artifacts), "docs/product/intake/" + intake.id + "/intake.json", approvalPath];
  const before = await Promise.all(paths.map(p => readFile(join(root, p))));
  await assert.rejects(approveIntake(root, { id: intake.id, actor: "fixture-owner", evidence: "Fixture request." }), /Invalid acceptance location/);
  for (let i = 0; i < paths.length; i++) assert.deepEqual(await readFile(join(root, paths[i])), before[i]);
});

// Reproductions of IR-02/03: mutate real temporary files at an I/O boundary.
// Based on the independent review probes; never replace returned file contents.
async function interceptedRead(action, intercept) {
  const originalRead = fsp.readFile;
  fsp.readFile = async (...args) => { await intercept(args[0]); return originalRead(...args); };
  syncBuiltinESMExports();
  try { return await action(); }
  finally { fsp.readFile = originalRead; syncBuiltinESMExports(); }
}
for (const change of ["requirement contents", "session requirement pointer"]) {
  test("product approval rejects concurrent " + change + " without approving", async t => {
    const root = await fixture(t), sessionPath = join(root, "work/sessions/S.md");
    const alternate = "docs/product/requirements/alternate.md";
    const invalid = req("- AC-01: first.\n- AC-01: duplicated.\n");
    await atomicWrite(join(root, alternate), invalid);
    let changed = false, expectedSession = await readFile(sessionPath);
    await interceptedRead(async () => {
      await assert.rejects(createApproval(root, { session: "S", gate: "product-intent", actor: "fixture-owner", evidence }), /requirement.*changed/i);
    }, async path => {
      if (!changed && resolve(String(path)) === resolve(root, evidence)) {
        changed = true;
        if (change === "requirement contents") await atomicWrite(join(root, requirement), invalid);
        else {
          expectedSession = Buffer.from(expectedSession.toString("utf8").replace(requirement, alternate));
          await atomicWrite(sessionPath, expectedSession.toString("utf8"));
        }
      }
    });
    assert.equal(changed, true);
    assert.equal(await exists(join(root, "work/approvals/S/product-intent.json")), false);
    assert.deepEqual(await readFile(sessionPath), expectedSession);
  });
}
for (const changedPath of [requirement, review]) {
  test("seal rejects changed validated input " + changedPath, async t => {
    const root = await fixture(t);
    await putReview(root, ["AC-01", "AC-D01"]);
    let reads = 0, changed = false;
    await interceptedRead(async () => {
      await assert.rejects(sealEvidence(root, sealOptions), /(?:Verified input|Evidence input).*changed/i);
    }, async path => {
      if (resolve(String(path)) === resolve(root, changedPath) && ++reads === 2) {
        changed = true;
        if (changedPath === requirement) await atomicWrite(join(root, requirement), req("- AC-01: changed after parsing.\n"));
        else await putReview(root, ["AC-01"]);
      }
    });
    assert.equal(changed, true);
    assert.equal(await exists(join(root, output)), false);
  });
}
test("receipt coverage is parsed from the same bytes as its validated requirement hash", async t => {
  const root = await fixture(t);
  await putReview(root, ["AC-01", "AC-D01"]);
  await sealEvidence(root, sealOptions);
  const receipt = await readJson(join(root, output));
  receipt.acceptance = receipt.acceptance.filter(x => x.id === "AC-01");
  await writeJson(join(root, output), receipt);
  let reads = 0;
  await interceptedRead(async () => {
    await assert.rejects(closeSession(root, { id: "S", outcome: "completed", summary: "Must fail.", verifier_evidence: output }), /Missing acceptance.*AC-D01|Verified artifact changed/);
  }, async path => {
    if (resolve(String(path)) === resolve(root, requirement) && ++reads === 2) {
      await atomicWrite(join(root, requirement), req("- AC-01: swapped after hashing.\n"));
    }
  });
  assert.ok(reads >= 1, "The requirement must actually be read");
  assert.equal(parseFrontmatter(await readFile(join(root, "work/sessions/S.md"), "utf8")).status, "active");
});
