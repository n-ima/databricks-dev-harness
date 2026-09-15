import { reader, digest } from './delivery-assurance.mjs';
import { lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseFrontmatter, pathInside, exists, writeJson, withFileLock } from './shared.mjs';

// This verifies recorded correspondence and integrity, not pixels or human identity.
const HASH = /^[a-f0-9]{64}$/;
const LIMIT = 1024 * 1024;
function fail(message) { throw new Error('UI contract: ' + message); }
function text(v, label) { if (typeof v !== 'string' || !v.trim() || v.length > 4000 || /[\x00-\x1f]/.test(v)) fail(label + ' must be bounded non-empty text'); }
function object(v, keys, label) { if (!v || typeof v !== 'object' || Array.isArray(v) || keys.some(k => !Object.hasOwn(v,k)) || Object.keys(v).some(k => !keys.includes(k))) fail(label + ' has missing or unknown fields'); }
function array(v, label, nonempty = true) { if (!Array.isArray(v) || v.length > 256 || (nonempty && !v.length)) fail(label + ' must be a bounded non-empty array'); }
function strings(v, label) { array(v,label); v.forEach(x=>text(x,label)); if(new Set(v).size!==v.length)fail(label+' has duplicates'); }
function canonical(v) { return Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v; }
export function uiReviewHash(contract) { const { review, ...basis } = contract; return digest(JSON.stringify(canonical(basis))); }
function relative(v, label) { text(v,label); if(!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_. -]+)*$/.test(v)||v.split('/').some(p=>p==='..'||p==='.'||/[. ]$/.test(p)))fail(label+' must be a repository-relative path'); return v; }
const within = (root, p) => p.startsWith(root + '/');
async function safeOutput(path) {
  for(let current=resolve(path);;current=dirname(current)) {
    try { if((await lstat(current)).isSymbolicLink())fail('symlink or junction output is not allowed'); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    if(dirname(current)===current)break;
  }
}

// Deliberately bounded npm spec support; never guess aliases/URLs/compound ranges.
function versionSatisfies(spec, resolved) {
  const pattern=/^(\^|~)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[\w.-]+)?$/;
  const base=typeof spec==='string'&&spec.match(pattern),actual=resolved.match(pattern);
  if(!base||!actual||actual[1])return false;
  if(base[5]||actual[5])return spec===resolved;
  const b=base.slice(2,5).map(Number),a=actual.slice(2,5).map(Number);
  if([...b,...a].some(n=>!Number.isSafeInteger(n)))return false;
  const compare=a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
  if(!base[1])return compare===0;
  if(compare<0)return false;
  if(base[1]==='~')return a[0]===b[0]&&a[1]===b[1];
  return b[0]>0 ? a[0]===b[0] : b[1]>0 ? a[0]===0&&a[1]===b[1] : a[0]===0&&a[1]===0&&a[2]===b[2];
}

export async function validateUiContract(root, contractPath, { phase = 'mock', sessionId, appRoot, appkitVersion } = {}) {
  if (!['preview','mock'].includes(phase)) fail('phase must be preview or mock');
  if (!contractPath) fail('missing --ui-contract; retain the old approval, review the actual runtime UI and approve again');
  relative(contractPath,'contract path');
  if (!contractPath.startsWith('docs/product/ui/') || !contractPath.endsWith('.json')) fail('contract belongs under docs/product/ui/*.json');
  const read = await reader(root,{fileLimit:8*LIMIT,totalLimit:64*LIMIT,maxFiles:256});
  const contractBytes = await read(contractPath);
  if(contractBytes.length>LIMIT)fail('contract exceeds 1 MiB');
  const c = JSON.parse(contractBytes.toString('utf8'));
  object(c,['schemaVersion','sessionId','producer','requirement','architecture','target','runtime','screens','unresolved','review'],'contract');
  if(c.schemaVersion!==1)fail('unsupported schemaVersion');
  if(typeof c.sessionId!=='string'||!/^[A-Za-z0-9_-]+$/.test(c.sessionId))fail('invalid sessionId');
  if(sessionId&&c.sessionId!==sessionId)fail('session mismatch');
  object(c.producer,['actor','context'],'producer'); text(c.producer.actor,'producer actor'); text(c.producer.context,'producer context');
  const hashes = { [contractPath]: digest(contractBytes) };
  const ref = async r => {
    object(r,['path','sha256'],'reference'); relative(r.path,'reference path'); if(!HASH.test(r.sha256))fail('reference requires SHA-256');
    const bytes=await read(r.path); if(digest(bytes)!==r.sha256)fail('changed artifact: '+r.path);
    if(hashes[r.path]&&hashes[r.path]!==r.sha256)fail('inconsistent reference: '+r.path);
    hashes[r.path]=r.sha256; return bytes;
  };
  const refs = async (list,label) => { array(list,label); for(const r of list)await ref(r); };
  const sessionBytes=await read('work/sessions/'+c.sessionId+'.md');
  const session=parseFrontmatter(sessionBytes.toString('utf8'));
  if(session.id!==c.sessionId||session.requirement!==c.requirement?.path||session.architecture!==c.architecture?.path)fail('session requirement/design mismatch');
  await ref(c.requirement); await ref(c.architecture);
  object(c.target,['hosting','framework','appRoot','exception'],'target');
  if(!['databricks-apps','external'].includes(c.target.hosting))fail('select hosting explicitly');
  text(c.target.framework,'framework');relative(c.target.appRoot,'appRoot');
  if(appRoot&&c.target.appRoot!==appRoot)fail('different appRoot; reuse the reviewed app, do not reinitialize a different app');
  if(c.target.hosting!=='databricks-apps'||c.target.framework!=='databricks-appkit') {
    const e=c.target.exception;object(e,['actor','decision','hosting','framework','requirementSha256','evidence'],'explicit exception');
    text(e.actor,'exception actor');
    if(e.decision!=='approved'||e.hosting!==c.target.hosting||e.framework!==c.target.framework||e.requirementSha256!==c.requirement.sha256)fail('exception does not approve this exact target and requirement');
    await ref(e.evidence);
  } else if(c.target.exception!==null)fail('default target must not carry an unused exception');
  object(c.runtime,['version','manifest','lockfile','sources','styles','fixtures'],'runtime');text(c.runtime.version,'runtime version');
  for(const r of [c.runtime.manifest,c.runtime.lockfile,...(c.runtime.sources||[]),...(c.runtime.styles||[]),...(c.runtime.fixtures||[])]) {
    if(!r?.path||!within(c.target.appRoot,r.path))fail('runtime references must belong to the reviewed appRoot');
  }
  const manifestBytes=await ref(c.runtime.manifest),lockBytes=await ref(c.runtime.lockfile);
  await refs(c.runtime.sources,'runtime shared/entry sources');await refs(c.runtime.styles,'runtime styles');await refs(c.runtime.fixtures,'runtime fixtures');
  if(c.target.framework==='databricks-appkit') {
    if(c.runtime.manifest.path!==c.target.appRoot+'/package.json'||c.runtime.lockfile.path!==c.target.appRoot+'/package-lock.json')fail('AppKit requires its actual package.json and npm lockfile');
    const manifest=JSON.parse(manifestBytes),lock=JSON.parse(lockBytes);
    if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(c.runtime.version))fail('AppKit version must be exact');
    for(const name of ['@databricks/appkit','@databricks/appkit-ui']) {
      if(typeof manifest.dependencies?.[name]!=='string'||lock.packages?.['node_modules/'+name]?.version!==c.runtime.version)fail('AppKit package/lock version mismatch: '+name);
      if(!versionSatisfies(manifest.dependencies[name],c.runtime.version))fail('AppKit dependency spec is incompatible or unsupported; use an exact version, caret or tilde stable range: '+name);
      if(lock.packages?.['']?.dependencies?.[name]!==manifest.dependencies[name])fail('manifest and root lock dependencies differ: '+name);
    }
    if(appkitVersion&&c.runtime.version!==appkitVersion.replace(/^v/,''))fail('AppKit template version differs from the reviewed UI');
  }
  array(c.screens,'screens'); const ids=new Set();
  for(const s of c.screens) {
    object(s,['id','source','components','states','previews','behavior'],'screen');text(s.id,'screen id');if(ids.has(s.id))fail('duplicate screen id');ids.add(s.id);
    if(!s.source?.path||!within(c.target.appRoot,s.source.path))fail('screen source must belong to the reviewed appRoot');
    if(c.target.framework==='databricks-appkit'&&!/\.[jt]sx$/.test(s.source.path))fail('AppKit screen requires runtime React source, not standalone HTML');
    if(!c.runtime.sources.some(r=>r.path===s.source.path&&r.sha256===s.source.sha256))fail('screen source must be included in runtime sources');
    await ref(s.source);strings(s.components,'screen components');strings(s.states,'screen states');array(s.previews,'previews');array(s.behavior,'behavior',phase==='mock');
    const previewStates=new Set(),behaviorStates=new Set();
    for(const p of s.previews) {
      object(p,['state','mode','source','runtimeSha256','evidence'],'preview');
      if(!s.states.includes(p.state)||previewStates.has(p.state))fail('unknown or duplicate preview state');previewStates.add(p.state);
      if(!['runtime','runtime-html'].includes(p.mode))fail('approximate HTML is not a runtime UI preview');
      if(p.runtimeSha256!==s.source.sha256)fail('preview is not bound to its runtime source');
      if(p.mode==='runtime'&&p.source?.path!==s.source.path)fail('runtime preview must use the same screen source');
      if(p.mode==='runtime-html'&&(!/\.html?$/.test(p.source?.path||'')||phase==='mock'))fail('static runtime HTML cannot replace behavioral mock approval');
      await ref(p.source);await refs(p.evidence,'preview render/visual evidence');
    }
    if(previewStates.size!==s.states.length)fail('missing preview state');
    for(const b of s.behavior) {
      object(b,['state','evidence'],'behavior');if(!s.states.includes(b.state)||behaviorStates.has(b.state))fail('unknown or duplicate behavior state');behaviorStates.add(b.state);await refs(b.evidence,'behavior/accessibility evidence');
    }
    if(phase==='mock'&&behaviorStates.size!==s.states.length)fail('missing behavior or accessibility evidence');
  }
  array(c.unresolved,'unresolved differences',false);if(c.unresolved.length)fail('unresolved design/runtime differences');
  const r=c.review;object(r,['actor','context','status','reviewedSha256','screens','evidence'],'independent review');
  text(r.actor,'review actor');text(r.context,'review context');
  if(r.actor===c.producer.actor||r.context===c.producer.context||r.status!=='pass')fail('passing fresh-context independent review is required');
  if(r.reviewedSha256!==uiReviewHash(c))fail('stale review');strings(r.screens,'review screen coverage');
  if(r.screens.length!==ids.size||r.screens.some(id=>!ids.has(id)))fail('review must cover every screen');
  await refs(r.evidence,'independent review evidence');
  return { contract:c,artifactHashes:hashes,contractPath,phase,certifiesAppearance:false,identityAuthenticated:false };
}

export async function validateUiApproval(root, record, expected = {}) {
  if(record?.gate!=='ui-mock'||record.decision!=='approved'||!record.actor||!record.sessionId)fail('matching human UI approval required');
  if(expected.sessionId&&record.sessionId!==expected.sessionId)fail('approval session mismatch');
  if(!record.uiContract||!record.artifactHashes?.[record.uiContract])fail('legacy approval lacks a bound ui-contract; retain it and review/reapprove the current app');
  const checked=await validateUiContract(root,record.uiContract,{...expected,sessionId:record.sessionId,phase:'mock'});
  for(const [p,hash] of Object.entries(checked.artifactHashes))if(record.artifactHashes?.[p]!==hash)fail('approval does not bind current UI artifact: '+p);
  const read=await reader(root,{fileLimit:8*LIMIT,totalLimit:64*LIMIT,maxFiles:256});
  if(!record.evidence||!record.artifactHashes[record.evidence])fail('human evidence is not bound');
  for(const [p,hash] of Object.entries(record.artifactHashes))if(!HASH.test(hash)||digest(await read(p))!==hash)fail('approved artifact changed: '+p);
  return checked;
}

export async function uiCommand(root, action, args) {
  const opts={};for(let n=0;n<args.length;n+=2){const k=args[n];if(!['--contract','--phase','--session','--app-root','--approval'].includes(k)||!args[n+1]||Object.hasOwn(opts,k))fail('invalid or duplicate UI argument');opts[k]=args[n+1];}
  if(action==='ui-approval-check') {
    if(!opts['--approval']||!opts['--session']||!opts['--app-root']||opts['--contract']||opts['--phase'])fail('ui-approval-check requires --approval, --session and --app-root only');
    const read=await reader(root),record=JSON.parse(await read(opts['--approval']));
    await validateUiApproval(root,record,{sessionId:opts['--session'],appRoot:opts['--app-root']});
    return {mode:'ui-approval-check',valid:true,certifiesAppearance:false,identityAuthenticated:false,summary:'指定session/appのUI承認記録と現ファイルは整合。人の実在・画面一致は別の確認が必要です。'};
  }
  if(opts['--approval'])fail('--approval applies only to ui-approval-check');
  const path=opts['--contract'];if(!path)fail('--contract is required');
  if(action!=='ui-init'&&(opts['--session']||opts['--app-root']))fail('session/app-root apply only to ui-init');
  if(action==='ui-init') {
    if(opts['--phase']||!opts['--session']||!opts['--app-root'])fail('ui-init requires --session and --app-root');
    if(!/^[A-Za-z0-9_-]+$/.test(opts['--session']))fail('invalid session');relative(opts['--app-root'],'appRoot');relative(path,'contract path');
    if(!path.startsWith('docs/product/ui/')||!path.endsWith('.json'))fail('contract belongs under docs/product/ui/*.json');
    const read=await reader(root);const s=parseFrontmatter((await read('work/sessions/'+opts['--session']+'.md')).toString('utf8'));
    if(s.id!==opts['--session']||s.status!=='active')fail('active matching session required');
    const r=async p=>({path:p,sha256:digest(await read(p))});
    const c={schemaVersion:1,sessionId:s.id,producer:{actor:'未確定',context:'未確定'},requirement:await r(s.requirement),architecture:await r(s.architecture),
      target:{hosting:'databricks-apps',framework:'databricks-appkit',appRoot:opts['--app-root'],exception:null},
      runtime:{version:'未確定',manifest:null,lockfile:null,sources:[],styles:[],fixtures:[]},screens:[],unresolved:['既存appの部品・版・描画・状態と独立レビューを記録する'],review:null};
    const output=pathInside(root,path);await safeOutput(output);
    await withFileLock(output,async()=>{await safeOutput(output);if(await exists(output))fail('refusing to overwrite existing UI contract');await writeJson(output,c);});
    return {mode:'ui-contract-draft',path,ready:false,summary:'Databricks Appsを既定に下書きを作成。実アプリと証拠を対応付けるまでUI確認済みではありません。'};
  }
  if(action==='ui-hash') {
    if(opts['--phase'])fail('ui-hash does not accept phase');const read=await reader(root);const c=JSON.parse(await read(path));
    return {reviewedSha256:uiReviewHash(c),certifiesAppearance:false,summary:'レビュー対象hashのみ。実行・視覚・人の承認を証明しません。'};
  }
  if(action!=='ui-check')fail('unknown UI action');
  const checked=await validateUiContract(root,path,{phase:opts['--phase']??'preview'});
  return {mode:'ui-contract-check',phase:checked.phase,findings:[],artifactCount:Object.keys(checked.artifactHashes).length,certifiesAppearance:false,identityAuthenticated:false,
    summary:'UI対応記録とhashは整合。実際の画面一致と操作は独立レビュー・人の確認が必要です。'};
}
