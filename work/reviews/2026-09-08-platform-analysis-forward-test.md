# 改善後の独立forward-test: Notebook / SQL / ML / Serving

実施日: 2026-09-08 JST。実装者とは別のエージェントによるローカル検証。
修正は行っていない。source repository編集、Git操作、Databricks認証、外部書込、モデル課金呼出しなし。

## 検証対象と隔離

最新AGENTS.md、orchestrate-work、define-work、build-work、PLATFORM_PLAYBOOKを独立に読み、harness:contextと関連sessionを確認した。
新規一時fixtureへtools/、harness/、docs/、tests/、vendor/と必要なroot設定をコピーし、コピー側の既存CLIを実行した。

- Fixture: `C:/Users/nimao/AppData/Local/Temp/databricks-forward-analysis-v2-a691d292be2144e49755740b4ac22814`
- Python: 3.12.10
- Intake: `20260907-231343-675-demand-forecast-v2`
- Analysis plan: `work/scaffolds/20260907-231347-171-analysis-demand-exploration-5d2b975e.json`
- Generated analysis: `tests/fixtures/analysis/demand-exploration/`

## 同一依頼と新旧比較

「既存Unity CatalogデータをNotebook/SQLで探索し、需要予測モデルをMLflowで評価・登録して、Databricks Model ServingのAPIとして公開・デプロイする開発をしたい。最初に要件を議論したい。」

| 対象 | 前回の実測 | 今回の実測 |
|---|---|---|
| 原文の公開のみ | define | define / discussion-first |
| 公開・デプロイへの言い換え | release / production-deploy | define / discussion-first / product-intent |
| workload保持 | 専用workloadなし | api, analysis, ml, model-serving, governance |
| モデル登録の分類 | dataUpdate=true | dataUpdate=false |
| UI | false | false。rich-app/Genieは選択されない |
| 質問 | 共通4問とテーブル更新2問 | 共通5問とAPI/analysis/ML/Serving/governance各1問 |
| 設計骨格 | Lakeflow/Lakebase/AppKit/Genie等を一律列挙 | 選択workload別の境界・公式技能・検証内容 |
| analysis生成 | 対応kindなし | plan/apply成功、8ファイルをfixture配下へ生成 |
| ML/Serving生成 | 非対応で経路が薄い | generatorは非対応、公式技能への明示経路あり |
| 未承認でimplementへ進行 | 拒否 | 同じエラーで拒否 |

routeは`executionAuthorized:false`。intakeは`needs-answers`、sessionは`define / product-intent pending`。
CLIの分類改善は人の承認や実行権限を付与しない。

## 生成質問と経路の確認

- Q-01〜05: 成果、対象外、機密/権限、受入、cloud/edition/compute/用途/費用。
- Q-40: API提供先と入出力、認証/認可、エラー、遅延等。
- Q-50: 分析の問い、粒度・期間/時間帯、欠損/除外、仮説・検証。
- Q-100: 目的変数、予測単位/期間、時系列split、リーク、baseline、合格値、再現性、signature、登録/昇格/監視。
- Q-110: 入出力/signature、model version、endpoint既存/新規、認可、latency/QPS/cost、canary/rollback/監視。
- Q-140: UC owner/identity/policy/lineage/監査/保持/権限変更。

不要なQ-10/Q-11（テーブル更新）やQ-20/Q-21（UI）は生成されない。
作業別設計にdatabricks-data-discovery/dbsql/execution-compute、databricks-ml-training、databricks-model-serving、databricks-unity-catalogが結び付く。
MLは古典MLとGenAI judge評価を区別し、需要予測にmlflow.genai.evaluateを当てはめない旨がplaybookにある。

明示選択も検証した。

```text
node tools/harness.mjs workload resolve --prompt <同一依頼> --workload analysis --workload ml --workload model-serving
node tools/harness.mjs intake create --name demand-forecast-v2-explicit --title "需要予測explicit経路" --summary <同一依頼> --workload analysis --workload ml --workload model-serving
```

resolverは`mode:explicit-selection`、`selectedIds:[analysis,ml,model-serving]`を返し、intake createもexit 0。
台帳の質問全件をユーザーに提示する必要はなく、既知情報を根拠付きで記録し、未回答の重要項目のみ議論するスキル指示は維持されている。
要件のACは汎用草案のままであり、実案件ではエージェントが観測可能な予測・API受入条件へ具体化してから実際の人の承認を受ける必要がある。

## analysis生成と実行

```text
node tools/harness.mjs scaffold plan --kind analysis --name demand-exploration
node tools/harness.mjs scaffold apply --plan work/scaffolds/20260907-231347-171-analysis-demand-exploration-5d2b975e.json --yes
cd tests/fixtures/analysis/demand-exploration
python -m unittest discover -s . -p test_analysis.py -v
```

planは`purpose:fixture, profile:null, command:[], deployReady:false, missing:[]`。
applyはexit 0、status applied。analysis.py、test_analysis.py、fixture.json、fixture.sql、fixture marker、analysis.ipynb、Databricks draft SQL、READMEを生成した。

生成試験は2/2 pass。

```text
test_boundaries ... ok
test_sql_python_parity ... ok
Ran 2 tests in 0.001s
OK
```

合成データ4行についてSQLiteとPythonの結果が一致し、末端日2026-01-03の数量100は除外される。
Notebook JSONからcode cellのsourceを読み、同じディレクトリで標準Pythonのexec/compileを使って実際に実行した。code cellは1つで、結果は次の通り。

```json
[{"day":"2026-01-01","quantity":5},{"day":"2026-01-02","quantity":4}]
```

Jupyter GUI/kernelは利用していない。NotebookセルのPythonコード実行確認であり、Jupyter UIやDatabricks Notebook runtimeの検証ではない。

コピーした`node --test tests/workloads.test.mjs`は7/7 pass（分類・unknown・catalog・api/analysis generatorのhash/上書き拒否を含む）。

## 発見したバグ: P2 非正規ISO日付でPython/SQLの結果が不一致（下記で解消確認）

`harness/templates/starters/analysis/analysis.py:5,10`のdate.fromisoformatは`20260101`を受理して`2026-01-01`へ正規化する。
`harness/templates/starters/analysis/fixture.sql:4`は元文字列を期間比較するため、同じ行が除外される。

生成ファイルを変更せず、次の追加入力で再現した。

```python
rows = [{"id": "compact-date", "day": "20260101", "quantity": 7}]
start, end = "2026-01-01", "2026-01-03"
# analyze(rows, start, end)
# -> [{"day": "2026-01-01", "quantity": 7}]
# 同じrowsをapproved_sourceへ挿入し、fixture.sqlに同じ期間をbind
# -> []
```

実出力は`equal:False`。現在の2生成試験と7workload試験では検出されない。
期間とrow.dayを両経路で厳密なYYYY-MM-DD契約に合わせるか、比較前に同じ正規化を適用し、この追加ケースを試験する必要がある。
これはローカルfixtureの受入可能入力の整合性に関するバグで、実Databricks SQLが不正という主張ではない。

## ML/Servingと未検証範囲

catalogのml/model-servingは`scaffold:null`。CLIで`scaffold plan --kind ml`と`--kind model-serving`を試すと各exit 1で対応kind一覧を返す。
これはplaybookが明示する「公式技能経路あり、generatorなし」と整合する。analysis生成はモデル学習・MLflow run・UC登録・endpoint作成を行わない。
READMEはSQLiteがDatabricks方言/Spark/Connectを証明しないこと、draft queryは未実行であること、trained modelの代わりではないことを明記する。

未検証: 実Databricks認証、UC実データ/権限、実SQL/Notebook、Python/Connect環境整合、予測学習/統計評価、MLflow追跡/registry lineage、Serving呼出/負荷/認可/rollback、Jupyter UI、実ユーザー承認後の遷移。
本体の全回帰テストはこの担当では未実施。上記は新しいfixture上の限定的な独立検証である。

## 対象snapshotのSHA-256

以下6ファイルはコピー時と検証後の本体hashが同じである。

| File | SHA-256 |
|---|---|
| tools/harness.mjs | 9800CBB6484007E03D4FEC13BB3D0EA0837D11C3583B0D723A77BAAA43D53764 |
| tools/lib/intake.mjs | D27A54F60537C59F1E5743B217FB15F18DBEC4361DC704FE76B456EEE4BCC0A8 |
| tools/lib/scaffold.mjs | 01F2BB44A4787190EE4198929D18FDDC576BA26525AE9778E555EB8B797D2DA7 |
| tools/lib/workloads.mjs | C28CBFA2D65C1B931EC67F4E7D3F05F7AA028D0778F905D0774A09860BC17693 |
| harness/router.json | 82CBBD5D1C03569AD428EBB6F6F2DF40B0B54002A5F3974DA5FEFC15A9BC3EC2 |
| harness/workloads.json | C4538775631126565AAF979DFE62AC984F81E9C0F7C0FE960AA4A2B712600FED |

## 日付修正後の独立再検証

実装担当がcanonical_dayでASCII YYYY-MM-DDを検証する修正を実装した。この担当はsourceを編集していない。
新規fixture C:/Users/nimao/AppData/Local/Temp/databricks-forward-analysis-v3-dbbcc748eb364379986737990dc6711b で、新plan work/scaffolds/20260907-231907-874-analysis-demand-strict-date-5e53861c.json を作成・確認・applyした。旧planは再利用していない。

生成先は tests/fixtures/analysis/demand-strict-date/。deployReady=false、8ファイル生成。
生成Python試験3/3 pass。独立probe verify_analysis_v3.pyでcompact/week/非ゼロpadding/不正日/None/全角/末尾空白/末尾改行をrow/start/endへ渡す24ケースが全てValueError。閏日2024-02-29と最小年0001-01-01の2ケースはSQL/Python一致。Notebookの実code cellをASTで実行し末尾式を評価すると日別数量5,4を返した。

新plan、source template、生成物のhash一致:

- analysis.py: 97D36A402C50F4862C3E7B9D14CF1083FEE0248862644798D3402FA75ED980FF
- test_analysis.py: 9E10535F9622D58399E530E092F19C126317242947DC52E3B151672A95D8CF7A

明示intakeも再読取し、mode=explicit-selection、selectedIds=[analysis,ml,model-serving]、質問Q-01〜05/Q-50/Q-100/Q-110、needs-answersの永続化を確認した。

日付不一致は解消した。この限定forward-test内で追加の未解決バグは観測していない。実Databricks/ML/Serving/Jupyter UIは引き続き未検証。
次の行動: 証拠を実装担当へ引き渡す。fixture sessionのproduct-intentはpendingを維持し、本物の予測システムの実装/承認/公開を行わない。
