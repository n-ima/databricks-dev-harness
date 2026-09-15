---
id: PUSH-REVIEW-20260916
status: accepted
owner: repository-owner
---

# 検証済み作業状態のprivateブランチへの保存

利用者の「pushしてください」に基づくGitHub送信。直近是正と未採用UIF/HARD-03が同一ファイルに重なるため、検証済みの組合せを壊さずレビュー用ブランチに保存する。mainの更新、候補の正式採用、タグ・更新payloadの再発行、Databricks操作、既存案件の更新を含めない。

## 受入条件

- PUSH-01: private `n-ima/databricks-dev-harness` の新規 `codex/truth-repair-review-20260916` ブランチへ通常pushし、リモートのcommit IDがローカルと一致する。mainは元の `a77c96ac3bf48cd7033688e38449f320407611d3` のまま。
- PUSH-02: ローカルbackup/認証/runtimeを含めず、対象ファイルを検査する。コード・証拠の整合検査と独立確認を残す。秘密情報検査の限界も明記する。
- PUSH-03: 修正候補・未採用候補・公開済み配布版を区別し、対象commit/branchとmain未更新を利用者に知らせる。既存案件へ自動反映したとは扱わない。

## 実行設計

Git branchを新規作成し、同じ検証済みファイルの組合せをcommitする。ignore済みと `.harness/` のbackupを追加しない。commit前に対象path、サイズ、秘密らしい値、既存の独立受入receipt、Git正規化による差を確認。force push・remote変更・mainへのmergeをしない。送信失敗時はローカルcommitを保持し、通信エラーと反映結果を区別する。

当手順はハーネスソースの保存であり、アプリのデプロイではない。独立確認担当はステージ済み/commit済みの正確な対象とremote到達を確認する。
