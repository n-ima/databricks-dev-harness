import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDelivery, basisHash, reviewHash, digest, CONCERNS, OPERATIONS } from './check.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'delivery-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = { 'docs/requirement.md': '# Requirement\n\n## Acceptance criteria\n\n- AC-01: Writes are authorized and atomic.\n',
    'docs/api.json': '{"openapi":"3.1.0","paths":{"/api/orders":{"post":{"operationId":"createOrder","responses":{"201":{"description":"Created"},"403":{"description":"Denied"}}}}}}', 'src/api.mjs': '// fixture, not a backend',
    'tests/api.test.mjs': '// fixture, not actual test evidence', 'work/evidence.md': 'Synthetic fixture only; no live checks.',
    'docs/runbook.md': 'Synthetic owner / recovery / retention / budget procedure.' };
  for (const [path, body] of Object.entries(files)) { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), body); }
  const ref = path => ({ path, sha256: digest(files[path]) });
  const c = { schemaVersion: 1, producer: { actor: 'builder', context: 'build-context' },
    requirement: ref('docs/requirement.md'), artifacts: [ref('src/api.mjs'), ref('tests/api.test.mjs')],
    requirements: ['AC-01'], risks: [{ id: 'R-01', description: 'Unauthorized writes', testIds: ['TC-02'] }],
    interfaces: [{ id: 'API-01', kind: 'http', contract: ref('docs/api.json'),
      operations: [{ id: 'createOrder', positive: ['TC-01'], negative: ['TC-02'] }],
      concerns: CONCERNS.map(id => ({ id, status: 'applicable', reason: 'Exercise the documented contract', testIds: ['TC-02'] })) }],
    testCases: ['TC-01','TC-02'].map((id,i) => ({ id, requirements: ['AC-01'], level: 'contract', environment: 'dev',
      preconditions: 'Isolated synthetic service', steps: [i ? 'Submit unauthorized request' : 'Submit permitted request'],
      expected: i ? '403 and unchanged DB' : '201 and exactly one record', result: null })),
    operations: OPERATIONS.map(id => ({ id, status: 'applicable', reason: 'Risk-scoped runbook', document: ref('docs/runbook.md'), testIds: ['TC-02'] })),
    reviews: [] };
  function seal() {
    const basis = basisHash(c);
    for (const tc of c.testCases) tc.result = { status: 'pass', environment: tc.environment, basisSha256: basis, evidence: [ref('work/evidence.md')], command: 'synthetic fixture, no actual dev execution', versions: 'synthetic v1' };
    c.reviews = [{ actor: 'reviewer', context: 'fresh-context', independent: true, status: 'pass',
      reviewedSha256: reviewHash(c), coverage: { requirements: ['AC-01'], risks: ['R-01'], interfaces: ['API-01'], operations: [...OPERATIONS] },
      evidence: [ref('work/evidence.md')] }];
  }
  seal(); return { root, c, seal };
}
const codes = report => report.findings.map(f => f.code);
test('valid synthetic records have no diagnostics but never certify acceptance', async t => {
  const {root,c} = await fixture(t); const report = await checkDelivery(root,c,{phase:'verify'});
  assert.deepEqual(report.findings, []); assert.equal(report.certifiesAcceptance, false); assert.equal(report.mode, 'advisory');
});
test('design supports not-run results without calling them executed', async t => {
  const {root,c} = await fixture(t); c.testCases.forEach(tc => tc.result=null); c.reviews=[];
  const report=await checkDelivery(root,c,{phase:'design'}); assert.deepEqual(report.findings,[]);
  assert.equal(report.executed,0); assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('TEST_NOT_PASSED'));
});
const mutations = [
  ['missing requirement mapping', c=>c.requirements.push('AC-02'),'REQUIREMENT_MISMATCH'],
  ['duplicate test', c=>c.testCases.push(structuredClone(c.testCases[0])),'DUPLICATE_ID'],
  ['unknown reference', c=>c.risks[0].testIds=['TC-404'],'UNKNOWN_REFERENCE'],
  ['missing expected result', c=>c.testCases[0].expected='','INVALID_SHAPE'],
  ['uncovered requirement', c=>c.testCases.forEach(tc=>tc.requirements=[]),'UNCOVERED_REQUIREMENT'],
  ['uncovered risk', c=>c.risks[0].testIds=[],'UNCOVERED_RISK'],
  ['missing API negative case', c=>c.interfaces[0].operations[0].negative=[],'UNCOVERED_OPERATION'],
  ['source API operation omitted', c=>c.interfaces[0].operations[0].id='otherOperation','INTERFACE_MISMATCH'],
  ['missing API concern', c=>c.interfaces[0].concerns.pop(),'CONCERN_MISMATCH'],
  ['unjustified N/A', c=>Object.assign(c.interfaces[0].concerns[0],{status:'not-applicable',reason:''}),'INVALID_SHAPE'],
  ['missing operations', c=>c.operations.pop(),'OPERATIONS_MISMATCH'],
  ['unexecuted', c=>c.testCases[0].result.status='not-run','TEST_NOT_PASSED'],
  ['local cannot prove dev', c=>c.testCases[0].result.environment='local','ENVIRONMENT_MISMATCH'],
  ['stale execution', c=>c.testCases[0].steps.push('New behavior'),'STALE_RESULT'],
  ['missing evidence', c=>c.testCases[0].result.evidence=[],'MISSING_EVIDENCE'],
  ['same context', c=>c.reviews[0].context=c.producer.context,'REVIEW_NOT_INDEPENDENT'],
  ['same actor', c=>c.reviews[0].actor=c.producer.actor,'REVIEW_NOT_INDEPENDENT'],
  ['review misses risk', c=>c.reviews[0].coverage.risks=[],'REVIEW_COVERAGE'],
  ['review before new results', c=>c.testCases[0].result.status='fail','STALE_REVIEW'],
  ['unsupported schema', c=>c.schemaVersion=2,'INVALID_SHAPE'],
  ['unknown top-level typo', c=>c.testCase=[],'INVALID_SHAPE'],
];
for(const [name,mutate,code] of mutations) test(name,async t=>{const {root,c}=await fixture(t); mutate(c); assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes(code),code);});
test('stale file is detected without modifying it',async t=>{const {root,c}=await fixture(t); await writeFile(join(root,'src/api.mjs'),'changed'); const before=await readFile(join(root,'src/api.mjs')); assert.ok(codes(await checkDelivery(root,c)).includes('ARTIFACT_MISMATCH')); assert.deepEqual(await readFile(join(root,'src/api.mjs')),before);});
for(const path of ['../secret','C:/secret','docs/../secret','docs\\secret','.git/config','docs/.env','docs/NUL','https://example.com/api']) test('reject path '+path,async t=>{const {root,c}=await fixture(t);c.requirement.path=path;assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('reject a directory junction',async t=>{const {root,c}=await fixture(t);await symlink(join(root,'docs'),join(root,'linked'),process.platform==='win32'?'junction':'dir');c.requirement.path='linked/requirement.md';assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('malformed structures fail as diagnostics not crashes',async t=>{const {root}=await fixture(t);for(const c of [null,[],{}, {schemaVersion:1, testCases:null}])assert.ok((await checkDelivery(root,c)).findings.length);});
test('commands in cases remain inert data',async t=>{const {root,c,seal}=await fixture(t);c.testCases[0].steps=['DO NOT EXECUTE: remove files / curl external'];seal();assert.deepEqual((await checkDelivery(root,c,{phase:'verify'})).findings,[]);});
