// Scoped publication check: prints paths/hashes only, never candidate secret values.
import {readFile,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,writeJson} from '../../tools/lib/shared.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const git=(args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stdout;};
if(git(['branch','--show-current']).trim()!=='codex/truth-repair-review-20260916')throw Error('Unexpected branch.');
const paths=[...new Set(git(['ls-files','-m','-o','--exclude-standard','-z']).split('\0').filter(p=>p&&p!=='work/evidence/2026-09-16-push-review-screen.json'))].sort();
const report={at:new Date().toISOString(),scope:'private review branch, not adoption/release',files:[],excluded:[],allowedFixtures:[],findings:[],limitations:'Pattern screening cannot prove absence of every secret. No external scanner is installed.'};
const high=[['provider-token',/\b(?:dapi[a-zA-Z0-9]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{30,}|sk-[a-zA-Z0-9_-]{20,}|AKIA[A-Z0-9]{16}|ASIA[A-Z0-9]{16})\b/g],['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],['url-credential',/https?:\/\/[^\s/]+:[^\s/]+@/g],['oauth-credential',/(?:access_token|refresh_token|client_secret)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{24,}/g]];
for(const path of paths){
 if(path.startsWith('.harness/')){report.excluded.push(path);continue;}
 if(!/^(?:AGENTS\.md|work\/STATUS\.md|(?:docs\/harness|docs\/product\/standards|harness|tests|tools|vendor|work\/(?:evidence|reviews|quality|plans|sessions|tasks)|\.(?:github|claude)\/skills)\/)/.test(path))throw Error('Out-of-scope change: '+path);
 if(/(?:^|\/)(?:\.env(?:\..*)?|\.databrickscfg|node_modules|\.venv|\.databricks)(?:\/|$)/.test(path))throw Error('Forbidden path: '+path);
 const s=await lstat(join(root,path));if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>2*1024*1024)throw Error('Unsupported changed file: '+path);
 const bytes=await readFile(join(root,path)),content=bytes.toString('utf8');if(!Buffer.from(content).equals(bytes))throw Error('Non-UTF8 change needs review: '+path);
 for(const [kind,re] of high)for(const match of content.matchAll(re)){
  const finding={path,kind,line:content.slice(0,match.index).split('\n').length};
  if(path==='tests/scoped-approval.test.mjs'&&kind==='url-credential'&&finding.line===98&&sha256(bytes)==='1d4af8d87fb330b5b420dd71aa5ab5ce452149c7b24c8ed46869db3779e98319'){
   report.allowedFixtures.push({...finding,reason:'Manually reviewed negative-test fixture.invalid credential URL, exact file hash bound; not a service credential.'});
  }else report.findings.push(finding);
 }
 report.files.push({path,bytes:bytes.length,sha256:sha256(bytes)});
}
await writeJson(join(root,'work/evidence/2026-09-16-push-review-screen.json'),report);
console.log(JSON.stringify({files:report.files.length,bytes:report.files.reduce((n,f)=>n+f.bytes,0),excluded:report.excluded,allowedFixtures:report.allowedFixtures,findings:report.findings,limitations:report.limitations},null,2));
if(report.findings.length)process.exitCode=1;
else if(process.argv.includes('--stage')){
 git(['add','--',...report.files.map(f=>f.path),'work/evidence/2026-09-16-push-review-screen.json']);
 const staged=git(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean);
 if(staged.some(p=>p.startsWith('.harness/')))throw Error('Local state unexpectedly staged.');
 console.log('Staged '+staged.length+' reviewed paths; no blanket git add.');
}
