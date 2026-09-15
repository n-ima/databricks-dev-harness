# 採用済み改善のmain反映記録

2026-09-16 JST。対象はGitHubハーネスソースのみ。

## 採用と統合前の検証

- 人の指示と範囲: [ADR-0012](../../docs/harness/decisions/ADR-0012-ui-scope-adoption.md)。UIFとHARD-03のローカル実装範囲の採用待ちは解消した。
- 確認したremote: private `n-ima/databricks-dev-harness`、default branch `main`。
- 旧main: `a77c96ac3bf48cd7033688e38449f320407611d3`。
- レビュー済み基点: `acc506aa4de4e28e15400b92da06df2c2dfa2a8e`。旧mainの子孫でありfast-forward可能。
- `npm run harness:check`: pass。
- 全回帰: 711件、709 pass / 0 fail / 2 skipped。Windows、Node v24.15.0。[機械結果](2026-09-16-adopt-main-tests.json)、[原log](2026-09-16-adopt-main-tests.log)、[再実行用runner](2026-09-16-adopt-main-check.mjs)。skipを成功へ算入しない。
- acc506aから実装・テスト・生成asset・packageに差分なし。今回の差分は採用注記と作業/検証記録のみ。独立確認担当もdocs/work以外1,042fileと、既存4版・4,204payloadのraw bytes/hash不変を確認。
- `.harness/` の既存ローカルbackupは保持し、Git追加対象にしない。

## 到達状況

この時点ではmain push前。最終到達はpush後の独立確認と追記で記録する。

## 限界

実provider/実AppKit画面/実Databricksの受入、課金、進行中案件への更新は未実施。旧版payloadを再発行せず、tag/Release/バージョンは変更しない。元の独立receiptはそのcommitの履歴であり、採用注記変更後の同名文書へhash一致を主張しない。main更新は既存案件への自動更新ではない。
