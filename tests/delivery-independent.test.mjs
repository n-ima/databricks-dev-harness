import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkDelivery, basisHash, reviewHash, digest, CONCERNS, OPERATIONS } from '../tools/lib/delivery-assurance.mjs';

// Independently authored synthetic records. No provider or live service is used.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'delivery-independent-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs'));
  const put = async (path, body) => { await writeFile(join(root, path), body); return { path, sha256: digest(body) }; };
  const evidence = await put('evidence.txt', 'Synthetic observations only.');
  const api = { openapi: '3.2.0', info: { title: 'Synthetic', version: '1' }, paths: { '/records': { get: { operationId: 'listRecords', responses: { 200: { description: 'OK' } } } } } };
  const c = { schemaVersion: 1, producer: { actor: 'author', context: 'author-context' },
    requirement: await put('docs/requirements.md', '# Requirements\n\n## Acceptance criteria\n\n- AC-01: Authorized read.\n- AC-02: Denied read.\n'),
    artifacts: [await put('implementation.txt', 'Synthetic implementation'), await put('tests.txt', 'Synthetic test definitions')],
    requirements: ['AC-01', 'AC-02'], risks: [{ id: 'risk', description: 'Unauthorized disclosure', testIds: ['deny'] }],
    interfaces: [{ id: 'records', kind: 'http', contract: await put('docs/api.json', JSON.stringify(api)),
      operations: [{ id: 'listRecords', positive: ['allow'], negative: ['deny'] }],
      concerns: CONCERNS.map(id => ({ id, status: 'applicable', reason: 'Synthetic coverage', testIds: ['deny'] })) }],
    testCases: ['allow', 'deny'].map((id, i) => ({ id, requirements: [i ? 'AC-02' : 'AC-01'], level: 'contract', environment: 'dev', preconditions: 'Synthetic', steps: ['Inspect fixture'], expected: i ? '403' : '200', result: null })),
    operations: OPERATIONS.map(id => ({ id, status: 'not-applicable', reason: 'Synthetic scope only', testIds: [], document: null })), reviews: [] };
  function seal() {
    for (const tc of c.testCases) tc.result = { status: 'pass', environment: tc.environment, basisSha256: basisHash(c), evidence: [evidence], command: 'synthetic, never executed', versions: 'synthetic' };
    c.reviews = [{ actor: 'independent-reviewer', context: 'fresh-context', independent: true, status: 'pass', reviewedSha256: reviewHash(c),
      coverage: { requirements: [...c.requirements], risks: c.risks.map(x => x.id), interfaces: ['records'], operations: [...OPERATIONS] }, evidence: [evidence] }];
  }
  seal();
  return { root, c, api, put, seal, async apiUpdate() { c.interfaces[0].contract = await put('docs/api.json', JSON.stringify(api)); seal(); } };
}
const codes = r => r.findings.map(f => f.code);
test('independent baseline has no diagnostics', async t => { const {root,c}=await fixture(t); assert.deepEqual((await checkDelivery(root,c,{phase:'verify'})).findings,[]); });
test('independent requirement omission cannot pass with resealed records', async t => { const {root,c,seal}=await fixture(t); c.requirements.pop(); c.testCases[1].requirements=['AC-01']; seal(); assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('REQUIREMENT_MISMATCH')); });
test('independent duplicate source operation IDs cannot pass', async t => { const f=await fixture(t); f.api.paths['/other']={get:structuredClone(f.api.paths['/records'].get)}; await f.apiUpdate(); assert.ok(codes(await checkDelivery(f.root,f.c,{phase:'verify'})).includes('INTERFACE_MISMATCH')); });
test('independent additionalOperations omitted inventory must be diagnosed', async t => { const f=await fixture(t); f.api.paths['/records'].additionalOperations={COPY:{operationId:'copyRecords',responses:{200:{description:'Copied'}}}}; await f.apiUpdate(); const r=await checkDelivery(f.root,f.c,{phase:'verify'}); assert.ok(codes(r).some(x=>['INTERFACE_MISMATCH','UNSUPPORTED_CONTRACT'].includes(x)),JSON.stringify(r)); });
test('independent source operation removal is diagnosed', async t => { const f=await fixture(t); delete f.api.paths['/records'].get; await f.apiUpdate(); assert.ok(codes(await checkDelivery(f.root,f.c)).includes('INTERFACE_MISMATCH')); });
test('independent identical positive and negative case is diagnosed', async t => { const {root,c,seal}=await fixture(t); c.interfaces[0].operations[0].negative=['allow'];seal();assert.ok(codes(await checkDelivery(root,c)).includes('UNCOVERED_OPERATION')); });
test('independent duplicate concern and missing one are diagnosed', async t => { const {root,c,seal}=await fixture(t);c.interfaces[0].concerns[1]=structuredClone(c.interfaces[0].concerns[0]);seal();assert.ok(codes(await checkDelivery(root,c)).includes('CONCERN_MISMATCH')); });
test('independent evidence bytes change is diagnosed', async t => { const {root,c,put}=await fixture(t);await put('evidence.txt','Modified observations');assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('ARTIFACT_MISMATCH')); });
test('independent evidence reference update invalidates review', async t => { const {root,c,put}=await fixture(t);c.testCases[0].result.evidence=[await put('new-evidence.txt','New observations')];assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('STALE_REVIEW')); });
test('independent implementation digest update invalidates result', async t => { const {root,c,put}=await fixture(t);c.artifacts[0]=await put('implementation.txt','New implementation');assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('STALE_RESULT')); });
test('independent same context is rejected after reseal', async t => { const {root,c}=await fixture(t);c.reviews[0].context=c.producer.context;assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('REVIEW_NOT_INDEPENDENT')); });
test('independent duplicate coverage entry is diagnosed', async t => { const {root,c}=await fixture(t);c.reviews[0].coverage.requirements=['AC-01','AC-01'];assert.ok(codes(await checkDelivery(root,c)).includes('REVIEW_COVERAGE')); });
for(const status of ['not-run','blocked','fail'])test('independent '+status+' is not passed',async t=>{const {root,c}=await fixture(t);c.testCases[0].result.status=status;c.reviews[0].reviewedSha256=reviewHash(c);assert.ok(codes(await checkDelivery(root,c,{phase:'verify'})).includes('TEST_NOT_PASSED'));});
test('independent empty artifact is rejected',async t=>{const {root,c,put,seal}=await fixture(t);c.artifacts[0]=await put('implementation.txt','');seal();assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('independent 1 MiB artifact is permitted',async t=>{const {root,c,put,seal}=await fixture(t);c.artifacts[0]=await put('implementation.txt',Buffer.alloc(1024*1024,65));seal();assert.deepEqual((await checkDelivery(root,c,{phase:'verify'})).findings,[]);});
test('independent oversized artifact is rejected',async t=>{const {root,c,put,seal}=await fixture(t);c.artifacts[0]=await put('implementation.txt',Buffer.alloc(1024*1024+1,65));seal();assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('independent cumulative byte limit is enforced',async t=>{const {root,c,put,seal}=await fixture(t);for(let i=0;i<17;i++)c.artifacts.push(await put('large-'+i+'.txt',Buffer.alloc(1024*1024,65)));seal();assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('independent file count limit is enforced',async t=>{const {root,c,put,seal}=await fixture(t);for(let i=0;i<129;i++)c.artifacts.push(await put('small-'+i+'.txt','a'));seal();assert.ok(codes(await checkDelivery(root,c)).includes('UNSAFE_ARTIFACT'));});
test('independent CLI valid, diagnostic, and input error exits',async t=>{const {root,c,put}=await fixture(t);const command=resolve('tools/lib/delivery-assurance.mjs');const run=()=>spawnSync(process.execPath,[command,'--root',root,'--contract','contract.json','--phase','verify'],{encoding:'utf8'});await put('contract.json',JSON.stringify(c));const before=await readFile(join(root,'contract.json'));let r=run();assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).certifiesAcceptance,false);assert.deepEqual(await readFile(join(root,'contract.json')),before);c.reviews=[];await put('contract.json',JSON.stringify(c));assert.equal(run().status,1);await put('contract.json','{');assert.equal(run().status,2);});
