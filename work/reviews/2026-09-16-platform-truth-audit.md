# Databricks機能・実装・検証範囲の独立監査

2026-09-16 JST。対象: 現行ローカル候補と固定公開payload `.harness/releases/0.6.1/files`。担当: Apps/API、Delta更新、Lakebase、Genie/指標、Notebook/分析、ML/Serving、モデル/OCR評価。

## 結論

新しい確定指摘は2件。既存Lakebase Appを壊しうる技能の移行指示と、通常入力で不正YAMLを含むMetric View SQLの生成。両方とも公開0.6.1に存在し、未採用UI候補だけの問題ではない。

一方、README、VALIDATION_STATUS、PLATFORM_PLAYBOOKは、技能経路・合成fixture・未実行draft・実環境未検証を概ね区別している。今回読んだ現行資料から「全Databricks機能が実装・実機検証済み」とは読めない。過去の全会話、全vendor資料、全案件や全境界を監査したものではない。

## 確定指摘

### PT-01 / P1: 既存AppのLakebase resource型を変える誤った技能指示

- 対象: `vendor/databricks-skills/databricks-lakebase/SKILL.md:16`。201行付近でも旧 `database` keyを使うと失敗すると断定。`harness/workloads.json:135` がこの技能を選び、`tools/lib/workloads.mjs:22` 付近のconformanceは技能ファイルの存在を検査するが意味の正しさは検査しない。
- 内容: 既存Appの `database` resourceを退役扱いして `postgres` へ移すよう指示している。
- 照合: 2026-09-11更新の[公式Apps/Lakebase資料](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase#notes)は、既存 `database` resourceが継続動作し、`postgres` への変更で別のPostgres roleができ既存データへのアクセスが壊れるため変更しないと明記。[Autoscaling移行資料](https://docs.databricks.com/aws/en/oltp/upgrade-to-autoscaling#upgrade-of-existing-provisioned-instances-to-autoscaling)にも同じ注意がある。新規Appに `postgres` を選ぶ推奨と既存Appの変更可否を混同している。
- 再現条件: 既に `database` を使用するAppの改修・Lakebase接続相談で選択技能を読むと、現行公式の注意に反する移行指示に到達する。接続破壊自体は実DBで実行していない。指示の矛盾と公開配布を確認した。
- 公開範囲: sourceと0.6.1 payloadの該当技能は全byte同一。SHA-256 `155eaa65499902aac25a5ffb7cd5b5293329c373b52dec744558f0d252bdee8f` は公開manifestとも一致。
- 影響: 技能を正しい前提として採用したエージェントが、稼働中Appへの不要なresource/role変更を提案し、承認されれば既存データへのアクセスを壊しうる。今回その変更を行った事実はない。
- 是正条件: 原vendorの出自を維持しつつ、検証済み版への更新または上位の明示訂正で「新規」と「既存」を分ける。旧 `database` を保持する案件を合成前方試験にし、不必要な変更を提示しないことを独立確認する。実移行が必要ならresource/role/権限を個別設計する。

### PT-02 / P2: Metric Viewのdraft SQLが通常入力でも不正YAMLを含む

- 対象: `tools/lib/scaffold.mjs:866`〜868（公開0.6.1では865〜867）。`AS $$` の後、YAML文字列の内側に `-- Generated from ...` を挿入している。ここはSQLコメントではなくYAML本文なので構文が壊れる。
- 再現: `Region=region` / `Revenue=SUM(amount)` / source `dev.audit.orders` という通常の入力で `planScaffold` → `applyScaffold` を実行。現行候補・公開payload双方で `draft-ready` として生成される。生成した `.metric.yml` はPyYAML 6.0.3で成功するが、`.draft.sql` の `$$` 内を同じparserで読むと `mapping values are not allowed here`、`version: 1.1` で失敗する。コメント接頭辞だけをメモリ上で `#` に変えた対照では成功した。
- 証拠: `work/evidence/2026-09-16-platform-truth-probes.mjs`。実行: `node work/evidence/2026-09-16-platform-truth-probes.mjs`、exit 0。各版で standalone=pass / embedded=fail / corrected-control=pass。合成temp rootのみ使用し実SQLは未実行。
- 公式契約: [Metric View作成](https://docs.databricks.com/aws/en/uc-semantics/metric-views/create#sql-statement)は `$$` の内側をYAML定義とする。[YAML reference](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference)も標準YAMLを使用し、コメント例は `#`。
- 試験の欠落: `tests/scaffold-data.test.mjs` のGenie/metric試験はdraft表示・出力path・YAML中の式を照合するが、SQLに埋め込んだYAMLをparseしない。重点既存62試験の成功でも本件を検出しなかった。
- 影響: 生成SQLを具体的な配置先へ埋めてレビュー後に使用する段階で構文エラーになる。`draft` / `deployReady:false` は明示されており、自動実行・実データ破壊はない。
- 是正条件: SQLコメントを文字列外へ移すかYAMLコメントへ変更し、生成SQLから抽出した本文をparseして正本YAMLと同じ定義であることを試験する。DatabricksでのMEASURE/DDL検証は別途必要。

## 追加確認候補（実Spark障害は未再現）

`tools/lib/scaffold.mjs:621,631` の `groupBy(...).count().where(F.col("count") > 1)` は集計列にaliasを付けない。一方、351行以降はkeyまたはsequenceの合法名 `count` を受理する。独立probeで key=`count` と sequence=`count` の双方を生成し、各4件の生成unittestが現行・公開両版ですべて成功した。

[公式GroupedData.count](https://docs.databricks.com/aws/en/pyspark/reference/classes/groupeddata/count)の出力はgroup keyに `count` 列を加えるため、この入力では同名列になり名前解決が曖昧になると推定する。今回のPythonにはPySpark/Deltaがなく、この段階は実行していない。独立したSpark環境での確認、衝突しない集計alias、合法列名の境界試験が次の確認条件。確定2件へ水増ししない。

## 実装と証拠の対応（未検証の明示は不具合と別）

| 領域 | 現在あるもの | ここからは言えないこと |
|---|---|---|
| Databricks Apps / AppKit | 版固定manifest・plan/init経路、明示profile/host、生成root検査。`tools/lib/scaffold.mjs`、`tests/scaffold-data.test.mjs` | 試験のDatabricks応答は注入fake。実AppKit build、Apps deploy、OAuth/resource/画面/利用者権限の成功ではない |
| Apps HTTP API | `tools/lib/starters.mjs`、`harness/templates/starters/api/` のOpenAPIとloopback HTTP。入力・再送・競合・容量・同一process内同時呼出を試験 | 固定 `Bearer fixture-only`、メモリreceipt。実OAuth、tenant認可、Lakebase永続transaction、分散同時実行、負荷、deploy用runtimeはない |
| Delta更新 / Lakeflow | 生成Pythonの純粋な行遷移とDelta builder呼出順の記録adapter、job draft。実行には別の `--execute` が必要 | Spark DataFrame検証、Delta MERGE transaction、実source/target/compute/権限は未実行。Job/Pipelineが稼働済みとは言えない |
| Lakebase | catalog・質問・設計・公式技能への経路 | 専用CRUD生成器、実DB migration/transaction/pool/token rotationの試験ではない。PT-01の技能誤指示がある |
| Genie | table指定のspace JSON、resource draft、質問benchmark枠。`scaffold.mjs:883`以降 | expected answer/SQLは空配列。会話API、ground truth、paraphrase、認可、精度を測った証拠ではない |
| Metric Views | YAML、SQL、requiredChecksのcontract draft | MEASURE parityやSHOW CREATE検証の実装/実行ではない。加えてPT-02の生成構文不備 |
| Notebook / SQL分析 | 合成fixture、ipynb、Python集計、SQLiteとの比較。`starters.mjs:45`以降 | Databricks SQL draftは未実行。Spark/Connect、実データversion/ACL/scan、予測モデルを確認していない |
| ML training / Registry / Serving | `harness/workloads.json:221`以降の分類・質問、vendor技能 | 学習・評価・登録・endpointの実装を汎用生成する機能ではない。実MLflow run、registry lineage、Serving latency/scale/rollout未検証 |
| モデル比較 | `tools/lib/evaluation.mjs:77`以降は課題×provider×反復の計画、結果の取り込み・hash・比較。66試行は予定のmatrix | モデルを実行する機能ではない。合成pass recordの比較で性能・費用・品質の実測はできない。`promotionAuthorized:false` を維持 |
| OCR / 文書AI | vendor `databricks-ai-functions/SKILL.md` に `ai_parse_document` と文書処理例がある | OCR固有のgenerator、dataset、文字/項目精度評価、実測証拠は今回のtools/harness/testsで見つからない。`workload resolve --prompt 'OCR精度を評価したい'` は `unknown:true`。一般技能があることをOCR検証済みとしない |

上記はREADME冒頭の広い対象記載を、PLATFORM_PLAYBOOKの「機能の発見と雛形は別」、VALIDATION_STATUS:25〜26/46/50、および `work/evidence/2026-09-08-platform-harness-audit.md` の未実行一覧に沿って読み分けたもの。API/analysis・evaluation・workload catalogはsourceと0.6.1 payloadのhashが一致。scaffold全体はUI候補差分があるが、非UIの2反例を両方から生成して確認した。

## 今回の検証範囲と引継ぎ

- `orchestrate-work`、`review-work`、文書標準・品質契約・Databricks/Quality標準、関連platform session/plan/evidenceを読み、`npm run harness:context` と明示review routeを確認。
- `node --test tests/workloads.test.mjs tests/scaffold-data.test.mjs tests/evaluation.test.mjs`: 62 pass / 0 fail / 0 skip。外部応答はfake、APIはloopback、Pythonは合成データ。全回帰ではない。
- 上記独立probe: 現行と公開payloadのMetric YAML対照、Delta count列の生成・ローカルunit計16件。0.6.1の全配布blob再監査やremote再接続は実施せず、対象fileと既存公開記録だけを照合。
- 監査対象source、実案件、認証、実DB、権限、課金呼出は変更/実行していない。作成物はこの報告と再現script。生成した合成temp rootは試験後に削除済み。
- 次はPT-01の訂正方針とPT-02の小さな修正・回帰を別作業として扱う。ライブ検証を実施したと読み替えない。親監査へ確定2件と追加候補を引継ぐ。
