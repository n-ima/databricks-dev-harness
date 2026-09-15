# Delivery assurance候補の独立実装レビュー

日付: 2026-09-14 (JST)。状態: 1件のP2未解消、候補の検証完了は保留。

原作者: main agent `/root`。検証者: 別context `/root/delivery_candidate_verification`。AGENTS.md、orchestrate-work、review-workを読み、harness:contextと関連session/planを確認した。routeはreview、workloadはローカル候補のため適用なし。実装対象ファイルは変更していない。追加したのは独立テストと本報告のみ。既存HARD-03変更には触れていない。

関連session: `work/sessions/20260913-234633-498-delivery-assurance-reaudit.md`。

## 対象snapshot (SHA-256)

| 対象 | SHA-256 |
|---|---|
| work/candidates/delivery-assurance/check.mjs | 685e419aee66920c1984d3ea987b62271408b771fe1434d64b8e66445dba39ff |
| work/candidates/delivery-assurance/check.test.mjs | 8125bd41d0bde3aee4840c658e68e58ce697e2d568e2042144484d3497ff7286 |
| work/candidates/delivery-assurance/independent.test.mjs | 9ec4ebd9d1115dae2f545b84065a9b7e29a1e8ef2bc7cc6f9d685bfb60c56653 |
| work/candidates/delivery-assurance/README.md | 58d5e259cf7c4b348726b42978f02b873deab3e0ffba1e04095bb793d0b28087 |
| docs/harness/requirements/2026-09-14-delivery-assurance.md | b4734ac640df40cac5ce22c8040b3622eec1a8e4411c95acfb27eef7b4bb7716 |
| docs/harness/design/DELIVERY_ASSURANCE.md | 9cf33bb0e01de35130d03dab1b58acf4c51a05e85262b573aeca714c9f32c3b7 |
| tools/lib/acceptance.mjs (既存依存、未変更) | a4785ef8688781d3be53724f301d20e6b051d778b9f947f23102431dc2c4b8f0 |

## 実行と結果

Windows、PowerShell、Node.js v24.15.0。fixtureはOS一時ディレクトリ内に作成し、各テスト終了時に自身の一時ディレクトリだけを削除する。記録のpass/devは合成データであり実環境試験ではない。

- `node --test work/candidates/delivery-assurance/check.test.mjs`: 35 pass / 0 fail / 0 skip。
- `node --test work/candidates/delivery-assurance/independent.test.mjs`: 20 pass / 1 fail / 0 skip。失敗は下記DA-IR-01の再現。
- CLIを独立fixtureから3回起動し、構造上正常はexit 0・diagnosticはexit 1・不正JSONはexit 2を確認。正常時の`mode:advisory`、`certifiesAcceptance:false`と入力契約bytes不変を確認。

## DA-IR-01 [P2]: OpenAPI 3.2追加操作がinventoryから脱落する

対象: `check.mjs`のOpenAPI paths内のmethod列挙処理。`get`から`query`までの固定フィールドだけを読むため、OpenAPI 3.2の`additionalOperations`に存在する操作を無視する。

再現: 独立テスト`independent additionalOperations omitted inventory must be diagnosed`（independent.test.mjs:38）。元OpenAPI 3.2の`/records`に通常GETに加えて`additionalOperations: { COPY: { operationId: "copyRecords", responses: { "200": { description: "Copied" } } } }`を追加する。品質契約側の操作一覧はGETのままとし、ファイルhash・実行basis・review hashを現在snapshotで再生成する。verify結果は次のとおり。

```json
{"mode":"advisory","certifiesAcceptance":false,"phase":"verify","findings":[],"executed":2}
```

[OpenAPI 3.2公式仕様のPath Item Object](https://spec.openapis.org/oas/v3.2.0.html#path-item-object)では、`additionalOperations`は追加HTTPメソッドに対するOperation Objectのmapである。この入力は単なる任意extensionや意味的な未記載リスクではなく、対応対象とされているOpenAPI 3.2 pathsに明示された操作。AC-03および設計の「operationIdを過不足なく照合する」という約束を満たさない。参考診断のため既存gateを解除する問題ではないが、未対応操作を見逃す。

受入条件: `additionalOperations`の操作も照合するか、存在時に`UNSUPPORTED_CONTRACT`として明示拒否する。上記反例が`INTERFACE_MISMATCH`または`UNSUPPORTED_CONTRACT`を返し、既存35件と独立21件が成功すること。対応対象を限定する場合は候補ガイド・設計にも記載する。

## 受入条件との対応と確認範囲

| 条件 | 今回の確認 |
|---|---|
| AC-01 | 最新一次情報の総合再調査は親taskの別担当範囲。このレビューでは判定しない。 |
| AC-02 | 既存・独立テストで要件集合不一致、重複ID、未定義参照、未対応要件/リスク、期待結果欠落を検出。 |
| AC-03 | 通常操作の欠落/削除、元operationId重複、正負ケース重複、concern欠落を検出。DA-IR-01未解消。 |
| AC-04 | 証拠bytes変更、証拠参照更新後の古いreview、実装hash更新後の古いbasis、観測環境不一致、未実行/blocked/failを検出。 |
| AC-05 | 運用6項目照合、N/A理由、applicable文書参照、designのnull未実行を既存試験とコードで確認。運用文書の実質的品質は未認定。 |
| AC-06 | 別contextで実装とテストを読み、未知反例21件を作成。actor/contextの記録照合を確認。本人認証は対象外。 |
| AC-07 | コードは読取とdigest/diagnosticsのみ。既存パス/junction拒否試験成功。独立試験で空file、1MiB境界、超過、合計16MiB超過、128file超過、CLI bytes不変を確認。 |
| AC-08 | provider比較計画は親taskの別担当範囲。provider、モデル、Databricks呼出しは実施していない。 |

## 限界と引継ぎ

意味的なinterfaces/risks丸ごとの申告漏れ、不適切なN/A、未選択artifactの変更、実際の試験実行事実、本人認証、敵対的filesystem TOCTOUは明記済みの非保証であり、今回の実装欠陥として数えない。OpenAPI/JSON Schema全体のvalidationや実HTTP/DBの品質も独立外部検証が必要。

このレビューは候補単体をWindows上で確認した。全repository回帰、実provider、live Databricks、配備や公開を検証していない。既存gate/配布への自動接続は候補コードから観測されないが、正式採用を承認するものではない。

次: 原作者がDA-IR-01を修正し、同じ独立テストを再実行した新snapshotでレビューを追記する。今回の未解消状態を親sessionにcheckpointする。正式採用と実環境評価は人の判断待ちを維持する。
