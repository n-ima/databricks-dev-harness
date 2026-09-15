---
id: PLAN-DELIVERY-ASSURANCE
requirement: ../../docs/harness/requirements/2026-09-14-delivery-assurance.md
design: ../../docs/harness/design/DELIVERY_ASSURANCE.md
status: proposed
owner: implementing-agent
started: 2026-09-14
updated: 2026-09-14
---

# 再監査と品質契約の改善候補

## 作業順と終了条件

1. DA-01: 最新情報・現行実装・既存研究を照合。採用/保留/棄却理由を報告。
2. DA-02: 品質契約の最小設計と読取専用診断候補。反例を先に試験。
3. DA-03: 候補の独立レビューと修正。既存全回帰・文書整合性を検証。
4. DA-04: 両provider・実Databricks・運用の評価計画と正式採用判断へ引き渡す。

## 制約

HARD-03の既存変更は触らない。scope台帳/完了判定/権限/予算を変更しない。Databricks上にハーネスを配備しない。個別案件、課金モデル呼出し、認証、remote pushは行わない。新しい評価基準の正式採用は人の判断待ちとする。

## 検証計画

ローカル: 欠落・誤参照・未実行・古い証拠・同一context・範囲外path・symlink・不正JSONの反例。全回帰。独立verifierは候補を変更せず未知ケースを追加検証する。

実provider/live: 未実行。将来、同じtask/予算/版/環境でbaselineとcandidateを比較。安全性は足切り、費用と時間は品質合格後に比較。運用中の障害・復旧・更新も評価対象に含める。

測定規約は再監査報告の「費用・時間・人の負担」を参照。欠測null、請求単位と取得元、全失敗を含む費用/受入trial、必須承認と誤り修正の介入区別を維持する。既存eval平均を総費用と呼ばない。実Copilot canaryにはcommand preToolUse timeoutのfail-openと外側権限の確認を含める（今回未実行）。

## 現在地

再監査報告・候補実装・独立修正再レビュー済み。候補56pass、既存556pass/0fail/1skip。DA-01〜03はverifying（候補の独立確認済み、全体受入とは別）。DA-04は正式採用と実provider/live評価範囲の判断待ち。調査・設計・候補実装は正式採用や実環境受入と区別する。
