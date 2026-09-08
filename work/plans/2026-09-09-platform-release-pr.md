## 概要

0.4.0の候補をprivateテンプレートへ反映するPRです。L1を維持し、実Databricksや両providerでの本番対応を認定するものではありません。

- 16領域の対象分類と要件・設計への接続。API-onlyの不要UI確認、ML登録のDelta誤判定を修正。
- API/分析の非deploy用fixtureと実HTTP/SQL/Python契約テスト。
- Claude Code/Copilot hook形式と複数ファイル編集の検査を改善。
- 最新調査、対象別利用手順、provider/model互換性、セッション・ナレッジ・独立検証の記録。
- 旧0.3.2を保持し、別の0.4.0候補manifestを収録。

## 検証

- ローカル全回帰:325件、324成功、失敗0、Windows権限依存skip1。
- GitHub実CI: [run34280734934](https://github.com/n-ima/databricks-dev-harness/actions/runs/34280734934)、source f90000b1b4ae3ffad9ac810f632822ddfbf65ab2、Ubuntuで325/325成功・失敗0・skip0。既存workflow_dispatchの実行であり、自動3-OS起動や実Copilotモデルの動作検証ではありません。
- 独立最終重点検証:123/123成功、新生成API HTTP:2/2成功。全回帰と重なるため合算しません。
- Conformanceと1012管理ファイルのsource/fresh Git byte一致を確認。
- 詳細:work/evidence/2026-09-09-platform-publication.md、work/reviews/2026-09-08-platform-final-review.md。
- ステージ後の差分検査は、新規5ファイルに末尾空行の書式警告あり。前回のunstaged検査は新規ファイルを含んでいません。既存0.4.0の固定bytesを保ち、警告を成功とは扱わずレビュー事項として残しています。

## レビュー上の注意

制御対象の検査とpolicy hash入力が変わります。自己承認や自動mergeは行いません。予算・完了基準・人の承認ゲートは緩めていません。

実provider host、Databricks OAuth/live integration、モデル比較は未実施。API fixtureは製品backendではありません。CI結果はこのPRの実runを参照してください。Databricksへのデプロイ、権限変更、repo公開設定の変更は含みません。
