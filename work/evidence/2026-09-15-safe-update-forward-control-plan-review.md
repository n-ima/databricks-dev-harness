# 正常対照の適用前確認

先の既存provider差分保持試験を変更せず、別tempに正常対照を作成した。最初から`.gitignore`を持ち、provider独自差分はない。旧版check成功、案件試験2 pass。新しい実行器は明示許可された試験限定で使用する。

- 対象: `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-mzrNox/legacy project`
- 更新元: `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-mzrNox/clean source 0.5.0`
- 版: 0.4.0 → 0.5.0、`source-tree`（Gitなし）。
- 計画: `.harness/updates/update-20260915-012338-130-84201d84.json`
- update 45 / add 45 / keep 967 / conflict 0 / delete 0。
- 元配布形式から別途作ったplanと全1057 operationが一致。
- 元版管理1012ファイル・案件20ファイル・installed baselineは計画前後で不変。
- manual-review: 案件所有のpackage/lock、README、.vscode、docs/product、work、apps、resources、srcを保持する。試験範囲に追加依存・仕様移行・削除は不要。公開0.5.0への更新で候補CLIが案件に入るとは期待しない。
- fresh temp対象の書込み担当はこの試験のみ。他のagent/provider/background writerは起動していない。

利用者本人の新しい承認を仮装せず、既存の明示的fixture適用許可に基づき、この計画を独立検証者が確認して適用する。実案件・正式採用・公開・実provider・Databricksの受入完了は意味しない。

訂正記録: 当初本文の案件22件は人向け説明の誤計数。保存済みstate.jsonのprotectedPathsは当初から20件で、機械証拠は修正していない。
