# 2026-09-04 根拠レビュー: Databricks 開発ハーネス

- 調査日・閲覧日: 2026-09-04
- 次回レビュー目安: 2026-10-04。CLI、provider hook、AppKit、認証方式の更新時は前倒しする。
- 対象: VS Code を入口とする Claude Code / GitHub Copilot 共用ハーネス。
- 性質: 設計の根拠であり、実装完了報告・製品比較ベンチマーク・本番運転の承認ではない。

## 読み方と既存文書との関係

ここでは **観察**（資料・コマンドで確認したこと）、**推奨**（このプロジェクトで選ぶ設計）、**推測・未検証**（まだ実証していない効果）を分離する。公式の説明も、すべてのバージョン・実行環境で動く証明にはならない。

基本方針の重複記述は避ける。入口は[従来の調査概要](2026-09-harness-research.md)、[アーキテクチャ](../design/ARCHITECTURE.md)、[要件 H-01〜H-20](../requirements/HARNESS.md)。配布は [ADR-0001](../decisions/ADR-0001-distribution.md)、記憶は [ADR-0002](../decisions/ADR-0002-session-memory.md) を正本とする。本書はそれらを更新・評価するときの根拠台帳である。

## 1. 観察: 公式一次情報

各行の URL は直接参照先、日付は本レビューでの閲覧日。要約は資料に書かれた範囲に限定した。

| ID | 出典・閲覧日 | 観察 |
|---|---|---|
| O-01 | [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/) — 2026-09-04 | 短い AGENTS.md を地図とし、リポジトリ内の設計・計画・知識を正本にする。UI、ログ、メトリクスを agent に観測可能にし、構造・鮮度の検査と定期的な文書整備を行った事例。成果は固有の環境への投資に依存し、一般化の限界も述べている。 |
| O-02 | [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — 2026-09-04 | planner / generator / evaluator を分離し、evaluator が実際の画面・API・DB を検証する。新しいモデルでは context reset や sprint 構造、評価頻度を減らす実験も行っている。「構成要素を増やすほど良い」とは述べていない。 |
| O-03 | [GitHub: Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support) — 2026-09-04 | instruction の探索場所と対応範囲は VS Code、CLI、cloud、code review で異なる。リポジトリ全体の instructions と path-scoped instructions を区別している。 |
| O-04 | [GitHub: Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) — 2026-09-04 | SKILL.md ベースの project skills を複数の Copilot surface で使用できる。全コンテキストへ大きい説明を常時載せる方式とは異なる。 |
| O-05 | [GitHub: Hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference) — 2026-09-04 | CLI は複数の設定・plugin hook を合成する。cloud は repo の `.github/hooks` と Linux 実行が前提。`agentStop` は継続制御、`preCompact` は通知。command `preToolUse` の timeout は fail-open であり、hook 単独の強制力には限界がある。 |
| O-06 | [VS Code: Agent hooks (Preview)](https://code.visualstudio.com/docs/agent-customization/hooks) — 2026-09-04 | `.github/hooks` と Claude 形式を探索し、イベント名を変換する。Preview であり、組織が無効化できる。agent が hook script を編集できる場合の自己改変リスクと、編集の人承認が説明されている。 |
| O-07 | [GitHub: Configure the development environment](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/customize-the-agent-environment) — 2026-09-04 | cloud agent の再現可能な事前セットアップは `.github/workflows/copilot-setup-steps.yml` に置き、job 名は `copilot-setup-steps` とする。ローカルでのインストールだけでは cloud 環境に引き継がれない。 |
| O-08 | [Claude Code: Extension overview](https://code.claude.com/docs/en/features-overview) — 2026-09-04 | instructions、skills、subagents、hooks、plugins を役割別に説明する。判断の手順と、必ず走らせたい決定的処理を同一機構として扱わない。 |
| O-09 | [Claude Code: Memory](https://code.claude.com/docs/en/memory) — 2026-09-04 | CLAUDE.md と auto memory は別の機構。AGENTS.md は CLAUDE.md から参照できる。provider 固有の記憶機能が存在することは、provider 間の可搬性や記録の正しさを保証しない。 |
| O-10 | [Claude Code: Hooks reference](https://code.claude.com/docs/en/hooks) — 2026-09-04 | SessionStart、PreCompact、Stop などの lifecycle event と、それぞれの入力・出力・制御可能範囲が定義されている。同じ名前の hook でも他 provider の payload と同一とは限らない。 |
| O-11 | [Claude Code: Skills](https://code.claude.com/docs/en/slash-commands) — 2026-09-04 | `context: fork` や `disable-model-invocation: true` など provider 固有の metadata がある。後者は model による自動起動を抑えるもので、OS・Databricks の権限制御を代替しない。 |
| O-12 | [Claude Code: Goals](https://code.claude.com/docs/en/goal) — 2026-09-04 | `/goal` は別モデルによる会話ベースの判定で継続する。判定モデルは独立してファイルを読んだりコマンドを実行したりしない。resume で計数基準が変わるため、総予算の正本にはできない。 |
| O-13 | [Claude Code: Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks) — 2026-09-04 | `/loop` は時間ベースの session-scoped scheduling。独立した永続実行には別の scheduling 機構を使う。実装の収束ループと監視の定期実行は目的が異なる。 |
| O-14 | [GitHub: Autopilot](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/autopilot)、[CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference) — 2026-09-04 | continuation 数を制限できる。`--max-ai-credits` は soft limit として説明される。自律継続、権限許可、機械的完了判定は別問題である。 |
| O-15 | [Databricks: Agent Skills](https://github.com/databricks/databricks-agent-skills) — 2026-09-04 | stable / experimental を区別し、Copilot cloud には repo 内 skills と hook を置く。旧 `databricks-solutions/ai-dev-kit` 由来の experimental skills には stable と同じ品質保証を与えていない。 |
| O-16 | [Databricks: AppKit](https://github.com/databricks/appkit)、[official app templates](https://github.com/databricks/app-templates) — 2026-09-04 | Node.js / React 用の AppKit と公式 app template 群が提供されている。SDK・template を利用できることと、個別業務要件を満たすことは別である。 |
| O-17 | [Databricks: Apps skill](https://github.com/databricks/databricks-agent-skills/blob/main/skills/databricks-apps/SKILL.md)、[App design skill](https://github.com/databricks/databricks-agent-skills/blob/main/skills/databricks-app-design/SKILL.md) — 2026-09-04 | custom app が必要かを先に判断し、manifest から scaffold の resource key を得る。AppKit API はインストール済み版の docs を参照する。単純な可視化だけなら managed AI/BI dashboard も選択肢としている。 |
| O-18 | [Databricks: Bundle configuration reference](https://docs.databricks.com/aws/en/dev-tools/bundles/reference)、[direct engine](https://docs.databricks.com/aws/en/dev-tools/bundles/direct) — 2026-09-04 | 現名称は Declarative Automation Bundles。`bundle.engine: direct` と CLI version constraint を記述できる。JSON plan と、同じ plan を適用する deploy が提供される。 |
| O-19 | [Databricks: Bundle release notes](https://docs.databricks.com/aws/en/release-notes/dev-tools/bundles) — 2026-09-04 | CLI 1.3.0 で direct engine が GA となったことが記録されている。旧 Terraform-backed bundle を新規開発の既定にする根拠はない。 |
| O-20 | [Databricks: CLI authentication](https://docs.databricks.com/aws/en/dev-tools/cli/authentication) — 2026-09-04 | OAuth U2M、profile の明示指定、CLI 1.0 以降の OS-native token storage を説明する。認証情報の探索は環境変数等の影響を受けるため、profile 名だけで接続先・実行主体の確認を省略できない。 |
| O-21 | [Databricks: GitHub Actions CI/CD](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/cicd-github-actions) — 2026-09-04 | GitHub OIDC federation と GitHub Environment の構成例がある。bundle deploy だけでは App process が新コードへ再起動しないため、resource の run と health 確認も必要とする。 |
| O-22 | [GitHub: Secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use) — 2026-09-04 | third-party action の完全な commit SHA pin と最小権限を推奨する。公式の簡略サンプルに `@main` があっても、この repo の供給網ポリシーを弱める理由にはならない。 |
| O-23 | [GitHub: Agentic Workflows](https://docs.github.com/en/copilot/how-tos/github-agentic-workflows/creating-github-agentic-workflows) — 2026-09-04 | Markdown から workflow を構成し、engine、permissions、safe outputs を指定する仕組みがある。日次保守を実装できることは、権限を広げて無条件に自動修正・merge してよいことを意味しない。 |

## 2. 観察: practitioner の一次発信

| ID | 出典・閲覧日 | 観察 | この repo で採る部分・採らない部分 |
|---|---|---|---|
| P-01 | [Mitchell Hashimoto: My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey) — 2026-09-04 | 自身の仕事に agent を段階的に導入し、繰り返す失敗を instruction や専用ツールへ変えた経験。 | 再現する失敗から小さく改善する。常時 agent を動かすこと自体を KPI にしない。 |
| P-02 | [Geoffrey Huntley: Ralph](https://ghuntley.com/ralph/) — 2026-09-04 | 単一 task、context の扱い、検証による backpressure を重視する実践。適用には技術的判断が必要で、既存 codebase への無警戒な導入を勧める内容ではない。 | 小さい反復と速い検査を採る。無限 shell loop、無制限課金、既存テスト改変による見かけの成功は採らない。 |
| P-03 | [Birgitta Böckeler: Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html) — 2026-09-04 | feedforward / feedback と、計算による検査 / 推論による評価を分け、保守性・アーキテクチャ・振る舞いを扱う。 | linter・schema・test は毎変更、意味・UX・未知の反例は独立 review。instruction の量を品質指標にしない。 |

これらは本人・実践者による有益な知見であり、Databricks 業務アプリで同じ改善率が出る比較実験ではない。

## 3. 観察: この環境で確認した版と資料のずれ

調査時の read-only コマンドは `databricks -v`、`databricks aitools install --help`、`databricks apps manifest --help`、`databricks apps init --help`、`databricks apps validate --help`、`databricks bundle validate --help`、`databricks bundle deploy --help`。接続・デプロイは行っていない。

| 観察 | 確認結果 | 設計への含意 |
|---|---|---|
| CLI | `Databricks CLI v1.6.0` | 1.x という大分類だけでなく実際の patch 版を実行証拠に残す。 |
| official skills lock | [vendor lock](../../../vendor/databricks-skills.lock.json) は `resolvedVersion: 0.2.10`、CLI 1.6.0、取得日 2026-09-04 を記録。 | lock の存在は compatibility test の成功ではない。供給元・版・内容 digest と評価結果を対応づける。 |
| toolchain lock | [toolchain lock](../../../harness/toolchain.lock.json) は CLI `>=1.6.0 <2.0.0`、AppKit template `v0.69.1` を指定。 | これは選択した baseline。CLI range は binary の完全 pin ではなく、将来の 1.x 全版の互換性保証でもない。 |
| skills installer の既定 | 公式 README は CLI を skills-only と説明する一方、ローカル 1.6.0 の help は対応 agent に plugin を既定導入すると説明。 | 一方を無条件に一般化しない。repo への取得は明示的な `--path` を使い、取得内容を検査する。 |
| AppKit version 解決 | 1.6.0 の help では `apps manifest` の既定は main、`apps init` は released version / auto。`--version latest` は main を意味する。 | manifest と init の両方に同じ明示 version を渡す。`latest` を「最新 stable」のつもりで使わない。 |
| validation | `bundle validate --strict` は warning も失敗扱い。`apps validate` は build / typecheck / lint / test 等を実行する。 | 成功だけで、ユーザー操作・データ意味・権限・稼働状態を検証したことにはしない。 |
| replayable plan | 1.6.0 に `bundle deploy --plan` がある。 | CLI 機能の存在は、当該 workspace で承認→適用→復旧が成功した証拠ではない。 |

### 実装検証の追補 — mock初期化の認証

調査後、server-onlyのAppKit mock初期化をローカルで試みたところ、CLIが既存DEFAULT設定のOAuth処理に進み、認証で失敗した。アプリ生成・デプロイ成功ではない。「業務データを使わないため初期化もoffline」という推測は誤りだった。

CLI v1.6.0の[init.go](https://github.com/databricks/cli/blob/v1.6.0/cmd/apps/init.go#L142)にはworkspace clientの事前処理があり、[auth.go](https://github.com/databricks/cli/blob/v1.6.0/cmd/root/auth.go#L247)で認証する。`--skip-install`は依存導入の省略で、認証の省略ではない。`apps manifest`の認証不要性をinitへ一般化してはいけない。

対策は、mockでも明示dev profile/hostを必要にし、未指定のplanをneeds-inputで止めること。profile一覧は `--skip-validate` で取得し、予期したhostかを確認してから選択profileだけを検証する。mockでは業務データplugin/resourceを禁止し、fixture-only Bundleへ退避する。実workspaceでの生成は引き続き未検証。この実失敗を回帰テストと[検証記録](../../../work/evidence/2026-09-04-local-validation.md)へ残す。

## 4. 推奨: 採用する仕組み

以下は資料の引用ではなく、本プロジェクトの条件に合わせた設計判断である。実装・有効化の状態は各コマンド・テスト・外部検証の証拠で判定する。

| ID | 推奨 | 根拠 | 正本・追跡先 |
|---|---|---|---|
| R-01 | GitHub template を bootstrap の正本とし、共通 skill / rule / schema / tool から thin provider adapter を生成する。plugin は後段の任意便利層とする。 | O-03〜O-08、O-15。cloud に user plugin は持ち込まれない。 | [ADR-0001](../decisions/ADR-0001-distribution.md) |
| R-02 | ordinary chat は小さい入口から session、要件、設計、検証へ進む。provider transcript と auto memory は補助にとどめ、compact file memory を正本とする。 | O-01、O-09、P-01 | [ADR-0002](../decisions/ADR-0002-session-memory.md)、[session 運用](../operations/SESSION_AND_KNOWLEDGE.md) |
| R-03 | loop は目的、受入条件、状態、最大反復・時間・process、kill switch、終了理由を持つ。provider の自律継続機能を利用しても予算・完了判定は独立させる。 | O-02、O-10〜O-14、P-02 | [ADR-0003](../decisions/ADR-0003-bounded-execution-and-evidence.md) |
| R-04 | Stop は証拠不足を検出し、PreCompact は checkpoint を促す。human gate・予算切れ・失敗を「完了」に変換しない。hook だけを security boundary にしない。 | O-05、O-06、O-10、O-12 | [ADR-0003](../decisions/ADR-0003-bounded-execution-and-evidence.md) |
| R-05 | verifier は別 context で成果物と実画面を検査する。実装 agent は自分の verifier・合格閾値・権限・予算を無承認で変えられない。context reset 自体は常時強制せず評価して選ぶ。 | O-02、O-06、P-03 | [評価運用](../operations/EVALUATION.md)、[改善ループ](../operations/IMPROVEMENT_LOOP.md) |
| R-06 | provider と host を分けて検証する。少なくとも Claude Code / Copilot の VS Code 利用、CLI、対象にする cloud を列挙し、payload fixture と実 session の両方を検証する。 | O-03〜O-07 | H-04、H-15、H-19 |
| R-07 | CLI 1.6 baseline、明示 direct engine、AppKit manifest / init の同一 version、installed docs、供給元 pin を採る。無確認で main や最新版に追従しない。 | O-15〜O-19、ローカル観察 | [ADR-0004](../decisions/ADR-0004-databricks-toolchain-and-identity.md) |
| R-08 | local は OAuth U2M と明示 profile、CI は専用 principal + OIDC + protected GitHub Environment。人が exact artifact / target を承認する。 | O-20〜O-22 | [ADR-0004](../decisions/ADR-0004-databricks-toolchain-and-identity.md) |
| R-09 | ユーザーの rich UI 要求を明示的な product policy とし、AppKit UI、ECharts、TanStack Table を基本にする。実行できる synthetic fixture mock を確認後に接続する。 | O-16、O-17、ユーザーの要求。ライブラリ統一の効果は推測を含む。 | [ADR-0005](../decisions/ADR-0005-rich-appkit-ui-default.md)、[frontend 標準](../../product/standards/FRONTEND.md) |
| R-10 | golden task を反復実行し、成果・時間・費用・介入・回帰を比較する。定期改善は report / PR までに限定し、未承認の policy 変更や自動 merge を含めない。 | O-01、O-02、O-23、P-01〜P-03 | [評価運用](../operations/EVALUATION.md)、[改善ループ](../operations/IMPROVEMENT_LOOP.md) |

## 5. 推測・未検証・採用しない誇張

- template と薄い adapter により学習・保守負担が減る、AppKit UI の統一により画面品質が安定する、という効果は合理的な仮説である。まだ本 repo の比較評価によって立証したものではない。
- 「世界最高」は改善目標であり、ランキング上の達成事実ではない。採用タスク成功率、変更 lead time、人の介入、逃した欠陥、費用、復旧可能性で評価する。
- loop engineering は有用な設計語彙だが、単一の確立した製品仕様として扱わない。[Loop Engineering: Building Blocks, Adoption, and Impact](https://arxiv.org/abs/2608.21884)（閲覧 2026-09-04）は新しい研究であり、製品の安全保証や本 repo の成功証拠には使わない。
- 別モデルの judge にも誤判定がある。同じ実装 agent が生成したテストが通るだけでは、業務意味・権限・UX の正しさは証明できない。
- provider の token / credit 上限が soft limit の場合、hard な総費用上限として表示しない。正確な利用量が取れなければ `unavailable` と記録し、ゼロや推定値を実測値にしない。
- plugin の存在、hook の設定、予算 JSON、golden-task manifest の存在だけでは、実際に実行・強制・合格したことにならない。
- AppKit を使うこと自体は rich UI の証拠ではない。業務上の意味と操作を含む mock 承認・browser 検証が必要。
- 本調査は workspace 接続、実データ更新、Genie benchmark、Copilot cloud job、OIDC federation、GitHub Environment approval、本番 deploy / rollback を実行していない。

## 6. 成熟度を上げるために必要な証拠

調査開始時の宣言は `harnessVersion: 0.2.0`、`maturityLevel: L1`。並行実装でファイルが増えても、この研究文書だけでは L2 / L3 へ昇格しない。

| 昇格前に確認するもの | 必要な証拠 |
|---|---|
| 再現可能な setup | fresh template copy、再実行、Windows / 対象 shell、固定依存、秘密の非保存のテスト結果 |
| provider parity | 対象 provider / host / version、実際の skill discovery、hook 発火、checkpoint 復元、拒否動作の記録 |
| bounded loop | iteration / time / process timeout、cancel、resume、stale evidence、不正な合格宣言、protected file 改変の負例テスト |
| workload coverage | Delta / Lakeflow、Lakebase、Genie、rich AppKit の代表 golden task と独立 review |
| platform deployment | explicit identity、strict validation、plan、承認 artifact、dev/test deploy、health、rollback の記録 |
| 安全な CI | OIDC federation subject の限定、GitHub Environment reviewer / branch 設定、actions SHA pin、権限不足の負例 |
| 改善の有効性 | 同条件での provider 別反復評価。成功率改善だけでなく費用・介入・security regression を記録 |

最終判定は [HARNESS の受入条件](../requirements/HARNESS.md) に evidence を対応づけ、[独立 review と人ゲート](../operations/OPERATING_MODEL.md) を通して行う。未実施は未実施として残す。
