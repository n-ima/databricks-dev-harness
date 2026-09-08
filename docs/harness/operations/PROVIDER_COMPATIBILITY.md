# Provider・モデル・ツールの互換性と更新

確認日: 2026-09-08。これは確認時点のsnapshotです。利用可能モデル・課金・組織policy・previewは変わるため、案件開始時と更新時に公式情報と実際のmodel pickerを再確認します。

## 対応surfaceを分ける

| surface | 読み込む資産 | この監査での確認 | 初回の確認方法 |
|---|---|---|---|
| Claude Code (terminal / VS Code extension) | CLAUDE.md→AGENTS.md、.claude/skills、rules、settings hooks | 設定・hook入出力のprocess試験。実modelのend-to-endは未実行 | 案件rootで起動、/hooksと/doctor、orchestrate-workとsessionを認識するか確認 |
| VS Code GitHub Copilot Chat Agent | .github/copilot-instructions.md、skills、instructions、hooks | 設定・snake_case payloadのfixture試験。実extensionでのhook発火は未実行 | Agentモードで案件rootを開く。OutputのGitHub Copilot Chat Hooks、Load Hooks/debug logsで確認 |
| GitHub Copilot CLI | .github/skills、instructions、hooks（Claude設定も参照される） | camelCase/snake_caseのadapter試験。CLI本体はこの端末のPATHにない | 別途CLIを使う場合だけ本人が導入・login。通常のVS Code利用の必須条件ではない |
| Copilot cloud agent | repo instruction/skillとLinux job内のhooks、setup workflow | この変更のcloud-agent実行は未検証 | workflowとfirewall・依存・環境変数を確認。local profileは転送しない |

Claude/Copilot間の基本指示はcanonical `harness/skills` とpinned vendorから生成します。provider固有設定は薄いadapter。プラグインを追加しただけで同じ安全境界になるわけではありません。[GitHub customization対応表](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)

### Hookの重要な違い

VS CodeはCopilot CLI形式を変換し、Claude設定も読み込みます。CLIもClaude設定を読み込むため、設定ファイルのprovider名だけで実行surfaceを判定できません。このハーネスは拒否/追加contextを一つのJSONのCLI形式とhookSpecificOutput形式に同じ内容で返します。複数ファイル編集のfilePathも検査します。これは同じ意味のadapterでありallowの自動付与ではありません。

読込重複で同じhookが複数回発火する場合があります。拒否検査とsanitized metadata書込は冪等な処理ですが、contextの重複も診断で確認してください。rootを開いて起動するのがサポートする基本経路です。相対commandを使うため、任意のnested cwdからの起動は未保証です。複数repositoryでは対象を取り違えないようにします。

VS Code hooksはPreviewです。組織設定で無効化されることがあり、ファイルが存在しても発火の証明にはなりません。matcher/tool名と入力propertyはClaudeと異なります。[VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks)

Copilotのcommand preToolUseはエラー時に拒否しますが、**timeoutは通常のpermission flowへ戻るfail-open**です。command型userPromptSubmittedのstdoutは採用されないため、毎回のworkflowはrepository instructionsと明示CLIで進めます。hookに依存して全自然言語を強制変換する設計にはしません。[GitHub hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)

ClaudeのSessionStart/UserPromptSubmit、PreToolUse、Stop等もevent固有の出力に従います。PreCompactの通知は意味的なcheckpointの代用ではありません。Stopで無期限再実行を要求せず、予算・人のゲート・既にactiveなstop hookを尊重します。[Claude hooks reference](https://code.claude.com/docs/en/hooks)

**HooksはOS/network sandboxではありません。** equal-privilege processはルールを編集でき、迂回するコマンドを完全解析できません。開発用の最小権限、production credentialsの不在、repo/worktree分離、CI/branch protectionとEnvironment承認を外側に設けます。

## 確認された版と採用の区別

| 対象 | upstream確認版 | この端末/固定版 | 採用判断 |
|---|---|---|---|
| Databricks CLI | 1.15.0 (2026-09-03) | PATH 1.6.0、隔離1.15.0のchecksum/help/manifestを実測 | 最低互換範囲は既存1.6以上2未満を維持。最新コマンドは1.15契約で別確認 |
| AppKit | 0.72.0 (2026-09-04) | scaffold pin v0.69.1 | 0.72 manifest取得済み。init/build/live未確認のためpinは黙って変更しない |
| Databricks Agent Skills | GitHub tag 0.2.15 (2026-09-07) | vendor 0.2.10、CLI1.15 installerも0.2.10を選択 | 公式resolverの結果を維持。latest tagを強制導入しない |
| Claude Code | 2.1.263 (2026-09-06) | 2.1.201 | 最新版との実model運転は別検証 |
| Copilot CLI | 1.0.83 (2026-09-04) | PATHに見つからない | VS Code extensionとは別。無人loop使用前に導入・権限・sandbox・模型試験 |
| VS Code | docsは2026-09-02更新を確認 | 1.136.1 | GPT-6 Astraの公式minimum版に合うが、契約・組織policyによる提供可否は別 |

版根拠: [CLI](https://github.com/databricks/cli/releases/tag/v1.15.0)、[AppKit](https://github.com/databricks/appkit/releases/tag/v0.72.0)、[Databricks Skills](https://github.com/databricks/databricks-agent-skills/releases/tag/v0.2.15)、[Claude Code](https://github.com/anthropics/claude-code/releases/tag/v2.1.263)、[Copilot CLI](https://github.com/github/copilot-cli/releases/tag/v1.0.83)。ローカル実測は[監査証拠](../../../work/evidence/2026-09-08-platform-harness-audit.md)。

AppKit0.72のmanifestではserverが必須、agents/aiSearch/databaseにbeta表示がありました。pluginの存在を本番成熟度や今回workspaceの利用可否と同一視しません。利用するversionのmanifestがresourcesとMUST rulesの正本です。

## モデル方針: 固定名ではなく実測で選ぶ

2026-09-08に開いた公式一覧ではOpenAIのGPT-6 Astra、GPT-5.6 Terra/Luna、AnthropicのClaude Opus 5 / Sonnet 5 / Fable 5.1が掲載されています。検索snippetの古い一覧より、実際の公式本文を優先しました。[OpenAI models](https://developers.openai.com/api/docs/models)、[Anthropic model overview](https://platform.claude.com/docs/en/models/overview)

GitHub側の一覧・surface別対応・minimum IDE版と、実際の契約/組織のmodel pickerを確認します。OpenAI/Anthropic APIで使えるモデルがCopilotやDatabricksでも使えるとは限りません。旧4.xモデルの退役情報があるため古い固定model名をrepo defaultsに残しません。[GitHub supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)

プロジェクトでの設計判断:

- デフォルトは利用者の現設定を継承。エージェントが勝手に高額モデルへ切り替えない。
- 難しい要件/設計/独立reviewは実際に利用可能な高精度モデルを候補に、定型実装はより低費用の候補を同じ課題で比較。
- Claudeのopusplan等のaliasはplan/executeの切替に使えるが、実際に解決されたmodel名を記録する。[Claude model configuration](https://code.claude.com/docs/en/model-config)
- provider、surface、modelの正確なID、CLI/IDE版、reasoning設定、所要時間、介入回数、費用（取得不能ならnull）、受入結果をsession/evaluationへ残す。
- verifierは別の新しいcontextで独立実行。モデル名が違うだけでは独立性の証明にならない。
- モデル更新で不要になった長い指示・reset/sprintも除去候補にするが、必ず比較試験で確認。新モデルだから自律予算/権限を増やすことはしない。

最新モデルの性能比較やこのハーネスとの組合せ比較は未実行です。この一覧を「最強モデルの実証」として使いません。

## 更新手順

自動化は検査・計画・fixture・比較を担当し、採用はreviewに残します。週次レビューまたはCLI/model/hookの変更時に以下を行います（scheduler登録は別の明示依頼時のみ）。

1. `harness:doctor` で現状を記録、公式release/docsを再確認。GitHub tagとCLI resolverの選択を別々に記録。
2. CLIは必要なら隔離先へ公式checksum付きで取得。グローバルinstallや既存pyprojectを黙って上書きしない。
3. skills更新はsource専用の別作業branch/コピーで `databricks aitools install --path 隔離先` を使い、resolved version・差分・LICENSE/NOTICEを確認する。裸のinstallはagentのglobal plugin設定を変え得るため使わない。
4. 現行 `setup --refresh-skills` は製品初期化も行う。**ハーネスsourceで更新だけの目的には使わない。** reviewed staged skillsと対応legal/lockを取り込み、provider assetsを同期する。採用しない候補はそのまま隔離する。
5. AppKit pin変更はmanifest→同じversionでinit→build/validation→fixtures→dev smokeを一組で検証。依存だけを後からnpmで差し替えない。
6. `npm run agent-assets:sync`、`npm run harness:check`、`npm run test:harness`。固定golden taskを両provider各3回以上＋新しいforward-testで比較。失敗や未実行をpassへ変えない。
7. 独立review後に**新しいversion**のrelease bytesを作る。既配布0.3.2の封印を作り直さない。下流はupdate plan/apply、README/package scripts/VS Code設定のmanual migrationをレビューする。

実model/liveの未完了がある場合は開発候補として保持し、L2/L3運転や「全環境対応」のrelease認定をしません。

### 既存0.3.2案件からの更新

新規template利用はGitHubで公開されたrevisionに従います。ローカル0.4.0候補を作っただけではGitHub mainは変わりません。

0.3.2の古いupdaterは新しいmanaged testパスを認識せず、安全側に拒否する場合があります。allowlistを場当たり的に緩めず、信頼・レビュー済みの新sourceのupdaterを明示した案件rootに対して使います。実行中agentを停止し、案件の変更を保存してから、次を新sourceのrootで実行します。パスは本人の実際の案件とimmutable payloadへ置換。

```text
node --input-type=module -e "import {planUpdate} from './tools/lib/distribution.mjs'; await planUpdate(process.argv[1], {source: process.argv[2]});" D:/projects/TARGET-PRODUCT D:/projects/databricks-dev-harness/.harness/releases/0.4.0
```

これは案件内に差分planを作るだけです。conflictとmanual migration、publisherの信頼、source hashを確認後に同じ新sourceからapplyします。

```text
node --input-type=module -e "import {applyUpdate} from './tools/lib/distribution.mjs'; await applyUpdate(process.argv[1], {plan: process.argv[2], yes: true});" D:/projects/TARGET-PRODUCT .harness/updates/REVIEWED-PLAN.json
```

package/README/VS Code設定は自動上書き対象ではありません。新しい保護対象（tools/lib、workloads/router）を含むVS Code設定を手動差分で取り込み、案件rootでconformance/testsを実行します。active sessionのpolicy hashが変わるため、古いloopを無理に再開せずcheckpointから新計画を作ります。
