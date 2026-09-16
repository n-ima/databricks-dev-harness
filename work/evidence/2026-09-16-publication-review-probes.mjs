import { mkdtemp, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base=resolve(tmpdir()), root=await mkdtemp(join(base,'publication-review-'));
try {
  for(const path of ['tools/lib/publication.mjs','tools/lib/distribution.mjs','tools/lib/shared.mjs','tools/lib/workloads.mjs','tools/harness-publication.mjs','tests/publication.test.mjs','harness/router.json','harness/workloads.json']) {
    await mkdir(dirname(join(root,path)),{recursive:true});await cp(join(repo,path),join(root,path));
  }
  await cp(join(repo,'vendor'),join(root,'vendor'),{recursive:true});
  await writeFile(join(root,'product.config.json'),JSON.stringify({name:'review-only-initialized-product'}));
  const result=spawnSync(process.execPath,['--test','--test-name-pattern','natural-language publication','tests/publication.test.mjs'],{cwd:root,encoding:'utf8',shell:false,timeout:30000});
  console.log(JSON.stringify({scenario:'同じ配布テストを初期化済み合成案件で実行',status:result.status,stdout:result.stdout,stderr:result.stderr},null,2));
  process.exitCode=result.status===0?0:1;
} finally {
  assert.ok(root.startsWith(base+sep+'publication-review-'));await rm(root,{recursive:true,force:true});
}
