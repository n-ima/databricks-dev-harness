# 目的に合った開発手順の改善計画

要件: docs/harness/requirements/2026-09-16-purpose-driven-delivery.md
設計: docs/harness/design/PURPOSE_DRIVEN_DELIVERY.md
session: 20260916-071045-256-purpose-driven-delivery

## 今回の目的と終了条件

配置相談で本実装を先取りしない手順を、全画面設計・Apps一致・安全な承認を保持して改善する。調査から候補実装・独立検証まで進め、未検証の実providerや正式配布を完了としない。

## 今は行わないこと

実案件・Databricksの変更、新画面管理システム、新承認gate、全操作の一律タイマー、評価器の緩和、権限追加、main/pushの無断実行。

## 作業と証拠

- [x] PDD-A 調査の比較・反証と改善設計、独立レビュー。容量障害のため事前でなく設計/実装を併せて確認した。
- [x] PDD-B 既存のskills/標準/template/golden課題の最小修正、provider同期。
- [x] PDD-C 回帰試験、実部品の隔離表示、変更・全画面・再開の独立試行。実Claude Code/Copilot比較とは区別する。
- [x] PDD-D 独立最終レビュー、未検証/移行/配布条件の整理、記録の照合。正式採用・公開は含まない。

## 再検討条件

表示にbackend/認証初期化が不可欠、部品が想定版で利用不能、仕様の未決がUIの構造を変える、正式gateを弱めないと進めない、試験が実案件・資格情報・費用へ波及する場合。原因と対象を限定し、必要なら人の判断を求める。

## 確認済みの状態

開始時0.7.0/main、未追跡.harness/のみ。source pre-push guard導入済み。Claude CLIは存在、Copilot CLIはPATH上になし。実providerの利用権/費用/隔離は未確認。既存案件のinstalled AppKit UI 0.72.0が存在するが、当該案件は変更しない。

最終の全回帰は追加5件を含めて728件中726成功/0失敗/2skip。独立レビューのPDD-R1（保存先のjunction）とPDD-R2（分類入力の再現性）は解消。実AppKit表示、段階的な3画面の配置・動作設計、新context再開、非UI4入力の範囲判断を確認した。最終品質診断は5結果登録・指摘0件だが参考診断であり、正式受入を代行しない。

実装・独立検証は完了。利用者の「正式採用してよい」で評価課題の強化を含む正式採用が確定し、続く「すべて承認するので進めてください」で新版公開へ進む。ADR-0013を保存済み。実Claude Code/Copilot反復比較・効率改善率は未検証。公開はsession 20260916-091431-687-publish-harness-0-7-1に分離し、0.7.0を保持して0.7.1を作る。実案件の更新やDatabricks操作は行わない。
