import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {freshTemplateFixture} from './helpers/initialization.mjs';
import {planScaffold,applyScaffold} from '../tools/lib/scaffold.mjs';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function fixture(t,full=false){
  const base=resolve(tmpdir()),parent=await mkdtemp(join(base,'truth-assets-')),root=join(parent,'project');
  t.after(async()=>{assert.ok(parent.startsWith(base+sep));await rm(parent,{recursive:true,force:true});});
  if(full)await freshTemplateFixture(repository,root);else {await mkdir(join(root,'harness'),{recursive:true});await writeFile(join(root,'harness/toolchain.lock.json'),'{"appkitTemplateVersion":"v0.69.1"}');}
  return root;
}
const cli=(root,...args)=>spawnSync(process.execPath,['tools/harness.mjs',...args],{cwd:root,encoding:'utf8',timeout:60000});
test('FIX-04 re-setup refuses unknown skills in either provider before modifying either tree',async t=>{
  const root=await fixture(t,true);let r=cli(root,'setup','--project-name','test','--skip-agent-skills');assert.equal(r.status,0,r.stderr+r.stdout);
  const first=join(root,'.claude/skills/orchestrate-work/SKILL.md'),old=await readFile(first);
  const custom=join(root,'.github/skills/project-only/SKILL.md');await mkdir(dirname(custom),{recursive:true});await writeFile(custom,'# Synthetic custom instruction\n');
  r=cli(root,'setup','--project-name','test','--skip-agent-skills');assert.notEqual(r.status,0);assert.match(r.stderr+r.stdout,/unknown|独自|unmanaged/i);
  assert.equal(await readFile(custom,'utf8'),'# Synthetic custom instruction\n');assert.deepEqual(await readFile(first),old);
});
test('FIX-01 generated provider skill preserves existing Apps database resource type',async t=>{
  const root=await fixture(t,true),r=cli(root,'setup','--project-name','test','--skip-agent-skills');assert.equal(r.status,0,r.stderr+r.stdout);
  for(const provider of ['.claude','.github']){
    const content=await readFile(join(root,provider,'skills/databricks-lakebase/SKILL.md'),'utf8');
    assert.doesNotMatch(content,/migrate to the `postgres` resource key/);
    assert.match(content,/HARNESS CORRECTION/);
    assert.match(content,/既存.*database/);
  }
});
test('FIX-05 generated SQL embeds exactly the canonical metric YAML',async t=>{
  const root=await fixture(t),noExternal={run(){throw Error('no external execution');}};
  const plan=await planScaffold(root,{kind:'metric-view',name:'sales',description:'Profit $$ USD',source_table:'dev.test.orders',dimension:['地域$$=region'],measure:['Revenue$$=SUM(amount)']},noExternal);
  await applyScaffold(root,{plan:'work/scaffolds/'+plan.id+'.json',yes:true},noExternal);
  const yaml=await readFile(join(root,'src/metrics/sales.metric.yml'),'utf8');
  const sql=await readFile(join(root,'src/metrics/sales.draft.sql'),'utf8');
  assert.equal(sql.split('$$')[1],'\n'+yaml);assert.match(sql,/DRAFT ONLY/);
  assert.equal(sql.split('$$').length,3);
  assert.equal(JSON.parse(yaml.split('\n').find(l=>l.startsWith('comment: ')).slice(9)),'Profit $$ USD');
});
