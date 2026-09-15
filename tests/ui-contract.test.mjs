import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,mkdir,symlink,cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { atomicWrite,writeJson,sha256 } from '../tools/lib/shared.mjs';
import { validateUiContract,validateUiApproval,uiCommand } from '../tools/lib/ui-contract.mjs';
import { createApproval } from '../tools/lib/approval.mjs';
import { uiFixture } from './helpers/ui-fidelity.mjs';

async function setup(t){
  t.mock.method(console,'log',()=>{});
  const root=await mkdtemp(join(tmpdir(),'ui-fidelity-'));
  t.after(async()=>{assert.ok(root.startsWith(resolve(tmpdir())+sep));assert.match(root,/ui-fidelity-/);await rm(root,{recursive:true,force:true});});
  await writeJson(join(root,'harness.config.json'),{humanGates:['ui-mock']});
  await atomicWrite(join(root,'work/evidence/human.md'),'Synthetic human decision only.');
  return {root,...await uiFixture(root)};
}
const opts={session:'session',gate:'ui-mock',actor:'owner',evidence:'work/evidence/human.md',artifact:['apps/demo/mock.tsx'],ui_contract:'docs/product/ui/demo.json'};

test('runtime correspondence supports preview and mock without certifying pixels',async t=>{
  const {root,path}=await setup(t);
  for(const phase of ['preview','mock'])assert.equal((await validateUiContract(root,path,{phase})).certifiesAppearance,false);
  const approval=await createApproval(root,opts);
  assert.equal((await validateUiApproval(root,approval,{sessionId:'session',appRoot:'apps/demo',appkitVersion:'v0.69.1'})).identityAuthenticated,false);
  for(const expected of [{sessionId:'another'},{appRoot:'apps/another'},{appkitVersion:'v0.70.0'}])await assert.rejects(validateUiApproval(root,approval,expected),/mismatch|different|differs/);
});
for(const field of ['mock.tsx','style.css','fixtures.json','package.json','package-lock.json'])test('approval rejects changed '+field,async t=>{
  const {root}=await setup(t);const approval=await createApproval(root,opts);
  await atomicWrite(join(root,'apps/demo',field),'changed');
  await assert.rejects(validateUiApproval(root,approval),/changed artifact/);
});
for(const [name,mutate] of [
  ['empty screens',c=>c.screens=[]],['empty styles',c=>c.runtime.styles=[]],['empty components',c=>c.screens[0].components=[]],
  ['missing state',c=>c.screens[0].states.push('denied')],['approximate HTML',c=>c.screens[0].previews[0].mode='html'],
  ['unresolved difference',c=>c.unresolved.push('style differs')],['self review',c=>c.review.context=c.producer.context],
  ['unapproved external',c=>c.target.hosting='external'],['version mismatch',c=>c.runtime.version='0.70.0'],
])test('contract rejects '+name,async t=>{const {root,c,path,save}=await setup(t);mutate(c);await save();await assert.rejects(validateUiContract(root,path));});

test('runtime-generated static HTML is visual-only, never behavioral approval',async t=>{
  const {root,c,path,save,ref}=await setup(t);
  await atomicWrite(join(root,'docs/product/ui/render.html'),'<button>fixture</button>');
  c.screens[0].previews[0].mode='runtime-html';c.screens[0].previews[0].source=await ref('docs/product/ui/render.html');c.screens[0].behavior=[];await save();
  await validateUiContract(root,path,{phase:'preview'});
  await assert.rejects(validateUiContract(root,path,{phase:'mock'}),/behavior/);
  await assert.rejects(createApproval(root,opts),/behavior/);
});
test('external hosting requires a decision tied to this target and requirement',async t=>{
  const {root,c,path,save,ref}=await setup(t);
  c.target.hosting='external';c.target.exception={actor:'owner',decision:'approved',hosting:'external',framework:'databricks-appkit',requirementSha256:c.requirement.sha256,evidence:await ref('work/evidence/human.md')};await save();
  await validateUiContract(root,path);
  c.target.exception.requirementSha256='0'.repeat(64);await save();await assert.rejects(validateUiContract(root,path),/exception/);
});
test('stale review and unbound or legacy approvals fail without rewriting records',async t=>{
  const {root,c,path,save}=await setup(t);const approval=await createApproval(root,opts);
  c.producer.actor='changed';await save(false);await assert.rejects(validateUiContract(root,path),/stale review/);
  delete approval.uiContract;await assert.rejects(validateUiApproval(root,approval),/legacy/);
  const disk=JSON.parse(await readFile(join(root,'work/approvals/session/ui-mock.json')));assert.equal(disk.uiContract,path);
});
test('UI draft defaults to Apps, cannot overwrite and cannot be approved as complete',async t=>{
  const {root}=await setup(t);const path='docs/product/ui/draft.json';
  const args=['--contract',path,'--session','session','--app-root','apps/demo'];
  await uiCommand(root,'ui-init',args);const bytes=await readFile(join(root,path));assert.equal(JSON.parse(bytes).target.hosting,'databricks-apps');
  await assert.rejects(uiCommand(root,'ui-init',args),/overwrite/);assert.equal(sha256(await readFile(join(root,path))),sha256(bytes));
  await assert.rejects(validateUiContract(root,path));
  await assert.rejects(uiCommand(root,'ui-check',['--contract','../escape.json']),/relative/);
});

test('public delivery CLI validates the actual approval and refuses stale/different app records',async t=>{
  const {root}=await setup(t);await createApproval(root,opts);
  await cp(resolve('tools'),join(root,'tools'),{recursive:true});
  const cli=join(root,'tools/harness.mjs');
  const run=(app='apps/demo')=>spawnSync(process.execPath,[cli,'delivery','ui-approval-check','--approval','work/approvals/session/ui-mock.json','--session','session','--app-root',app],{cwd:root,encoding:'utf8'});
  assert.equal(run().status,0);assert.equal(run('apps/other').status,1);
  await atomicWrite(join(root,'apps/demo/style.css'),'changed');assert.equal(run().status,1);
});
test('ui-init rejects linked output ancestors before creating a draft or lock',async t=>{
  const {root}=await setup(t);const target=join(root,'unrelated');await mkdir(target);
  await symlink(target,join(root,'docs/product/ui/link'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(uiCommand(root,'ui-init',['--contract','docs/product/ui/link/draft.json','--session','session','--app-root','apps/demo']),/symlink|junction/);
  await assert.rejects(readFile(join(target,'draft.json')),/ENOENT/);await assert.rejects(readFile(join(target,'draft.json.lock')),/ENOENT/);
});
