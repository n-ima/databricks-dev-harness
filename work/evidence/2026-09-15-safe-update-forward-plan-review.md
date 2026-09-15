# 隔離forward test: 適用前の計画確認

- 確認者: 独立forward-test agent。利用者本人として承認を作成した記録ではない。
- 根拠: 親からの明示的なテスト依頼でsource/destination fixtureへの適用を許可済み。未公開の候補CLIは試験限定。
- 対象: `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-DC37Di/legacy project`
- 更新元: `C:/Users/nimao/AppData/Local/Temp/safe-update-forward-DC37Di/clean source 0.5.0`
- 実行器: `D:/projects/databricks-dev-harness/tools/update-harness.mjs`。対象は`--target`で明示。
- 版: 公開配布物0.4.0 → 公開配布物0.5.0。実行器と更新payloadの版を混同しない。
- 選択: Gitも配布cacheもないclean-source形式。CLI表示は`source-tree`。
- 差分: update 45 / add 45 / keep 967 / conflict 0 / delete 0。
- 計画: `.harness/updates/update-20260915-012041-430-111f809b.json`。
- 管理1012ファイル、案件20ファイル、installed baselineの更新前hashが計画後も一致。
- 書込み: この試験で新規作成したtemp案件のみ。別agent/provider/background writerはこのfixtureで起動していない。対象sessionにcheckpointを初期配置した。

## 手動移行の判断

配布manifestのmanual-reviewはpackage/lock、README、.vscode、docs/product、work、apps、resources、srcを保持し、必要な移行を別途確認するという内容。公開0.5.0の運用手順は追加npm依存なしとしている。案件の今回の最小検証は既存Node標準ライブラリだけで実行でき、計算・拒否の合成案件試験を更新前に2件実行済み。全20案件ファイルを保持する計画にして、仕様やnpm scriptsの移行は行わない。

案件独自`.github/skills/project-custom/SKILL.md`を意図的に含めたため、旧版のcheckが既に`file list differs from canonical skill sources`で失敗している。更新計画に競合はないが、これを案件受入完了とは扱わない。独自skillは無条件syncせず保持し、更新前後のcheck結果を比較する。

既存許可の範囲でこの具体計画を隔離fixtureへ適用する。実案件適用、正式採用、公開、実Claude/Copilot起動、Databricks、外部networkへの許可は付与しない。

訂正記録: 当初本文の案件22件は人向け説明の誤計数。保存済みstate.jsonのprotectedPathsは当初から20件で、機械検証も20件。最終レビュー時に本文のみ訂正した。管理1012/1057、baselineは別母集団。
