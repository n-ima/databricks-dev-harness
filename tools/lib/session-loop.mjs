import {readFile,readdir} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {exists,parseFrontmatter,readJson} from './shared.mjs';
import {assertUnlinkedPath} from './scaffold-output.mjs';

export async function loopSessionPath(root,id){
  if(typeof id!=='string'||!id||!/^[-\p{L}\p{N}_]+$/u.test(id)) throw new Error('Invalid loop session id.');
  const directory=join(root,'work/sessions');await assertUnlinkedPath(directory);
  const names=(await readdir(directory)).filter(n=>n.endsWith('.md'));
  const exact=names.filter(n=>n===id+'.md');
  const matches=exact.length?exact:names.filter(n=>n.startsWith(id));
  if(matches.length!==1) throw new Error('Loop session not found or ambiguous.');
  const path=join(directory,matches[0]);await assertUnlinkedPath(path);return path;
}
export async function readLoopSession(root,id,{allowPending=false}={}){
  const path=await loopSessionPath(root,id);
  const fields=parseFrontmatter(await readFile(path,'utf8'));
  if(fields.id&&fields.id!==basename(path,'.md')) throw new Error('Loop session identity does not match its file.');
  if(fields.status!=='active') throw new Error(`Loop session must be active (observed ${fields.status||'invalid'}).`);
  if(!allowPending&&fields.gate_status==='pending') throw new Error(`Session gate is pending: ${fields.gate||'unknown'}`);
  return {path,fields};
}

// Caller owns the session lock; writers use loop -> session, never reverse.
export async function assertSessionLoopsComplete(root,sessionId){
  const directory=join(root,'work/loops');await assertUnlinkedPath(directory);
  if(!await exists(directory)) return;
  for(const name of (await readdir(directory)).filter(n=>n.endsWith('.json'))){
    const path=join(directory,name);await assertUnlinkedPath(path);
    let state;try{state=await readJson(path);}catch{throw new Error(`Unreadable loop record: ${name}`);}
    if(!state||typeof state.sessionId!=='string'||state.id!==basename(name,'.json')||!Array.isArray(state.iterations)||!['active','achieved','blocked','budget_exhausted','failed','cancelled'].includes(state.status)) throw new Error(`Invalid loop record: ${name}`);
    if(state.sessionId!==sessionId) continue;
    if(await exists(path+'.lock')||state.status==='active'||state.gate?.status==='pending'||state.iterations.some(i=>!i||!i.finishedAt)) throw new Error(`Session has an unresolved loop: ${state.id}. Preserve it and resolve or hand off; cancellation is not approval.`);
    if(state.gate&&state.gate.status!=='approved') throw new Error(`Invalid loop gate: ${state.id}`);
  }
}
