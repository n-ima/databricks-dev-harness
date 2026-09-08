# 2026-09-08 全領域開発ハーネス再監査

閲覧/検証日: 2026-09-08 JST。次回目安: 2026-09-15、またはprovider/model/CLI/preview契約変更時。以前の調査を消さず、この日付の判断を追記する。

## 結論

既存L1の記憶・承認・hash・隔離・評価機構は活かす。一方、4種generatorを全Databricks開発の入口とみなしていた点は修正が必要だった。改善は「汎用の万能agentを増やす」ことではなく、対象の発見、適切な質問と設計、実行可能な契約検証、正確なadapter、freshな独立評価へ投資する。

全世界で最良という比較結果は存在しない。品質はaccepted-task success、手戻り、介入、費用、権限境界と運用時の失敗で測る。実ワークスペースprofile未設定のため、本監査のローカル成功はlive Databricks成功を意味しない。

## 監査で再現した問題 → 実装判断

| 観測 | 原因 | 今回の変更/証拠 |
|---|---|---|
| API-onlyなのにUI material question・mock gate | app/ui文字列を否定と無関係に検出 | 16種catalog、API/画面分離、明示選択/除外、API-only回帰試験 |
| MLflow「モデル登録」をDelta更新と分類 | 登録という汎用語だけで判定 | ML/analysis/Servingを別分類、時系列・リーク・signatureの質問 |
| 「要件を議論」でもdeploy語を増やすとrelease | keyword点数だけの重複実装 | CLI/hookの共通resolver、discussion-firstと明示intent |
| 製品設計が常にLakeflow/Lakebase/UI/Genie | 固定architecture template | 選択workloadのboundary・公式skill・verificationを出力 |
| API/analysisのgeneratorなし | 4種固定 | 非deployのHTTP/OpenAPI契約とNotebook/SQL/Python fixture |
| VS CodeがCLI/Claude hookを取り込む | provider名と実surfaceが一致する前提 | 一つのJSONに同義の両出力形式、複数filePath検査 |
| 最新版=即採用という混同のリスク | tag/installer/local/accountの区別不足 | 最新候補・実測・既採用・beta・未実行を分離 |

独立した2エージェントによるfresh fixtureの前方試験は、API-onlyとNotebook/ML/Servingを実際にCLIへ渡して再現した。これはClaude/Copilotの課金modelの実機試験ではない。

## Databricksの一次情報

- [VS Code構成](https://docs.databricks.com/aws/en/dev-tools/vscode-ext/configure)（文書更新2026-08-27）: active folder/Bundle/profile/compute、Python環境の整合、local→workspaceの一方向同期を確認。Gitを正本とし、独立componentのBundle設定を混在させない。
- [environments CLI](https://docs.databricks.com/aws/en/dev-tools/cli/reference/environments-commands): setup-localはcomputeに対応するPython/Connectと.venv/pyprojectを整える。まずdry-run、対象と既存lockの差分確認という案件別の段階を採用。
- [Apps API接続](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local): API endpointは/api/とOAuth、呼出元CAN USEが必要。API-onlyをUI開発の一種として扱わず、独立の契約を設計。
- [Lakebase](https://docs.databricks.com/aws/en/oltp/projects)（更新2026-08-04）: transaction/低遅延、branch、UC連携。Deltaへの変更記録にはPublic Previewの機能もあり、用途と成熟度を分ける。
- [Model Serving](https://docs.databricks.com/aws/en/machine-learning/model-serving/)（更新2026-08-28）: MLflow形式のcustom model/agentやfoundation modelをRESTで提供。Apps HTTPや既存platform APIのクライアントと区別する。
- [AI Search](https://docs.databricks.com/aws/en/ai-search/ai-search): 現名称とretrieval/indexの経路を確認。vendor skill名のvector-searchを独断でrenameせずcatalogで説明する。
- [MCP/tool管理](https://docs.databricks.com/aws/en/agents/mcp-tools)（更新2026-08-25）: managed MCP、external tool、custom MCP hosting、Unity Gateway/UCによる境界。開発用coding agentと、作る製品agentを区別する。
- [MLflow GenAI eval](https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/concepts/eval-harness)（更新2026-08-05）: dataset/scorer/traceでapp版を比較。従来MLの予測精度評価と混同しない。
- [共有](https://docs.databricks.com/aws/en/data-sharing/): data/AI assetの外部境界を別のscopeとして扱う。
- [Free Edition制限](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)（更新2026-07-20）: 非商用、serverless、account API不可等。添付workspaceから「あらゆる業務開発/運用が可能」と結論しない。

## 最新releaseと実測

GitHub公式release APIを確認: CLI1.15.0、AppKit0.72.0、Agent Skills0.2.15、Claude Code2.1.263、Copilot CLI1.0.83。[正確な版と直接リンク](../operations/PROVIDER_COMPATIBILITY.md)

CLI1.15.0を公式SHA256SUMSと照合してrepo-local隔離先で実行。environments setup-localのhelpとAppKit0.72 manifestを取得。profileに未設定の調査用名を指定し、実workspace認証・init・deployはしなかった。manifestのserver必須、agents/aiSearch/database betaを確認。CLI1.15公式installerは0.2.10を選択したため、GitHub0.2.15を勝手にvendor採用しない。詳しいhashと検証範囲は[証拠](../../../work/evidence/2026-09-08-platform-harness-audit.md)。

## Copilot / Claude / モデル

[GitHub customization表](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)、[GitHub hooks契約](https://docs.github.com/en/copilot/reference/hooks-reference)、[VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks)、[Claude hooks](https://code.claude.com/docs/en/hooks)で実行surface別の相違を確認。プロンプト送信hookだけでworkflowを強制せず、instructions・skill・CLI・durable sessionを連結する。失敗・timeout・無効設定時の動作が同じとは仮定しない。

モデルの現行掲載情報と実利用可能性を分離。[OpenAI](https://developers.openai.com/api/docs/models)、[Anthropic](https://platform.claude.com/docs/en/models/overview)、[Copilot model対応表](https://docs.github.com/en/copilot/reference/ai-models/supported-models)を実際に開いて確認。検索snippetは更新遅れがあり、モデル名を根拠なくpinしない。現設定継承＋exact resolved version記録＋同じ評価課題での比較を採用。詳細は[互換性と更新](../operations/PROVIDER_COMPATIBILITY.md)。

## ハーネス/AI駆動開発: 参考にした発信と取捨選択

- [Anthropic: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)（2026-03-24）: planner/generator/evaluatorの責任分離と、model更新に伴う足場の削減実験。推奨として、独立評価と具体的受入基準は維持し、小さな変更にも複数agent/sprint/context resetを強制する方式は採らない。
- [Simon Willison: Agentic manual testing](https://simonwillison.net/guides/agentic-engineering-patterns/agentic-manual-testing/): unit testだけでなく実際の利用面をagentが操作する設計上の示唆。APIは本物のloopback HTTP、分析は生成NotebookとSQL/Pythonの比較まで確認する。fixture通過を本番品質の代用にしない。
- [Birgitta Böckeler: Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)（2026-04-02）: guide/feedbackとarchitecture/品質を維持する機構として捉える。catalog・guardrail・test・memoryは役割の異なる部品とし、巨大な一枚の指示へ足さない。

個人の発信は設計上の視点として参照し、CLI引数・認証・課金・model availabilityの根拠には使わない。各技法の効果はこのrepoの比較試験で確かめる必要がある。

## 採用/保留

採用: template＋共通skills＋薄いprovider adapter、短いmap、対象別の質問/検証、fixture-first、bounded loop、独立review、hash-aware下流更新。

保留: 新AppKit版の無検証pin変更、全機能一括install/global plugin、無人本番公開、model自動高額切替、複数agentの無条件常設、全世界最良の宣言。最新版候補を知ることと本番採用は異なる意思決定。

次の実証は本人OAuth後、承認された非機密pilotでAPI/Lakebaseまたはread-only分析を選び、実provider・Databricks・利用面を一つずつ検証する。未実行の比較や必要権限を成功扱いにしない。

