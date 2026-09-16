# 0.7.0 公開の独立確認

- reviewer: `/root/publish_070_review`
- provider: `codex`
- independent: true（公開実行担当とは別context。実装・Git操作・GitHub設定変更を実施していない）
- session: `20260916-043428-743-publish-harness-0-7-0`
- 対象: 既存独立受入済み 0.7.0 の内容不変と、今回の許可された private main 公開

## 公開前の確認（2026-09-16）

1. `publish-harness` と開発・公開手順、要件、設計、0.7.0移行案内を読んだ。今回の利用者のpush指示はハーネスGit公開の許可であり、案件更新・Databricks配備・GitHub設定変更の許可ではない。
2. `work/quality/2026-09-16-publication-accepted.json`、既存acceptance JSON、既存receiptが参照する51ファイルを現bytesのSHA-256で照合し、不一致0件。旧独立受入のPUBC-01〜05を別の内容に流用していない。
3. `node tools/harness-publication.mjs check --base f06743b0c941872b6db041a88ee6fe7adb72168f` を独立実行し、`stamp-valid`、0.7.0、1,102管理ファイル、旧main比較済みを確認。stamp SHA-256 は `9cfc0dd3697008330e20fe81f48c3ef712399ab42e7686a211dd4382daa49717`。この時点は未commitであり公開完了とは扱わない。
4. `guard-status` は `installed`。既存pre-pushを迂回する指示はない。GitHub API経由で `n-ima/databricks-dev-harness` はprivate、default branchはmain、originの送信先も同一を確認。
5. `publication-real-update-r2.json` の受入済み証拠が現bytesと一致。実0.6.1→0.7.0のcacheなしGit source/固定payload、1,102ファイル照合、9種案件ファイル保持、再適用keep、競合時1,068管理ファイル不変、旧0.6.1全bytes保持を記録している。今回も実案件を検証対象にしない。
6. `.harness/agent-assets/backups/` の未追跡13ファイルはローカル保存用として除外すべき対象。固定release cacheもGitへ追加する必要はない。親担当へ除外を明示した。
7. 回帰721成功/0失敗/2skip、4native skill形式・provider整合、設計/実装/forwardレビューの解消済み証拠を確認。今回のレビューで回帰全件を再実行したとは扱わない。

公開前の阻害指摘はなし。commit後の送信対象照合と、公開後のremote SHA・内容・CI状態の独立確認が残る。

## 公開後の確認

2026-09-16T04:39:24Zまでの独立確認:

- `git ls-remote origin refs/heads/main` は `cac5e265ee47a3b305de847edc42c36b07317d6a`。local HEADも一致した。
- GitHubのprivate属性とdefault mainを再確認した。
- GitHub Contents APIから公開commitの `harness/base-release.json`、`harness.config.json`、`package.json`、`package-lock.json`、CI定義を取得し、受入済みローカルbytesのSHA-256と5件すべて一致。公開stampは0.7.0/1,102管理ファイルのものを維持している。
- `check --committed --base f06743b0c941872b6db041a88ee6fe7adb72168f` はpass。公開commitと受入済みsourceの一致を確認した。
- 旧mainから公開commitへの `.harness` 配下の追加・変更は0件。ローカルbackupは未追跡のまま保持されている。
- GitHub Actionsのhead SHA指定一覧およびcommit check-runsは双方0件。hosted CIは実行結果を確認できていないため、**成功とは認定しない**。この未検証を最終報告に含めること。

`work/evidence/2026-09-16-publish-070-remote-review.json` に観測値を固定した。`work/reviews/2026-09-16-publish-070-acceptance.json` は既存PUBC-01〜05の受入対象が不変であることと、今回のprivate main到達を結び付ける。新たな全機能・実provider・実Databricks受入ではない。

## 限界

旧受入はローカル検証の範囲であり、実Claude Code/Copilot・Databricks・実案件適用の成功を表さない。ローカルguardの回避不能性やGitHub branch protection導入済みを主張しない。公開前の確認だけでremote到達やhosted CI成功を認定しない。
