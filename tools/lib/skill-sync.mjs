import {lstat,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname,join,relative} from 'node:path';
import {atomicWrite,withFileLock,sha256} from './shared.mjs';
import {assertUnlinkedPath} from './scaffold-output.mjs';

async function info(path){try{return await lstat(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function inventory(base,expected){
  const files=new Map();let count=0,total=0;
  await assertUnlinkedPath(base);
  if(!await info(base))return files;
  async function walk(dir,prefix='',depth=0){
    if(depth>20)throw new Error('Skill directory depth exceeded.');
    for(const entry of await readdir(dir,{withFileTypes:true})){
      if(++count>20000)throw new Error('Skill file count exceeded.');
      const rel=prefix+entry.name,path=join(dir,entry.name),item=await lstat(path);
      if(item.isSymbolicLink()||!item.isDirectory()&&(!item.isFile()||item.nlink!==1))throw new Error('Skill symlink/junction/hardlink/non-file refused: '+rel);
      if(item.isDirectory()){
        if(![...expected.keys()].some(p=>p.startsWith(rel+'/')))throw new Error('Unknown/unmanaged skill directory; preserved without deletion: '+rel);
        await walk(path,rel+'/',depth+1);
      }else{
        if(!expected.has(rel))throw new Error('Unknown/unmanaged skill file; preserved without deletion: '+rel);
        total+=item.size;if(total>64*1024*1024)throw new Error('Skill byte limit exceeded.');
        files.set(rel,await readFile(path));
      }
    }
  }
  await walk(base);return files;
}

export async function syncSkillsSafely(root,targets,expected){
  const lock=join(root,'.harness/agent-assets/sync');await assertUnlinkedPath(lock);
  return withFileLock(lock,async()=>{
    // Inventory every provider before the first write; unknown content is never deleted.
    const old=await Promise.all(targets.map(target=>inventory(target,expected)));
    const changes=[];
    for(const [index,target] of targets.entries())for(const [name,bytes] of expected){
      const prior=old[index].get(name);if(!prior?.equals(bytes))changes.push({target,name,bytes,prior});
    }
    const overwritten=changes.filter(c=>c.prior),backup=overwritten.length?join(root,'.harness/agent-assets/backups',randomUUID()):null;
    if(backup){
      await assertUnlinkedPath(backup);await mkdir(backup,{recursive:true});
      const records=[];
      for(const c of overwritten){
        const rel=relative(root,join(c.target,c.name)).replaceAll('\\','/'),path=join(backup,rel);
        await mkdir(dirname(path),{recursive:true});await writeFile(path,c.prior,{flag:'wx'});
        records.push({path:rel,sha256:sha256(c.prior)});
      }
      await writeFile(join(backup,'manifest.json'),JSON.stringify({schemaVersion:1,files:records},null,2)+'\n',{flag:'wx'});
      console.log('Managed skill backups: '+relative(root,backup).replaceAll('\\','/'));
    }
    for(const c of changes){
      const path=join(c.target,c.name);await assertUnlinkedPath(path);
      const now=await info(path);
      if(now?.isSymbolicLink()||now&&!now.isFile()||now?.nlink>1)throw new Error('Skill target changed type; preserved backup.');
      if(c.prior?(!now||!c.prior.equals(await readFile(path))):now)throw new Error('Skill target changed during sync; preserve backup and retry after review.');
      await atomicWrite(path,c.bytes);
    }
    return {changed:changes.length,backup};
  });
}
