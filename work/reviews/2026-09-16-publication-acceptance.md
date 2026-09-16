# 公開工程の再発防止・独立受入

2026-09-16。担当: `/root/publication_code_review`（実装担当とは別context、Codex）。

## 結論

**今回の対象である対策実装とローカル配布準備について、PUBC-01〜05を受入可能と判断する。** 初回のPCR-01（削除のcommit漏れ）とPCR-02（案件側テストのsource固定仮定）は独立再現し、修正後の拒否/正常系を再確認した。未解消の阻害指摘はない。

これはGitHub公開、実案件への適用、Databricks動作、実Claude Code/Copilotの全機能保証ではない。現在のsourceは0.7.0のstamp済みローカル候補であり、本リポジトリでのcommit/pushは今回の受入対象外。

## 対象snapshot

- 版: `0.7.0`
- 管理file: `1102`
- `harness/base-release.json` SHA-256: `9cfc0dd3697008330e20fe81f48c3ef712399ab42e7686a211dd4382daa49717`
- 品質契約: `work/quality/2026-09-16-publication-review-ready.json`
- 品質reviewHash: `f3b721ebfe127feabd8e27ccb925bd14a0d7b6ed7c0e7ed00a16c3516755b030`
- 各実装/文書/証拠/生成物の直接照合hashは`work/evidence/2026-09-16-publication-acceptance-verification.json`と本レビューのJSONに記録。

## 条件ごとの判断

| 条件 | 判断と独立確認 |
|---|---|
| PUBC-01 | 日本語工程表と専用publish skillが、採用済み範囲→新版/stamp→更新試験→公開到達確認までを一つの公開作業として定義。案件配備と別物であり同じ採用を再要求しない。3依頼の別context forward結果を読み、最新orchestrate-workの案件Git/status-only補足と生成コピーを直接照合した。 |
| PUBC-02 | source検査を旧main SHAに対して独立再実行し、0.7.0全1102fileの整合を確認。旧stamp拒否証拠、列挙漏れ/削除/改変/版差/同版差替え試験、LF/Git往復証拠を照合。cacheの旧版へfallbackせず現sourceだけを検査するコードを確認した。 |
| PUBC-03 | 実repoのguard-statusを読み取り、標準pre-pushの導入済みを確認。temp Gitの通常push/別ref→main/削除/非HEAD/未commit/既存hook保持を再試験。PCR-01の未stage削除を別probeで拒否し、正しくcommitした削除は受理。CIの正確なbase SHAと完全履歴取得、source限定条件を実fileから確認。 |
| PUBC-04 | 実0.6.1固定payloadを使う隔離canaryをr2として独立再実行。cacheなしGit cloneと0.7.0固定payloadの両経路で1102hash一致、案件9file保持、再適用keep、更新後の公開試験各12pass。競合時は1068既存管理fileが不変、旧0.6.1manifest/全payloadも不変。旧CLIのallowlist制約は新版側実行器で橋渡しし、stamp手編集やforce不要。 |
| PUBC-05 | 全回帰r2の生ログ/対象hashを照合: 721pass/0fail/2skip。変更した4native skillの検査成功、両provider生成物8fileのcanonical一致、CI実file一致を直接確認。独立設計・実装・forwardレビューの指摘解消と未検証範囲を照合した。 |

## 独立再実行と証拠

- `node work/evidence/2026-09-16-publication-real-update.mjs r2` — 成功。結果は`work/evidence/2026-09-16-publication-real-update-r2.json`。実案件への操作ではない。
- `node tools/harness-publication.mjs guard-status` — installed。これは同権限によるhook回避を封じる保証ではない。
- `node tools/harness-publication.mjs check --base f06743b0c941872b6db041a88ee6fe7adb72168f` — stamp-valid、committed:false、certifiesAcceptance:false。
- 削除未stage/prod-marker反例を`publication-acceptance-check.mjs`から再実行し、生ログを別の一意なJSONへ保存。
- 品質verifyは受入レビュー登録前にMISSING_REVIEWのみ、recordedExecutions=5。これは構造整合の診断であり、上の実行確認と意味レビューを代替しない。親担当が本レビューを品質契約へ接続した後、最終診断/receiptを行う。

## 残る適用限界

- 検証環境はWindows、Node 24.15.0。全回帰の2skipはfile symlink作成権限に依存する試験であり、junctionの試験は実行済み。Hosted Linux/macOS CIは未実行。
- 実Claude Code/Copilot会話、GitHub required checks/branch protection、実案件の業務受入、Databricks/モデル課金試験は未実施。
- 発行者本人認証、悪意ある同権限の変更、未列挙の全世界の失敗を保証しない。今回の受入は要件PUBC-01〜05の限定された再発防止策に対するもの。
- 今後main公開するときはこの最終snapshotをcommitし、送信commitの検査・通常push・remote SHA/CIの確認を行う。今回のローカル準備を既に公開済みと報告しない。
