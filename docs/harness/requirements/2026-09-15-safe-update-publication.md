---
id: HARNESS-PUBLISH-060
status: accepted
---

# 安全更新0.6.0の採用・private公開

利用者の「進めてください」は直前に提示した安全更新候補の正式採用と次版公開への承認。既存private origin/mainへ通常pushする。実案件変更、Databricks操作、HARD-03、GitHub Release/tag作成は対象外。

## 受入条件

- PUB-01: 安全更新の採用を記録し、公開用snapshotから未採用HARD-03だけを除外する。元の作業ツリーと旧配布物は保持する。
- PUB-02: 0.6.0のmanifest/payloadと元ソース・Git checkoutのbyte一致を確認し、公開用snapshotの構造・全回帰・独立確認を通す。
- PUB-03: 旧0.4/0.5の隔離案件から0.6.0へ初回更新し、導入された案件内CLIの次回planと案件保持・競合停止を確認する。初回/次回の日本語手順を公開する。
- PUB-04: private origin/mainへ通常pushし、remoteと公開commitの一致を確認する。CIの未実行・失敗は成功と報告しない。

## 記録の境界

作業中の候補レビューは当時の証拠。採用後の文書・版・公開snapshotの確認は新しい証拠を残す。policy/受入条件を緩めて過去のreceiptを流用しない。
