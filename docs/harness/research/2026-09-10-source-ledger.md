# ハーネス再評価の出典台帳

参照日: 2026-09-10 JST。本文・実装を確認した範囲を明記する。検索結果だけの候補は採用根拠に含めない。公開資料の機能説明、実験結果、作者の推奨、当ハーネスへの設計判断は別物である。rolling docsとmainは固定版ではなく、この日の観測である。公開実装を導入する場合は別途commit・license・依存・安全性を固定/確認する。

## 公開一次資料

### S01 — Effective harnesses for long-running agents

- 発行: Anthropic / Justin Young。日付/版: 2025-11-26。
- 原資料: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- 読了範囲: 本文。
- 採用する事実: 初期化・小さな機能・進捗ファイル・実ブラウザー確認。
- 限界: Webアプリ中心の実験。全領域・全モデルの保証ではない。

### S02 — Harness design for long-running application development

- 発行: Anthropic / Prithvi Rajasekaran。日付/版: 2026-03-24。
- 原資料: [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- 読了範囲: 本文・簡素化と評価器の限界。
- 採用する事実: モデル更新に伴うsprint/reset削減、評価器の校正。
- 限界: 比較の作業範囲と費用が揃わない。マルチエージェントの普遍的優位は証明しない。

### S03 — Effective context engineering for AI agents

- 発行: Anthropic。日付/版: 2025-09-29。
- 原資料: [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- 読了範囲: 本文・長時間実行節。
- 採用する事実: compaction・構造化ノート・必要時取得。
- 限界: 大量文書の常時注入や固定reset間隔を推奨する根拠ではない。

### S04 — Demystifying evals for AI agents

- 発行: Anthropic。日付/版: 2026-01-09。
- 原資料: [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- 読了範囲: 本文・grader/指標/評価設計。
- 採用する事実: 回帰と能力評価、pass@kとpass^k、grader校正。
- 限界: モデル判定だけで安全性・主観的品質を認定できない。

### S05 — spec-kit/templates/tasks-template.md

- 発行: GitHub / Spec Kit。日付/版: main（commit未固定）。
- 原資料: [spec-kit/templates/tasks-template.md](https://github.com/github/spec-kit/blob/main/templates/tasks-template.md)
- 読了範囲: テンプレート本文。
- 採用する事実: task ID・story・依存・file path。
- 限界: testsは仕様で要求される場合のみ。金融/業務CRUDの必須検証へそのままコピーしない。

### S06 — OpenSpec

- 発行: Fission AI。日付/版: main（commit未固定）。
- 原資料: [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- 読了範囲: READMEの構成・workflow・比較。
- 採用する事実: 変更ごとのproposal/spec/design/tasks。
- 限界: 比較とモデル推奨は作者の主張。自由な更新と承認拘束の両立は別途必要。

### S07 — Subagent-Driven Development

- 発行: Jesse Vincent / obra/superpowers。日付/版: main（commit未固定）。
- 原資料: [Subagent-Driven Development](https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md?plain=1)
- 読了範囲: 関連workflow・review・narration節。
- 採用する事実: fresh workerとtask review、最終review。
- 限界: 外部skillは調査対象のみ。進捗省略や常時委譲は当ハーネスの要件ではない。

### S08 — Beads documentation

- 発行: gastownhall/beads。日付/版: main（commit未固定）。
- 原資料: [Beads documentation](https://github.com/gastownhall/beads/blob/main/docs/index.md)
- 読了範囲: 概念・architecture節。
- 採用する事実: 依存関係を持つwork item、Dolt同期。
- 限界: 旧JSONL/SQLite版と混同しない。追加DB/同期基盤の運用費は別評価。

### S09 — Deep Agents frontend overview

- 発行: LangChain。日付/版: 更新日記載なし。
- 原資料: [Deep Agents frontend overview](https://docs.langchain.com/oss/python/deepagents/frontend/overview)
- 読了範囲: 本文。
- 採用する事実: メッセージとtodo/worker/interruptの表示を分離。
- 限界: UI投影の実装例。最適な委譲数や安全保証の証拠ではない。

### S10 — Context engineering in Deep Agents

- 発行: LangChain。日付/版: 更新日記載なし。
- 原資料: [Context engineering in Deep Agents](https://docs.langchain.com/oss/python/deepagents/context-engineering)
- 読了範囲: 構成・分離・長期記憶節。
- 採用する事実: thread内stateとcross-thread memoryの区別。
- 限界: filesystem風APIでも永続性はbackend依存。InMemoryStore例を再起動耐性と解釈しない。

### S11 — My AI Adoption Journey

- 発行: Mitchell Hashimoto。日付/版: 2026-02-05。
- 原資料: [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey)
- 読了範囲: 本文。
- 採用する事実: 観測した失敗に対応する短い指示と高速な検証ツール。
- 限界: 個人の経験報告。効果量の統制試験ではない。

### S12 — The lethal trifecta for AI agents: private data, untrusted content, and external communication

- 発行: Simon Willison。日付/版: 2025-06-16。
- 原資料: [The lethal trifecta for AI agents: private data, untrusted content, and external communication](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- 読了範囲: 本文。
- 採用する事実: 秘密・非信頼入力・外部送信の組合せの危険。
- 限界: 攻撃面の整理。引用された各事件の現況を本調査で再検証していない。

### S13 — Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?

- 発行: Gloaguen et al.。日付/版: v2: 2026-06-23。
- 原資料: [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/html/2602.11988v2)
- 読了範囲: 方法・結果・限界。
- 採用する事実: 4 coding agents、SWE-bench Lite 300件/CTXbench 138件。一般的成功率改善を確認せず。
- 限界: Python中心、安全性/保守性の総合評価ではない。v1より強い断定を流用しない。

### S14 — On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents

- 発行: Lulla et al.。日付/版: v2: 2026-03-30。
- 原資料: [On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents](https://arxiv.org/html/2601.20404v2)
- 読了範囲: 方法・指標・結果・限界。
- 採用する事実: 10 repo/124 PRで時間・出力token低減。
- 限界: 100 LoC以下・5file以下。意味的正しさの包括評価は対象外。成功率研究と同一指標ではない。

### S15 — We are Changing our Developer Productivity Experiment Design

- 発行: METR / Becker et al.。日付/版: 2026-02-24。
- 原資料: [We are Changing our Developer Productivity Experiment Design](https://metr.org/blog/2026-02-24-uplift-update/)
- 読了範囲: 本文・推定とバイアス。
- 採用する事実: 新しいAI生産性評価の参加選択・並行作業時間の測定問題。
- 限界: 旧19%遅延を現在に一般化せず、新推定も確定的効果量としない。

### S16 — Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses

- 発行: Lin et al.。日付/版: v4: 2026-05-18。
- 原資料: [Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses](https://arxiv.org/html/2604.25850v4)
- 読了範囲: 方法・ablation・帰属・限界。
- 採用する事実: 変更ごとの予測と観測、評価器read-only、層間の非加算性。
- 限界: Terminal-Bench最適化の研究試作。回帰の予見は弱く、本番自律改善を保証しない。

### S17 — Tools reference — Task tool availability

- 発行: Anthropic / Claude Code。日付/版: rolling docs、v2.1.233以降の条件。
- 原資料: [Tools reference — Task tool availability](https://code.claude.com/docs/en/tools-reference#task-tool-availability)
- 読了範囲: 該当節。
- 採用する事実: 一部のmodel/hostでTask系toolsを標準省略。
- 限界: ローカルinstalled versionとは別。Taskなしでも作業はできるが利用者への一覧は自動で増えない。

### S18 — Configure permissions

- 発行: Anthropic / Claude Code。日付/版: rolling docs。
- 原資料: [Configure permissions](https://code.claude.com/docs/en/permissions)
- 読了範囲: permissionとsandboxの関係。
- 採用する事実: permission判断とOS強制境界は補完関係。
- 限界: 許可設定だけで全プロセスのOS隔離を証明できない。

### S19 — Configure the sandboxed Bash tool

- 発行: Anthropic / Claude Code。日付/版: rolling docs。
- 原資料: [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
- 読了範囲: 対応OS・filesystem/network・限界。
- 採用する事実: native Windows非対応、WSL2等、filesystemとnetwork両面。
- 限界: WSL相互運用/escape/許可domainへの送信等を別途試す必要。

### S20 — GitHub Copilot hooks reference

- 発行: GitHub。日付/版: rolling docs。
- 原資料: [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)
- 読了範囲: CLI/cloud差・progress・timeout節。
- 採用する事実: CLIの表示専用progress、hook timeoutはfail-open。
- 限界: 通常permissionは継続。timeout=無条件全許可と誤記しない。VS Codeへ同一仕様と推定しない。

### S21 — Agent hooks in Visual Studio Code (Preview)

- 発行: Microsoft / VS Code。日付/版: rolling docs / Preview。
- 原資料: [Agent hooks in Visual Studio Code (Preview)](https://code.visualstudio.com/docs/agent-customization/hooks)
- 読了範囲: lifecycle・input/output節。
- 採用する事実: VS Code固有8events・debug logsによる確認。
- 限界: 設定ファイルの生成だけでは実拡張で発火した証拠にならない。

### S22 — Supported AI models in GitHub Copilot

- 発行: GitHub。日付/版: rolling docs。
- 原資料: [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models)
- 読了範囲: model一覧・client差・retirement節。
- 採用する事実: GPT-6 Astra/Claude Opus 5等の掲載、client/plan依存。
- 限界: 表のcheckアイコンがテキスト抽出で欠落。全モデルが全client対応とは判断しない。

### S23 — Models overview

- 発行: Anthropic / Claude Platform。日付/版: rolling docs。
- 原資料: [Models overview](https://platform.claude.com/docs/en/models/overview)
- 読了範囲: 比較表・Models API節。
- 採用する事実: Fable5.1/Opus5/Sonnet5/Haiku4.5、能力をAPIで確認可能。
- 限界: API提供はClaude Code/契約での利用可能性の証明ではない。

### S24 — GPT-6 Astra Model

- 発行: OpenAI / official OpenAI documentation。日付/版: rolling docs。
- 原資料: [GPT-6 Astra Model](https://developers.openai.com/api/docs/models/gpt-6-astra)
- 読了範囲: model本文・tool support・limits。
- 採用する事実: 高度なcoding等の現行モデル掲載、API能力と上限。
- 限界: vendor能力説明は本ハーネスの優劣試験ではない。API料金をCopilot料金に転用しない。

### S25 — Custom instructions with AGENTS.md

- 発行: OpenAI / ChatGPT Learn。日付/版: rolling docs。
- 原資料: [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- 読了範囲: discovery・limit・verify節。
- 採用する事実: 階層指示と32KiB既定上限、実ロード確認。
- 限界: Codex固有の挙動。全provider共通のロード規則にはしない。

### S26 — Security Best Practices

- 発行: Model Context Protocol。日付/版: 2025-11-25版URL、文書は継続更新。
- 原資料: [Security Best Practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)
- 読了範囲: confused deputy/token/SSRF/session/local server節。
- 採用する事実: audience検証、token passthrough禁止、非信頼URL対策。
- 限界: 最新RCの全仕様認定ではなく、参照版のsecurity要求。

### S27 — Secure use reference

- 発行: GitHub Actions。日付/版: rolling docs。
- 原資料: [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- 読了範囲: secret・非信頼checkout・actions pin節。
- 採用する事実: 最小権限、完全SHA固定、PR入力の信頼境界。
- 限界: SHA固定だけで依存内容が安全とは限らない。

### S28 — Agent skills for AI coding assistants

- 発行: Databricks AWS。日付/版: 更新2026-08-25。
- 原資料: [Agent skills for AI coding assistants](https://docs.databricks.com/aws/en/agent-skills/)
- 読了範囲: 本文。
- 採用する事実: aitools、公式skills、AI Dev Kit deprecated、skillsとMCPは別。
- 限界: 導入は認証/MCP接続/全機能提供を自動保証しない。

### S29 — AppKit

- 発行: Databricks / databricks/appkit。日付/版: main（commit未固定）。
- 原資料: [AppKit](https://github.com/databricks/appkit)
- 読了範囲: READMEのarchitecture/plugin節。
- 採用する事実: TypeScript/React、server/analytics/Genie/files/Lakebase。
- 限界: READMEのproduction-readyは個別アプリの受入証明ではない。

### S30 — Configure authorization in a Databricks app

- 発行: Databricks AWS。日付/版: 更新2026-08-21。
- 原資料: [Configure authorization in a Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth)
- 読了範囲: app/user authorization節。
- 採用する事実: App SPと利用者identityの分離。
- 限界: 接続成功と業務ロール認可を混同しない。

### S31 — Declarative Automation Bundles resources

- 発行: Databricks AWS。日付/版: rolling docs。
- 原資料: [Declarative Automation Bundles resources](https://docs.databricks.com/aws/en/dev-tools/bundles/resources)
- 読了範囲: 対応resource表・schema・lifecycle節。
- 採用する事実: Apps/Jobs/pipeline/Serving/Genie等、createと参照の差。
- 限界: 全文5140行の全field精査ではない。使用CLIのschemaが必要。

### S32 — Test and monitor a Genie Agent

- 発行: Databricks AWS。日付/版: rolling docs。
- 原資料: [Test and monitor a Genie Agent](https://docs.databricks.com/aws/en/genie-agents/monitor)
- 読了範囲: benchmark・言い換え・評価節。
- 採用する事実: 同じ問いの複数表現とSQL/result評価。
- 限界: benchmark通過は未知の全質問の正確さを保証しない。

### S33 — Evaluate and monitor agents

- 発行: Databricks AWS / MLflow。日付/版: 更新2026-07-28。
- 原資料: [Evaluate and monitor agents](https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/)
- 読了範囲: 本文。
- 採用する事実: trace・scorer・human feedbackの開発/運用ループ。
- 限界: 製品agentの評価と開発harnessの評価は別dataset・別権限で扱う。

### S34 — Lakebase Data API

- 発行: Databricks AWS。日付/版: 更新2026-08-19。
- 原資料: [Lakebase Data API](https://docs.databricks.com/aws/en/oltp/projects/data-api)
- 読了範囲: overview・compatibility節。
- 採用する事実: schema由来REST CRUD/RPC。
- 限界: PostgREST完全互換ではない。複数HTTPの業務transactionを保証する記述ではない。

### S35 — Databricks Free Edition limitations

- 発行: Databricks AWS。日付/版: 更新2026-07-20。
- 原資料: [Databricks Free Edition limitations](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations)
- 読了範囲: 本文。
- 採用する事実: 非商用・SLAなし・機能/管理/computeの制限。
- 限界: workspace全域の本番受入環境としては不足。無料のまま全機能を約束しない。

### S36 — Databricks IDE extension

- 発行: Databricks AWS。日付/版: 更新2026-07-10。
- 原資料: [Databricks IDE extension](https://docs.databricks.com/aws/en/dev-tools/vscode-ext/)
- 読了範囲: 本文。
- 採用する事実: VS Code/Cursor、Bundle、remote実行、Connect/debug。
- 限界: R/Scala/SQL notebook実行と深い言語支援は別。localだけでSparkの全挙動を証明できない。

### S37 — Unity Catalog metric views

- 発行: Databricks AWS。日付/版: 更新2026-07-28。
- 原資料: [Unity Catalog metric views](https://docs.databricks.com/aws/en/uc-semantics/metric-views/)
- 読了範囲: 本文。
- 採用する事実: 再利用可能な業務指標定義。
- 限界: 即時OLTP表示へ常に分析基盤を挟むことを強制しない。

### S38 — Upsert into a Delta Lake table using merge

- 発行: Databricks AWS。日付/版: rolling docs。
- 原資料: [Upsert into a Delta Lake table using merge](https://docs.databricks.com/aws/en/delta/merge)
- 読了範囲: 重複・runtime差・dedup節。
- 採用する事実: 入力内重複処理とRuntime16以降/15.4以前の条件差。
- 限界: MERGEを書くだけで全処理が冪等になるとはいえない。

### S39 — Best Practices

- 発行: Microsoft / Playwright。日付/版: rolling docs。
- 原資料: [Best Practices](https://playwright.dev/docs/best-practices)
- 読了範囲: user-visible behavior・isolation・tooling節。
- 採用する事実: 実利用者の操作・独立したfixture・失敗trace。
- 限界: ブラウザー試験の合格はDB権限や製品意図の承認ではない。

### S40 — Query from Lakebase SQL Editor

- 発行: Databricks AWS。日付/版: 更新2026-07-01。
- 原資料: [Query from Lakebase SQL Editor](https://docs.databricks.com/aws/en/oltp/projects/sql-editor)
- 読了範囲: SQL Editor・private-access制限節。
- 採用する事実: Private Link/public無効条件下のstateless proxyとtransaction制約。
- 限界: 通常Postgres接続もtransaction不可、と一般化しない。

## ローカルの一次証拠

- L01: ハーネスHEAD `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7` と現行 `tools/harness.mjs`、`tools/agent-hook.mjs`、`tools/lib/memory.mjs`。
- L02: `work/evidence/2026-09-10-context-probe.mjs` / 同名JSON。9sessionによる隔離再現。エージェントモデルは起動しない。
- L03: `work/evidence/2026-09-10-harness-reaudit.md`。回帰結果・調査範囲・中断記録。
- L04: `D:/vscode-worspace/CreateAppl`。観測HEAD `1f4475f3b71c12bcc4ca1b8a93675cea2c271966`、working-tree内のAGENTS.md/CLAUDE.md/タスク・進捗テンプレート/implement.agent.md。非公開比較資料、コピー・実行・改変なし。
- L05: `docs/harness/research/2026-09-harness-research.md`、`docs/harness/operations/PROVIDER_COMPATIBILITY.md`、`VALIDATION_STATUS.md`。過去に調査済みだった内容と現在の証拠段階の区別。

## 探索したが判断根拠から外したもの

原文を十分確認できていない論文・紹介記事、検索結果のみの数値、後続版の確認なしに引用される古いモデル推奨、インストール件数・star数による品質順位は結論の根拠にしない。特にAGENTS.md研究はv2の方法/限界まで確認し、成功率と速度を同じ指標として扱わない。公開harnessの比較は機能/構造の比較であり、当環境でのhead-to-head実験ではない。

