# Delivery assurance candidate

未採用の読取専用診断。完成判定、承認器、実行エンジンではない。ハーネス本体・案件への自動組込みはまだ行っていない。

## ローカル検証

```text
node --test work/candidates/delivery-assurance/check.test.mjs
node work/candidates/delivery-assurance/check.mjs --root D:/projects/TARGET --contract work/plans/delivery-contract.json --phase design
node work/candidates/delivery-assurance/check.mjs --root D:/projects/TARGET --contract work/plans/delivery-contract.json --phase verify
```

上記TARGETは説明用。実案件を操作していない。出力はmode:advisory、certifiesAcceptance:false。exit 0は構造上の指摘なし、1は指摘あり、2はCLI入力・読取失敗。0でも業務受入/安全性/実行事実を証明しない。

## データ構造

具体例はcheck.test.mjsのfixtureを参照。テスト内で作るpassやdev記録は合成データであり、実Databricksの証拠ではない。

| 欄 | 内容 |
|---|---|
| schemaVersion | 1のみ |
| producer | 実装担当actor/contextの記録 |
| requirement | 正本要件へのpath/sha256 |
| artifacts | 対象実装とテストのpath/sha256。選択漏れは独立確認 |
| requirements | 元要件のAC集合と完全一致 |
| risks | id/description/testIds |
| interfaces | id/kind:http/contract/operations/concerns |
| operations（API内） | 元OpenAPIのoperationId、positive/negativeの別test ID |
| concerns | 認証、認可、入力、エラー、冪等性、同時実行、互換性、上限の各適用判断 |
| testCases | id/requirements/level/environment/preconditions/steps/expected/result |
| result | nullまたはstatus/environment/basisSha256/evidence/command/versions |
| operations（最上位） | ownership/monitoring/recovery/data-protection/cost/dependency-updatesの適用判断とrunbook |
| reviews | actor/context/independent/status/reviewedSha256/coverage/evidence |

basisHashは結果・review以外の全契約に対するcanonical hash。reviewHashはreview以外の全契約に対するhash。結果を変更したら再レビューする。記録されたactor/contextは認証ではない。review coverageは要件・リスク・interface・運用項目の全IDを照合するが、レビューを実施した事実は外側の仕組みで確認する。

design段階で未実行を許容し、verify段階では未実行/失敗/blockedを指摘する。実行前にはテスト計画を確認し、実行後の結果を後付けで都合よく変えない。API契約・要件・コード・試験の変更は古い証拠を無効化する。

## 意図的に保証しないもの

- OpenAPI全仕様、JSON Schema、認証実装、DBの実動作。既存の標準validatorや案件のHTTP/DB試験を利用する。OpenAPI 3.2 additionalOperationsは黙って無視せず未対応として診断する。
- interfacesやrisksを丸ごと記載しない、全運用を不適切に適用外にする、といった意味的欠落。独立レビューで要件から逆に洗い出す。
- 選択artifact外のファイル変更や実環境変更の自動発見。正式化時に変更集合/配備版と連携する必要がある。
- hashの改ざん耐性を超える実行/identity認証、敵対的な同時filesystem変更へのOS境界。
- すべての製品・変更に同じ重さの文書を要求すること。今回の候補はAPI縦切りの検証であり、軽微変更/分析/MLへの省略規則は次段階。

## 正式採用前の人の確認

この契約を標準フローにするか、risk-tierとN/A条件、既存receiptと役割重複がないかをレビューする。候補が通ったことだけでsession closeや配備を許可しない。
