# 0.5.0採用済み改善の公開記録

## 範囲

- 要件: `docs/harness/requirements/2026-09-15-private-publication.md`（PUB-01〜04）。利用者がprivate originへのpushを明示指示。
- 対象: 品質契約の診断CLI・日本語の要件/設計/記録・文書定義と軽量UI確認フロー。配布番号0.5.0、成熟度L1維持。
- 除外: 未採用HARD-03のscope approval候補、個別案件の変更、実Databricks、課金モデル実行、GitHub Release/tag公開。

## 公開snapshotの作り方

元の作業ツリーは採用済み/未採用が混在。採用済みだけを選択してindexへ登録し、`.harness/runtime/publish-0.5.0`へexportした。`tools/harness.mjs`、`tools/lib/distribution.mjs`、`docs/harness/operations/CLI_REFERENCE.md`の未採用hunkは隔離コピーとindexだけから除外。元の候補実装・試験・文書・sessionはローカルに保持する。

過去の`2026-09-15-human-readable-delivery.receipt.json`は当時の混在treeを検証した履歴であり、今回の公開bytesをそのまま認定しない。今回のsnapshot、配布manifest、独立レビューを別に照合する。

## 検証

- 隔離snapshotの`npm run harness:check`: 成功。
- 同snapshotの`npm run test:harness`: 全567、566成功、失敗0、skip1、39590ms。未採用scoped-approval専用52件を含まない。skipは既存のホストsymlink権限制約であり、成功とは数えない。
- 最終配布: 1057管理ファイル、Windowsのfresh Git checkout / core.autocrlf=trueでraw bytes一致。結果は`2026-09-15-release-050-byte-validation-final.json`。manifest SHA256は`28ac2790d76abe0ba49b3e05bcb1680b255d374572ae5c9700ed9be3388d4d18`。
- 全1057管理対象についてindexのGit blob、検証snapshot、最終payloadの一致を確認。scoped-approval候補の専用ファイルはstageされていない。
- 独立確認で旧0.4.0の更新許可リストが新版テストを拒否することを検出。安全制御を緩めず、検証済み新版payloadの`planUpdate`/`applyUpdate` APIへ対象案件rootを渡す橋渡し手順に訂正した。独自変更は引き続き競合で停止する。
- 独立レビュー: `work/reviews/2026-09-15-publication-050-review.md`。公開前の阻害指摘なし。0.4.0→0.5.0は新版APIで90管理ファイルを更新し、全1057hash一致、15種の案件ファイル・旧baseline・旧英語sessionを保持、日本語intakeを生成。競合/計画後変更は拒否。更新fixtureで86試験中85成功・失敗0・既存skip1。ガイド相当のone-linerも成功。
- 個別案件はread-onlyで元版0.4.0と未コミット変更の存在を確認。plan/apply、checkpoint、commit、アプリ/DB操作は行っていない。

## remoteと未検証範囲

公開前は`origin/main = 0d77f62514cafd00f4dc00d190e955a99a0acd35`。`n-ima/databricks-dev-harness`はprivate・template、既定mainと確認。

2026-09-15、採用ソースcommit `ea55f49a815152a9e6fe609f0390fe9b6a155aae` を通常pushし、`git ls-remote origin refs/heads/main`が同SHAであることを確認。90ファイルをcommit。push後もprivate/templateを維持。未採用HARD-03の3混在hunk・専用実装/試験/文書/記録、および従来のwork/STATUS変更はローカルに保持した。

対象SHAのGitHub Actions runは0件、check-runsも0件。Actions設定自体はenabledを確認したが、起動・成功は未確認であり原因を断定しない。過去の別SHAでの成功を今回のCI成功に流用しない。今回の完了は許可されたsource pushと更新案内の提供であり、hosted CIの成功認定ではない。

この後に追記する独立公開照合・session完了記録だけのcommitは、配布payloadを変更しない。今回の公開receiptは公開作業の記録を封印するもので、案件の更新承認・本番配備承認・候補HARD-03の採用証明に転用しない。

Linux/macOSのhosted CI、実providerのcanary、実Databricks適合、全改善の完了、世界最高の客観的証明を、このローカル検証で主張しない。
