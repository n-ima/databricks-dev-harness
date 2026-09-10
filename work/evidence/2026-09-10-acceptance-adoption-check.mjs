import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256, parseFrontmatter } from "../../tools/lib/shared.mjs";
import { acceptanceIds } from "../../tools/lib/acceptance.mjs";
import { taskRecords } from "../../tools/lib/tasks.mjs";

// Only the explicitly approved status/link changes may differ from review.
const transitions = {
  "docs/harness/requirements/retrospective-hardening.md": [
    {
      "before": "owner: harness-maintainer",
      "after": "owner: harness-maintainer\nadopted_scope: HIMP-01\nadoption_decision: docs/harness/decisions/ADR-0006-acceptance-integrity-adoption.md"
    },
    {
      "before": "# 振り返りからの安全性・再現性強化",
      "after": "# 振り返りからの安全性・再現性強化\n\n採用状態: HIMP-01のみ2026-09-10にユーザーが正式採用を承認した。[ADR-0006](../decisions/ADR-0006-acceptance-integrity-adoption.md)参照。残り7項目を含む文書全体はdraftのままとし、受入条件本文は変更しない。"
    }
  ],
  "docs/harness/design/RETROSPECTIVE_HARDENING.md": [
    {
      "before": "状態: draft candidate / 2026-09-10。要件: [retrospective-hardening](../requirements/retrospective-hardening.md)。",
      "after": "状態: 第1節のみ正式採用済み、その他はdraft / 2026-09-10。[採用判断](../decisions/ADR-0006-acceptance-integrity-adoption.md)。要件: [retrospective-hardening](../requirements/retrospective-hardening.md)。"
    },
    {
      "before": "## 1. 受入条件の完全性 — 最初の実装候補",
      "after": "## 1. 受入条件の完全性 — 正式採用済み"
    }
  ],
  "docs/harness/operations/ACCEPTANCE_CONTRACT.md": [
    {
      "before": "HIMP-01のローカル改善候補。正式昇格前。要件を承認する前と、レビュー結果をseal・利用するときに共通の検証を行う。",
      "after": "HIMP-01の正式採用済み仕様（2026-09-10、[ADR-0006](../decisions/ADR-0006-acceptance-integrity-adoption.md)）。ローカルハーネスへの採用であり、公開・案件反映は別段階。要件を承認する前と、レビュー結果をseal・利用するときに共通の検証を行う。"
    }
  ]
};
const adoption = JSON.parse(await readFile("work/evidence/2026-09-10-acceptance-adoption.json", "utf8"));
assert.equal(adoption.recordType, "harness-adoption-decision");
assert.equal(adoption.status, "adopted");
assert.deepEqual(adoption.requirementScope, ["HIMP-01"]);
assert.equal(adoption.completionReceipt, false);
assert.equal(adoption.semanticImplementationChangesThisTurn, false);
assert.equal(adoption.authorization.quote, "正式採用してよい");
assert.equal(adoption.reviewedSnapshot.length, 8);
assert.equal(sha256(await readFile(adoption.independentReview.path)), adoption.independentReview.sha256);
for (const entry of adoption.reviewedSnapshot) {
  const bytes = await readFile(entry.path);
  const allowed = transitions[entry.path];
  if (!allowed) {
    assert.equal(sha256(bytes), entry.sha256, "Reviewed implementation/test changed: " + entry.path);
    continue;
  }
  let original = bytes.toString("utf8").replaceAll("\r\n", "\n");
  for (const { before, after } of [...allowed].reverse()) {
    assert.equal(original.split(after).length, 2, "Expected one approved status edit in " + entry.path);
    original = original.replace(after, before);
  }
  assert.ok([sha256(original), sha256(original.replaceAll("\n", "\r\n"))].includes(entry.sha256),
    "Unexpected semantic document changes: " + entry.path);
}
const requirement = await readFile("docs/harness/requirements/retrospective-hardening.md", "utf8");
assert.equal(parseFrontmatter(requirement).status, "draft");
assert.equal(parseFrontmatter(requirement).adopted_scope, "HIMP-01");
assert.deepEqual(acceptanceIds(requirement), Array.from({length: 8}, (_, i) => "HIMP-0" + (i + 1)));
const task = (await taskRecords(process.cwd())).find(item => item.id === "HARD-01");
assert.equal(task.status, "verifying");
assert.equal(task.verifier_evidence, "none");
console.log("PASS: reviewed code/test bytes unchanged (5 files).");
console.log("PASS: only approved status/link annotations differ in 3 reviewed documents.");
console.log("PASS: independent review immutable; HIMP-01 alone adopted.");
console.log("PASS: all 8 acceptance criteria preserved; no forged completion receipt.");
