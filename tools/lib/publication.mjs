import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { exists } from './shared.mjs';
import { inspectPublicationSource, assertPublicationUpgrade, assertPublicationCommitFiles } from './distribution.mjs';

const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const ZERO = /^0+$/;
export const hookText = '#!/bin/sh\n# Databricks harness publication guard v1\nwhile read -r local_ref local_oid remote_ref remote_oid; do\n  if [ "$remote_ref" = "refs/heads/main" ]; then\n    printf "%s %s %s %s\\n" "$local_ref" "$local_oid" "$remote_ref" "$remote_oid" | node tools/harness-publication.mjs pre-push || exit $?\n  fi\ndone\n';

function git(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', shell: false, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0 && !allowFailure) throw new Error(`Git確認に失敗: ${args[0]}。履歴/設定を確認してください。`);
  return result;
}
async function noLinks(path) {
  let current = resolve(path);
  for (;;) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('公開検査/guardはlinkやjunctionを辿りません。'); }
    catch(error) { if(error.code !== 'ENOENT') throw error; }
    const parent=dirname(current); if(parent===current) break; current=parent;
  }
}

export async function checkPublication(root, { base, committed = false, revision } = {}) {
  const snapshot = await inspectPublicationSource(root);
  let baseStatus = 'not-requested';
  if (base) {
    if (!OID.test(base) || ZERO.test(base)) throw new Error('--baseは取得済みの正確なcommit SHAが必要です。');
    git(root, ['cat-file','-e',`${base}^{commit}`]);
    const files = git(root,['ls-tree','--name-only',base,'--','harness/base-release.json']).stdout.trim();
    if (files) {
      const previous = JSON.parse(git(root,['show',`${base}:harness/base-release.json`]).stdout);
      assertPublicationUpgrade(snapshot.manifest, previous); baseStatus = 'compared';
    } else baseStatus = 'legacy-without-stamp';
  }
  if (committed || revision) {
    const head = git(root,['rev-parse','HEAD']).stdout.trim();
    if (revision && (!OID.test(revision) || revision !== head)) throw new Error('送信commitをcheckoutして確認してください。HEAD以外をmainへ送信しません。');
    const scope = new Set([...snapshot.managedPaths,'harness/base-release.json','package.json','package-lock.json']);
    const changed = git(root,['diff','--name-only','-z','HEAD']).stdout.split('\0').filter(path=>scope.has(path));
    const tracked = new Set(git(root,['ls-tree','-r','--name-only','-z','HEAD']).stdout.split('\0').filter(Boolean));
    assertPublicationCommitFiles(snapshot.manifest, [...tracked]);
    const untracked = [...scope].filter(path=>!tracked.has(path));
    if(changed.length || untracked.length) throw new Error(`公開対象をcommitしてから検査してください: ${[...changed,...untracked].join(', ')}`);
  }
  return { status:'stamp-valid',version:snapshot.manifest.version,manifestSha256:snapshot.manifestSha256,managedFiles:snapshot.managedPaths.length,baseStatus,committed:Boolean(committed||revision),certifiesAcceptance:false,warning:'版と配布内容の整合検査。独立レビュー・更新試験・remote到達の証明ではありません。' };
}

export async function prePush(root, input) {
  if (Buffer.byteLength(input)>1024*1024) throw new Error('push ref入力が上限を超えています。');
  const lines=input.trim()?input.trim().split(/\r?\n/):[];
  if(lines.length>128) throw new Error('push ref数が上限を超えています。');
  const reports=[];
  for(const line of lines) {
    const fields=line.split(/\s+/);
    if(fields.length!==4 || !OID.test(fields[1]) || !OID.test(fields[3])) throw new Error('Git pre-push入力が不正です。');
    const [,local,remoteRef,remote]=fields;
    if(remoteRef!=='refs/heads/main') continue;
    if(ZERO.test(local)) throw new Error('mainの削除は公開guardが拒否します。');
    reports.push(await checkPublication(root,{revision:local,committed:true,...(!ZERO.test(remote)?{base:remote}:{})}));
  }
  return {status:reports.length?'checked':'not-main',reports};
}

async function hookPath(root) {
  if(await exists(join(root,'product.config.json'))) throw new Error('公開guardはハーネス開発元専用です。案件には導入しません。');
  await noLinks(root);
  const configured=git(root,['config','--get','core.hooksPath'],{allowFailure:true});
  if(configured.status!==1) throw new Error('既存core.hooksPathを保持して停止します。既存hookとの統合を確認してください。');
  const path=resolve(root,git(root,['rev-parse','--git-path','hooks/pre-push']).stdout.trim());
  await noLinks(path);
  return path;
}
export async function guardStatus(root) {
  const path=await hookPath(root);
  if(!await exists(path)) return {status:'not-installed',path};
  const st=await lstat(path);
  if(!st.isFile() || st.size>16384 || await readFile(path,'utf8')!==hookText) throw new Error('既存pre-push hookを保持して停止します。自動上書きしません。');
  if(process.platform!=='win32' && !(st.mode&0o111)) throw new Error('公開guardに実行権限がありません。');
  return {status:'installed',path};
}
export async function installGuard(root) {
  const state=await guardStatus(root);
  if(state.status==='installed') return state;
  await mkdir(dirname(state.path),{recursive:true});
  await writeFile(state.path,hookText,{flag:'wx',mode:0o755});
  await chmod(state.path,0o755);
  return guardStatus(root);
}
