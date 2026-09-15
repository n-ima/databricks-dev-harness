import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {sha256,writeJson} from '../../tools/lib/shared.mjs';
import {validateReceipt} from '../../tools/lib/evidence.mjs';
const git=args=>{const r=spawnSync('git',args,{encoding:null,maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr.toString());return r.stdout;};
const paths=git(['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean);
const report={at:new Date().toISOString(),branch:git(['branch','--show-current']).toString().trim(),staged:[],findings:[]};
for(const path of paths){const blob=git(['show',':'+path]),local=await readFile(path),match=blob.equals(local);report.staged.push({path,sha256:sha256(blob),bytes:blob.length,match});if(!match)report.findings.push('staged/local bytes differ: '+path);}
await validateReceipt(process.cwd(),'work/reviews/20260915-153857-861-truth-repair.receipt.json',{sessionId:'20260915-153857-861-truth-repair',requirement:'docs/harness/requirements/2026-09-16-truth-repair.md'});
report.repairReceiptValid=true;await writeJson('work/evidence/2026-09-16-push-index.json',report);
console.log(JSON.stringify({files:paths.length,repairReceiptValid:true,findings:report.findings}));process.exitCode=report.findings.length?1:0;
