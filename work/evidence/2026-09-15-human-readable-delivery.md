# 日本語文書・品質契約の標準採用 — ローカル検証

対象: HARNESS-HUMAN-DELIVERY、2026-09-15。主担当: root（Codex）。ハーネス開発元のみ。利用者の採用指示をADR-0010に記録した。

## 変更前の再現

新規 `tests/human-documents.test.mjs` の初期3試験は0成功/3失敗。実際のintakeが英語の要件・設計を生成し、日本語の業務/データ/画面/外部境界の確認構成がないことを検出した。

## 実装と結果

| 対象 | 結果 |
|---|---|
| 要件・設計生成 | 日本語テンプレートを共通の生成元にした。機械ID/API/原資料は原語を維持 |
| 一覧と定義 | 業務、用語、機能、データ/項目、画面/遷移、外部境界、試験/運用を対象範囲に合わせて定義 |
| API-only | 画面を適用外とし、UI工程を追加しない |
| UI設計 | 軽量HTMLは任意の配置/導線確認。実行可能モックの挙動確認と承認を代替しない |
| 品質診断 | 正式CLI、配布対象、標準skillへ統合。参考診断のまま既存receiptを維持 |
| 新旧互換 | 旧英語sessionと新日本語sessionの再開・更新、回答台帳、承認/hash失効を検証 |
| provider | Claude Code/Copilot生成資産を同期。実providerを動かした試験ではない |

## 実行したチェック

- `node --test tests/human-documents.test.mjs tests/workloads.test.mjs`: 初期改善後11成功/0失敗。
- `node --test tests/human-documents.test.mjs tests/memory.test.mjs tests/delivery-assurance.test.mjs tests/delivery-independent.test.mjs`: 97成功/0失敗（追加CLI試験前）。
- `node --test work/reviews/2026-09-15-delivery-adoption-probe.mjs tests/human-documents.test.mjs`: 13成功/0失敗。不正phaseの終了値は独立probeの失敗を受け2へ修正。
- `npm run test:harness`: **619件、618成功、0失敗、既存skip 1**。39.44秒。旧候補の56試験を通常回帰へ移植し、新規文書/CLI/再開6試験を追加。
- `npm run agent-assets:sync`: 成功。
- `npm run harness:check`: 成功。
- `skill-creator/scripts/quick_validate.py`: 変更した5skillすべて成功。
- `git diff --check`: 成功。

これはコマンドの確認結果の要約であり、生ログや実環境成功を捏造したものではない。fixtureの合成pass/dev記録はテスト対象のデータで、実Databricksへの実行証拠ではない。

## 独立確認

- [別contextの設計レビュー](../reviews/2026-09-15-human-docs-design-review.md): 最低属性への参照不足HDR-01を修正し、再レビューで解消。API＋CSVバッチ・UIなし・重複規則未決の模擬依頼を確認。
- [別contextの品質診断コードレビュー](../reviews/2026-09-15-delivery-adoption-code-review.md): 移植56試験＋独立CLI probe7件が63成功/0失敗、配布限定2試験も成功。不正phaseの終了値HD-IR-01は修正後に独立確認で解消。
- [日本語生成・session互換の独立コードレビュー](../reviews/2026-09-15-human-documents-code-review.json): 未解消指摘なし。狭い回帰150成功/0失敗/既存skip1。実際のインストール先CLIを模した生成/承認/再開probeも成功。全体回帰は独立再実行で終了0（dot reporterなので独立した成功/skip件数とは区別）。22対象hashの一致も検証者が確認。

環境はWindows/PowerShell、Node.js v24.15.0。skip1は当hostでテスト用symlinkが作れない既存条件。directory junctionの試験は成功。主担当は最終設計/診断レビューの現行hash15件を照合済み（修正前snapshotは履歴として除外）。

## 未実施・対象外

実Claude Code/Copilotの自然言語canary、実Databricks、課金モデル比較、個別案件変更、remote push、リリース配布は実施していない。既存承認文書の一括翻訳、HARD-03の正式採用、稼働状態用の新画面も行わない。標準採用とローカル検証は、無条件自動実行・完全網羅・世界順位の証明ではない。
