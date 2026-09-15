# 0.5.0公開計画

要件: docs/harness/requirements/2026-09-15-private-publication.md

1. 採用済み変更をindexへ選択し、隔離snapshotで未採用の3混在箇所を除く。元の作業ツリーから候補を消さない。
2. 全回帰・構造検査、0.5.0のmanifest/payloadとraw-byte検査、別コンテキストの独立確認を実施する。
3. indexと検証snapshotの一致を確認し、通常commit/push。remote SHAとCIを確認して記録する。
4. 既存案件には反映せず、更新のdry-run→競合解決→適用→案件試験→別context再開を案内する。
