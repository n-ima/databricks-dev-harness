---
id: ADOPT-MAIN-20260916
status: accepted
owner: repository-owner
---

# レビュー済み改善の採用とmainへの反映

利用者の「ということは、採用待ちはなく、実装までは終わっている、ということですか。であれば、mainに反映してください」に基づく。説明したUIFとHARD-03のローカル実装範囲を正式採用し、直近の是正とともにprivate GitHubのmainへ反映する。同じ範囲の採用判断を再要求しない。

## 受入条件

- MAIN-01: UIFとHARD-03の採用範囲、互換性変更、検証済み/未検証をADRと現在の運用案内・sessionに記録する。履歴の未採用記述を現在の停止理由として残さない。
- MAIN-02: レビュー済みcommit acc506aa4de4e28e15400b92da06df2c2dfa2a8eから実装・テスト・生成assetを変更せず、ローカル検査と別contextの統合確認を行う。既存リリースpayload、案件、認証、ローカルbackupは変更・追加しない。
- MAIN-03: private n-ima/databricks-dev-harnessのmainへ履歴を保つ通常pushを行い、リモートcommitがローカルmainと一致しレビュー済みcommitを含むことを確認する。

## 設計と対象外

[ADR-0012](../decisions/ADR-0012-ui-scope-adoption.md)に採用と統合方法を記録する。新規機能や評価器の変更はなく、追加の品質契約JSONは作らず既存の受入証拠と差分・統合レビューを使う。Databricks操作、実providerモデル実行、案件更新、バージョン変更、tag/Release/payloadの再発行は対象外。
