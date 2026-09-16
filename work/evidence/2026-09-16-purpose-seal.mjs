import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sealEvidence } from '../../tools/lib/evidence.mjs';
import { checkDelivery } from '../../tools/lib/delivery-assurance.mjs';
const q=JSON.parse(await readFile('work/quality/2026-09-16-purpose-adopted.json'));
const report=await checkDelivery(process.cwd(),q,{phase:'verify'});assert.deepEqual(report.findings,[]);
const copies=['orchestrate-work','define-work','mock-ui','build-work','review-work','release-work'].flatMap(s=>[`.claude/skills/${s}/SKILL.md`,`.github/skills/${s}/SKILL.md`]);
const receipt=await sealEvidence(process.cwd(),{review:'work/reviews/2026-09-16-purpose-adopted.json',session:'20260916-071045-256-purpose-driven-delivery',requirement:q.requirement.path,artifact:[...q.artifacts.map(a=>a.path),...copies,'work/quality/2026-09-16-purpose-adopted.json','work/evidence/2026-09-16-purpose-driven-delivery.md']});
assert.equal(receipt.status,'pass');console.log(JSON.stringify({quality:report,receiptStatus:receipt.status}));
