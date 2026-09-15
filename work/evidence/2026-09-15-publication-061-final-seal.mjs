// Re-seal unchanged independent reviews against the isolated publication policy.
import assert from 'node:assert/strict';
import { readFile, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve('D:/projects/databricks-dev-harness');
const snapshot = join(root, '.harness/runtime/publish-0.6.1-final');
const { sealEvidence, validateReceipt } = await import(pathToFileURL(join(snapshot, 'tools/lib/evidence.mjs')));
const results = [];
for (const [kind, session, requirement] of [
  ['pub', '20260915-013942-357-publish-safe-update-0-6-0', 'docs/harness/requirements/2026-09-15-safe-update-publication.md'],
  ['preflight', '20260915-022729-254-publish-receipt-correction-0-6-1', 'docs/harness/requirements/2026-09-15-publication-receipt-correction.md'],
]) {
  const review = `work/reviews/2026-09-15-publication-061-${kind}-acceptance.json`;
  const output = `work/reviews/2026-09-15-publication-061-${kind}.receipt.json`;
  const archived = output.replace('.receipt.json', '-root-context.receipt.json');
  await copyFile(join(root, output), join(root, archived));
  const previous = JSON.parse(await readFile(join(root, archived), 'utf8'));
  const document = JSON.parse(await readFile(join(root, review), 'utf8'));
  const evidence = new Set([review, ...document.acceptance.flatMap(item => item.evidence)]);
  for (const path of evidence) {
    assert.ok(path.startsWith('work/') && !path.includes('..'));
    await mkdir(dirname(join(snapshot, path)), { recursive: true });
    await copyFile(join(root, path), join(snapshot, path));
  }
  assert.deepEqual(await readFile(join(root, requirement)), await readFile(join(snapshot, requirement)));
  assert.deepEqual(await readFile(join(root, 'harness/base-release.json')), await readFile(join(snapshot, 'harness/base-release.json')));
  const receipt = await sealEvidence(snapshot, { review, session, requirement, output,
    ...(kind === 'preflight' ? { artifact: ['harness/base-release.json', 'tests/contracts.test.mjs'] } : {}) });
  if (kind === 'pub') {
    assert.equal(receipt.status, 'pass');
    await validateReceipt(snapshot, output, { sessionId: session, requirement });
  } else {
    assert.equal(receipt.status, 'fail');
    await assert.rejects(validateReceipt(snapshot, output), /Passing independent-verification receipt/);
  }
  await copyFile(join(snapshot, output), join(root, output));
  results.push({ kind, review, output, status: receipt.status, previousPolicyHash: previous.policyHash,
    finalPolicyHash: receipt.policyHash, completionRejected: kind === 'preflight' });
}
const report = { at: new Date().toISOString(), status: 'pass', snapshot, results,
  note: '独立レビュー本文は不変。最初のreceiptは未採用変更を含むroot policyで発行されたため履歴として保存し、公開対象だけのsnapshotで再発行・検証。旧PUBは完了可能、未公開FIXは引き続き完了拒否。実案件とDatabricksへの変更なし。' };
const reportPath = 'work/evidence/2026-09-15-publication-061-final-preflight.json';
await writeFile(join(root, reportPath), JSON.stringify(report, null, 2) + '\n');
await copyFile(join(root, reportPath), join(snapshot, reportPath));
console.log(JSON.stringify(report, null, 2));
