// Independent read-only snapshot check; stdout is the resulting evidence.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,basisHash,reviewHash} from '../../tools/lib/delivery-assurance.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const bytes=p=>readFile(join(root,p));
const json=async p=>JSON.parse(await bytes(p));
const c=await json('work/quality/2026-09-16-truth-repair.json');
const sources=[];
for(const ref of [c.requirement,...c.artifacts]){
  const sha256=digest(await bytes(ref.path));assert.equal(sha256,ref.sha256,ref.path);
  sources.push({path:ref.path,sha256});
}
for(const path of ['vendor/databricks-skills/databricks-lakebase/SKILL.md','.claude/skills/databricks-lakebase/SKILL.md','.github/skills/databricks-lakebase/SKILL.md','tools/lib/ui-contract.mjs','tools/lib/scoped-approval.mjs'])sources.push({path,sha256:digest(await bytes(path))});
const executions=[];
for(const t of c.testCases){
  assert.equal(t.result.status,'pass',t.id);assert.equal(t.result.basisSha256,basisHash(c),t.id);
  for(const e of t.result.evidence)assert.equal(digest(await bytes(e.path)),e.sha256,e.path);
  executions.push({id:t.id,status:t.result.status,evidence:t.result.evidence});
}
const preserve=await json('work/evidence/2026-09-16-truth-preservation.json');
for(const p of preserve.preserved)assert.equal(digest(await bytes(p.path)),p.expected,p.path);
const releases=[];
for(const r of preserve.releases){
  const base='.harness/releases/'+r.version,raw=await bytes(base+'/manifest.json'),manifest=JSON.parse(raw);
  const expected=r.version==='0.6.1'?'d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d':(await json('work/evidence/2026-09-15-publication-061-assembly.json')).oldManifests[r.version];
  assert.equal(digest(raw),expected,r.version);
  for(const f of manifest.managedFiles)assert.equal(digest(await bytes(base+'/files/'+f.path)),f.sha256,f.path);
  releases.push({version:r.version,manifestSha256:expected,payloadCount:manifest.managedFiles.length});
}
const report={at:new Date().toISOString(),reviewer:'/root/truth_repair_final_review',environment:process.platform+' / '+process.version,basisSha256:basisHash(c),reviewedSha256:reviewHash(c),sources,executions,preservedCount:preserve.preserved.length,mixedReviewed:preserve.mixedReviewRequired.map(x=>x.path),releases,findings:[]};
report.sourceSnapshotSha256=digest(Buffer.from(JSON.stringify(sources)));
console.log(JSON.stringify(report,null,2));
