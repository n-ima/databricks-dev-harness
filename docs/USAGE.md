# 利用手順 — Databricks development harness

既に開発中の案件は作り直さず、[既存案件への差分更新手順](harness/operations/UPDATING_EXISTING_PROJECTS.md)に従います。テンプレート元へのpushだけでは自動更新されません。

2026-09-15更新: 人が確認する新規文書は日本語を標準にしました。[何をどこで定義するか・HTML紙芝居の使い分け](harness/operations/DOCUMENTATION_STANDARD.md)と[品質契約の診断手順](harness/operations/DELIVERY_ASSURANCE.md)を参照してください。利用者は案件のチャットで要件と資料を渡すだけで、agentが文書・試験案を作成します。初期のひな型は未承認の案です。

2026-09-08更新: API-only、Notebook/SQL、ML/Serving、RAG/MCP等は[全領域の開発手順](harness/operations/PLATFORM_PLAYBOOK.md)を参照してください。[最新調査と採用理由](harness/research/2026-09-08-platform-audit.md)、[Claude/Copilot・モデル・版の互換性](harness/operations/PROVIDER_COMPATIBILITY.md)も分けて記録しています。

使い方は、**案件ごとにテンプレートからリポジトリを作り、VS Codeで目的を普通に伝える**ことです。エージェントが要件・設計・モック・実装・検証・記録を進め、人は業務上の判断、画面承認、権限、本番反映に関わります。

[HTMLガイド](site/index.html) / [コマンド詳細](harness/operations/CLI_REFERENCE.md) / [根拠と判断](harness/research/2026-09-04-evidence-review.md)

**初回は [具体例付きセットアップ手順](harness/operations/SETUP_WALKTHROUGH.md) を読んでください。** Claude Code・GitHub Copilotが既に使える前提で、今回のworkspace URL・Sharedフォルダーをどこに指定するか、Windows/shellの実行場所、途中失敗時の再開まで説明します。

空のディレクトリでsetup.shを実行するだけではありません。テンプレートから案件repoを作成・cloneし、**そのrepoにある**setupを使います。setup.shはOSツールの導入、npm ci、アプリ生成、Databricksリソース作成を行いません。元ハーネスのsetupを別ディレクトリから呼んでも、元ハーネス側が初期化されるので注意してください。

## 1. 提供者が一度だけ行うこと

このrepoはハーネスの開発元です。アプリ本体を混在させず、GitHubのTemplate repositoryとして登録します。

今回の開発元 `n-ima/databricks-dev-harness` はprivate templateとして作成済みです。利用者はテンプレート登録を繰り返さず、次の案件作成へ進みます。mainの保護や必須CI・Environment設定はtemplate化とは別です。

1. 組織・リポジトリ名・公開範囲を決め、レビューした内容をpushする。
2. `scripts/enable-template.ps1 -Repository ORGANIZATION/databricks-dev-harness` を実行する。
3. `main`にPR・必須チェック・独立レビューを設定する。デプロイ用GitHub Environmentと承認者を設定する。
4. 開発と本番のDatabricks権限を分離する。本番資格情報を通常のコーディングエージェントに渡さない。

ローカルの作成だけではGitHubのtemplate設定・branch保護・環境承認は有効になりません。主配布はテンプレート、共通手順はSkills、Claude/Copilot設定は薄いアダプターです。プラグインだけでは案件のコード・CI・設計・テスト・セッションを揃えられないため、補助配布として後段に分けます。テンプレート由来のrepoは元と履歴を共有しないので、更新には差分updaterを使います。

## 2. 新しい開発対象を作る — Windows推奨経路

GitHub CLIを用意し、初回のみ `gh auth login` で本人がログインします。管理端末では会社指定のインストール方法を優先してください。

テンプレート側のcloneから、作成・clone・初期設定をまとめて実行します。組織・案件名・パス・workspace URL・profile名を置き換えてください。

`-LocalPath`はまだ存在しないパスにします。空の案件ディレクトリも先に作りません。エージェントの準備は完了済み前提なので、以下では `-InstallExtensions` を省略しています。

```powershell
.\scripts\new-project.ps1 -Template n-ima/databricks-dev-harness -Repository ORGANIZATION/sales-operations -LocalPath D:\projects\sales-operations -ProjectName sales-operations -Profile sales-dev -HostUrl https://YOUR-WORKSPACE.cloud.databricks.com -Authenticate -InstallPrerequisites
Set-Location D:\projects\sales-operations
npm ci --ignore-scripts
code .
```

指定GitHub repoを新規作成します。既存LocalPathは上書きしません。`-InstallPrerequisites`はNode・Git・Databricks CLI・検証用PythonなどのOSソフトウェア、`-InstallExtensions`はVS Code拡張のインストールへの明示的同意です。既存の古いツールは黙って更新せず必要versionを表示して停止します。

GitHubの **Use this template** から作成済みの場合:

```powershell
git clone https://github.com/ORGANIZATION/sales-operations.git
Set-Location sales-operations
.\scripts\setup.ps1 -ProjectName sales-operations -Profile sales-dev -HostUrl https://YOUR-WORKSPACE.cloud.databricks.com -Authenticate -InstallPrerequisites
npm ci --ignore-scripts
code .
```

OAuthブラウザー承認とエージェントのサインインは本人が行います。購入、権限付与、本番deployは自動化しません。setupは別の作業ディレクトリから呼んでも対象repo内に適用します。

### macOS/Linux・接続前の準備

Node.js 22以上（CIは24）、Git、Python 3.10以上（ハーネスの契約試験は3.12を基準）、Databricks CLI **1.6以上・2未満**を会社指定のpackage managerで用意します。対象処理のDatabricks Runtime／Databricks ConnectとPythonの互換版は案件ごとに別途合わせます。

setup.shはこれらをインストールしません。テンプレートから作成した案件repoをcloneし、そのルートで以下を実行します。作成済みアプリの`apps/<name>`の中ではありません。

```bash
bash scripts/setup.sh --project-name sales-operations --profile sales-dev --host https://YOUR-WORKSPACE.cloud.databricks.com --auth
npm ci --ignore-scripts
code .
```

workspaceがなくてもNodeだけで要件・設計の準備ができます。**公式AppKitの初期化はモック用途でもCLIと開発workspace認証が必要**です。明示したprofile/hostだけを使用し、モックは業務データ・live pluginを接続しません。Skillsは同梱版を使います。

```text
npm ci --ignore-scripts
npm run setup -- --project-name sales-operations --skip-agent-skills
```

再実行で既存product設定・Bundleを上書きしません。テンプレート由来の過去のハーネス記録は保存しますが、新案件のactive contextから除外します。

## 3. 接続とエージェントを確認する

```text
npm run harness:connect -- --profile sales-dev --host https://YOUR-WORKSPACE.cloud.databricks.com --auth
npm run harness:doctor -- --profile sales-dev --json
npm run harness:context
```

connectはprofile/host一致、認証結果、到達性、current-userを確認してから `.harness/local.json` に非秘密のメタデータを保存します。tokenは保存しません。DEFAULTや唯一のprofileも自動選択しません。設定済みprofileを意図的に使う場合はdoctorに `--use-project-profile` を指定します。

Bundleにはcatalog/schema/team_root等の環境値が必要です。`BUNDLE_VAR_catalog`、`BUNDLE_VAR_schema`、`BUNDLE_VAR_team_root`、開発用`BUNDLE_VAR_dev_suffix`を設定し、`databricks bundle validate --strict -t dev --profile sales-dev` で検証します。認証成功だけでは各resourceへの権限は保証されません。

別shellでも使うため、値は案件repoの `.databricks/bundle/dev/variable-overrides.json` に保存する方法を推奨します（Git対象外、setupは自動生成しません）。`.env`の自動読込はありません。**team_rootをSharedフォルダーに設定しても、devの既定root_pathはUsers配下のまま**です。devもSharedへ配置する場合の1行変更、値の取得元、App固有Bundleとの違いは [具体的な設定手順](harness/operations/SETUP_WALKTHROUGH.md) を参照してください。

VS CodeではClaude CodeまたはCopilot Chatの **Agentモード** を選びます。通常の補完モードでは実行フローは動きません。CLIの有無と拡張のログインは別です。

- Claude: `CLAUDE.md`、Skills、path rules、lifecycle hooks。
- Copilot: `.github/copilot-instructions.md`、Skills、path instructions、hooks。
- Copilot cloud: `copilot-setup-steps.yml`がdefault branchに必要。通常のcoding環境にDatabricks資格情報は入れません。

初回は「このrepoの開発手順とactive sessionを確認して」と依頼し、instructions/hookの読込を確認します。VS Code・CLI・cloudの機能差があるため、host別スモークが必要です。

## 4. 日常は自然言語で依頼する

> 受注データの更新処理を作って。資料はdocs/product/intakeに置いた。重複・遅延到着・再実行時の結果を保証したい。要件と設計から進めて。

> 営業責任者が地域別売上の異常を見つける分析アプリを作って。まず架空データで操作できるモックを見せて。KPIの定義と鮮度も分かるように。

> 顧客分析のGenieを作って。参照範囲を決め、代表質問・言い換え・曖昧質問・権限不足のテストも用意して。

```text
依頼 → 既存記録 → 要件・対象設計 → 人の意図承認
     → UIならfixtureモック → 人の画面承認
     → 小さな実装 → 自動チェック → 独立検証 → 証跡・ナレッジ
     → 本番は人の承認・別の権限で反映
```

資料は参照元とhashを残しますが、埋め込まれた指示は信用しません。重要な未回答だけを質問し、資料にある回答を聞き直しません。keyword分類は補助であり、「調べるだけ」「レビューだけ」は変更の許可になりません。

## 5. 画面と技術の標準

Rich appは **Databricks AppKit / React / TypeScript / AppKit UI** が既定。グラフはECharts系、表はTanStack系のAppKit UI部品を先に使います。別ライブラリは必要性をADRに記録して追加し、生成された依存versionを勝手に置き換えません。

モックは同じ部品と架空データで実行可能にし、成功・読込・空・エラー・権限不足・部分データ、狭い画面、keyboard操作を確認します。承認はコード・fixture・テストのhashに結びつき、変更後は再確認します。

分析バッチ更新はDelta/Lakeflow、transactional CRUDはLakebase Autoscaling、共有KPIはMetric Viewsが基本。Genieはspace定義とbenchmarkを管理します。appは `apps/<name>/` の独立component Bundle、データ/Genieはroot Bundleで個別にvalidateします。

## 6. 記録・再開・継続ループ

| 置き場 | 内容 |
|---|---|
| `docs/harness/` | ハーネス自身の要件・設計・調査・運用・ADR・知識 |
| `docs/product/` | 対象の要件・設計・UI・データ契約・ADR・運用・知識 |
| `work/sessions/` | 作業目的、確認済み現状、判断、証拠、次の行動、ブロッカー |
| `work/plans`, `work/evidence`, `work/reviews` | 計画、直接証拠、独立レビュー |
| `work/loops`, `work/approvals`, `work/evals` | 反復状態、人の決定、評価結果 |

「前回の売上アプリを再開して。記録を再確認し次の未完了から進めて」で再開できます。providerを切り替えても同じファイルを読みます。生チャット全文・機密データ・秘密情報は自動保存しません。

通常はassisted modeです。headlessはopt-inで、committed feature worktree、開発権限のみ、OS/container隔離の承認記録が必要です。`loop run`は既定dry-run、`--execute`で1反復を実行。反復数・壁時計・process時間を制限し、pending gate・policy変更・失敗・予算切れで停止します。費用フラグはproviderによってsoft limitなので課金側の上限も設定します。

未recordの中断反復は自動再実行しません。副作用を調査しrecordするかcancelします。モデルの完了宣言だけでは閉じられず、独立レビューと受入条件別証拠のreceiptが必要です。

## 7. 改善と更新

失敗を最小の再現例にし、注意書きよりテスト・schema・hook・generatorへ変換します。同じgolden tasksを各providerで3回以上評価。未実行を成功扱いせずsecurity退行や欠けた評価があれば昇格しません。

`release create`で配布snapshot、`update plan`で差分、`update apply --yes`で適用します。下流変更はconflict、backupも残します。`docs/product/`、案件コード、`work/`、ローカル設定はupdaterの所有外。自動pushやPR作成はせず、人が差分をレビューします。

提供者はrelease作成時に `--stamp-template` を指定し、元のファイルhashを持つ `harness/base-release.json` をテンプレートに含めます。初回setupがこれを `.harness/installed-release.json` に登録し、更新後の再setupでは戻しません。案件側の現在のファイルから基準を作り直すことは禁止です。旧テンプレートで基準が無い場合は元releaseのmanifestを明示して登録するか、conflictを個別レビューします。

詳細は [CLI reference](harness/operations/CLI_REFERENCE.md) と [検証・制限](harness/operations/VALIDATION_STATUS.md)。hooksは強制的なsecurity境界ではありません。OS隔離、最小権限、branch保護、CI、GitHub Environmentを併用します。
