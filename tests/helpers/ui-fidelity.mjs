// Synthetic correspondence records only: not real AppKit execution or human approval.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, writeJson, sha256 } from '../../tools/lib/shared.mjs';
import { uiReviewHash } from '../../tools/lib/ui-contract.mjs';

export async function uiFixture(root, { sessionId='session', appRoot='apps/demo', requirement='docs/product/requirements/demo.md', architecture='docs/product/architecture/demo.md', createSession=true }={}) {
  if(createSession) await atomicWrite(join(root,`work/sessions/${sessionId}.md`),`---\nid: ${sessionId}\nstatus: active\ngate: ui-mock\ngate_status: pending\nrequirement: ${requirement}\narchitecture: ${architecture}\n---\nSynthetic session\n`);
  await atomicWrite(join(root,requirement),'---\nstatus: accepted\n---\n- AC-01: synthetic UI contract test\n');
  await atomicWrite(join(root,architecture),'# Synthetic Apps UI design\n');
  const dependencies={'@databricks/appkit':'0.69.1','@databricks/appkit-ui':'0.69.1'};
  await writeJson(join(root,appRoot,'package.json'),{dependencies});
  await writeJson(join(root,appRoot,'package-lock.json'),{lockfileVersion:3,packages:{'':{dependencies},'node_modules/@databricks/appkit':{version:'0.69.1'},'node_modules/@databricks/appkit-ui':{version:'0.69.1'}}});
  await atomicWrite(join(root,appRoot,'mock.tsx'),'// synthetic runtime source; not a compiled AppKit app\nexport const fixture = "synthetic";\n');
  await atomicWrite(join(root,appRoot,'style.css'),':root {color: blue;}\n');
  await writeJson(join(root,appRoot,'fixtures.json'),{products:[]});
  await atomicWrite(join(root,'work/evidence/ui-render.md'),'Synthetic render and keyboard evidence for validator tests; no browser was run.\n');
  await atomicWrite(join(root,'work/evidence/ui-review.md'),'Synthetic independent review, not a real reviewer decision.\n');
  const ref=async path=>({path,sha256:sha256(await readFile(join(root,path)))});
  const source=await ref(appRoot+'/mock.tsx');
  const c={schemaVersion:1,sessionId,producer:{actor:'synthetic-author',context:'synthetic-author-context'},requirement:await ref(requirement),architecture:await ref(architecture),
    target:{hosting:'databricks-apps',framework:'databricks-appkit',appRoot,exception:null},
    runtime:{version:'0.69.1',manifest:await ref(appRoot+'/package.json'),lockfile:await ref(appRoot+'/package-lock.json'),sources:[source],styles:[await ref(appRoot+'/style.css')],fixtures:[await ref(appRoot+'/fixtures.json')]},
    screens:[{id:'UI-01',source,components:['AppKit Button'],states:['normal'],previews:[{state:'normal',mode:'runtime',source,runtimeSha256:source.sha256,evidence:[await ref('work/evidence/ui-render.md')]}],behavior:[{state:'normal',evidence:[await ref('work/evidence/ui-render.md')]}]}],
    unresolved:[],review:{actor:'synthetic-reviewer',context:'synthetic-fresh-context',status:'pass',reviewedSha256:'',screens:['UI-01'],evidence:[await ref('work/evidence/ui-review.md')]}};
  const path='docs/product/ui/demo.json';
  const save=async (updateReview=true)=>{if(updateReview)c.review.reviewedSha256=uiReviewHash(c);await writeJson(join(root,path),c);};
  await save();return {c,path,save,ref};
}
