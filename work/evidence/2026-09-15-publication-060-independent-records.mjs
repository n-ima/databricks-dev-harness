// Review records and quality metadata only. No implementation or acceptance-policy changes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { basisHash, reviewHash } from '../../.harness/runtime/publish-0.6.0/tools/lib/delivery-assurance.mjs';
const repo = 'D:/projects/databricks-dev-harness';
const snapshot = join(repo, '.harness/runtime/publish-0.6.0');
const prefix = 'work/evidence/2026-09-15-publication-060-independent';
const reviewPath = 'work/reviews/2026-09-15-publication-060-review.md';
const qualityPath = 'work/quality/safe-local-update.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async (root, p) => readFile(join(root, p));
const json = async (root, p) => JSON.parse(await read(root, p));
const reference = async (root, path) => ({ path, sha256: sha(await read(root, path)) });
async function patchFile(path, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  let old; try { old = await readFile(join(repo, path), 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const absolute = join(repo, path).replaceAll('\\', '/');
  const lines = text.trimEnd().split(/\r?\n/);
  const execute = patch => {
    const result = spawnSync('C:/Users/nimao/AppData/Local/OpenAI/Codex/bin/bffc5354119c8421/codex.exe', ['--codex-run-as-apply-patch', patch], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  };
  const first = lines.slice(0, 40);
  execute(`*** Begin Patch\n*** ${old === undefined ? 'Add' : 'Update'} File: ${absolute}\n${old === undefined ? '' : '@@\n' + old.trimEnd().split(/\r?\n/).map(x => '-' + x).join('\n') + '\n'}${first.map(x => '+' + x).join('\n')}\n*** End Patch`);
  for (let offset = 40; offset < lines.length; offset += 40) {
    const context = lines.slice(Math.max(0, offset - 3), offset).map(x => ' ' + x).join('\n');
    execute(`*** Begin Patch\n*** Update File: ${absolute}\n@@\n${context}\n${lines.slice(offset, offset + 40).map(x => '+' + x).join('\n')}\n*** End of File\n*** End Patch`);
  }
}
const audit = await json(repo, `${prefix}-audit.json`);
const forward = await json(repo, `${prefix}-forward-result.json`);
const tests = await json(repo, `${prefix}-tests.json`);
assert.equal(audit.status, 'pass'); assert.equal(forward.status, 'pass'); assert.equal(tests.exitCode, 0);
assert.match(tests.stdout, /# tests 27/); assert.match(tests.stdout, /# fail 0/);
const summary = {
  reviewer: '/root/publication_060_review', at: new Date().toISOString(), status: 'pass',
  environment: { node: process.version, platform: process.platform },
  manifestSha256: audit.incoming.manifestSha256, managedFiles: 1067, snapshotIndexPayloadParity: true,
  snapshotFileCountAtAudit: audit.snapshotFileCount, hard03Excluded: true, originalCandidateFilesPreserved: Object.keys(audit.preserved).length,
  oldReleaseCounts: audit.old.map(x => ({ version: x.manifest.version, managedFiles: x.manifest.managedFiles.length, manifestSha256: x.manifestSha256 })),
  independentTests: { tests: 27, pass: 27, fail: 0, skip: 0, durationMs: 4608.002 },
  publisherTests: { tests: 582, pass: 581, fail: 0, skip: 1, durationMs: 38538.3753, independentlyRerun: false },
  publisherFreshGitByteCheck: audit.publisherByteEvidence,
  forward: forward.outcomes.map(x => ({ from: x.version, to: x.installedVersion, changes: x.applied.changedFiles, deletedFiles: x.applied.deletedFiles, managedFiles: x.applied.managedFilesVerified, protectedFiles: x.protectedCount, backups: x.backupCount, oldBaseManifestPreserved: x.oldBaseManifestPreserved, nextPlanCounts: x.nextPlan.counts, rejectionProbes: x.rejectionProbes, checkBeforeAndAfterPass: x.checkBeforeAndAfterPass, productBeforeAndAfterPass: x.productBeforeAndAfterPass })),
  preservedTemp: forward.retainedTemp, realProjectOrProviderOrDatabricksTest: false, p06004: 'not-run; wait for push'
};
await patchFile(`${prefix}-summary.json`, summary);

const c = await json(repo, qualityPath);
c.producer = { actor: 'codex-root', context: '20260915-013942-357-publish-safe-update-0-6-0' };
c.requirement = await reference(snapshot, c.requirement.path);
const artifactPaths = [...new Set([...c.artifacts.map(x => x.path), 'harness.config.json', 'harness/base-release.json', 'package.json', 'package-lock.json', 'docs/harness/decisions/ADR-0011-safe-local-update-adoption.md', `${prefix}-runner.mjs`, `${prefix}.test.mjs`])];
c.artifacts = await Promise.all(artifactPaths.map(p => reference(p.startsWith('work/') ? repo : snapshot, p)));
for (const op of c.operations) op.document = await reference(snapshot, op.document.path);
const tc5 = c.testCases.find(x => x.id === 'TC-SU-05');
tc5.steps = ['別contextの独立担当が短い日本語/英語表記依頼のrouteをCLIで確認し、明示されたローカルfixtureをplan/applyする', '導入後のcanonical/Claude/Copilot skillの全bytesと初回/次回の日本語運用を照合する'];
tc5.expected = '3表記の短い指示がupdate-harnessへrouteされexecutionAuthorized=false。安全なCLI適用/停止と生成skill同一を確認。実providerモデルの振る舞いは未検証';
const tc6 = c.testCases.find(x => x.id === 'TC-SU-06');
tc6.preconditions = 'A: 真正な公開0.4.0/0.5.0全manifest/payloadから作る別々の隔離案件と、採用0.6.0のGitなしclean sourceおよび配布物。B: 公開snapshot CLIを含む合成版の隔離fixture。実案件ではない';
tc6.steps = ['A: 旧案件CLIで真正な元baselineを登録。信頼済み0.6外部CLIと明示targetで両source形式のplan operations一致・計画前後bytes不変を確認', 'A: 0.4はclean source CLI、0.5は配布CLIから0.6へ更新。全1067管理hash、各20案件files、旧base manifest、更新前backup47/11と旧installed bytesを照合', 'A: 導入済み案件内CLIを案件cwdで起動し次回0.6 planが1067keepになることを確認。前後check/案件2tests・既存session読取・3表記route・provider skill同一を確認', 'B: 専用試験で1.2から次版1.3のplan、独立IND-05で案件内CLIによる0.6から合成0.7のplan/applyを実行'];
tc6.expected = '公開旧版のallowlistやbaselineを書換えず直接0.6へ移行。案件を保持し競合/無承認/staleを拒否。次回入口が導入される。将来の本物の未公開版や実案件の成功とはしない';
const basis = basisHash(c);
const testRef = await reference(repo, `${prefix}-tests.json`);
const forwardRef = await reference(repo, `${prefix}-forward-result.json`);
const summaryRef = await reference(repo, `${prefix}-summary.json`);
const fullRef = await reference(snapshot, 'work/evidence/2026-09-15-publication-060-full.log');
for (const tc of c.testCases) tc.result = {
  status: 'pass', environment: 'local', basisSha256: basis,
  evidence: tc.id === 'TC-SU-07' ? [testRef, fullRef] : [testRef, forwardRef, summaryRef, fullRef],
  command: `node work/evidence/2026-09-15-publication-060-independent-runner.mjs audit${tc.id === 'TC-SU-07' ? '' : '; 同runner prepare → 計画確認 → apply（証拠JSONに完全argv）'}`,
  versions: 'Windows / Node.js v24.15.0 / 公開0.6.0 snapshot。独立27pass、旧0.4/0.5隔離更新。実Claude Code/Copilot・実案件・Databricksは未実行'
};
c.reviews = [];
const reviewed = reviewHash(c);
const report = `# 安全更新0.6.0公開前の独立レビュー

2026-09-15。担当: \`/root/publication_060_review\`。実装・公開担当とは別context。判定: **P060-01〜03とSU-01〜05の限定範囲に未解消の阻害指摘なし**。P060-04はpush前のため未確認。

## 対象と境界

固定snapshotは\`.harness/runtime/publish-0.6.0\`。Windows / PowerShell / Node.js v24.15.0で検証した。AGENTS、orchestrate-work、improve-harness、review-work、release-work、文書/品質/安全標準、採用要件とADR-0011、SAFE_LOCAL_UPDATE設計/運用、旧bridge、従来の独立レビューを読んだ。実装・managed文書・受入条件は編集せず、レビューと証拠、および依頼されたwork内品質契約の公開版再検証だけを記録した。

manifest SHA-256は\`${audit.incoming.manifestSha256}\`、管理ファイル1067件。全件について公開snapshot・配布payload・公開予定Git index blobを独立照合した。snapshot内の全pathを確認しscoped-approval/SCOPED_APPROVALSがなく、tools/harness、distribution、CLI_REFERENCEのcandidate import/dispatch/説明もない。元ツリーの候補等11filesは組立時hashと試験後hashが一致した。旧0.4.0/0.5.0配布物は全1012/1057filesを照合し、試験前後で不変。

## 受入と実行結果

| 条件 | 独立に確認した内容 |
|---|---|
| P060-01 | ADRとaccepted要件の採用範囲が一致。公開版からHARD-03を除き、元候補・旧配布物を保持 |
| P060-02 | 全1067のsnapshot/payload/index byte一致と独立check成功。主担当のfresh Git/core.autocrlf=true一致、全582件581pass/0fail/1skipの記録も同manifestで照合 |
| P060-03 | 真正な旧0.4/0.5から0.6への外部CLI導入、案件内CLI次回plan、各20files保持・競合停止、初回/次回日本語案内を確認 |
| SU-01 | Gitなしclean sourceと配布物で両旧版のoperations一致。plan時点の管理bytes/案件bytes/baseline不変。専用試験でdirty sourceの固定版選択と元source後変更の隔離を確認 |
| SU-02 | 二つの旧版案件で各20files、旧base manifest、binary/CRLF/設定/秘密fixtureを保持。独自編集・削除・未知衝突の全体停止を専用試験、実payloadの編集競合をforwardで確認 |
| SU-03 | 未知元版、対象取り違え/包含/drive root、source/target/managed parent junction、改変・path/size不正・未知/重複引数・無承認・stale/snapshot改変を拒否。指定source scriptは実行しない |
| SU-04 | 全管理hash後に導入版記録。旧0.4/0.5で更新前backup47/11filesと旧installed bytes一致。keep破損と削除file復活を注入し、interrupted journal・旧baseline保持・replay拒否を確認 |
| SU-05 | 3表記の自然言語route、canonical/Claude/Copilot生成skillのbyte一致。公開版を外部起動したあと案件内CLIで次回plan成功。実providerモデル試験と区別 |
| P060-04 | pushとremote/CIは未確認。公開完了とは判定しない |

独立実行は\`tests/update-entry.test.mjs\`の15件と、前独立レビューの反例を公開snapshot moduleへ向けた追加12件、計27pass/0fail/0skip（4608.002ms）。既存反例のコピーであり、今回初めて発案した12件とは数えない。主担当の全回帰を独立再実行したとは主張しない。

| 旧版 | 管理差分 | 更新後 | 保持・backup | 次回案件内CLI |
|---|---|---|---|---|
| 0.4.0 | update47/add55/delete0 | 1067hash一致 | 案件20files不変、backup47と旧installed一致 | 0.6→0.6 planは1067keep |
| 0.5.0 | update11/add10/delete0 | 1067hash一致 | 案件20files不変、backup11と旧installed一致 | 0.6→0.6 planは1067keep |

0.4はGitなしsourceのCLI、0.5は配布物のCLIを外部cwdから\`--target\`付きで起動した。両形式のplanは両版で比較した。計画の対象/版/件数/競合0/削除0とmanual-reviewを読んでから、許可されたfixtureのみ適用した。各版で無承認、AGENTS独自変更の競合、古い計画の適用を拒否し、拒否後に管理/案件/baseline不変を確認。試験が注入した差分だけを戻し、fresh planで適用した。実際の案件差分を戻したものではない。

両版とも更新前後harness check成功、案件の計算/異常入力2tests成功。新processで既存sessionを読めた。次の本物の公開版は存在しないため同版planまで確認し、別の合成版試験で案件内CLIによる1.2→1.3 planと0.6→0.7 plan/applyを補った。実案件/新モデルcontextの業務再開の証明ではない。

## 案内・品質契約の意味確認

初回に0.4/0.5自身の旧CLIへ新allowlistを足す必要はない。信頼済み0.6実行器とsourceデータを分け、明示target、真正なbaseline、固定source、計画説明、書込み停止、失敗時journal/backup照合を案内する。hash一致は本人認証や案件受入ではない。providerの無条件syncで独自skillを消さない説明は実装と整合する。

品質契約は候補記録を保存したうえ、公開snapshotの要件・実装・設定・運用hashと今回の結果に更新した。SU-01〜05、RISK-OWNERSHIP/SOURCE/COMPLETION、運用6項目の対応を確認。HTTP interfaceなしはローカルCLI/ファイルのみの範囲と整合する。TC-SU-06は実公開0.4/0.5→0.6と導入後の次回入口の証拠に対応させ、合成版の範囲も明記した。費用はローカルI/O/保存容量、依存はNode標準APIで、案件packageは保持する。

契約basis=\`${basis}\`、reviewedSha256=\`${reviewed}\`。clean snapshotでの最終診断は[品質検証記録](../evidence/2026-09-15-publication-060-independent-quality-verify.json)へ保存する。診断の\`certifiesAcceptance:false\`を維持し、P060-04・実案件承認・本人認証へ転用しない。

## 証拠と未実施

- [要約](../evidence/2026-09-15-publication-060-independent-summary.json)、[全hash監査](../evidence/2026-09-15-publication-060-independent-audit.json)、[独立27件](../evidence/2026-09-15-publication-060-independent-tests.json)、[forward全照合](../evidence/2026-09-15-publication-060-independent-forward-result.json)。
- [再現runner](../evidence/2026-09-15-publication-060-independent-runner.mjs)のaudit→prepare→計画確認→apply。再実行時は証拠prefixを変え、既存証拠を上書きしない。全argv/cwd/終了値/stdout/stderrを各実行JSONに保存。
- 専用temp \`${forward.retainedTemp.replaceAll('\\', '/')}\` に二つの案件・snapshot・backup/journalを保持。実案件、Databricks、ネットワーク、実Claude/Copilot、Linux/macOS、Node22実機、clone/ZIP取得・解凍、Git branch運用は未実施。供給元本人認証や敵対的同一OS権限writerの隔離は保証しない。
- 初回runnerの括弧構文誤りを実行前に修正した。製品不具合ではない。sandbox helper起動失敗後は許可されたrequire_escalatedでローカル読取・隔離試験を実行した。
`;
await patchFile(reviewPath, report);
c.reviews = [{ actor: 'codex-publication-060-independent-reviewer', context: '/root/publication_060_review', independent: true, status: 'pass', reviewedSha256: reviewed, coverage: { requirements: [...c.requirements], risks: c.risks.map(x => x.id), interfaces: [], operations: c.operations.map(x => x.id) }, evidence: [await reference(repo, reviewPath), testRef, forwardRef, summaryRef] }];
await patchFile(qualityPath, c);
const base = { schemaVersion: 1, reviewer: '/root/publication_060_review', provider: 'codex', independent: true, reviewDate: '2026-09-15', sessionId: '20260915-013942-357-publish-safe-update-0-6-0', snapshot: '.harness/runtime/publish-0.6.0', manifestSha256: audit.incoming.manifestSha256, unresolvedFindings: [], environment: 'Windows / PowerShell / Node.js v24.15.0', notVerified: ['実provider/実案件/Databricks', '他OS/Node22実機/hosted CI', 'P060-04 remote push（この記録時点はpush前）'] };
const evidence = [reviewPath, `${prefix}-summary.json`, `${prefix}-tests.json`, `${prefix}-forward-result.json`];
await patchFile('work/reviews/2026-09-15-publication-060-acceptance.json', { ...base, requirement: 'docs/harness/requirements/2026-09-15-safe-update-publication.md', requirementSha256: sha(await read(snapshot, 'docs/harness/requirements/2026-09-15-safe-update-publication.md')), acceptance: [
  { id: 'P060-01', status: 'pass', evidence, rationale: '採用範囲とADR整合。全snapshot path・CLI接続でHARD-03除外、元候補11filesと旧0.4/0.5全payload保持。' },
  { id: 'P060-02', status: 'pass', evidence, rationale: '1067全管理bytesをsnapshot/payload/indexで独立照合、checkと27独立tests成功。主担当の全582件581pass/0fail/1skip・fresh Git byte一致も同manifestで照合。' },
  { id: 'P060-03', status: 'pass', evidence, rationale: '実公開0.4/0.5元payloadの隔離案件から0.6導入、各20案件files保持、backup47/11一致、案件内CLI次回plan、競合/無承認/stale拒否、前後checkと案件試験・案内を確認。' },
  { id: 'P060-04', status: 'not-run', evidence: [], rationale: 'push前。remote commit・private・CIはpush後にread-onlyで確認する。' }
] });
await patchFile('work/reviews/2026-09-15-publication-060-safe-update-acceptance.json', { ...base, requirement: c.requirement.path, requirementSha256: c.requirement.sha256, acceptance: c.requirements.map(id => ({ id, status: 'pass', evidence, rationale: `${id}の独立確認と検証限界はreviewの受入表に記載。公開snapshotの27testsと旧0.4/0.5隔離forwardが成功。` })), qualityBasisSha256: basis, qualityReviewedSha256: reviewed });

const copyPaths = [...new Set([qualityPath, reviewPath, 'work/reviews/2026-09-15-publication-060-acceptance.json', 'work/reviews/2026-09-15-publication-060-safe-update-acceptance.json', ...c.artifacts.filter(x => x.path.startsWith('work/')).map(x => x.path), `${prefix}-tests.json`, `${prefix}-forward-result.json`, `${prefix}-summary.json`])];
for (const p of copyPaths) { await mkdir(dirname(join(snapshot, p)), { recursive: true }); await copyFile(join(repo, p), join(snapshot, p)); }
const verify = spawnSync(process.execPath, [join(snapshot, 'tools/harness.mjs'), 'delivery', 'check', '--contract', qualityPath, '--phase', 'verify'], { cwd: snapshot, encoding: 'utf8' });
await patchFile(`${prefix}-quality-verify.json`, { command: [process.execPath, join(snapshot, 'tools/harness.mjs'), 'delivery', 'check', '--contract', qualityPath, '--phase', 'verify'], cwd: snapshot, exitCode: verify.status, stdout: verify.stdout, stderr: verify.stderr, at: new Date().toISOString(), basisSha256: basis, reviewedSha256: reviewed });
assert.equal(verify.status, 0, verify.stdout + verify.stderr);
const result = JSON.parse(verify.stdout); assert.deepEqual(result.findings, []); assert.equal(result.certifiesAcceptance, false);
await copyFile(join(repo, `${prefix}-quality-verify.json`), join(snapshot, `${prefix}-quality-verify.json`));
console.log(JSON.stringify({ quality: qualityPath, review: reviewPath, basis, reviewed, verification: result }, null, 2));
