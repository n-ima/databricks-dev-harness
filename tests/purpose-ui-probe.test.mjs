import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,symlink,readdir,rm,rmdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';

async function setup(t){
  const temporary=await mkdtemp(join(tmpdir(),'purpose-probe-'));
  t.after(async()=>{assert(temporary.startsWith(resolve(tmpdir())+sep));assert.match(temporary,/purpose-probe-/);await rm(temporary,{recursive:true,force:true});});
  const repo=join(temporary,'repo'),outside=join(temporary,'outside-repo');
  await mkdir(join(repo,'tests/fixtures/purpose-ui'),{recursive:true});
  await mkdir(join(repo,'work/evidence'),{recursive:true});await mkdir(outside);
  const runner=join(repo,'tests/fixtures/purpose-ui/probe.mjs');
  await copyFile(resolve('tests/fixtures/purpose-ui/probe.mjs'),runner);
  const run=(output,...extra)=>spawnSync(process.execPath,[runner,'--runtime-root',join(temporary,'missing-dependencies'),'--browser-packages',join(temporary,'missing-browser'),'--output',output,...extra],{cwd:repo,encoding:'utf8',timeout:10000});
  return {repo,outside,run};
}

for(const linked of ['work','work/evidence','work/evidence/nested'])test('display probe rejects linked output ancestor '+linked+' before writing',async t=>{
  const {repo,outside,run}=await setup(t);
  const link=join(repo,linked);
  if(linked==='work')await rmdir(join(repo,'work/evidence')); // empty directories only
  if(linked!=='work/evidence/nested')await rmdir(link);
  await symlink(outside,link,process.platform==='win32'?'junction':'dir');
  const output=linked+'/proof';
  // For a link above evidence, preserve the lexical required prefix.
  const destination=linked==='work'?'work/evidence/proof':output;
  if(linked==='work')await mkdir(join(outside,'evidence'));
  const result=run(destination);
  assert.notEqual(result.status,0);assert.match(result.stderr,/symlink or junction output/);
  assert.deepEqual(await readdir(linked==='work'?join(outside,'evidence'):outside),[]);
});

test('display probe refuses traversal, reuse and invalid arguments without changing output',async t=>{
  const {repo,outside,run}=await setup(t);
  for(const destination of ['../outside-repo/proof','work/evidence/../../../outside-repo/proof','work/evidence-other/proof']){
    const result=run(destination);assert.notEqual(result.status,0);assert.match(result.stderr,/work\/evidence subdirectory/);
  }
  const existing=join(repo,'work/evidence/existing');await mkdir(existing);await writeFile(join(existing,'keep.txt'),'preserve');
  assert.match(run('work/evidence/existing').stderr,/EEXIST/);assert.equal(await readFile(join(existing,'keep.txt'),'utf8'),'preserve');
  for(const extra of [['--output','work/evidence/other'],['--unknown','value']])assert.match(run('work/evidence/proof',...extra).stderr,/invalid\/duplicate argument/);
  assert.deepEqual(await readdir(join(repo,'work/evidence')),['existing']);assert.deepEqual(await readdir(outside),[]);
});

test('display probe permits a new contained output then fails on missing dependencies',async t=>{
  const {repo,run}=await setup(t);const result=run('work/evidence/proof');
  assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);
  assert.deepEqual(await readdir(join(repo,'work/evidence/proof')),[]);
});
