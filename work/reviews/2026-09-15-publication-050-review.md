# 0.5.0 公開前の独立レビュー

- 確認日: 2026-09-15
- 確認担当: `publication_050_review`（実装・切り出し担当とは別context）
- 対象要件: `docs/harness/requirements/2026-09-15-private-publication.md` の PUB-01〜03
- 対象: `.harness/runtime/publish-0.5.0`、対応する公開予定index、および最終配布物 `.harness/releases/0.5.0`
- 環境: Windows / PowerShell / Node.js `v24.15.0`。外部接続・実Databricks・課金・実案件の変更なし。

## 結論

公開前の確認範囲に未解消の阻害指摘なし。初回に見つかった旧0.4.0 updaterと新版manifestの互換性問題は、検証済み新版APIを使う更新案内へ修正され、隔離fixtureで再確認した。PUB-04のremote公開確認・CI結果はこの公開前レビューでは未確認であり、push後に別途追記する。

## 受入条件と自分で確認した証拠

| 条件 | 独立確認した内容 | 結果・境界 |
| --- | --- | --- |
| PUB-01 | 公開予定indexの変更名に `scoped-approval` / `SCOPED_APPROVALS` がない。混在3ファイルの公開予定bytesと隔離copyが一致し、CLIの候補import/dispatchがない。候補4ファイルの原作業ツリーbytesが試験前後で不変。 | 採用コード・日本語生成・配布関連の4試験群を更新済みfixtureで実行し86件中85成功、失敗0、既存skip1。公開担当の全回帰を自分の全回帰とは数えない。 |
| PUB-02 | 最終manifestの1,057全管理ファイルについて隔離snapshotと実配布payloadのSHA-256を独立照合。indexの `harness/base-release.json` とsnapshotが一致。0.4.0配布物の1,012ファイルを読み取り、各hash一致のうえ別fixtureへ複製。 | 全hash一致。manifest SHA-256は下記。自分はfresh Git checkoutのbyte試験を再実行していないため、その部分は公開担当の専用証拠で確認する。 |
| PUB-03 | 0.4.0の真正な元manifest登録→旧CLI拒否の再現→0.5.0配布APIによるplan/apply→生成→既存情報保持を通して確認。競合と計画後の変更も拒否。 | 90管理ファイル更新、削除0。全1,057hash一致、15種の案件ファイル不変、旧baseline保持、新installed baselineは0.5.0。修正後ガイド相当のone-linerも実行成功。 |
| PUB-04 | この時点ではpush前。 | 未確認。公開を完了したとは判定しない。 |

## 検出・解消した指摘

### P2 / PUB-UPD-01: 旧CLIでは新版の追加試験ファイルを読み込めない（解消済み）

初回ガイドの案件側 `npm run harness -- update plan --source ...` を0.4.0環境で実行すると、旧版の `OWNED_FILES` に新版の追加試験3ファイルがないため、`Release attempts to own an excluded product/local path: tests/delivery-assurance.test.mjs` で計画前に失敗する。旧manifestのbaseline登録自体は成功し、拒否後に管理ファイルと案件ファイルは不変だった。

修正後の `UPDATING_EXISTING_PROJECTS.md` は、検証済み配布物の `files/tools/lib/distribution.mjs` を `pathToFileURL` でimportし、`planUpdate(process.cwd(), {source})` / `applyUpdate(process.cwd(), {plan, yes:true})` を呼ぶ。対象を案件rootへ明示し、旧allowlist・baseline・計画を書き換えない。API実装が保持するpayload検証、競合停止、planHash、適用前のbytes照合を確認した。新版CLIを絶対パスで実行すると対象rootが異なる点もガイドに明記された。

## 独立実行の詳細

- 隔離fixture: `.harness/runtime/publication-fixture-7f798a9c-d5a0-4fe5-9453-a62ab37e06cb`。合成の製品情報だけを用い、実案件を複製・操作していない。
- 試験用script: `.harness/runtime/publication-050-independent-probe.mjs`。独立確認用であり配布コードに含めない。
- 実行要約: fixture内 `probe-report.json`、観測時刻 `2026-09-15T00:02:15.696Z`、status `pass`。
- `AGENTS.md` に模擬の独自変更を加えた場合、planは `canApply:false`、applyは全体拒否。計画後に同ファイルを変更した場合も適用前に拒否し、原版へ戻したうえ再計画・適用した。
- 保持確認: `package.json`、`package-lock.json`、`README.md`、`.vscode/settings.json`、`product.config.json`、既存要件・設計・frontend標準、`apps/`、`src/`、`resources/`、過去の証拠、`.harness/local.json`、合成 `.env`、既存sessionの計15ファイル。ハーネス更新だけで案件version `3.2.1` は変更されない。
- `harness/base-release.json` は0.4.0のまま保持、`.harness/installed-release.json` は0.5.0、`recovery.json` は `applied`。管理ファイル1,057件をmanifestへ照合した。
- `sync-agent-assets` の後も全管理hash一致。更新後の `intake create` で日本語の目的・データ項目・UI適用外の定義が生成され、入力の `{{title}}` は原文を保持、承認済み状態は捏造されない。旧英語sessionから既存checkpointを読み取れる。
- 更新済みfixtureで `node --test --test-reporter=tap tests/distribution.test.mjs tests/human-documents.test.mjs tests/delivery-assurance.test.mjs tests/delivery-independent.test.mjs` を実行。86 tests / 85 pass / 0 fail / 1 skipped / 4117.1042 ms。品質契約CLIのdesign/verify、記録command非実行、`certifiesAcceptance:false` を含む。
- 修正ガイド相当のplan/apply one-linerも同fixtureで実行し、同版再適用で管理変更0件を確認。

## 主要レビュー対象のSHA-256

下記pathは公開snapshotからの相対path。混在する原作業ツリーのhashではない。

| 対象 | SHA-256 |
| --- | --- |
| `harness/base-release.json` / 最終 `manifest.json` | `28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18` |
| `tools/harness.mjs` | `caaeb395bfe20be22565f845de1e99cf1b556d6cd6c73609a991487f9d8054e3` |
| `tools/lib/distribution.mjs` | `2504cee85e34935dbbbf61a3170aa71bb47f175d3863ac973eafbe3ea28a2e83` |
| `tools/lib/intake.mjs` | `6f8fd44372f14763f05b3d399283dfcc85a358735cc669eb4ccf5988f9df582a` |
| `tools/lib/product-documents.mjs` | `e410bca5d2952154b251af8764be2eba4a6fbecd16cd01377a85c391a34ac8b6` |
| `tools/lib/session-state.mjs` | `fcb92adb709ee795bfc357cf4baf53682e94b2c35928230f2ff79f5f9c991c8a` |
| `tools/lib/delivery-assurance.mjs` | `9584432361f776c17f72beab197785b64b2e812380155ffa042bd9b65148a6da` |
| `docs/harness/operations/UPDATING_EXISTING_PROJECTS.md` | `e71eb7bdeffa2cbf9995b592da6d57625f3cc981698aa65e454f855246532abe` |
| `harness.config.json` | `877b306b561c6f8d05585f6530d5e549e7fdfcd6bbc4fa368f352030be7ece1d` |
| `package.json` | `071cbf6a66cabca371548a1162e9e5ce5e90d6d69d4c3fc0e3d66b93d1d7a5a5` |

原作業ツリーに保持され、最終manifestには含まれない候補の試験前後hash:

| 対象 | SHA-256 |
| --- | --- |
| `tools/lib/scoped-approval.mjs` | `f6dd8a55792567ce3715853d7fafbc0fa241abf386d8ead4f4b35af5b3591fc1` |
| `tests/scoped-approval.test.mjs` | `1d4af8d87fb330b5b420dd71aa5ab5ce452149c7b24c8ed46869db3779e98319` |
| `docs/harness/design/SCOPED_APPROVALS.md` | `de9b53617b1d55d73862c33d356fc38f0e36b14dbfc054f6e1ed335ea8b0b82d` |
| `docs/harness/operations/SCOPED_APPROVALS.md` | `1b3ee904a07844fc95c2d72651c85a73a6f0ff4b3660f0a820c3f81242e762e3` |

## 未検証範囲と次の確認

このレビューはWindowsローカルの公開snapshot・模擬案件を対象とする。fresh Git checkoutのbyte再現試験と全567試験は公開担当の記録を参照し、自分の独立実行は上記の86試験と追加probeに限定する。実Claude Code/Copilotの振る舞い、実Databricks接続・deploy・費用、実案件固有の試験、他OS、publisher本人認証、GitHub remote SHA/private設定/CIはまだ確認していない。成熟度L1を超える認定はしない。

push後にremote SHA・公開範囲・private設定を読取専用で照合し、CIは観測した状態を記録する。成功していないCIや未実行の環境を成功へ補完しない。

## push後の独立確認（PUB-04）

以下の追記により、上記の公開前時点で未確認だったPUB-04を確認済みとする。採用済みsourceのprivate pushと更新案内の範囲は確認済み。hosted CI成功と既存実案件への適用は含まない。

- source commit: `ea55f49a815152a9e6fe609f0390fe9b6a155aae`。公開前の `0d77f62514cafd00f4dc00d190e955a99a0acd35` から採用済み変更90ファイルを含む通常commit。
- `git ls-remote origin refs/heads/main` の結果は同じ `ea55f49a815152a9e6fe609f0390fe9b6a155aae`。
- `gh repo view n-ima/databricks-dev-harness --json nameWithOwner,isPrivate,isTemplate,defaultBranchRef` の結果は `isPrivate:true`、`isTemplate:true`、既定branch `main`。
- `git cat-file --batch` で当該commitの全1,057管理blobを読み、最終manifest内のSHA-256へ独立照合し全件一致。commitの `harness/base-release.json` も `28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18` と一致。
- `git ls-tree -r --name-only` で当該commitに `scoped-approval` / `SCOPED_APPROVALS` の候補パスがないことを確認。原作業ツリーには候補が残るため、原作業ツリーのtoolsを公開コードの代わりに認定しない。
- `gh run list --repo n-ima/databricks-dev-harness --commit ea55f49a815152a9e6fe609f0390fe9b6a155aae --json databaseId,headSha,name,status,conclusion,url,event` は `[]`。CI runを観測していないため、成功・失敗のいずれにも補完しない。PUB-04は未実行CIを成功と報告しない条件を含み、hosted CI成功そのものを要求しない。
- 上記は2026-09-15のsource push後のread-only確認。後続の完了記録のみのcommit/pushは別記録であり、ここで照合したsource commitと配布manifestを置き換えない。実案件更新・Databricks配備・tag/Release公開は行っていない。
