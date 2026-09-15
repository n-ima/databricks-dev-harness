import { createHash } from 'node:crypto';
import { lstat, open } from 'node:fs/promises';
import { resolve, dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acceptanceIds } from './acceptance.mjs';

// Adopted read-only diagnostic. Never a completion receipt or execution authority.
export const CONCERNS = Object.freeze(['authentication','authorization','validation','errors','idempotency','concurrency','compatibility','limits']);
export const OPERATIONS = Object.freeze(['ownership','monitoring','recovery','data-protection','cost','dependency-updates']);
const LIMIT = 1024 * 1024;
export const digest = value => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const jsonHash = value => digest(JSON.stringify(canonical(value)));
export function basisHash(c) {
  const { reviews, testCases, ...design } = c;
  return jsonHash({ ...design, testCases: testCases.map(({result,...tc})=>tc) });
}
export function reviewHash(c) { const {reviews,...reviewed}=c; return jsonHash(reviewed); }
function problem(code,message) { const e=new Error(message); e.code=code; throw e; }
function text(value,label) {
  if(typeof value!=='string'||!value.trim()||value.length>10000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) problem('INVALID_SHAPE',label+' must be non-empty text');
}
function object(value,keys,label) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k))) problem('INVALID_SHAPE',label+' has missing or unknown fields');
}
function list(value,label) { if(!Array.isArray(value)||value.length>1000) problem('INVALID_SHAPE',label+' must be a bounded array'); }
function strings(value,label) { list(value,label);value.forEach(v=>text(v,label)); }
function oneOf(value,allowed,label) { if(!allowed.includes(value)) problem('INVALID_SHAPE',label+' has an unsupported value'); }
function ref(value) {
  object(value,['path','sha256'],'artifact'); text(value.path,'path');
  if(!/^[a-f0-9]{64}$/.test(value.sha256)) problem('INVALID_SHAPE','artifact requires sha256');
}
function decision(r,document) {
  object(r,document?['id','status','reason','testIds','document']:['id','status','reason','testIds'],'decision');
  text(r.id,'decision id');oneOf(r.status,['applicable','not-applicable'],'decision status');text(r.reason,'decision reason');strings(r.testIds,'decision tests');
  if(document){if(r.status==='applicable')ref(r.document);else if(r.document!==null)ref(r.document);}
}
function shape(c) {
  object(c,['schemaVersion','producer','requirement','artifacts','requirements','risks','interfaces','testCases','operations','reviews'],'contract');
  if(c.schemaVersion!==1) problem('INVALID_SHAPE','unsupported schemaVersion');
  object(c.producer,['actor','context'],'producer');text(c.producer.actor,'actor');text(c.producer.context,'context');
  ref(c.requirement);list(c.artifacts,'artifacts');c.artifacts.forEach(ref);if(!c.artifacts.length)problem('INVALID_SHAPE','declare implementation and test artifacts');
  strings(c.requirements,'requirements');
  list(c.risks,'risks');for(const r of c.risks){object(r,['id','description','testIds'],'risk');text(r.id,'risk id');text(r.description,'risk description');strings(r.testIds,'risk tests');}
  list(c.interfaces,'interfaces');for(const i of c.interfaces){
    object(i,['id','kind','contract','operations','concerns'],'interface');text(i.id,'interface id');oneOf(i.kind,['http'],'interface kind');ref(i.contract);
    list(i.operations,'interface operations');if(!i.operations.length)problem('INVALID_SHAPE','interface requires operations');
    for(const op of i.operations){object(op,['id','positive','negative'],'operation');text(op.id,'operation id');strings(op.positive,'positive');strings(op.negative,'negative');}
    list(i.concerns,'concerns');for(const r of i.concerns)decision(r,false);
  }
  list(c.testCases,'testCases');for(const tc of c.testCases){
    object(tc,['id','requirements','level','environment','preconditions','steps','expected','result'],'test case');
    for(const key of ['id','preconditions','expected'])text(tc[key],'case '+key);
    strings(tc.requirements,'test requirements');strings(tc.steps,'steps');if(!tc.steps.length)problem('INVALID_SHAPE','test steps are required');
    oneOf(tc.level,['unit','contract','integration','e2e','evaluation','recovery'],'test level');oneOf(tc.environment,['local','dev','prod'],'expected environment');
    if(tc.result!==null){
      object(tc.result,['status','environment','basisSha256','evidence','command','versions'],'result');
      oneOf(tc.result.status,['pass','fail','not-run','blocked'],'result status');oneOf(tc.result.environment,['local','dev','prod'],'observed environment');
      text(tc.result.basisSha256,'result basis');text(tc.result.command,'result command');text(tc.result.versions,'result versions');
      list(tc.result.evidence,'result evidence');tc.result.evidence.forEach(ref);
    }
  }
  list(c.operations,'operations');c.operations.forEach(o=>decision(o,true));
  list(c.reviews,'reviews');for(const r of c.reviews){
    object(r,['actor','context','independent','status','reviewedSha256','coverage','evidence'],'review');
    text(r.actor,'review actor');text(r.context,'review context');if(typeof r.independent!=='boolean')problem('INVALID_SHAPE','independent must be boolean');
    oneOf(r.status,['pass','fail','not-run','blocked'],'review status');text(r.reviewedSha256,'review snapshot');
    object(r.coverage,['requirements','risks','interfaces','operations'],'review coverage');Object.values(r.coverage).forEach(v=>strings(v,'review coverage'));
    list(r.evidence,'review evidence');r.evidence.forEach(ref);
  }
}
export async function reader(root, { fileLimit = LIMIT, totalLimit = 16 * LIMIT, maxFiles = 128 } = {}) {
  const base=resolve(root);let p=base;
  for(;;){const st=await lstat(p);if(st.isSymbolicLink())problem('UNSAFE_ARTIFACT','root may not traverse links');if(dirname(p)===p)break;p=dirname(p);}
  const cache=new Map();let total=0;
  return async value=>{
    if(typeof value!=='string'||value.length>1024||value.includes('\\')||value.includes(':')||value.startsWith('/')||/[\x00-\x1f]/.test(value))problem('UNSAFE_ARTIFACT','invalid relative artifact path');
    const parts=value.split('/');
    if(parts.some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)||part.startsWith('.')||['node_modules','vendor'].includes(part)))problem('UNSAFE_ARTIFACT','unsafe artifact path');
    if(cache.has(value))return cache.get(value);
    if(cache.size>=maxFiles)problem('UNSAFE_ARTIFACT','too many artifact files');
    let target=base;
    for(const part of parts){target=join(target,part);const st=await lstat(target);if(st.isSymbolicLink())problem('UNSAFE_ARTIFACT','artifact may not traverse links');}
    if(!target.startsWith(base+sep))problem('UNSAFE_ARTIFACT','artifact escapes root');
    const st=await lstat(target);if(!st.isFile()||st.size===0||st.size>fileLimit)problem('UNSAFE_ARTIFACT','artifact must be a non-empty regular file within byte limit');
    const handle=await open(target,'r');let bytes;
    try {
      const opened=await handle.stat();if(!opened.isFile()||opened.dev!==st.dev||opened.ino!==st.ino)problem('UNSAFE_ARTIFACT','artifact changed during open');
      const buffer=Buffer.alloc(fileLimit+1);let count=0;
      while(count<buffer.length){const read=await handle.read(buffer,count,buffer.length-count,null);if(!read.bytesRead)break;count+=read.bytesRead;}
      if(!count||count>fileLimit)problem('UNSAFE_ARTIFACT','artifact exceeds byte limit');bytes=buffer.subarray(0,count);
    } finally {await handle.close();}
    total+=bytes.length;if(total>totalLimit)problem('UNSAFE_ARTIFACT','artifact byte budget exceeded');
    cache.set(value,bytes);return bytes;
  };
}
export async function checkDelivery(root,c,{phase='design'}={}) {
  const findings=[];const add=(code,message)=>findings.push({code,message});
  const report=()=>({mode:'advisory',certifiesAcceptance:false,phase,findings,
    recordedExecutions:Array.isArray(c?.testCases)?c.testCases.filter(t=>['pass','fail'].includes(t?.result?.status)).length:0});
  try {oneOf(phase,['design','verify'],'phase');if(Buffer.byteLength(JSON.stringify(c)??'')>LIMIT)problem('INVALID_SHAPE','contract exceeds 1 MiB');shape(c);}
  catch(e){add(e.code??'INVALID_SHAPE',e.message);return report();}
  const unique=(ids,label)=>{if(new Set(ids).size!==ids.length)add('DUPLICATE_ID',label+' contains duplicate IDs');return new Set(ids);};
  const req=unique(c.requirements,'requirements'),tests=unique(c.testCases.map(t=>t.id),'testCases');
  unique(c.risks.map(r=>r.id),'risks');unique(c.interfaces.map(i=>i.id),'interfaces');unique(c.operations.map(o=>o.id),'operations');
  const equal=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));
  const links=(ids,allowed,label)=>{unique(ids,label);for(const id of ids)if(!allowed.has(id))add('UNKNOWN_REFERENCE',label+' references '+id);};
  let read;
  try{read=await reader(root);}catch(e){add('UNSAFE_ARTIFACT',e.message);return report();}
  const checkRef=async r=>{try{const bytes=await read(r.path);if(digest(bytes)!==r.sha256)add('ARTIFACT_MISMATCH','changed artifact: '+r.path);return bytes;}catch{add('UNSAFE_ARTIFACT','unreadable or unsafe artifact: '+r.path);return null;}};
  const requirement=await checkRef(c.requirement);
  if(requirement)try{if(!equal(c.requirements,acceptanceIds(requirement.toString('utf8'))))add('REQUIREMENT_MISMATCH','contract must cover exactly the source requirement IDs');}catch(e){add('REQUIREMENT_MISMATCH',e.message);}
  unique(c.artifacts.map(a=>a.path),'artifact paths');for(const a of c.artifacts)await checkRef(a);
  for(const tc of c.testCases)links(tc.requirements,req,tc.id);
  for(const id of req)if(!c.testCases.some(tc=>tc.requirements.includes(id)))add('UNCOVERED_REQUIREMENT','no test case for '+id);
  for(const r of c.risks){links(r.testIds,tests,r.id);if(!r.testIds.length)add('UNCOVERED_RISK','no test for '+r.id);}
  for(const i of c.interfaces){
    const contractBytes=await checkRef(i.contract);unique(i.operations.map(o=>o.id),i.id+' operations');
    if(contractBytes)try{
      const api=JSON.parse(contractBytes.toString('utf8'));
      if(typeof api.openapi!=='string'||!/^3\.[12]\.\d+$/.test(api.openapi)||!api.paths||typeof api.paths!=='object'||Array.isArray(api.paths)||api.webhooks)throw new Error('only OpenAPI 3.1/3.2 JSON paths supported');
      const ids=[];
      for(const [path,item] of Object.entries(api.paths)){
        if(!path.startsWith('/')||!item||typeof item!=='object'||Array.isArray(item)||item.$ref||Object.hasOwn(item,'additionalOperations'))throw new Error('invalid, referenced or extended path item');
        for(const method of ['get','put','post','delete','options','head','patch','trace','query'])if(Object.hasOwn(item,method)){
          const op=item[method];if(!op||typeof op!=='object'||op.$ref||op.callbacks||typeof op.operationId!=='string'||!op.operationId.trim())throw new Error('operationId required; callbacks/references need external validation');
          ids.push(op.operationId);
        }
      }
      if(!equal(i.operations.map(o=>o.id),ids))add('INTERFACE_MISMATCH',i.id+' must cover exactly the source operationIds');
    }catch{add('UNSUPPORTED_CONTRACT',i.id+' needs a supported OpenAPI JSON operation inventory; use external schema validation separately');}
    for(const op of i.operations){for(const key of ['positive','negative']){links(op[key],tests,i.id+'/'+op.id+'/'+key);if(!op[key].length)add('UNCOVERED_OPERATION',i.id+'/'+op.id+' needs '+key+' cases');}
      if(op.positive.some(id=>op.negative.includes(id)))add('UNCOVERED_OPERATION','positive and negative cases must be distinct: '+op.id);
    }
    if(!equal(i.concerns.map(r=>r.id),CONCERNS))add('CONCERN_MISMATCH',i.id+' must assess all interface concerns');
    for(const r of i.concerns){links(r.testIds,tests,i.id+'/'+r.id);if(r.status==='applicable'&&!r.testIds.length)add('UNCOVERED_RISK',i.id+'/'+r.id+' needs tests');}
  }
  if(!equal(c.operations.map(o=>o.id),OPERATIONS))add('OPERATIONS_MISMATCH','assess all operational concerns');
  for(const o of c.operations){links(o.testIds,tests,'operations/'+o.id);if(o.document)await checkRef(o.document);}
  const basis=basisHash(c);
  for(const tc of c.testCases){const r=tc.result;
    if(r){if(r.basisSha256!==basis)add('STALE_RESULT',tc.id+' was run against another snapshot');if(r.environment!==tc.environment)add('ENVIRONMENT_MISMATCH',tc.id+' observed environment differs');
      for(const e of r.evidence)await checkRef(e);if(['pass','fail'].includes(r.status)&&!r.evidence.length)add('MISSING_EVIDENCE',tc.id+' needs execution evidence');}
    if(phase==='verify'&&r?.status!=='pass')add('TEST_NOT_PASSED',tc.id+': '+(r?.status??'not-run'));
  }
  const expectedCoverage={requirements:c.requirements,risks:c.risks.map(r=>r.id),interfaces:c.interfaces.map(i=>i.id),operations:c.operations.map(o=>o.id)};
  if(phase==='verify'&&!c.reviews.length)add('MISSING_REVIEW','fresh independent review is missing');
  for(const r of c.reviews){
    if(!r.independent||r.actor===c.producer.actor||r.context===c.producer.context)add('REVIEW_NOT_INDEPENDENT','review must use a different actor and fresh context');
    if(r.reviewedSha256!==reviewHash(c))add('STALE_REVIEW','reviewed snapshot differs');
    for(const [key,ids] of Object.entries(expectedCoverage))if(!equal(r.coverage[key],ids))add('REVIEW_COVERAGE','review misses or duplicates '+key);
    if(!r.evidence.length)add('MISSING_EVIDENCE','review requires evidence');for(const e of r.evidence)await checkRef(e);
    if(phase==='verify'&&r.status!=='pass')add('REVIEW_NOT_PASSED','review: '+r.status);
  }
  return report();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),opts={};
    for(let i=0;i<args.length;i+=2){const key=args[i];if(!['--root','--contract','--phase'].includes(key)||!args[i+1]||Object.hasOwn(opts,key))throw new Error('Use --root ROOT --contract RELATIVE_JSON --phase design|verify');opts[key]=args[i+1];}
    if(!opts['--root']||!opts['--contract'])throw new Error('Explicit --root and --contract are required');
    const read=await reader(opts['--root']);const c=JSON.parse((await read(opts['--contract'])).toString('utf8'));
    const report=await checkDelivery(opts['--root'],c,{phase:opts['--phase']??'design'});
    console.log(JSON.stringify(report,null,2));process.exitCode=report.findings.length?1:0;
  }catch{console.error('Invalid or unreadable delivery contract; no commands or external requests executed.');process.exitCode=2;}
}

/** Stable read-only harness entry point; payload commands are inert records. */
export async function deliveryCommand(root, action, args) {
  if (['ui-init','ui-check','ui-hash','ui-approval-check'].includes(action)) {
    const { uiCommand } = await import('./ui-contract.mjs');
    try { return await uiCommand(root, action, args); }
    catch (error) {
      const { redact } = await import('./shared.mjs');
      const message = error.message?.startsWith('UI contract:') ? redact(error.message) : 'UI契約/参照ファイル/引数を読み取れません。対象と形式を確認してください。';
      return {mode:action,valid:false,certifiesAppearance:false,identityAuthenticated:false,findings:[{code:'UI_CONTRACT_INVALID',message}],summary:'UI確認は未完了です。表示された不足を解決し、必要な再レビュー・再承認を行ってください。'};
    }
  }
  if (!['check','hashes'].includes(action)) throw new Error('delivery check|hashes を指定してください。');
  const options = {};
  for (let n=0;n<args.length;n+=2) {
    const key=args[n];
    if (!['--contract','--phase'].includes(key) || !args[n+1] || Object.hasOwn(options,key)) throw new Error('delivery --contract 相対JSON --phase design|verify を指定してください。');
    options[key]=args[n+1];
  }
  if (!options['--contract'] || (action==='hashes' && options['--phase'])) throw new Error('contractは必須。hashesにはphaseを指定しません。');
  if (options['--phase'] !== undefined) oneOf(options['--phase'], ['design','verify'], 'phase');
  const read=await reader(root);
  const c=JSON.parse((await read(options['--contract'])).toString('utf8'));
  if (action==='hashes') {
    shape(c);
    return {mode:'advisory',certifiesAcceptance:false,
      summary:'記録のhash計算のみ。参照ファイルの一致・実行・受入を証明しません。',
      basisSha256:basisHash(c),reviewedSha256:reviewHash(c)};
  }
  const report=await checkDelivery(root,c,{phase:options['--phase']??'design'});
  return {...report,summary:report.findings.length
    ? '品質契約に指摘があります。未実行・不整合を解決し、意味の妥当性は独立レビューで確認してください。'
    : '構造上の指摘はありません。業務受入・実行事実・実環境の成功を証明するものではありません。'};
}
