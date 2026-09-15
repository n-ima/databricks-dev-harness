# 再監査と品質診断候補の証拠

Session: 20260913-234633-498-delivery-assurance-reaudit。確認日2026-09-14 JST。候補未採用、全体目標未完了。

## スコープ

要件・API契約・リスク・テストケース・実行証拠・運用参照・独立レビューのローカル診断候補。既存gate、policy、予算、provider設定、Databricks、個別案件、GitHub remoteには変更なし。候補はwork/candidates内で配布対象外。既存HARD-03のdirty filesは保持した。

## 調査と設計

[再監査報告](../../docs/harness/research/2026-09-14-delivery-assurance-reaudit.md)に26の一次資料、確認範囲、採否、測定規約、未実証を記録。既存40出典をすべて再精査したとは扱わない。OpenAI Docsと深掘り調査の手順に従い、最新ページを確認したが最新modelへの自動更新・課金実験は行っていない。

独立設計レビュー /root/delivery_contract_design_review は、元要件集合、snapshot範囲、design/verifyとN/A、path/size境界の4点を指摘。設計へ具体化し、既存acceptanceIdsを再利用した。

## 実行ログの要約

環境: Windows / PowerShell / Node.js v24.15.0。

| 実行 | 観測 |
|---|---|
| 初回 node --test work/candidates/delivery-assurance/check.test.mjs | 実装前のERR_MODULE_NOT_FOUNDで失敗。これは新しい機能の未実装確認であり、既存harnessに同じvalidatorがあるという意味ではない |
| 初回実装後の候補suite | 34 pass / 0 fail |
| 元OpenAPI操作集合の照合追加後 | 35 pass / 0 fail |
| npm run test:harness | 557 total / 556 pass / 0 fail / 1 existing skip、約37.3秒 |
| npm run harness:check | passed |
| 独立suite初回 | 20 pass / 1 fail。追加operationを落とす反例を再現 |
| 修正後の両suite | 56 total / 56 pass / 0 fail / 0 skip、約0.55秒 |

正本は実行可能な[候補試験](../candidates/delivery-assurance/check.test.mjs)と[独立反例](../candidates/delivery-assurance/independent.test.mjs)、および独立レビューのsnapshot。上記はツール出力の要約であって全rawログではない。再実行で検証できる。

## 独立レビュー

[初回実装レビュー](../reviews/2026-09-14-delivery-candidate-review.md)でP2 DA-IR-01を検出。OpenAPI 3.2 additionalOperationsが黙って無視される問題。新たな全仕様parserを作らず、未対応として明示診断する修正を行った。初回記録は履歴として保持する。最新の独立再確認は別のrereview記録で確認する。

報告レビューでは、費用/介入の測定規約とcommand hook timeoutの適用が不足と指摘された。報告・計画へ追記し、既存コードやhook制御を変更しなかった。

最終の独立確認:

- [実装再レビュー](../reviews/2026-09-14-delivery-candidate-rereview.md): DA-IR-01解消、同じ独立反例を含む56 pass / 0 fail / 0 skip。限定範囲に未解消の阻害指摘なし。
- [報告再レビュー](../reviews/2026-09-14-delivery-research-rereview.md): DRR-01/02解消、更新した測定規約とcommand timeoutの説明・canary計画を確認。限定範囲に未解消の阻害指摘なし。
- npm run harness:check と git diff --check を最後に再実行し成功。候補・設計・要件の最終hashをレビュー記録と照合する。正式採用receiptは発行しない。

## 対象hash（メインによる修正後確認）

| file | SHA-256 |
|---|---|
| check.mjs | ec4aa321730ea1914b9ff1d27ca951addd7ce3537b16abb57c3bf97b424bdf77 |
| check.test.mjs | 8125bd41d0bde3aee4840c658e68e58ce697e2d568e2042144484d3497ff7286 |
| independent.test.mjs | 9ec4ebd9d1115dae2f545b84065a9b7e29a1e8ef2bc7cc6f9d685bfb60c56653 |
| DELIVERY_ASSURANCE.md | 43ac5bea2b4a8763649121912eb94fa3d096230b2bf781e71fc19716e0bb1ee0 |

## 証拠の限界と次の段階

候補suiteのdev/passは合成記録であり実Databricksを呼んでいない。参照hashが一致しても実行した事実・本人性・意味的網羅性は証明しない。ツールは記載commandを実行せず、URLへ接続しない。独立した意味レビュー、API schema validator、実HTTP/DB試験を置換しない。

正式採用、risk-tier/入口/既存receiptとの連携、両provider実地canary、実Databricks、コスト比較、運用実績、配布は残る。全体completedやL2/L3への昇格は行わない。手順上のhuman gateに達したら、実装済み候補の範囲を説明して判断を求める。
