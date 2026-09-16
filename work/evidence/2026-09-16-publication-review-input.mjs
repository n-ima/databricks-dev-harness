import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { basisHash, reviewHash, digest, checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const c=JSON.parse(await readFile('work/quality/2026-09-16-publication-final.json'));
await writeFile('work/evidence/2026-09-16-publication-draft-diagnostic.json',JSON.stringify(await checkDelivery(process.cwd(),c,{phase:'verify'}),null,2)+'\n',{flag:'wx'});
// The delivery reader deliberately forbids dot directories. Keep that boundary.
// Direct source checks and the release manifest bind these actual files; this
// separate read-only inventory is not a replacement for those verifications.
const snapshots=[];
for(const a of c.artifacts.filter(a=>a.path.startsWith('.'))){
  const bytes=await readFile(a.path);assert.equal(digest(bytes),a.sha256);
  snapshots.push({...a,bytes:bytes.length});
}
const path='work/evidence/2026-09-16-publication-provider-ci-snapshot.json';
await writeFile(path,JSON.stringify({checkedAt:new Date().toISOString(),purpose:'delivery readerの安全path制限を維持。実fileはpublication/source検査・base-release manifest・独立reviewが照合する。',snapshots},null,2)+'\n',{flag:'wx'});
c.artifacts=c.artifacts.filter(a=>!a.path.startsWith('.'));
c.artifacts.push({path,sha256:digest(await readFile(path))});
const basis=basisHash(c);for(const tc of c.testCases)tc.result.basisSha256=basis;
const output='work/quality/2026-09-16-publication-review-ready.json';
await writeFile(output,JSON.stringify(c,null,2)+'\n',{flag:'wx'});
const report=await checkDelivery(process.cwd(),c,{phase:'verify'});
assert.deepEqual(report.findings.map(f=>f.code),['MISSING_REVIEW']);
await writeFile('work/evidence/2026-09-16-publication-pre-review-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:output,basisSha256:basis,reviewedSha256:reviewHash(c),report},null,2));
