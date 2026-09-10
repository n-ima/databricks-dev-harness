import test from 'node:test';
import assert from 'node:assert/strict';
import fsp, { mkdtemp, readFile, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { acceptanceIds, assertAcceptanceId } from '../../../tools/lib/acceptance.mjs';
import { sealEvidence, validateReceipt, fileHash } from '../../../tools/lib/evidence.mjs';
import { policyHash } from '../../../tools/lib/policy.mjs';
import { createApproval } from '../../../tools/lib/approval.mjs';
import { closeSession } from '../../../tools/lib/memory.mjs';
import { createTask, updateTask } from '../../../tools/lib/tasks.mjs';
import { initLoop, runLoopIteration, recordLoop } from '../../../tools/lib/loop.mjs';
import { createIntake, answerIntake, approveIntake } from '../../../tools/lib/intake.mjs';
import { atomicWrite, writeJson, readJson, parseFrontmatter, exists } from '../../../tools/lib/shared.mjs';
import { installWorkloadCatalog } from '../../../tests/helpers/workloads.mjs';

const requirement = 'docs/product/requirements/probe.md';
const architecture = 'docs/product/architecture/probe.md';
const evidence = 'work/evidence/probe.md';
const review = 'work/reviews/probe.json';
const receiptPath = 'work/reviews/probe.receipt.json';
const sessionPath = 'work/sessions/S-1.md';
const document = body => '---\nstatus: accepted\n---\n' + body + '\n';
const body = '- AC-01: outcome\n- AC-D01: denied access';
const sessionDocument = (reference = requirement) => `---\nid: S-1\nstatus: active\nprovider: claude\ngate: none\ngate_status: not-applicable\nrequirement: ${reference}\narchitecture: ${architecture}\n---\n# Synthetic independent review fixture\n`;
const success = stdout => ({ ok: true, status: 0, stdout: stdout ?? 'synthetic success', stderr: '' });

async function fixture(t, criterionBody = body) {
  t.mock.method(console, 'log', () => {});
  const base = resolve(tmpdir());
  const root = await mkdtemp(join(base, 'harness-ac-independent-'));
  t.after(async () => {
    const target = resolve(root);
    assert.ok(target.startsWith(base + sep));
    assert.match(target.slice(base.length + 1), /^harness-ac-independent-/);
    await rm(target, { recursive: true, force: true });
  });
  await atomicWrite(join(root, 'AGENTS.md'), '# Synthetic policy\n');
  await atomicWrite(join(root, 'tools/agent-hook.mjs'), '// Synthetic hook\n');
  await writeJson(join(root, 'harness.config.json'), {
    humanGates: ['product-intent'],
    loop: { maxIterations: 3, maxWallMinutes: 10, maxProcessMinutes: 1, checks: [['fixture-check']] },
  });
  await atomicWrite(join(root, requirement), document(criterionBody));
  await atomicWrite(join(root, architecture), '# Synthetic design\n');
  await atomicWrite(join(root, evidence), 'Synthetic local evidence. No provider or Databricks invoked.\n');
  await atomicWrite(join(root, sessionPath), sessionDocument());
  return root;
}
async function directReceipt(root, ids = ['AC-01', 'AC-D01']) {
  const receipt = {
    schemaVersion: 1, sessionId: 'S-1', requirement, status: 'pass',
    reviewer: 'independent-probe-reviewer', provider: 'copilot', independent: true,
    acceptance: ids.map(id => ({ id, status: 'pass', evidence: [evidence] })),
    policyHash: await policyHash(root),
    artifactHashes: { [requirement]: await fileHash(root, requirement), [evidence]: await fileHash(root, evidence) },
  };
  await writeJson(join(root, receiptPath), receipt);
  return receipt;
}
async function bytes(root, paths) {
  return Promise.all(paths.map(path => readFile(join(root, path))));
}
async function unchanged(root, paths, before) {
  assert.deepEqual(await bytes(root, paths), before);
}
async function interceptedRead(action, intercept) {
  const originalRead = fsp.readFile;
  fsp.readFile = async (...args) => {
    await intercept(args[0]);
    return originalRead(...args);
  };
  syncBuiltinESMExports();
  try { return await action(); }
  finally { fsp.readFile = originalRead; syncBuiltinESMExports(); }
}

test('independent positive: mixed grammar, BOM/CRLF, headings and inert examples preserve exact IDs', () => {
  const source = '\uFEFF---\r\nstatus: accepted\r\n---\r\n~~~md\r\n- EX-01: example\r\n~~~\r\n## aCcEpTaNcE cRiTeRiA\r\n- [X] H-01: old\r\n* AC-D01: scoped\r\n+ AC-DATA-02: namespace\r\n<!-- - AC-99: hidden -->\r\n## Notes\r\nOrdinary reference to AC-D01.\r\n';
  assert.deepEqual(acceptanceIds(source), ['H-01', 'AC-D01', 'AC-DATA-02']);
});

for (const [name, source] of [
  ['empty comment body', '- AC-01: <!-- only comment -->'],
  ['duplicate across sections', '## Acceptance criteria\n- AC-01: first\n## Notes\nNotes.\n## 受入条件\n- AC-01: second'],
  ['outside section', '## Acceptance criteria\n- AC-01: first\n## Notes\n- AC-D01: outside'],
  ['shorter closing fence', '- AC-01: first\n~~~~\n- AC-D01: hidden\n~~~'],
  ['invalid review-like list', '- AC-01: first\n- ac-d01: lowercase'],
  ['unclosed HTML comment', '- AC-01: first\n<!-- hidden'],
]) test('independent negative parser: ' + name, () => assert.throws(() => acceptanceIds(source)));

for (const tail of ['# H-D01 must be verified', '# **AC-D01** must be verified', '• AC-D01: Unicode bullet requirement']) {
  test('unsupported definition must not silently permit seal and completion: ' + tail, async t => {
    const root = await fixture(t, '- AC-01: visible\n' + tail);
    await writeJson(join(root, review), {
      reviewer: 'independent-probe-reviewer', provider: 'copilot', independent: true,
      acceptance: [{ id: 'AC-01', status: 'pass', evidence: [evidence] }],
    });
    let rejected = false;
    try {
      await sealEvidence(root, { review, requirement, session: 'S-1', output: receiptPath });
      await closeSession(root, { id: 'S-1', outcome: 'completed', summary: 'Synthetic counterexample only', verifier_evidence: receiptPath });
    } catch (error) { rejected = true; assert.match(error.message, /acceptance/i); }
    const state = parseFrontmatter(await readFile(join(root, sessionPath), 'utf8')).status;
    t.diagnostic(JSON.stringify({ tail, rejected, fixtureSessionStatus: state }));
    assert.equal(rejected, true, 'Unsupported real definition was dropped; incomplete review sealed and fixture completed.');
    assert.equal(state, 'active');
  });
}

test('ID grammar must reject a final newline rather than accepting a partial-string match', () => {
  assert.throws(() => assertAcceptanceId('AC-01\n'), /Invalid acceptance/);
});

for (const [name, mutate, pattern] of [
  ['missing', receipt => receipt.acceptance.pop(), /Missing acceptance.*AC-D01/],
  ['extra', receipt => receipt.acceptance.push({ id: 'AC-99', status: 'pass', evidence: [evidence] }), /Unexpected acceptance/],
  ['duplicate', receipt => receipt.acceptance.push(receipt.acceptance[0]), /Duplicate/],
  ['empty', receipt => { receipt.acceptance = []; }, /No acceptance/],
  ['invalid ID', receipt => { receipt.acceptance[1].id = 'ac-d01'; }, /Invalid acceptance/],
  ['null result', receipt => { receipt.acceptance[1] = null; }, /acceptance/i],
]) {
  test('direct receipt bypassing seal is rejected without completion mutation: ' + name, async t => {
    const root = await fixture(t);
    const receipt = await directReceipt(root);
    mutate(receipt);
    await writeJson(join(root, receiptPath), receipt);
    const before = await readFile(join(root, sessionPath));
    await assert.rejects(validateReceipt(root, receiptPath, { sessionId: 'S-1', requirement, implementer: 'claude' }), pattern);
    await assert.rejects(closeSession(root, { id: 'S-1', summary: 'Must refuse', verifier_evidence: receiptPath }), pattern);
    assert.deepEqual(await readFile(join(root, sessionPath)), before);
  });
}

test('task completion rejects missing AC-D01 and leaves task plus session bytes unchanged', async t => {
  const root = await fixture(t);
  await directReceipt(root, ['AC-01']);
  let task = await createTask(root, { id: 'IP-01', title: 'Independent fixture', session: 'S-1', done_when: 'All criteria checked' });
  for (const status of ['ready', 'running', 'verifying']) task = await updateTask(root, { id: task.id, status, expected_revision: task.revision, summary: 'Synthetic fixture transition' });
  const paths = [sessionPath, 'work/tasks/IP-01.md'];
  const before = await bytes(root, paths);
  await assert.rejects(updateTask(root, { id: task.id, status: 'done', expected_revision: task.revision, summary: 'Must refuse', evidence: [evidence], verifier_evidence: receiptPath }), /Missing acceptance.*AC-D01/);
  await unchanged(root, paths, before);
});

test('loop completion rejects missing AC-D01 and preserves loop plus session bytes', async t => {
  const root = await fixture(t);
  await directReceipt(root, ['AC-01']);
  const queries = {
    'rev-parse --is-inside-work-tree': 'true', 'rev-parse --verify HEAD': 'a'.repeat(40),
    'branch --show-current': 'independent-fixture', 'status --porcelain': '',
  };
  const loop = await initLoop(root, { session: 'S-1', provider: 'claude', verifier_provider: 'copilot' }, {
    run: (command, args) => { assert.equal(command, 'git'); assert.ok(Object.hasOwn(queries, args.join(' '))); return success(queries[args.join(' ')]); },
  });
  const calls = [];
  await runLoopIteration(root, { id: loop.id, execute: true }, { run: command => { calls.push(command); assert.ok(['claude', 'fixture-check'].includes(command)); return success(); } });
  assert.deepEqual(calls, ['claude', 'fixture-check']);
  const paths = [sessionPath, 'work/loops/' + loop.id + '.json'];
  const before = await bytes(root, paths);
  await assert.rejects(recordLoop(root, { id: loop.id, outcome: 'achieved', summary: 'Must refuse', evidence: [evidence], verifier_evidence: receiptPath }), /Missing acceptance.*AC-D01/);
  await unchanged(root, paths, before);
});

test('final intake reconstruction refuses invalid IDs and preserves every linked artifact plus old approval', async t => {
  const root = await fixture(t);
  await installWorkloadCatalog(root);
  const intake = await createIntake(root, { title: 'Independent final render', summary: 'Analyze synthetic data', name: 'independent-final' });
  for (const q of intake.questions.filter(q => q.material)) await answerIntake(root, { id: intake.id, question: q.id, answer: '- AC-D01: unapproved additional criterion', actor: 'synthetic-owner' });
  const path = intake.artifacts.requirementPath;
  const text = await readFile(join(root, path), 'utf8');
  await atomicWrite(join(root, path), text.replace(/<!-- intake-answers:start -->[\s\S]*?<!-- intake-answers:end -->/, '<!-- intake-answers:start -->\n## Refined answers\nSafe manually edited view.\n<!-- intake-answers:end -->'));
  const approval = 'work/approvals/' + intake.sessionId + '/product-intent.json';
  await writeJson(join(root, approval), { decision: 'revoked', marker: 'must remain untouched' });
  const paths = [...Object.values(intake.artifacts), 'docs/product/intake/' + intake.id + '/intake.json', approval];
  const before = await bytes(root, paths);
  await assert.rejects(approveIntake(root, { id: intake.id, actor: 'synthetic-owner', evidence: 'Local fixture only' }), /Invalid acceptance location/);
  await unchanged(root, paths, before);
});

for (const change of ['requirement content', 'session reference']) {
  test('product-intent approval must reject a changed ' + change + ' before committing approval', async t => {
    const root = await fixture(t);
    const invalidRequirement = 'docs/product/requirements/changed.md';
    await atomicWrite(join(root, invalidRequirement), document('- AC-01: first\n- AC-01: conflicting duplicate'));
    let changed = false;
    let rejected = false;
    let changedSession;
    await interceptedRead(async () => {
      try { await createApproval(root, { session: 'S-1', gate: 'product-intent', actor: 'synthetic-owner', evidence }); }
      catch (error) { rejected = true; t.diagnostic(error.message); }
    }, async path => {
      if (!changed && resolve(String(path)) === resolve(root, evidence)) {
        changed = true;
        if (change === 'requirement content') await atomicWrite(join(root, requirement), document('- AC-01: first\n- AC-01: duplicate after initial read'));
        else await atomicWrite(join(root, sessionPath), sessionDocument(invalidRequirement));
        changedSession = await fsp.readFile(join(root, sessionPath));
      }
    });
    assert.equal(changed, true, 'Read boundary was not reached');
    const actual = parseFrontmatter(await readFile(join(root, sessionPath), 'utf8'));
    const approvalExists = await exists(join(root, 'work/approvals/S-1/product-intent.json'));
    t.diagnostic(JSON.stringify({ change, rejected, approvalExists, requirement: actual.requirement, gate_status: actual.gate_status }));
    assert.equal(rejected, true, 'Approval committed after its validated requirement changed.');
    assert.equal(approvalExists, false);
    assert.deepEqual(await readFile(join(root, sessionPath)), changedSession);
  });
}

test('receipt validation must parse the same requirement bytes that it checked against the artifact hash', async t => {
  const root = await fixture(t);
  await directReceipt(root, ['AC-01']);
  let requirementReads = 0, changed = false, rejected = false;
  await interceptedRead(async () => {
    try { await closeSession(root, { id: 'S-1', summary: 'Must refuse changed snapshot', verifier_evidence: receiptPath }); }
    catch (error) { rejected = true; t.diagnostic(error.message); }
  }, async path => {
    if (resolve(String(path)) === resolve(root, requirement)) {
      requirementReads++;
      if (requirementReads === 2) {
        changed = true;
        await atomicWrite(join(root, requirement), document('- AC-01: omitted AC-D01 after artifact hash validation'));
      }
    }
  });
  assert.equal(changed, true, 'Target read boundary was not reached');
  const receipt = await readJson(join(root, receiptPath));
  const currentHashMatches = receipt.artifactHashes[requirement] === await fileHash(root, requirement);
  const status = parseFrontmatter(await readFile(join(root, sessionPath), 'utf8')).status;
  t.diagnostic(JSON.stringify({ rejected, currentHashMatches, fixtureSessionStatus: status, requirementReads }));
  assert.equal(rejected, true, 'Incomplete receipt completed after requirement changed between hash and parse.');
  assert.equal(status, 'active');
});
