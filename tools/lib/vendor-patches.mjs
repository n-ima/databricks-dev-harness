import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {atomicWrite,pathInside,sha256} from './shared.mjs';
import {assertUnlinkedPath} from './scaffold-output.mjs';

function replaceOnce(text,before,after){
  if(!before||text.split(before).length!==2)throw new Error('Vendor patch hunk does not match exactly once; review the upstream change.');
  return text.replace(before,after);
}
export function correctedVendorBytes(bytes,spec){
  const text=bytes.toString('utf8');
  if(!Buffer.from(text).equals(bytes))throw new Error('Vendor patch requires valid UTF-8.');
  let original=text;
  if(sha256(bytes)!==spec.sourceSha256){
    for(const e of [...spec.edits].reverse()) original=replaceOnce(original,e.after,e.before);
    if(sha256(Buffer.from(original))!==spec.sourceSha256)throw new Error('Vendor patch source hash changed; independent review required.');
  }
  for(const e of spec.edits)original=replaceOnce(original,e.before,e.after);
  return Buffer.from(original);
}
export async function vendorPatches(root,directory,version,{write=false}={}){
  const manifest=JSON.parse(await readFile(join(root,'harness/vendor-patches.json'),'utf8'));
  if(manifest.schemaVersion!==1||manifest.upstreamVersion!==version||!Array.isArray(manifest.files))throw new Error('Vendor patches have not been reviewed for this upstream version.');
  const changes=[];
  for(const spec of manifest.files){
    const path=pathInside(directory,spec.path,'vendor patch');await assertUnlinkedPath(path);
    const before=await readFile(path),after=correctedVendorBytes(before,spec);
    if(!before.equals(after))changes.push({path,after});
  }
  // Validate every file before changing any file.
  if(!write&&changes.length)throw new Error('Reviewed vendor corrections are not applied; run agent-assets:sync.');
  for(const {path,after} of changes)await atomicWrite(path,after);
  return {changed:changes.length,version};
}
