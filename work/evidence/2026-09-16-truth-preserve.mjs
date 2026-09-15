// Read-only source/release preservation verification. Writes only its result record.
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../../tools/lib/delivery-assurance.mjs';
import {writeJson} from '../../tools/lib/shared.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const bytes=p=>readFile(join(root,p));
const json=async p=>JSON.parse(await bytes(p));
const baseline=await json('work/evidence/2026-09-16-truth-repair-baseline.json');
const mixed=new Set(['tools/harness.mjs','tools/lib/distribution.mjs','tools/lib/loop.mjs','tools/lib/scaffold.mjs','docs/harness/operations/CLI_REFERENCE.md','vendor/databricks-skills/databricks-lakebase/SKILL.md']);
const report={at:new Date().toISOString(),preserved:[],mixedReviewRequired:[],releases:[],providerCopies:[],findings:[]};
for(const [path,expected] of Object.entries(baseline.files)){
 const current=digest(await bytes(path));
 if(mixed.has(path)){report.mixedReviewRequired.push({path,prior:expected,current});continue;}
 const match=current===expected;report.preserved.push({path,expected,current,match});if(!match)report.findings.push('unexpected modification: '+path);
}
const previous=await json('work/evidence/2026-09-15-publication-061-assembly.json');
for(const [version,expected] of Object.entries({...previous.oldManifests,'0.6.1':'d9c637a2c5a25182b58ce67c71792ccf02b1920ec22cc37f70afb209d71d726d'})){
 const path='.harness/releases/'+version,raw=await bytes(path+'/manifest.json'),manifest=JSON.parse(raw);let mismatches=0;
 for(const f of manifest.managedFiles)if(digest(await bytes(path+'/files/'+f.path))!==f.sha256)mismatches++;
 const match=digest(raw)===expected;report.releases.push({version,manifestMatches:match,fileCount:manifest.managedFiles.length,mismatches});
 if(!match||mismatches)report.findings.push('release changed: '+version);
}
const canonical=await bytes('vendor/databricks-skills/databricks-lakebase/SKILL.md');
for(const provider of ['.claude','.github']){
 const path=provider+'/skills/databricks-lakebase/SKILL.md',match=canonical.equals(await bytes(path));
 report.providerCopies.push({path,sha256:digest(await bytes(path)),match});if(!match)report.findings.push('provider copy changed: '+path);
}
const patch=await json('harness/vendor-patches.json');let upstream=canonical.toString('utf8');
for(const edit of [...patch.files[0].edits].reverse())upstream=upstream.replace(edit.after,edit.before);
report.upstreamOriginalMatches=digest(Buffer.from(upstream))===baseline.files['vendor/databricks-skills/databricks-lakebase/SKILL.md'];
if(!report.upstreamOriginalMatches)report.findings.push('upstream reconstruction mismatch');
await writeJson(join(root,'work/evidence/2026-09-16-truth-preservation.json'),report);
console.log(JSON.stringify(report,null,2));process.exitCode=report.findings.length?1:0;
