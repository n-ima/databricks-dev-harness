# 日本語文書と品質契約の統合設計

2026-09-15。要件: [HARNESS-HUMAN-DELIVERY](../requirements/2026-09-15-human-readable-delivery.md)。前回候補は履歴として保存し、今回の採用は[採用記録](../decisions/ADR-0010-human-readable-delivery.md)に分離する。

## 実装方針

- 品質診断をtools/libへ昇格しCLI `delivery check` / `delivery hashes` を提供。read-only、参考診断、既存receiptと承認gateを維持。
- 要件・設計のMarkdownひな型をintakeも使用し、別の英語本文生成とのずれを解消する。機械metadataとIDは原語、本文と表見出しは日本語。利用者資料の原文は勝手に翻訳しない。
- [文書標準](../operations/DOCUMENTATION_STANDARD.md)を配布する正本とし、各一覧の最低属性、ID間の対応、未確定/仮定/適用外を定義する。案件の正本はdocs/product。項目定義・業務規則・外部境界と受入条件は本実装前に対象slice分を確定。
- 小案件は2文書内の一覧にまとめ、必要な部分だけ別紙へ分離。IDで参照し本文を複製しない。テストはwork/qualityの契約から要件・API・リスク・証拠へ紐づける。
- HTML紙芝居は配置・ラベル・遷移の低コスト確認。fixtureモックは入力・状態・アクセシビリティの確認。紙芝居承認だけでui-mock gateを解除しない。productionコンポーネントを使うモックへ移る際も、検討結果とfixtureを再利用する。
- 既存session見出しなど機械契約は安定させ、必要な日本語併記を互換読取で扱う。既存文書を一括置換しない。

## 検証境界

隔離fixtureで新旧文書、intake回答/承認、API-only/UI分岐、診断の未実行・不正入力・古い証拠を試験。両providerへのファイル同期は実provider実行ではない。reviewを別contextで行い、全回帰を再実行。入力資料そのものを要件承認と解釈しない。
