# 初回セットアップ実践ガイド

対象: Claude Code / GitHub Copilot は既に利用可能で、VS Codeで作業する方。確認日: 2026-09-04。

## 0. 結論 — 空のディレクトリでsetup.shを実行するだけではありません

**テンプレート一式を取得した「案件リポジトリのルート」でsetupを実行すると、エージェントが開発を始めるためのハーネス設定が揃います。アプリの完成・依存ライブラリ・Databricksのリソースや権限までは揃いません。**

```text
ハーネス本体 n-ima/databricks-dev-harness
  └─ Use this template → 案件repo（例: n-ima/sales-operations）
       └─ clone → D:\projects\sales-operations
            ├─ scripts/setup.ps1・setup.sh ← このrepoに含まれるものを実行
            ├─ docs/product/             ← 案件の要件・設計
            ├─ apps/                     ← アプリ本体は後で生成
            └─ work/                     ← 作業記録
```

1案件でデータ処理・Genie・画面を一緒に管理して構いません。必ずしも1画面につき1repoではなく、同じ製品として管理・リリースする単位です。

重要: **setupは実行時のカレントディレクトリではなく、スクリプト自身があるrepoを初期化します。** 空の `sales-operations` から元ハーネスの `D:\projects\databricks-dev-harness\scripts\setup.ps1` を呼ぶと、元ハーネス側を案件として初期化してしまいます。スクリプト単体をコピーする方法も非対応です。`apps/sales-operations` の中でsetupするのでもありません。

## 1. 自動化される範囲

| 処理 | new-project.ps1 | setup.ps1 | setup.sh |
|---|---|---|---|
| テンプレートから案件GitHub repoを作成・clone | する。既定private | しない | しない |
| Node / Git / Databricks CLI / 検証用Pythonの確認 | setupへ引き継ぐ | する | する |
| 未導入OSツールのインストール | `-InstallPrerequisites`を引き継ぐ | 明示指定時のみwingetで実施 | **しない** |
| 古い既存ツールの自動更新 | しない | しない。必要版を示して停止 | しない。必要版を示して停止 |
| Skills・Claude/Copilot設定の同期、案件設定・Bundleひな型生成 | clone先でsetupを呼ぶ | する | する |
| ブラウザーを使うOAuthログイン | `-Authenticate`を引き継ぐ | `-Authenticate`指定時。本人承認が必要 | `--auth`指定時。本人承認が必要 |
| 指定profile/hostの接続先・認証状態の確認 | setupへ引き継ぐ | profile指定時は毎回行う | profile指定時は毎回行う |
| npm ci、AppKit生成、アプリ固有ライブラリの導入 | しない | しない | しない |
| Catalog/Schema・warehouse・Lakebase・Genie・Apps作成、データ登録、deploy | しない | しない | しない |

必要版はNode.js 22以上、Git、Databricks CLI **1.6.0以上2未満**、契約テスト用Python 3.10以上です。Windowsの未導入Python自動導入は3.12。Databricks RuntimeやDatabricks Connectに合わせるPython環境とは別です。エージェント本体は準備済み前提なので、通常 `-InstallExtensions` は付けません。DatabricksのVS Code拡張もCLI経路の必須条件ではありません。

## 2. 今回のDatabricks画面から何を取り出すか

| 項目 | 今回の値・決め方 | 指定先 |
|---|---|---|
| workspaceの接続先 | `https://dbc-3fb0b9a2-66bb.cloud.databricks.com` | PowerShellの`-HostUrl` / shellの`--host` |
| CLI profile名 | 例: `harness-dev`。本人が選ぶローカルの接続名 | `-Profile` / `--profile`。以後のCLIでも毎回指定 |
| workspaceフォルダー | `/Workspace/Shared/test/dev-harness` | 後述のBundle変数`team_root`。**host引数ではない** |
| 案件名 | 例: `sales-operations`。作りたい製品の名前 | `-ProjectName` / `--project-name` |
| ローカル案件フォルダー | 例: `D:\projects\sales-operations` | new-projectの`-LocalPath`、またはclone先 |
| Catalog / Schema / warehouse ID | 添付には写っていない。後から選ぶ | セクション5・6。フォルダー名から推測しない |

ブラウザーのURLにある `/browse/folders/...` や `?o=...` は接続先に含めません。上のhostは添付からの具体例であり、他のworkspaceへ移す場合は置き換えます。

Databricks側では左の **Workspace → Shared → test → dev-harness** を開き、対象を右クリックして **Copy URL/path → Full path** でパスを確認します。日本語表示では同等の「URL/パスをコピー」「完全なパス」を選びます。フォルダーの存在だけで書込権限があるとは限りません。[公式: workspaceの識別情報](https://docs.databricks.com/aws/en/workspace/workspace-details)、[オブジェクトとパス](https://docs.databricks.com/aws/en/workspace/workspace-assets)。

`harness-dev`は本ガイドの**候補名**で、この手順の記載によって接続や作成は行われません。別名を使う場合は全コマンドを同じ名前に置き換えます。既存profileを使うなら、`databricks auth profiles --skip-validate`でhostを確認して本人が選び、setupの認証オプションを省略できます。唯一のprofileやDEFAULTをエージェントが勝手に選んではいけません。

## 3. 案件を作る — 次のA・B・Cから1つだけ

`sales-operations`は説明用です。今回新しい案件を実際に作成したわけではありません。同名repoが既にあれば新規作成を繰り返さず、Bのclone済み・再開手順を使います。

### A. Windows: 作成・clone・設定をまとめる

現在のハーネス本体 `D:\projects\databricks-dev-harness` がローカルにある場合の最短経路です。**案件用ディレクトリは先に作らないでください。** `new-project.ps1` は空でも既存のLocalPathを拒否します。

PowerShellで実行:

```powershell
Set-Location D:\projects\databricks-dev-harness
gh auth status
```

GitHub CLI未導入なら会社指定の方法で導入します。未ログインの場合のみ `gh auth login` を実行し、本人がブラウザーで承認します。次の1行は新しいprivate repoを作成します。repo名・profile名を決めてから実行してください。

```powershell
.\scripts\new-project.ps1 -Template n-ima/databricks-dev-harness -Repository n-ima/sales-operations -LocalPath D:\projects\sales-operations -ProjectName sales-operations -Profile harness-dev -HostUrl https://dbc-3fb0b9a2-66bb.cloud.databricks.com -Authenticate -InstallPrerequisites
```

Databricksのログイン画面が開いたら本人が認証します。未導入のOSツールがある場合だけwingetで導入します。組織の端末方針に従い、管理者権限や再起動・新しいターミナルが必要なら、その案内に従ってください。古いツールは自動更新しません。全ツール導入済みなら `-InstallPrerequisites` は省略できます。

成功後:

```powershell
Set-Location D:\projects\sales-operations
npm ci --ignore-scripts
npm run harness:check
code .
```

### B. Windows: GitHub画面で作成してから設定

1. [ハーネスのGitHub](https://github.com/n-ima/databricks-dev-harness)で **Use this template → Create a new repository**。
2. Ownerを選び、Repository nameに例として`sales-operations`、Visibilityは**Private**を指定して作成。
3. PowerShellで**親フォルダー**からcloneします。cloneが案件ディレクトリを作るので先に作る必要はありません。

```powershell
Set-Location D:\projects
gh repo clone n-ima/sales-operations D:\projects\sales-operations
Set-Location D:\projects\sales-operations
.\scripts\setup.ps1 -ProjectName sales-operations -Profile harness-dev -HostUrl https://dbc-3fb0b9a2-66bb.cloud.databricks.com -Authenticate -InstallPrerequisites
npm ci --ignore-scripts
npm run harness:check
code .
```

clone済みなら`Set-Location`以降だけ実行します。**ハーネス本体をcloneしただけでは案件GitHub repoにはなりません。** 案件のrepoをテンプレートから作ってからcloneしてください。[GitHub公式: テンプレートから作成](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)。

### C. macOS / Linux: setup.shを使う

Node.js、Git、Python、Databricks CLIを**そのshell内に**先に導入してください。setup.shはOSツールをインストールしません。不足を検出して止まるだけです。WSLを使う場合もWindows側の導入・認証をそのまま利用できる前提にせず、WSL内のPATHとprofileを確認します。

GitHub画面でBの1・2を済ませた後、作業したい**親フォルダー**で実行:

```bash
git clone https://github.com/n-ima/sales-operations.git
cd sales-operations
bash scripts/setup.sh --project-name sales-operations --profile harness-dev --host https://dbc-3fb0b9a2-66bb.cloud.databricks.com --auth
npm ci --ignore-scripts
npm run harness:check
code .
```

private repoへのGit認証は必要です。CLIの導入方法は[公式インストール手順](https://docs.databricks.com/aws/en/dev-tools/cli/install)を参照し、このハーネスの対応版に合わせます。`pip install databricks-cli`の旧CLIは使いません。

## 4. 「setup成功」と「開発・実行準備完了」を分ける

setupで`Connected harness-dev ...`、`Harness check passed.`、`Setup complete.`を確認します。profile無しのオフラインsetupならConnectedは出ません。成功後の案件repoには以下があります。

| ファイル・場所 | 用途 |
|---|---|
| `product.config.json` | 案件名。setup再実行で上書きしない |
| `databricks.yml` | root Bundleのひな型。実際のJob/Appが生成済みという意味ではない |
| `.harness/local.json` | 確認済みprofile/hostの非秘密メタデータ。Git対象外 |
| `.harness/installed-release.json` | 元テンプレートの更新基準。Git対象外 |
| `.claude/skills/`・`.github/skills/` | 共通Skillsのprovider別コピー |
| `docs/product/`・`work/` | 要件・設計・作業記録の置き場。具体的な案件文書は依頼後に作る |

OAuthはCLIが管理します。通常、接続設定はユーザーホームの`.databrickscfg`、OAuth token cacheはユーザーホームの`.databricks/token-cache.json`です。ファイル内容をチャットへ貼ったり、repoへコピーしません。[公式OAuth手順](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m)。

**setup成功だけなら、要件・設計の開始と接続確認までです。** 次の節の変数や対象リソースが未設定なら、doctorのBundle検査が失敗しても「接続そのものが失敗」とは限りません。エラーの検査項目を分けて確認します。アプリの依存は、後のAppKit生成で作られる`apps/<app-name>/package.json`とlockfileに従ってエージェントが導入・build・testします。rootの`npm ci`で全アプリの依存が入るわけではありません。

## 5. 添付のフォルダーをどこに指定するか

### 5-1. データを使う前にCatalog / Schemaを選ぶ

Databricks左メニュー **Catalog → 使用できるcatalog → schema** を開き、データの読書き先を選びます。例として`workspace` / `sales_dev`を使いますが、**この名前が存在する・権限があるとは確認していません**。実際の名前に置き換えてください。`Shared/test/dev-harness`はコード等のworkspaceフォルダーで、catalogやschemaではありません。新規schemaが必要なら、名前・用途・作成権限を決めて人が承認してから作ります。[公式Catalog Explorer](https://docs.databricks.com/aws/en/catalog-explorer)。

### 5-2. 案件repo内のローカル変数ファイルに保存

VS Codeまたはエージェントで、案件rootから見て `.databricks/bundle/dev/variable-overrides.json` を作ります。setupはこのファイルを作りません。次のJSONのcatalog/schemaを実際の値へ、dev_suffixを他の担当者・作業と重ならない識別子へ置き換えます。

```json
{
  "catalog": "workspace",
  "schema": "sales_dev",
  "team_root": "/Workspace/Shared/test/dev-harness",
  "dev_suffix": "my-pilot-01"
}
```

このファイルはGit対象外で、tokenやパスワードは書きません。clone先や別PCでは再作成が必要です。`--var`や`BUNDLE_VAR_*`がある場合はそちらが優先されるので、古い値を別のshell設定に残さないようにします。`.env`は自動読込されません。エージェントの別shellにも値を引き継ぐため、このtarget別ファイルを使うと確実です。[公式Bundle変数](https://docs.databricks.com/aws/en/dev-tools/bundles/variables)。

### 5-3. 重要: devはそのままではSharedフォルダーを使わない

生成されたBundleの既定は次のとおりです。`team_root`は必須変数なのでdev用にも値を用意しますが、**値を設定するだけではdevの配置先は変わりません**。

| target | 既定のworkspace.root_path |
|---|---|
| dev | `/Workspace/Users/${workspace.current_user.userName}/.bundle/${bundle.name}/dev/${var.dev_suffix}` |
| test | `${var.team_root}/${bundle.name}/test` |
| prod | `${var.team_root}/${bundle.name}/prod` |

最初の個人検証は**devの既定を維持する**のが簡単です。添付のSharedフォルダーが今すぐ必須というわけではありません。test/prodには別の環境値・権限・承認が必要で、本ガイドでは使いません。

もし**devも添付のSharedフォルダー配下に配置したい**場合だけ、案件側の`databricks.yml`に既にある`targets.dev.workspace.root_path`の1行を次に変えます。他の設定は残し、`targets:`を二重に追加しないでください。

```yaml
root_path: ${var.team_root}/${bundle.name}/${bundle.target}/${var.dev_suffix}
```

上の例なら `/Workspace/Shared/test/dev-harness/sales-operations/dev/my-pilot-01` になります。Sharedの親フォルダーそのものを複数案件の共通root_pathにせず、案件・target・作業IDで分けます。権限確認後に配置先を変えるだけで、この編集やvalidateはdeployではありません。

### 5-4. 読み取りの確認を行う

案件repoのルートで実行します。`--profile harness-dev`は選択済みの名前に合わせます。これは要件整理を始めるための必須条件ではなく、データ利用・Bundle実行の準備段階の確認です。resource定義がまだない・設定が未完成ならstrict validateが止まることもあるため、指摘された設定をエージェントと整えてから再確認します。成功に見せるためにstrictを外す必要はありません。

```text
databricks workspace get-status /Workspace/Shared/test/dev-harness --profile harness-dev
databricks bundle validate --strict -t dev --profile harness-dev
npm run harness:doctor -- --profile harness-dev --json
```

get-statusは存在・参照可否の確認で、書込権限の証明ではありません。validateでは表示されたworkspace/target/pathが意図どおりか確認します。成功してもデータの実行時権限やアプリ稼働まで保証しません。**この段階ではdeploy/runしません。**

アプリを生成した後は、`apps/<app-name>/`に独立したBundleができます。そのフォルダーでのvalidateと設定が別途必要で、rootのteam_rootや変数ファイルが自動継承されるわけではありません。fixtureモックのBundleは誤deploy防止のため別名へ退避されます。

## 6. Databricks側で追加準備するもの — 必要になった時だけ

最初から全種類のリソースを手作業で作る必要はありません。エージェントが既存の候補・新規作成の必要性を整理し、利用範囲・費用・権限を人が決めます。

| やりたいこと | フォルダー・ログイン以外に必要なこと |
|---|---|
| 要件整理・設計 | workspace未接続でも開始可。資料は案件の`docs/product/intake/`へ |
| AppKitの架空データモック | このハーネスが使うCLI初期化には明示dev profile/hostとOAuthが必要。業務データは不要 |
| Delta登録・更新処理 | 対象Catalog/Schema、入力データ、主キー・更新順、実行compute。読込はUSE CATALOG/USE SCHEMA/SELECT、書込は対象に必要なMODIFY等。新規tableならCREATE TABLE等を確認 |
| 集計グラフの分析アプリ | 既存SQL warehouseとID、対象table/metric view。warehouse CAN USEと必要なデータ権限 |
| Genie | 参照table/view、作成者が使えるwarehouse、業務定義、質問と期待結果。既存Agent/Spaceを使うならそのID・利用権限 |
| 入力・更新の業務アプリ | Lakebase project/branch/databaseの新規作成か既存利用か、接続・テーブル権限。分析用Deltaとは用途を分ける |
| Databricks Appsとして動かす | Apps利用・作成可否、使用resourceとapp service principalの権限。自分が読めるデータでもアプリが読めるとは限らない |

warehouse IDは **SQL → SQL Warehouses → 使用するwarehouse → Connection Details** で確認します。HTTP path `/sql/1.0/warehouses/xxxxxxxxxxxxxxxx` の末尾がIDです。添付のURLのworkspace番号やフォルダー番号ではありません。[公式接続情報](https://docs.databricks.com/aws/en/integrations/compute-details)。rootのsetupにはwarehouse引数がありません。選択したIDは案件の接続設計に記録し、後のscaffoldで要求されるresource項目に指定します。例: 分析AppKit planの `--set analytics.sql-warehouse.id=実際のID`（全体の手順・mock承認は[CLI reference](CLI_REFERENCE.md)参照）。

Appは作成時に専用service principalが割り当てられます。必要なデータ・warehouse・Lakebase・Genieへの権限を、そのAppのresource設定として明示します。個人のtokenをコードへ貼る方式ではありません。広い権限を一括付与せず、設定画面で付与対象を確認して承認します。[公式Apps認証](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth)、[SQL warehouse resource](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/sql-warehouse)。

### 添付はFree Edition — 非商用の検証用として考える

2026-09-04確認の公式案内では非商用向けでSLAはありません。serverless限定、SQL warehouseは1つ、Appsは最大3つで起動・更新後最大24時間で停止、Lakebaseは1 project等の制限があります。サンプルでの学習・検証と、実業務で使う環境は分けて判断してください。AppsやLakebaseが使えることと、全AppKit pluginがこのworkspaceで検証済みということは別です。[公式Free Edition制限](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)、[利用できる機能](https://docs.databricks.com/aws/en/getting-started/free-edition)。

## 7. あとは同じ案件フォルダーで自然言語を渡す

VS Codeで開くのは`D:\projects\sales-operations`です。Claude CodeまたはGitHub Copilot ChatのAgentモードを使用します。グローバルへの追加プラグイン導入や、どちらか専用のsetupは必要ありません。両者は同梱された共通手順を読みますが、実際に読み込まれたことは最初に確認します。

初回の依頼例（値は本人が選んだものにする）:

> この案件のAGENTS.mdとactive sessionを確認して。接続profileはharness-dev、workspaceは今回指定したURL。開発はdevのUsers配下を使う。営業データの分析アプリを作りたい。まず要件と設計を作り、架空データの操作できるモックを見せて。重要な未回答だけ質問して。本データ接続・権限変更・deployは承認を待って。

変数ファイル作成をエージェントに任せる例:

> Catalogは確認済みのXXX、SchemaはYYY、team_rootは/Workspace/Shared/test/dev-harness、dev_suffixはmy-pilot-01。案件rootの.databricks/bundle/dev/variable-overrides.jsonに保存して。devの配置先は既定のUsers配下を維持して、選択したprofileでvalidateまで。resource作成・権限変更・deployはしないで。

同じ作業をClaudeからCopilotへ切り替えるときは、同時に同じファイルを編集させず、先のエージェントにcheckpointを残させてから「work/sessionsの記録から再開して」と依頼します。通常のチャット内作業にheadlessループ用CLIや追加の無人実行設定は不要です。

## 8. 途中で止まった場合

- **new-project後にsetupだけ失敗**: GitHub repoやcloneが既にできている可能性があります。new-projectを繰り返さず、存在確認後、案件repo内でsetupだけ再実行します。
- **ツール不足・古い版**: 表示されたツールを許可された方法で導入/更新し、新しいターミナルから同じ案件のsetupを再実行します。既存ファイルは削除しません。
- **認証だけやり直す**: 案件rootで `npm run harness:connect -- --profile harness-dev --host https://dbc-3fb0b9a2-66bb.cloud.databricks.com --auth`。本人がブラウザー承認します。
- **Missing variable / catalog等が未設定**: セクション5の変数ファイルと実際の名前を確認。名前の設定だけではCatalog/Schemaは作成されません。
- **PERMISSION_DENIED**: 対象resourceと操作者・app service principalを確認し、管理者と必要な範囲だけ調整。tokenの貼付や管理者権限への切替で回避しません。
- **credential overridesの検出**: 名前が表示された環境変数を自分の端末で確認します。`.env.example`をsourceする手順はありません。別用途の認証を一括削除せず、専用ターミナルを使う等で分離します。

開始可能の目安は「案件repoがある → setupと接続確認が成功 → エージェントが要件・設計を記録」です。データ利用・実行準備では「必要な変数とresource定義を整備 → validate成功」を確認します。実アプリ・データ処理の完成は、mock承認・実装・検証・必要なdeploy承認を経た別の到達点です。workspace未接続でも要件整理は始められます。
