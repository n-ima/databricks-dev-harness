// Read-only external verification. Writes only publication review records via apply_patch.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const repo = 'D:/projects/databricks-dev-harness';
const commit = '69ebf2ebe33da2bc3a551970e40fb5edca9667b7';
const expectedManifest = '4f5b27da15fc53f59a69b230bca0e8bf83319d2147ed36ad9c478aaf1637209c';
const remotePath = 'work/evidence/2026-09-15-publication-060-independent-remote.json';
const reviewPath = 'work/reviews/2026-09-15-publication-060-push-review.md';
const acceptancePath = 'work/reviews/2026-09-15-publication-060-acceptance.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: repo, input, maxBuffer: 32 * 1024 * 1024, timeout: 120000 });
  assert.equal(result.status, 0, result.error?.message || result.stderr.toString());
  return result;
}
function observed(command, args) {
  const result = run(command, args);
  records.push({ command: [command, ...args], cwd: repo, exitCode: result.status, stdout: result.stdout.toString('utf8'), stderr: result.stderr.toString('utf8'), observedAt: new Date().toISOString() });
  return result.stdout.toString('utf8').trim();
}
async function patchFile(path, value, existing = false) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  const old = existing ? await readFile(join(repo, path), 'utf8') : null;
  const lines = text.trimEnd().split(/\r?\n/);
  const execute = patch => {
    const p = spawnSync('C:/Users/nimao/AppData/Local/OpenAI/Codex/bin/bffc5354119c8421/codex.exe', ['--codex-run-as-apply-patch', patch], { encoding: 'utf8' });
    assert.equal(p.status, 0, p.error?.message || p.stderr || p.stdout);
  };
  execute(`*** Begin Patch\n*** ${existing ? 'Update' : 'Add'} File: ${join(repo, path)}\n${existing ? '@@\n' + old.trimEnd().split(/\r?\n/).map(x => '-' + x).join('\n') + '\n' : ''}${lines.slice(0, 40).map(x => '+' + x).join('\n')}\n*** End Patch`);
  for (let offset = 40; offset < lines.length; offset += 40) execute(`*** Begin Patch\n*** Update File: ${join(repo, path)}\n@@\n${lines.slice(offset - 3, offset).map(x => ' ' + x).join('\n')}\n${lines.slice(offset, offset + 40).map(x => '+' + x).join('\n')}\n*** End of File\n*** End Patch`);
}
const immutablePaths = ['work/quality/safe-local-update.json', 'work/reviews/2026-09-15-publication-060-review.md', 'work/reviews/2026-09-15-publication-060-safe-update-acceptance.json', 'work/evidence/2026-09-15/publication-060-independent-quality-verify.json'.replace('2026-09-15/', '2026-09-15-')];
const immutableBefore = Object.fromEntries(await Promise.all(immutablePaths.map(async p => [p, sha(await readFile(join(repo, p)))])));
const remote = observed('git', ['ls-remote', 'origin', 'refs/heads/main']);
assert.equal(remote.split(/\s+/)[0], commit);
const repository = JSON.parse(observed('gh', ['repo', 'view', 'n-ima/databricks-dev-harness', '--json', 'nameWithOwner,isPrivate,isTemplate,defaultBranchRef']));
assert.equal(repository.isPrivate, true); assert.equal(repository.isTemplate, true); assert.equal(repository.defaultBranchRef.name, 'main');
const cliRuns = JSON.parse(observed('gh', ['run', 'list', '--repo', 'n-ima/databricks-dev-harness', '--commit', commit, '--json', 'databaseId,headSha,name,status,conclusion,url,event']));
const apiRuns = JSON.parse(observed('gh', ['api', `repos/n-ima/databricks-dev-harness/actions/runs?head_sha=${commit}&per_page=100`]));
const checkRuns = JSON.parse(observed('gh', ['api', `repos/n-ima/databricks-dev-harness/commits/${commit}/check-runs`, '-H', 'Accept: application/vnd.github+json']));
assert.deepEqual(cliRuns, []); assert.equal(apiRuns.total_count, 0); assert.equal(checkRuns.total_count, 0);
const permissionsArgs = ['api', 'repos/n-ima/databricks-dev-harness/actions/permissions'];
const permissionsResult = spawnSync('gh', permissionsArgs, { cwd: repo, encoding: 'utf8', timeout: 120000 });
const actionsPermissions = { command: ['gh', ...permissionsArgs], exitCode: permissionsResult.status, stdout: permissionsResult.stdout ?? '', stderr: permissionsResult.stderr ?? '', observedAt: new Date().toISOString() };
records.push(actionsPermissions);
const manifestBytes = run('git', ['show', `${commit}:harness/base-release.json`]).stdout;
assert.equal(sha(manifestBytes), expectedManifest);
const manifest = JSON.parse(manifestBytes); assert.equal(manifest.version, '0.6.0'); assert.equal(manifest.managedFiles.length, 1067);
const allPaths = run('git', ['ls-tree', '-r', '--name-only', commit]).stdout.toString('utf8').trim().split('\n');
assert.ok(!allPaths.some(p => /scoped-approval|SCOPED_APPROVALS/.test(p)));
for (const p of ['tools/harness.mjs', 'tools/lib/distribution.mjs', 'docs/harness/operations/CLI_REFERENCE.md']) assert.doesNotMatch(run('git', ['show', `${commit}:${p}`]).stdout.toString('utf8'), /scoped-approval|SCOPED_APPROVALS|approval-scope/);
const blobs = run('git', ['cat-file', '--batch'], manifest.managedFiles.map(x => `${commit}:${x.path}`).join('\n') + '\n').stdout;
let offset = 0; const blobHashes = {};
for (const item of manifest.managedFiles) {
  const end = blobs.indexOf(10, offset), header = blobs.subarray(offset, end).toString('utf8');
  assert.match(header, /^[a-f0-9]+ blob \d+$/);
  const length = Number(header.split(' ')[2]), bytes = blobs.subarray(end + 1, end + 1 + length);
  assert.equal(sha(bytes), item.sha256, item.path); assert.equal(length, item.bytes, item.path);
  blobHashes[item.path] = sha(bytes); offset = end + length + 2;
}
const parents = observed('git', ['show', '-s', '--format=%P', commit]).split(' ');
assert.deepEqual(parents, ['a37f3321188ce11f455f5d76793a24fe16ad78e1']);
for (const [p, hash] of Object.entries(immutableBefore)) assert.equal(sha(await readFile(join(repo, p))), hash, p);
const result = { schemaVersion: 1, reviewer: '/root/publication_060_review', status: 'pass', criterion: 'P060-04', observedAt: new Date().toISOString(), commit, remoteMain: remote.split(/\s+/)[0], parents, repository, manifestSha256: expectedManifest, managedFiles: 1067, managedCommitBlobParity: true, hard03PathsAndDispatchAbsent: true, commitFileCount: allPaths.length, blobHashes, observations: records, ci: { fullShaCliRuns: cliRuns, apiWorkflowRunCount: apiRuns.total_count, apiCheckRunCount: checkRuns.total_count, actionsPermissions, interpretation: '対象SHAのworkflow/check runは未観測。CI成功・失敗の証拠ではない。手動起動はしていない。設定照会結果のみから未実行理由を断定しない。' }, immutableSUQualityHashes: immutableBefore, mutatedRemote: false, notVerified: ['hosted CI成功', '実provider/実案件/Databricks', '今後の記録のみ追補commit/push'] };
await patchFile(remotePath, result);
await patchFile(reviewPath, `# 安全更新0.6.0公開後の独立レビュー
\n2026-09-15。担当: \`/root/publication_060_review\`。P060-04は限定範囲でpass。SU/quality用の既存レビューと証拠は変更していない。
\n- source commit: \`${commit}\`。\`git ls-remote origin refs/heads/main\`と一致。親は\`a37f3321188ce11f455f5d76793a24fe16ad78e1\`で、既存mainに連なる通常commit。
- GitHub read-only確認: \`n-ima/databricks-dev-harness\`、private/templateはtrue、既定branchはmain。
- commitのmanifest SHA-256は\`${expectedManifest}\`。公開前に確認した0.6.0・1067管理ファイルのmanifestと同一。\`git cat-file --batch\`で全1067blobのhashとsizeを独立照合し全件一致。
- commit全pathにscoped-approval/SCOPED_APPROVALSはなく、CLI・distribution・CLI_REFERENCEにも候補接続/案内はない。
- full SHAの\`gh run list\`は\`[]\`、Actions APIのworkflow_runsは0、check-runsも0。CIの実行・成功は未観測であり、成功とも失敗とも補完しない。workflow手動実行・GitHub設定変更・pushは本担当では行っていない。
- Actions permissionsをread-only照会した結果（終了値${actionsPermissions.exitCode}）: \`${actionsPermissions.stdout.trim().replaceAll('`', '') || actionsPermissions.stderr.trim().replaceAll('`', '')}\`。この結果だけから対象pushでCIが起動しなかった理由を断定しない。
\nP060-04はprivate origin/mainの公開commit一致と、未実行CIを成功と報告しないことを要求している。hosted CI成功そのもの、実案件適用、実provider、Databricks操作の受入ではない。後続の記録のみの追補commit/pushはこの確認の対象外。
\n全コマンド/時刻/結果と全blobhashは[独立remote証拠](../evidence/2026-09-15-publication-060-independent-remote.json)。SU品質契約・SU受入JSON・公開前レビュー・品質診断のhashが確認前後で不変であることも同証拠に記録した。
`);
const acceptance = JSON.parse(await readFile(join(repo, acceptancePath), 'utf8'));
const previous = acceptance.acceptance.filter(x => x.id !== 'P060-04');
acceptance.acceptance = acceptance.acceptance.map(x => x.id !== 'P060-04' ? x : { id: 'P060-04', status: 'pass', evidence: [reviewPath, remotePath], rationale: `private origin/mainが${commit}と一致。公開commit全1067管理blob・manifestは公開前snapshotと一致しHARD-03なし。full SHAのCLI/Actions/check-runs APIでCI未観測を記録し、成功とは報告しない。` });
acceptance.notVerified = acceptance.notVerified.filter(x => !x.includes('P060-04'));
acceptance.publishedSnapshot = { commit, remoteMain: commit, private: true, template: true, defaultBranch: 'main', manifestSha256: expectedManifest, managedFiles: 1067, ci: 'full SHA workflow/check runs未観測', pushReview: reviewPath };
assert.deepEqual(acceptance.acceptance.filter(x => x.id !== 'P060-04'), previous);
await patchFile(acceptancePath, acceptance, true);
for (const [p, hash] of Object.entries(immutableBefore)) assert.equal(sha(await readFile(join(repo, p))), hash, p);
console.log(JSON.stringify({ status: result.status, commit, manifestSha256: expectedManifest, managedFiles: 1067, ci: result.ci, acceptance: acceptancePath, review: reviewPath, evidence: remotePath }, null, 2));
