# Databricks Development Harness

自然言語の要求から、Databricksのデータ処理、Genie、分析画面、業務アプリ、API、Notebook/SQL、ML/Serving、RAG/MCPを、GitHub CopilotまたはClaude Codeで再現可能に開発するためのリポジトリ内ハーネスです。対象別の質問・設計・公式技能・検証へつなぎます。

## まず使う

このリポジトリはGitHubの **非公開Template repository** です。各開発対象は **Use this template** から別リポジトリを作り、cloneした案件repoのルートで次を一度だけ実行します。空のフォルダーや元ハーネス側でsetupするのではありません。Claude Code・GitHub Copilotの準備は完了済み前提です。

```powershell
.\scripts\setup.ps1 -ProjectName sales-operations -Profile sales-dev -HostUrl https://YOUR-WORKSPACE.cloud.databricks.com -Authenticate -InstallPrerequisites
npm ci --ignore-scripts
```

その後はVS CodeでClaude CodeまたはCopilot Chatを開き、通常の日本語で依頼します。

> 売上訂正を登録でき、部門別の推移を分析できるアプリを作って。まず要件と画面モックを作成し、私が承認したら実装まで進めて。

Agentモードでは共通instructionsとSkillsが、既存記録、要件・設計、モック、人の承認、実装、独立検証、証跡記録へ導きます。キーワード分類は補助で、利用hostごとの読込確認が必要です。headless実行は別のopt-inです。

詳細な初期設定、日常利用、再開、トラブル時の手順は [docs/USAGE.md](docs/USAGE.md) を参照してください。

初回は [具体例付きセットアップガイド](docs/harness/operations/SETUP_WALKTHROUGH.md) へ。今回のDatabricks画面から取るURL・フォルダーパス、追加で選ぶCatalog/Schema、setupで揃うもの・揃わないものを説明しています。setup.shは前提ツールをインストールしません。アプリ生成・依存導入・resource権限設定・deployはsetup後の開発工程です。

ブラウザーで読むには `npm run docs:serve` を実行し、[ローカルHTMLガイド](http://127.0.0.1:4173/site/) を開きます。[コマンド詳細](docs/harness/operations/CLI_REFERENCE.md)、[調査と設計根拠](docs/harness/research/2026-09-04-evidence-review.md)、[検証済み範囲・残る導入条件](docs/harness/operations/VALIDATION_STATUS.md) も参照してください。

状態: **0.4.0 / L1・ローカル開発候補**。[全領域の開発手順](docs/harness/operations/PLATFORM_PLAYBOOK.md)、[最新調査・判断](docs/harness/research/2026-09-08-platform-audit.md)、[今回の検証証拠](work/evidence/2026-09-08-platform-harness-audit.md)を参照してください。GitHub公開済み0.3.2の[配布証跡](work/evidence/2026-09-08-setup-guide-release.md)と区別します。workspace接続、本番deploy、実providerのgolden評価は未実施で、全機能の実機動作を保証しません。

## 何が正本か

- `AGENTS.md`: Claude/Copilot共通の短い入口
- `docs/harness/`: このハーネス自体の設計、運用、研究、判断、知識
- `docs/product/`: このテンプレートから作る開発対象の要件、設計、データ、UI、運用、知識
- `work/`: セッション、実行計画、レビュー、完成証跡
- `harness/skills/`: 共通ワークフローの正本
- `vendor/databricks-skills/`: バージョン固定したDatabricks公式Skills
- `.claude/`、`.github/`: 生成されたエージェント別アダプター

チャット履歴は正本ではありません。作業の目的、判断、検証結果、次の行動は `work/sessions/` に残し、安定した知識だけを `docs/*/knowledge/` へ昇格します。

## 基本コマンド

```powershell
npm run setup -- --project-name sales-operations --profile DEV --host https://example.cloud.databricks.com
npm run harness:doctor
npm run harness:context
npm run harness:check
databricks bundle validate --strict -t dev --profile DEV
```

セッション操作は通常エージェントが行います。手動で回復するときだけ `npm run session:list`、`session:start`、`session:checkpoint`、`session:close` を使います。

## 標準技術

- 配備: Declarative Automation Bundles
- ガバナンスと意味層: Unity Catalog、Metric Views
- データ処理: Lakeflow Jobs/Pipelines、Delta
- トランザクション: Lakebase
- アプリ: Databricks AppKit、React、TypeScript、Vite、AppKit UI
- 可視化: AppKit UIのApache ECharts、TanStack Table
- 会話分析: Genie + ベンチマーク
- 検証: Vitest、Playwright、データ契約、Bundle validation、独立レビュー

設計判断は [ARCHITECTURE.md](ARCHITECTURE.md) から辿れます。
