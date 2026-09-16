# 正式採用後の限定独立確認

2026-09-16。reviewer: `purpose_design_review`、provider: Codex、別context: `root/purpose_design_review-adopted-20260916`。

結論: PDD-01〜06の既存の限定passと、採用記録への移行を確認した。追加の指摘なし。実装の再開発・全試験再実行は行っていない。採用は利用者の決定であり、このreviewerが承認を代行したものではない。

## 人の決定と今回の範囲

親担当へ届いた利用者の「正式採用してよい」、続く「すべて承認するので進めてください」という指示の引継ぎと、ADR-0013・要件・設計・計画・実行記録先頭の整合を確認した。独立レビューは記録の整合と技術的な限定判断であり、人の発言を認証するシステムや完了receiptではない。

採用済みなのは目的別の手順改善と評価課題の強化。正式UI承認、全画面設計、実AppKit部品、安全な権限制御は維持される。公開・stamp・GitHub到達・案件への適用は別の作業で、今回の判定はそれらの成功を含まない。

## 変更範囲の独立照合

元品質記録 `work/quality/2026-09-16-purpose-driven-delivery.json` のrequirement 1件とartifacts 24件、合計25件の現在SHA-256を旧値と比較した。変更は下記2件だけで、残る23件は一致した。

| 対象 | 候補時点SHA-256 | 採用後SHA-256 |
|---|---|---|
| requirements/2026-09-16-purpose-driven-delivery.md | 084b2215daea103066eb9644613a9dcb7df663079cbef7b4dd3a03b3bb1e24f3 | 43ec974e9ca1430ec880499abb21e0ac7beb189bb757a29928c8a604abd13368 |
| design/PURPOSE_DRIVEN_DELIVERY.md | fe5229e7758cdd6c11ab06c3d0ca2f827b5e1f6ad337d02f56a7bab532eb53e8 | bc8ee9c54e40e4a8738bfb27ff1151fe29adf36dd522e1edbac6a2c6b35738aa |

要件はstatusと末尾の採用段落、設計は冒頭の状態と比較表の採用行だけをメモリ内で旧文言へ戻した。UTF-8のSHA-256は両方とも上表の候補時点の値と一致した。sourceへの逆書込みはしていない。受入条件PDD-01〜06、設計の判断・検証・移行条件は不変である。

既存5結果の証拠11参照も全件hash一致。6つのcanonical skillと12件のproviderコピーは一致した。`git diff -- tools harness/router.json` は差分なし。別作業の `harness.config.json`、`package.json`、`package-lock.json` は0.7.0から0.7.1への版文字列のみであり、依存や実行ロジックの変更ではない。リポジトリ全体が無変更という意味ではない。

ADR-0013のSHA-256は `a2700e4657fb48c894bcbc3b426fe20a44031ae7dfd46aa65a99d8617f9f5137`。読取時のplanは `86c3ae7e1a44e1482ad846b60ac5b3b66aba012852e70f1ba33eb0f2f4307693`、集約実行記録は `f7c8d48d2d699a72fa9121e455d5e35ab141c1695494453255aa48e678fb35d1`。後二者は現在状態の整合確認に使い、公開成功の証拠とはしない。

## PDD受入条件と根拠

| ID | 判断 | 根拠と今回の確認 |
|---|---|---|
| PDD-01 | pass | 凍結済み調査・設計レビューを維持。ADRの採用理由と未検証が既存証拠に一致し、未実行を成功に変えていない。 |
| PDD-02 | pass | 目的・必要十分な成果・停止条件の手順、skill/templateは旧hashと一致。採用後も全工程・全帳票の一律強制を追加していない。 |
| PDD-03 | pass | 実AppKit独立run2、固定3画面の設計/局所操作、fresh-context再開の既存証拠を維持。初回相談と正式gateの境界は不変。全状態の正式UI受入を認定しない。 |
| PDD-04 | pass | 非UI4題の目的別停止点と分類再現の限定結果を維持。実データによる分析・推論・障害解決成功へ読み替えていない。 |
| PDD-05 | pass | 正式制御・fixture・出力先保護の実装と証拠は不変。旧全回帰728件中726pass/0fail/2skip、独立78件・5件は過去の実行として保持し、今回再実行したとはしない。 |
| PDD-06 | pass | provider資産一致を今回も独立確認。ADRは既存案件を再初期化せず、採用・公開・案件適用を分離する。実provider反復比較は未実行のまま。 |

## 品質記録の引継ぎ方法

新しい `work/quality/2026-09-16-purpose-adopted.json` に旧5結果と根拠を引き継ぐ。実行された対象実装と受入条件が不変であることを本確認で担保し、結果commandには元basisと再実行していない旨を残す。TC-REVIEWにだけ今回の採用メタデータ確認を追加する。新しいbasisは採用後の正本とADRを対象とし、旧結果が新たに実行されたことを意味しない。

凍結した元品質記録のSHA-256は `f111bfa845f5803e6ce4cdd2b93d0f044ec65a826ce08ba231ccfd5bef0c0909`、元basisは `ef3df54f838362ebe47303ab3cbe53141f303bb79a0f6e025f3cdff6c7defa9e`。旧独立MD/JSONとquality-finalも変更しない。旧品質記録が現在の採用後正本に対してstaleになるのは履歴保持の結果であり、旧記録を書き換えて隠さない。

本MDはTC-REVIEWの証拠、別の採用レビューJSONはreviewsからのみ参照する。最終contract hashを本MDへ埋め込まず、循環参照を避ける。新規の運用gateや標準必須帳票を増やす変更ではない。

R-SCOPEは全画面と目的別停止点、R-SAFETYは既存拒否制御、R-DISPLAYは実部品表示、R-CLAIMは結果と未検証の区別を元独立レビューから引き継ぐ。今回の採用文言でどれも弱められていない。外部HTTP契約はなくinterfacesは空で妥当。運用6項目は、ownershipの人の採用決定が解消した点以外、監視記録・旧正式版保持・合成データ保護・実provider予算の分離・依存版固定という既存範囲を維持する。

## 未検証・別工程

実Claude Code/Copilotの反復比較、全段階sourceの厳密再現、速度/token/費用改善率、全状態・アクセシビリティの正式UI受入、Databricks認証/配備/実データ、敵対的な同時filesystem差替えへのOS隔離は認定しない。0.7.1のstamp・配布経路・公開・案件適用と完了receiptの発行は主担当の別工程である。
