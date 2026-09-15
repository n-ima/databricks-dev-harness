// Narrow independent tests of the final public UI facade. All records are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,mkdir,symlink,readdir } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWrite,writeJson,sha256 } from '../../tools/lib/shared.mjs';
import { uiFixture } from '../../tests/helpers/ui-fidelity.mjs';
import { createApproval } from '../../tools/lib/approval.mjs';
import { deliveryCommand } from '../../tools/lib/delivery-assurance.mjs';

async function fixture(t){
  t.mock.method(console,'log',()=>{});
  const root=await mkdtemp(join(tmpdir(),'ui-final-independent-'));
  t.after(async()=>{assert.ok(root.startsWith(resolve(tmpdir())+sep));assert.match(root,/ui-final-independent-/);await rm(root,{recursive:true,force:true});});
  await writeJson(join(root,'harness.config.json'),{humanGates:['ui-mock']});
  await atomicWrite(join(root,'work/evidence/human.md'),'SYNTHETIC human-decision record. No real person approval.');
  const f=await uiFixture(root);
  await createApproval(root,{session:'session',gate:'ui-mock',actor:'synthetic-owner',evidence:'work/evidence/human.md',artifact:['apps/demo/mock.tsx'],ui_contract:f.path});
  const args=['--approval','work/approvals/session/ui-mock.json','--session','session','--app-root','apps/demo'];
  return {root,args,...f};
}
test('final independent: assisted approval check is read-only and binds its session/app',async t=>{
  const f=await fixture(t),receipt=join(f.root,'work/approvals/session/ui-mock.json'),before=await readFile(receipt);
  const valid=await deliveryCommand(f.root,'ui-approval-check',f.args);assert.equal(valid.valid,true);assert.equal(valid.certifiesAppearance,false);assert.equal(valid.identityAuthenticated,false);
  for(const args of [f.args.slice(0,4),[...f.args.slice(0,3),'other',...f.args.slice(4)],[...f.args.slice(0,5),'apps/other']]){
    const result=await deliveryCommand(f.root,'ui-approval-check',args);assert.equal(result.valid,false);assert.equal(result.findings[0].code,'UI_CONTRACT_INVALID');
  }
  assert.deepEqual(await readFile(receipt),before);
});
test('final independent: assisted check cannot treat a newly reviewed contract as the old human approval',async t=>{
  const f=await fixture(t);await atomicWrite(join(f.root,'apps/demo/style.css'),'body { color: red; }');f.c.runtime.styles[0]=await f.ref('apps/demo/style.css');await f.save();
  const contractOnly=await deliveryCommand(f.root,'ui-check',['--contract',f.path,'--phase','mock']);assert.equal(contractOnly.findings.length,0);
  const approval=await deliveryCommand(f.root,'ui-approval-check',f.args);assert.equal(approval.valid,false);assert.match(approval.findings[0].message,/current UI artifact/);
});
test('final independent: malformed contract and invalid command return safe non-success diagnostics',async t=>{
  const f=await fixture(t);const sentinel='SYNTHETIC_SECRET_DO_NOT_DISPLAY';await atomicWrite(join(f.root,f.path),'{"secret":"'+sentinel+'"');
  for(const [action,args] of [['ui-check',['--contract',f.path]],['ui-approval-check',[...f.args,'--phase','mock']]]){
    const result=await deliveryCommand(f.root,action,args);assert.equal(result.valid,false);assert.equal(result.findings[0].code,'UI_CONTRACT_INVALID');assert.doesNotMatch(JSON.stringify(result),new RegExp(sentinel));
  }
});
test('final independent: ui-init refuses a linked ancestor without creating output or lock',async t=>{
  const f=await fixture(t),target=join(f.root,'unrelated');await mkdir(target);await symlink(target,join(f.root,'docs/product/ui/alias'),process.platform==='win32'?'junction':'dir');
  const result=await deliveryCommand(f.root,'ui-init',['--contract','docs/product/ui/alias/new.json','--session','session','--app-root','apps/demo']);assert.equal(result.valid,false);assert.match(result.findings[0].message,/symlink|junction/);assert.deepEqual(await readdir(target),[]);
});
test('final independent: UI hash command only computes a snapshot and never mutates the contract',async t=>{
  const f=await fixture(t),before=await readFile(join(f.root,f.path));const result=await deliveryCommand(f.root,'ui-hash',['--contract',f.path]);
  assert.match(result.reviewedSha256,/^[a-f0-9]{64}$/);assert.equal(result.certifiesAppearance,false);assert.equal(sha256(await readFile(join(f.root,f.path))),sha256(before));
});
