# 高品質・低負担・継続運用のためのハーネス再評価

## 結論

現行ハーネスの全面廃棄は推奨しない。自然言語からの分岐、永続記録、公式技能の固定、承認と実行の分離、証拠に基づく完了判定は維持する。一方、利用者が開発手順の不足を指摘しなくても品質を保つという目的には未達である。要件・インターフェース・リスク・テスト・運用の対応付け、および実providerと実Databricksによる証明を優先する。

到達目標は、正しさと安全性の最低条件を落とさず、受入済み成果当たりの費用・時間・人の介入を減らし、運用中の変更でも品質を維持することである。「世界最高」「誰も到達していない」は志向として保持できるが、比較母集団と条件のない順位や未観測の優越性は証明できない。未知の失敗を発見・再現・修正し、その効果を継続測定できることを設計上の中心に据える。

本書は現在のローカル候補の評価と、今後の採用判断を分ける。候補は既存の制御に未接続である。成果物の作成、ローカル回帰、実providerでの有効性、実環境受入、正式採用、配布はそれぞれ別の状態である。

## 既存調査と現在の不足

過去の[全面再評価](2026-09-10-comprehensive-reaudit.md)には、成果物の対応、別context、費用、運用、反例、固定評価と未知課題が既に記載されていた。したがって原因をすべて「未調査」と分類すると誤る。情報を要求へ変換する過程と、要求を自動検査・実利用による証拠へ変換する過程の不足が重なっている。

現在のコードではacceptance.mjsが要件IDとレビューの集合一致を検査し、evidence.mjsが選択artifactのsnapshotを結ぶ。intakeは要件と設計の骨格を作る。API starterは実HTTPを用いたローカルfixtureを持つ。しかし、それらだけでは、元のAPIに操作が増えたのにテスト計画から落ちた、設計リスクがテストされない、運用引継ぎがない、といった不足を統一して検出できない。

| 能力 | 今あるもの | 今回の判断 |
|---|---|---|
| 自然言語の入口 | orchestrate-work、workloads、intake | 維持。API等を明示選択できる。実providerでの取りこぼし検証は残る |
| 要件と設計 | docs/product、承認hash、テンプレート | 維持。外部契約・ケースとのリンクを補う |
| 作業の見える化 | task、status、session checkpoint | 別UIは増やさず、既存進捗に検証段階を統合する |
| 完了の証拠 | 全AC照合、receipt、hash | 維持。新候補で置き換えない |
| API | OpenAPI fixture、負のHTTP試験、公式技能 | 実装可能性と実環境での証明を分離。操作集合・観点・ケースを診断する |
| 運用 | runbook、調査、障害の読取優先ルート | 責任・監視・復旧・保持・費用・更新の検討を明示する |
| 改善 | golden task、比較plan、配布更新の仕組み | 評価計画だけで有効性を主張しない。実行結果が必要 |
| 両provider | 生成資産、hook fixture | ローカル設定検証と実hostの動作を同一視しない |
| 安全 | 承認、policy、隔離要求 | 文書やhashはOS境界・本人認証ではない。外側の権限を維持 |

## 公開実践から採る原理

GitHub Spec Kitは仕様、計画、タスクを段階的に作り、artifact間の不整合や不足を検討する。OpenSpecは変更単位のproposal/spec/design/tasksを扱い、既存製品の変更を局所化する。この二つから採るのは「仕様を一度長く書けばよい」ではなく、変更の影響を関連する実装・検証へ伝える原理である。二つのフレームワークを重ねて導入し、既存の正本を増やすことはしない。[^1][^2]

Anthropicの長時間開発の実践は、実装と評価の分離、具体的な達成契約、実際のUI/API/DBを使う評価を示す。同時に、モデルの変化に応じて構成を簡素化している。よって常時複数agent、固定回数の反復、長大なpromptを最高品質の必要条件にはしない。独立レビューは権限・仕様・統合の重要な境界に置き、定型検査は安価な決定的ツールへ寄せる。[^3]

評価は最終回答の文章だけでは不十分である。Anthropicのeval実践はtask、trial、grader、実行結果を区別する。ここから、失敗・未実行・不明を保持し、同じ課題を複数回試し、実際の状態を検証する方針を採る。採点器自体の誤判定も測定する。[^4]

Hashimotoの個人実践からは、遭遇した失敗を次回防げる仕組みに変える姿勢を参考にする。Willisonの外部入力・秘密・外部通信の組合せに関する整理は、ハーネスが読む資料やAPI応答を命令として扱わない理由を補強する。いずれも特定環境の実践・脅威整理であり、当ハーネスの性能値には転用しない。[^5][^6]

Superpowersの公開READMEも、計画・テスト・レビューを手順として組み合わせる実装例である。採用するのは検証責務の明確化であって、別runtimeや全taskへの委譲の必須化ではない。AGENTS.md研究のabstractはcontextファイルが常に成功率を上げるわけではないことを示すが、ここでは全文再分析をしていないため数値や一般的効果を結論に使わない。[^7][^8]

## 最新モデルとproviderの扱い

調査時点のOpenAI公式一覧にはGPT-6 Astra、GitHubの対応表にはGPT-5.6系、GPT-6 Astra、Claude Opus 5、Sonnet 5、Fable 5.1等がある。Anthropic公式一覧も別に確認した。ただし、一覧掲載は利用者の契約・IDE・組織policy・Databricksでの利用可否を保証しない。最新名への無条件置換は行わず、実際に選べるmodel IDと実測結果を記録する。[^9][^10][^11]

Claude Codeの最新subagent資料では、別contextやtool権限、model継承の規則が説明されている。古い「Exploreは常に安い固定model」という仮定を採用しない。費用資料でもreasoningやcontext、反復が費用に影響する。モデル名だけで単価を決め打ちせず、利用surfaceに応じた課金記録と予算を使う。[^12][^13]

GitHubのhook referenceも更新され、event・command/HTTP形式・surface別の差がある。HTTP preToolUseの失敗に加え、command preToolUseのtimeoutも既定のpermission flowへ戻る。commandの非timeoutエラーによる拒否とは異なる。現行command hookでもtimeout時に保護対象操作を外側の権限が止めるかをhostごとのcanary課題にする。hookが存在することを強制隔離の証明にしない。今回の候補はhookではなく独立した読取専用ツールに留め、既存adapterの変更は実測後に行う。[^14]

OpenAIの公式best practicesも、課題と検証方法を明確にし、再利用できる指示や段階的な作業を扱う。ここから特定の新製品への移行を要求するのではなく、既存のClaude/Copilotを共通成果物で支える方針を維持する。[^15]

## Databricksの開発範囲と実証境界

Databricks公式のAgent Skillsは、ローカルagentに開発知識を与える仕組みであり、managed MCP接続とは別である。AI Dev Kitの旧skillsはdeprecatedと記載されている。現行の公式skill固定方針を維持し、複数の旧・新資産を無条件に併用しない。版更新は固定版との差分・互換性・ライセンスを確認する。[^16]

Appsは独自HTTP APIの提供先となり、token接続には/api/やOAuth・利用権限の条件がある。Lakebase Data APIはschema由来のCRUD/RPC APIを提供する別方式で、PostgRESTと完全同一ではない。Data APIの最新手順には利用identityとPostgres roleの対応、authenticatorがroleを引き受ける設定、owner identityを使わない注意がある。skill内の概説だけで権限設定を完了扱いしない。[^17][^18]

Bundlesのresource一覧はApps、Jobs、Pipelines等を広く扱うが、個々のresource schemaとlifecycleは使用CLI版と実環境で確認する。今回は一覧・該当領域の確認であり、全fieldや全サービスの互換性監査ではない。[^19]

MLflowの評価・監視は開発時の試験と運用traceをつなげる候補であり、Appsのtelemetryも公開されている。ただし、telemetryを有効化するだけではSLOや復旧能力を証明できない。ハーネス自身のtelemetryと案件アプリの観測を分離し、秘密や生の業務資料を共通研究へ収集しない。[^20][^21]

Free Editionは非商用用途やSLA等の制約がある。過去のスクリーンショットだけで商用の本番検証環境が揃ったと扱わない。案件開始時にedition、region、feature、identity、費用と承認範囲を確定する。[^22]

## 品質契約の最小構成

追加するのはもう一つの承認器ではなく、既存記録間の不足を知らせる診断である。要件本文はdocs/product、API仕様も同じ案件側、テスト計画と証拠はworkに保存する。人に構造化JSONを書かせず、agentが元資料と会話から生成する。人には重要な仮定、仕様の争点、未検証範囲を短く提示する。

| 正本・記録 | 機械的に検査すること | 人または独立agentが判断すること |
|---|---|---|
| 要件 | 元ファイルの全ACと契約集合の一致 | 業務意図を正しく捉えたか |
| API契約 | operationIdとケースの対応、正常/拒否の別case | エラー・互換性・利用者権限の意味 |
| リスク | ID、説明、test参照の欠落 | 想定外のリスク、適用外の妥当性 |
| ケース | 前提、手順、期待値、予定環境 | 境界値・組合せ・状態遷移の十分さ |
| 結果 | status、環境、command、version、証拠hash | 実際の振る舞いと業務上の受入 |
| 運用 | owner、監視、復旧、保護、費用、更新への参照 | SLOや復旧手順が現場で使えるか |
| レビュー | 別context記録、対象snapshot、全対象ID | 本当に独立して反例を探したか |

OpenAPIのlatestは確認時点で3.2.1である。一方、最新仕様をすべての既存toolへ強制すると互換性リスクがある。候補は3.1/3.2 JSONのoperation一覧のみを検査し、全schema検証は標準toolに委ねる。YAMLや参照を独自に雑に解釈せず、未対応とする。[^23]

Schemathesisはschemaからproperty-based試験を生成する選択肢である。ただしschemaから生成できる境界値だけでは業務上の誤りや権限漏れを網羅しない。OWASP API Securityのobject-level authorization、資源消費、機能権限等を観点として使い、案件固有の状態・副作用を別に検査する。新依存を全案件へ必須導入するのは、導入費用と検出効果を確認してからとする。[^24][^25]

## テストの十分さと限界

「網羅」は列挙したcaseがすべて通ることだけではない。要件、interface操作、境界、権限、状態遷移、再送、並行、部分失敗、復旧、性能上限の各軸で、何を確認し何を除外したかが説明できる必要がある。しかしすべての入力・順序・分散障害の完全探索は約束できない。

標準化の候補はrisk-tierである。文言修正なら既存設計への差分と狭い回帰、外部APIなら契約・認可・互換性・再送、データ書込なら原子性・重複・復旧、AI処理ならground truth・評価器校正・holdout・費用を求める。tierの割当てと省略規則はまだ正式採用していない。候補の最初の縦切りはHTTP APIであり、これだけで16領域の設計を完備したことにはならない。

独立レビューは実装後だけでなく、重要な仕様・試験計画にも行う。ただし独立contextという記録だけでは、同じ仮定に引きずられないことや本人性を保証しない。レビュー担当には元の要件と成果物、受入条件、既知の制約を渡し、実装担当の自己評価だけを根拠にさせない。必要なら未知の反例や実ユーザー操作で確認する。

## 運用中も使える構成

運用を第二の大きな監視アプリとして追加しない。案件のrunbook、既存ログ・metrics、Databricks resourceと配備版、task/sessionを結び、自然言語の「障害を調べて」「費用が増えた」「仕様変更したい」から読取優先の調査へ入る。修正・権限変更・本番操作はそれぞれ元の承認境界を保つ。

運用契約は担当、利用者にとっての成功指標、通知先、復旧手順、バックアップ/復元、データ保持、費用上限、依存更新、廃止条件を扱う。SREのSLO実践にある利用者視点の指標と継続的改善は参考になるが、全案件に同じ99.9%等を課さない。業務上の重要度と許容停止時間から定める。[^26]

改善ループには運用事故と問い合わせを戻す。個別案件の事実は案件knowledgeに、再利用可能な失敗パターンだけを匿名化・出典付きでharness knowledgeへ移す。生のデータ、認証情報、会話全文、内部の逐語的思考は移さない。自動改善が自分の採点器、承認、予算を緩めて合格する構成は禁止を維持する。

## 費用・時間・人の負担

費用はmodel単価だけでなく、contextの再読込、失敗した反復、レビュー、computeの待機、テストデータ保持、運用保守を含める。まずdeterministic checksを実行し、高価な実環境・model評価へ進む前に明白な不備を除く。案件ごとの追加依存を最小化し、公式APIやvalidatorを再利用する。

人の介入を減らす対象は、保存形式、同じ質問の繰返し、状態の探索、証拠の手作業での転記である。削ってはいけない介入は、業務意図、見た目/利用フロー、データ・権限、破壊的操作、本番配備の判断である。すべての工程に同じ重い承認を追加する方式も、すべてを無人にする方式も採らない。

モデル比較は現在の設定をbaselineにし、同じ課題・環境・上限で行う。強いmodelを常に使うことも、安いmodelだけを使うことも目標ではない。品質条件を満たした候補の中から、受入までの総費用と所要時間が良いものを選ぶ。今回の有料model比較は未実施で、コスト削減率は不明である。

測定規約も固定する。各trialに開始/終了時刻、実作業時間、承認待ち時間、provider/host/model/version、入力/出力/cache token、請求単位、取得元、見積か実測かを記録する。取得不能はnullと理由を残し、ゼロとしない。Copilot creditsとUSD、Databricks DBUと通貨を根拠なく合算しない。価格snapshotや請求明細で換算できる場合だけ通貨別の合計を作り、二重計上を避ける。共有computeの配賦方法は試行前に決める。

人の介入は、(a)必須の業務/安全承認、(b)不足情報の回答、(c)agentの誤りを直す追加指示、(d)手作業実装・復旧に分ける。同じ判断への往復は一件に束ね、判断IDと実測の人の作業分を記録する。不明なら回数のみとし、時間を推測しない。単にチャット投稿数を介入回数としない。

受入成果当たり費用の分子は、比較群に割り当てた全trial（失敗・再試行・review含む）の同一単位の費用、分母は独立受入に合格したtrial数とする。ゼロ合格なら算出不能であり、安いと判定しない。合格trialだけの平均と、全試行込みの値を区別する。壁時計時間は開始から受入まで、承認待ちを含む値と除いた値の両方を報告する。既存evaluationの平均値だけをこの総費用指標と呼ばず、別の測定表で補う。個別案件の長期運用費は試験費と分けて報告する。

## 評価計画と採用順序

既存harness/evals/golden-tasks.jsonとevaluation.mjsを捨てずに使う。正式な比較は共通taskと予算を凍結し、両providerで最低3回ずつ行う。3回はスモーク確認の下限で、統計的優越を断定する十分な標本数ではない。追加試行数はばらつきと費用から判断する。

| 比較群 | 課題 | 観測 |
|---|---|---|
| API | Apps+Lakebase、Data API、API変更 | 不足契約、権限拒否、互換性、再送、実保存 |
| UI/業務 | mock承認→実装、表示変更 | 意図の一致、操作、保存後再読込、アクセシビリティ |
| データ | 重複・遅延・再実行 | 件数/金額照合、原子性、部分失敗 |
| AI/分析 | OCRモデル比較、Genie/予測 | leakage、評価器、holdout、費用、再現性 |
| 運用 | 障害、復旧、依存更新 | 読取優先、誤配備防止、復旧、旧証拠の失効 |
| 継続性 | 別context再開、provider切替 | 正しい対象、次の作業、未完了の保持 |

baselineとcandidateで変える要素を限定する。両方に同じ最新modelを使う比較と、modelだけを変える比較は分ける。比較前に合格基準を固定し、失敗runを除外しない。未知caseは独立verifierが作り、改善用の例と最終評価を分ける。

安全違反や重大な業務不整合は総合点で相殺しない。観測した試験でそれらが出れば採用停止とする。品質を満たした場合に時間・費用・人の介入を比較し、改善が不明なら候補のまま保持する。自分の評価器を変えたrunを同じ条件の比較として扱わない。

優先順は、(1)今回の品質契約を診断候補として反例検証、(2)独立レビューと人による標準化判断、(3)risk-tierと自然言語入口への統合、(4)実provider canary、(5)承認済み開発環境でAPI/業務/運用の縦切り、(6)版付き配布と案件への非破壊更新である。統合前に標準化済みと言わない。

## 証拠段階と残る作業

既存全回帰は557件中556成功、失敗0、skip1。これは現行ローカル基盤の回帰結果であり、今回の独立候補は別suiteである。候補の最新結果・独立指摘・対象hashは[証拠記録](../../../work/evidence/2026-09-14-delivery-assurance.md)を正本とする。

未完了はrisk-tierの標準化、自然言語入口への結線、両provider実地評価、Databricks全workloadでの実検証、課金を含む効果測定、運用実績、配布・downstream適用である。過去の承認scope候補HARD-03も今回の広い指示だけで正式採用しない。実環境や案件へ無断で副作用を起こさない。

## 出典と確認範囲

以下は2026-09-14（JST）に再確認した一次資料。rolling docsとmainは将来変化する。全文精読ではなく採否に必要な節を確認した資料を含む。検索snippetのみの数値、star数、紹介記事からの順位は根拠にしない。既存40出典台帳を今回すべて再精査したという意味ではない。

[^1]: GitHub, [Agentic SDD](https://github.github.com/spec-kit/reference/agentic-sdd.html), rolling。spec/plan/tasks/checklist/analyzeの説明。実比較未実行。
[^2]: Fission AI, [OpenSpec](https://github.com/Fission-AI/OpenSpec), main README。変更単位の構造。Stores betaは必須採用しない。
[^3]: Anthropic, [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps), 2026-03-24。生成/評価・達成契約・モデル変更に伴う構成見直し。当環境の効果量ではない。
[^4]: Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), 2026-01-09。評価の構成と実行結果。独自採点器の正しさは別検証。
[^5]: Mitchell Hashimoto, [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey), 2026-02-05。個人の実践。一般的成功率の証拠ではない。
[^6]: Simon Willison, [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/), 2025-06-16。脅威の組合せ。個々の事件の現況まで再監査していない。
[^7]: Jesse Vincent / obra, [Superpowers](https://github.com/obra/superpowers), main README。計画/試験/reviewの構成。当ハーネスとの性能比較なし。
[^8]: Gloaguen et al., [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988), abstract/metadataのみ今回確認。全文と効果量の再分析は未実施。
[^9]: OpenAI, [Models](https://developers.openai.com/api/docs/models), rolling。モデル一覧。課金・アカウント可用性の実確認ではない。
[^10]: GitHub, [Supported AI models](https://docs.github.com/en/copilot/reference/ai-models/supported-models), rolling。surfaceと最低IDE条件。実model picker未確認。
[^11]: Anthropic, [Models overview](https://platform.claude.com/docs/en/models/overview), rolling。APIモデル案内。Databricks/Copilot提供とは別。
[^12]: Anthropic, [Create custom subagents](https://code.claude.com/docs/en/subagents), rolling。context/model/権限の節。ローカルhostでの挙動未実測。
[^13]: Anthropic, [Manage costs effectively](https://code.claude.com/docs/en/costs), rolling。context/reasoning/費用の節。削減率は借用しない。
[^14]: GitHub, [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference), rolling。command/HTTPとpreToolUseの節。adapter更新は未実施。
[^15]: OpenAI, [Best practices](https://learn.chatgpt.com/guides/best-practices), rolling。作業指示と検証の案内。旧Codex URLからのredirect先を確認。
[^16]: Databricks, [Agent skills for AI coding assistants](https://docs.databricks.com/aws/en/agent-skills/), 更新2026-09-11。本文。skillsとMCPの境界・旧kitの扱い。
[^17]: Databricks, [Connect to an API Databricks app](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local), 更新2026-09-11。API/OAuthの要件。
[^18]: Databricks, [Lakebase Data API](https://docs.databricks.com/aws/en/oltp/projects/data-api), 更新2026-09-11。概要・互換性・設定/role。全REST operationを実試験したものではない。
[^19]: Databricks, [Bundle resources](https://docs.databricks.com/aws/en/dev-tools/bundles/resources), rolling。resource一覧。全field精査は未実施。
[^20]: Databricks, [Evaluate and monitor agents](https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/), rolling。評価と監視の概要。個別機能・runtimeの適合は使用時に確認。
[^21]: Databricks, [Configure telemetry for Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/observability), rolling。telemetryの構成。設定や送信は実施しない。
[^22]: Databricks, [Free Edition limitations](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations), rolling。非商用・SLAと管理制約。
[^23]: OpenAPI Initiative, [OpenAPI 3.2.1](https://spec.openapis.org/oas/v3.2.1.html), 2026-09-10。version/概要/operationの構成。全仕様実装を意味しない。
[^24]: Schemathesis, [Documentation](https://schemathesis.readthedocs.io/en/stable/), rolling。schema由来property-based試験の概要。未導入・未実行。
[^25]: OWASP, [API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/), 2023版。APIリスク分類。最新年号を推測せず明示版を参照。
[^26]: Google, [Implementing SLOs](https://sre.google/workbook/implementing-slos/), SRE Workbook。利用者視点・目標と改善。案件別SLOは未合意。
