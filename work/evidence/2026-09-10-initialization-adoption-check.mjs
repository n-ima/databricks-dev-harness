import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const adoption = JSON.parse(await readFile("work/evidence/2026-09-10-initialization-adoption.json", "utf8"));
assert.equal(adoption.status, "adopted");
assert.deepEqual(adoption.requirementScope, ["HIMP-08"]);
assert.equal(adoption.completionReceipt, false);
assert.equal(adoption.executionApproval, false);
assert.equal(adoption.semanticImplementationChangesThisTurn, false);
assert.deepEqual(adoption.approvedDocumentAnnotations, []);
const review = await readFile(adoption.independentReview.path);
assert.equal(hash(review), adoption.independentReview.sha256, "Independent final review changed");
const rows = [...review.toString("utf8").matchAll(/^\| ([^|]+) \| ([a-f0-9]{64}) \|$/gm)];
assert.equal(rows.length, adoption.independentReview.snapshotEntryCount);
for (const [, path, expected] of rows) {
  assert.equal(hash(await readFile(path)), expected, "Reviewed bytes changed: " + path);
}
console.log("PASS: immutable independent review and all 26 snapshot entries match byte-for-byte.");

const deployment = JSON.parse(await readFile("work/evidence/2026-09-10-deployment-adoption.json", "utf8"));
assert.equal(hash(await readFile(deployment.independentReview.path)), deployment.independentReview.sha256);
for (const entry of deployment.reviewedSnapshot) {
  let bytes = await readFile(entry.path);
  const edits = deployment.approvedDocumentAnnotations.filter(item => item.path === entry.path);
  if (edits.length) {
    let original = bytes.toString("utf8");
    for (const edit of [...edits].reverse()) {
      assert.equal(original.split(edit.after).length, 2, "Expected exact approved annotation: " + entry.path);
      original = original.replace(edit.after, edit.before);
    }
    bytes = Buffer.from(original, "utf8");
  }
  assert.equal(hash(bytes), entry.sha256, "Previous adoption drift: " + entry.path);
}
console.log("PASS: prior simulation review and 11 snapshots preserved, allowing only its recorded annotations.");
console.log("BOUNDARY: local adoption check; not a live execution approval, provider evaluation or completion receipt.");
