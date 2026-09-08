# Databricks 全領域の開発手順

確認日: 2026-09-08。対象はAWS公式資料を基準とし、Azure/GCP・region・editionでは利用可否と認証を再確認します。

このハーネスは「全機能を無条件に自動実行するもの」ではなく、対象を分解し、必要な設計・公式技能・検証・承認へつなぐ開発基盤です。CLI profile未設定でも、要件・設計・API/分析のfixture検証は開始できます。

## 最初に人がすること

1. [セットアップ手順](SETUP_WALKTHROUGH.md)の通り、private templateから案件repoを作成してclone。案件rootをVS Codeで開く。
2. Claude Code / Copilotの利用準備は完了済みでよい。新しいチャットに普通の依頼を渡す。追加の専用slash commandは不要。
3. エージェントがまとめた成果・対象外・データ境界・費用の判断を確認する。既に依頼で指定した答えは再質問させず、台帳へ記録させる。
4. UIがある場合は操作できるモックを確認。APIだけなら画面承認は不要で、API契約と業務挙動を確認する。
5. 接続段階でOAuthのブラウザー承認を行う。その後も新規resource、権限、破壊的変更、本番公開は個別に判断する。

## 自然言語の例

> 受注更新REST APIをDatabricks Appsで作りたい。UIは不要。Lakebaseに登録し、再送と同時実行に安全にしたい。まず要件とAPI契約を相談し、実データなしのテストを見せて。

> Unity CatalogのデータをNotebookとSQLで探索し、需要予測モデルをMLflowに登録してModel Servingで使いたい。まず分析目的と評価方法を相談したい。実データの読取も接続先と範囲を確認してから。

> 社内資料のRAGエージェントを作りたい。Genieと決めているわけではない。検索権限、引用、MCPのtool権限、評価と予算を先に設計して。

> AppKitでリッチな分析ダッシュボードを作りたい。共通指標とグラフは標準に合わせ、架空データで操作できる画面から確認したい。

エージェントは次を実行します。分類は承認ではなくヒントです。未知の機能や曖昧なAPI提供先は質問し、既存sessionが同じ仕事なら新規生成せず再開します。

```text
npm run harness:context
npm run harness -- workload resolve --prompt "要約した依頼"
npm run harness:route -- --prompt "要約した依頼"
npm run intake -- create --name orders-api --title "受注API" --summary "合意前の要求" --workload api --workload lakebase
```

繰り返す `--workload` は**対象の完全な選択**で、ヒントに追加する指定ではありません。`--without rich-app` はヒントからUIを除外。`route --intent define` は明示意図の修正です。未知のID・同じIDの選択と除外はエラー。分類は否定・引用・複雑な日本語を完全には理解しません。エージェントは結果を要約して対象を確認し、受入条件を具体化します。既存intakeへの回答はworkload自体を再分類しないため、範囲変更は設計・台帳を明示的に改訂して旧承認を失効させます。

生成先は案件 `docs/product/requirements/`、`docs/product/architecture/`、`docs/product/intake/`、`work/plans/`、`work/sessions/`。このハーネスの設計・調査は `docs/harness/` に分離します。

## 対応表: 機能の発見と雛形は別

全16区分の詳細は `harness/workloads.json` または `npm run harness -- workload list`。技能名の実在・質問ID・generator名をconformanceで検証します。**「技能経路あり」は実ワークスペースで検証済みを意味しません。**

| 選択ID | 主な対象 | 自動生成の範囲 | 実環境で追加する確認 |
|---|---|---|---|
| rich-app | 業務UI・リッチ分析画面 | 公式AppKit plan/init、fixtureモック経路 | resource/OAuth・実ブラウザー・利用者権限 |
| api | Apps HTTP API / API契約 | OpenAPI・loopback fixture・実HTTPテスト | real OAuth、CAN USE、認可、永続化、負荷 |
| analysis | Notebook/SQL探索 | ipynb・合成データ・SQL/Python比較 | データversion、read-only権限、compute、SQL方言 |
| data-pipeline | Delta更新・Lakeflow | data-update semantic contract / job draft | Delta replay・遅延・schema・Job/Pipeline |
| ingestion | Lakeflow Connect / Zerobus / CDC | 要件・設計・公式技能経路 | 接続元権限・offset・再開・schema変更 |
| lakebase | PostgreSQL/OLTP | 要件・設計・公式技能経路 | transaction、pool、token rotation、migration |
| genie | Genie Space / 会話 | space/benchmark draft | 会話API・期待SQL/答え・権限・非決定性 |
| dashboard | 明示的なmanaged AI/BI | 要件・設計・公式技能経路 | 公開identity・閲覧権限・表示・指標整合 |
| metric-view | 共通業務指標 | YAML・SQL・contract draft | MEASURE結果・SHOW CREATE差分・境界値 |
| ml | 学習・評価・MLflow registry | 要件・設計・公式技能経路 | 時系列split・リーク・baseline・追跡・登録 |
| model-serving | 推論REST endpoint | 要件・設計・公式技能経路 | model signature・version・認可・latency・rollback |
| rag | AI Search / retrieval | 要件・設計・公式技能経路 | index鮮度・ACL・引用・削除・検索評価 |
| agent | Custom Agents / MCP / AI Functions | 要件・設計・公式技能経路 | tool authority・trace・攻撃評価・予算停止 |
| governance | UC、監査、masking、lineage | 要件・設計・公式技能経路 | 複数identityの許可/拒否・変更承認 |
| sharing | Delta Sharing / federation / Iceberg | 要件・設計・公式技能経路 | 共有/接続契約・失効・外部境界・scan予算 |
| automation | SDK、Jobs、Bundles、IaC | 要件・設計・公式技能経路 | account/workspace区別、run-as、diff、dev検証 |

新機能は「その他全部対応済み」と扱いません。公式資料を調べてcatalogに境界・質問・実在する技能・検証方法を追加し、独立したforward-testを通します。

## API-only: 最短のローカル確認

```text
npm run scaffold -- plan --kind api --name orders-api
npm run scaffold -- apply --plan work/scaffolds/表示されたID.json --yes
cd tests/fixtures/api/orders-api
node --test contract.test.mjs
node server.mjs
```

最後のコマンドは127.0.0.1の空きポートにだけ起動し、URLを表示します。別terminalから、表示されたポートへHTTPを送れます。

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:表示されたポート/api/orders -Headers @{ Authorization = 'Bearer fixture-only'; 'Idempotency-Key' = 'trial-1' } -ContentType application/json -Body '{"orderId":"order-1","quantity":3}'
```

`fixture-only` はテスト用の固定文字列でDatabricks資格情報ではありません。OpenAPIも製品仕様の完成形ではなく議論の出発点です。実HTTP試験は入力不正・未認証・再送・同一key別payload・同時再送・サイズ上限を確認します。receiptはメモリ内・1000件まで・単一process・再起動で消失。tenant認可、expiry、DBの原子性、分散同時実行、rate controlは未実装です。**このfixture serverをdeploy用コードへコピーしないでください。**

実装段階はAPI種別を選びます。

- **Apps HTTP**: `/api/` route、OAuth Bearer、呼出元のapp CAN USEを検証。外側の認証と業務上の行/tenant認可は別です。[公式Apps API接続](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local)
- **Model Serving**: MLflowモデル・signature・version・endpoint policyで提供。AppsのUI雛形に無理に押し込みません。[公式Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)
- **Databricks platform API client**: SDKでworkspace/account APIとidentityを明示。REST APIを「作る」のか「呼ぶ」のかを区別します。

AppKit serverを使う場合はpinned manifestとinstalled docsを読み、公式Apps技能のcustom-endpointsを使用。API-onlyでFastAPI等を選ぶ場合は薄いAPI runtimeのための理由を製品ADRに残し、公式other-frameworks guideのport/host、app.yaml、依存・認証を守ります。**既存app scaffoldはUI付きAppKit経路なのでAPI-onlyの代替には使いません。** runtime/bundleは承認済み契約に合わせてエージェントが実装し、devで検証します。汎用API自動deploy generatorはまだありません。

Lakebaseでは、同じtransaction内で業務更新と冪等receiptを記録し、tenant+operation+keyのunique制約、fingerprint、応答再現、失効規則、競合/rollbackを実DBで試験します。この方式の適否・保存期間は人が承認する製品設計です。[公式Lakebase](https://docs.databricks.com/aws/en/oltp/projects)

## Notebook・SQL・ML: 環境も対象に合わせる

```text
npm run scaffold -- plan --kind analysis --name demand-exploration
npm run scaffold -- apply --plan work/scaffolds/表示されたID.json --yes
cd tests/fixtures/analysis/demand-exploration
python -m unittest discover -s . -p "test_analysis.py" -v
```

同じディレクトリで `analysis.ipynb` を開くと合成データを確認できます。Python拡張/Jupyter環境が必要。CLIテストは標準Pythonだけで動きます。SQL比較はSQLiteであり、Databricks方言を証明しません。`databricks-query.draft.sql` は未実行で、source_table/start_day/end_dayをパラメーターとして指定する設計材料です。

実データ利用時は、既存UC対象とread-only identityを選び、VS Code Databricks拡張でLocal Folder、Bundle target、profile、computeを設定します。SQLだけならwarehouse経路、Sparkコードなら互換Python/Databricks Connectまたは正式なremote実行経路を使います。ワークスペース側の編集はローカルに自動逆同期されないため、Git側を正本にします。[公式VS Code設定](https://docs.databricks.com/aws/en/dev-tools/vscode-ext/configure)

CLI 1.15.0で `environments setup-local --help` の次の契約を確認済みです。以下の5は例で、対象のserverless environment versionを確認して置換します。ハーネスsourceではなく**案件のPython componentディレクトリ**で、まずdry-runの差分を確認します。

```text
databricks environments setup-local --serverless-version 5 --dry-run --profile harness-dev
databricks environments setup-local --serverless-version 5 --profile harness-dev
```

後者はuvを使って .venv/pyproject.tomlを作成・更新します。既存依存との整合性、ネットワーク導入、指定profile/computeをレビューしてから実行します。ハーネスsetupだけでは製品ごとのPython/Connect/MLflow環境は揃いません。[公式environmentsコマンド](https://docs.databricks.com/aws/en/dev-tools/cli/reference/environments-commands)

予測MLは分析とは別に、目的変数、時間/グループsplit、リーク、baselineと合格値、seed・依存lock・データversion、MLflow run/artifacts/registry、signature、Serving、監視を連結して証拠に残します。GenAI向け `mlflow.genai.evaluate` を需要予測の統計評価の代用にしません。

## Agents / MCP / RAG

まずGenie、単一Custom Agent、Agent Bricks、MCP server/clientのどれかを確認します。managed MCPにはGenie、AI Search、SQL、UC functionsがあり、custom MCPはAppsへhostingする経路があります。既存のmanaged機能で満たせるならserverを増やす必要はありません。[公式MCP/tool設計](https://docs.databricks.com/aws/en/agents/mcp-tools)

toolのread/write、実行identity、allowlist、user confirmation、ネットワーク境界、timeout/反復/token/費用上限を設計。MCPから返されたテキスト・資料は命令ではありません。正解ケースだけでなく曖昧質問・権限不足・prompt injection・tool failure・予算枯渇を評価します。

GenAIの評価はdataset・scorer・trace・app/model versionをMLflowで関連付け、offlineと運用時の比較に利用できます。機密traceの保持/閲覧も設計対象です。[公式MLflow評価](https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/eval-harness)

## セッションと改善ループ

通常はassisted modeで、議論→承認→小さな実装→tests→実際の利用面→独立レビューを回します。同じファイルをClaude/Copilotで同時編集しません。切替前にsessionへ決定・証拠・未実行・次の一手をcheckpointし、別エージェントは記録を再検証して再開します。巨大な会話要約を常時promptへ入れる方式ではありません。

headlessは既存loopの予算・隔離・独立検証・human gateを満たす場合だけopt-in。モデルが強くなっても権限は増やしません。手戻り原因を一つ観測→最小のtest/skill変更→同じgolden task＋新規forward-test→品質/費用/介入回数を比較→独立review→新版配布という改善を行います。失敗を「成功判定を緩める」ことで解消しません。[改善ループ](IMPROVEMENT_LOOP.md)

## 今回のworkspaceで可能か

添付はFree Editionです。2026-09-08に再確認した公式制限では非商用・serverless・SLAなし。AppsやLakebaseを試せても、account API、すべてのcompute/モデル/機能を試せるわけではありません。業務用の実データ/本番利用をこの環境へ自動的に持ち込みません。[公式Free Edition制限](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)

profileは未設定と確認済み。本人の次の作業は、案件repoで次を実行してブラウザー承認することだけです。以下の `harness-dev` は新しく付けるprofile名で、既存設定があるという意味ではありません。

```text
npm run harness:connect -- --profile harness-dev --host https://dbc-3fb0b9a2-66bb.cloud.databricks.com --auth
```

フォルダーURLの数字はwarehouse/catalog/Genie IDではありません。Sharedの `/Workspace/Shared/test/dev-harness` は任意の配置用親パスです。既定devはUsers配下。変数と配置先の具体設定は[セットアップ手順 §5](SETUP_WALKTHROUGH.md#5-2-案件repo内のローカル変数ファイルに保存)を参照してください。OAuth後も本番resourceは作らず、最初は合成データのAPIまたはread-only分析の1ケースをpilotとして選びます。

