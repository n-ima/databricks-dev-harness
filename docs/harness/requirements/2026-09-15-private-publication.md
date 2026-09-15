---
id: HARNESS-PUBLISH-050
status: accepted
owner: harness-maintainer
last_updated: 2026-09-15
---

# 採用済み改善のprivate公開と更新案内

利用者の「pushしてください。そのうえで、すでにこのハーネスを使って開発中のプロジェクトにはどう反映すればよいのか」を根拠とする。品質契約と日本語文書改善の採用済み範囲を、既存private origin/mainへ通常pushする。更新可能な配布番号は0.5.0とする。未採用HARD-03、案件変更、Databricks操作、課金試験、GitHub Release/tag公開は含まない。成熟度L1を維持する。

## 受入条件

- PUB-01: 採用済み変更だけを切り出し、未採用HARD-03のローカル変更を保持する。公開用snapshotで構造・全回帰・独立確認を行う。
- PUB-02: 0.5.0の配布manifestとpayloadを作り、管理対象のhashとGit checkout後のbytesの一致を検証する。元の0.4.0配布物を上書きしない。
- PUB-03: 元版・案件側・新しい版の比較、競合停止、案件固有情報の保護、検証と再開を日本語で案内する。既存案件を勝手に変更しない。
- PUB-04: private origin/mainへ通常pushし、remote SHAの一致と公開範囲を確認する。CIの未実行・未成功は成功と報告しない。

過去の採用receiptは、その時点の混在作業ツリーの履歴である。今回の切り出し版にそのまま再利用せず、公開snapshot固有の試験・独立確認を別に残す。
