# 過去の再生ログ参照に関する追補

Date: 2026-09-10 (JST), private source push前の独立確認で発見。

`work/reviews/2026-09-10-initialization-alias-review.md` が参照する
`work/evidence/2026-09-10-initialization-final-replay.log` は、現存する内容と
その報告のSHA-256が一致しない。

- 当時の報告: `23310706d914662f46f132b7f1df78aeda09506fc10352eceeb20a1c36fe5865`
- 今回確認した現存6277bytes: `cd5611b0f7286128321a60f1fe2f5e947371a108d496731fb552802c4973a27d`

現存ログは20260910-002104の生成planを含む後続の主担当再生であり、
旧aliasレビューが記録した実行のログとしては使えない。
ファイル名の再利用による過去証拠の欠落として扱う。現在bytesから当時の内容を
推測復元したり、旧報告のhashを書き換えて一致したことにしたりしない。
独立最終レビューの「過去ログを保持した」という一般的説明にも、この例外がある。

HARD-08の採用は、この不一致logではなく、別名の最終r6ログとhash固定の
最終レビューに基づく。`initialization-adoption-check.mjs` により、
最終レビューそのものとその26行の対象はすべて一致している。
`2026-09-10-initialization-final-r6-independent.log` は42 pass、
`2026-09-10-initialization-final-r6-baseline.log` は151 pass / 1既存skip。
最終レビューで読む全体r6ログも別ファイルで保持している。

今回のpushは現存ログと本追補を両方保存する。今後の再実行は未使用の出力名へ
出力し、過去レビューの証拠を上書きしない。全ログの保存先の排他的作成を
実装することは後続改善であり、今回それが実装済みとは主張しない。
