# 目的に合ったAI駆動開発の再点検

確認日: 2026-09-16。対象: 0.7.0からの改善候補。世界全体の網羅調査・世界一の証明ではない。直前の読取専用調査を含め、今回の判断に使う一次資料と個人の実体験を整理した。全文を読んでいない論文の一般化や、比較条件の違う時間・費用の転用をしない。

## 結論

必要なのは、さらに細かい固定工程ではなく「現在の問いを解決するのに必要な成果と証拠」を選ぶこと。実部品の採用と、本番機能まで先に完成させることは別。AIの大量生成能力に合わせ、判断が固まっていない範囲を先に広げない。一方、全画面・データ設計・運用を対象から削って速く見せない。

## 現行の根拠と不足

| 観測 | 根拠 | 判断 |
|---|---|---|
| 工程と段階的な設計は既にある | OPERATING_MODEL、define-work、DOCUMENTATION_STANDARD | 工程そのものが皆無だった、という説明は誤り |
| 配置だけの描画を許可する一方、mock-uiは全状態実装・browser試験・契約/独立確認を一列に列挙 | mock-ui、UI_RUNTIME_FIDELITY | 初回相談でどこまで行えばよいかが弱い。具体的な停止点を補う |
| preview契約にも全宣言状態・差異ゼロ・独立レビューが必要 | tools/lib/ui-contract.mjs | 正式な視覚確認の整合検査として維持。最初の相談表示の必須条件にしない |
| build/reviewの一般手順に技術検証/設計だけの停止点が弱い | build-work、review-work、QUALITY | 本実装の検査を削らず、検査対象の主張と段階を明確化 |
| release-workはBundle検証を無条件に記載 | release-workとPLATFORM_PLAYBOOKの複数配備経路 | 利用する正規の配備方法に合わせる。無関係なBundleを作らない |
| 構造テストの証拠は正しく合成と記載され、実画面/provider未検証も記載済み | work/evidence/2026-09-15-ui-fidelity.md、tests/helpers/ui-fidelity.mjs | 証拠の捏造とは確認されない。ただし実用性の証明には不足 |
| 案件で単純な一画面に1時間超という申告 | 利用者の報告 | 実行ログ未取得。AppKitが原因、整合性検査だけが原因等と断定しない |

## 開発手法から取り入れるもの

| 一次資料 | 採用する考え方 | そのまま採用しない点・限界 |
|---|---|---|
| [GOV.UK: Making prototypes](https://www.gov.uk/service-manual/design/making-prototypes) | 試作の目的を学習・認識合わせに置き、必要な忠実度を選ぶ | 本番品質との区別はするが、本件の実部品要件を近似HTMLへ置換する根拠にはしない |
| [GOV.UK: Discovery](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works) / [Alpha](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works) | 問題と制約を理解し、重要な仮説を小さく試す | 政府の期間・工程を強制しない。利用者が要求する全画面設計は省かない |
| [DORA: Small batches](https://dora.dev/capabilities/working-in-small-batches/)（2025-12-08更新） | AI生成でも小さく確認し、後でまとめることでfeedbackを遅らせない | 本番配備を含む文脈を、配置相談でもまずAPIを配備すべきという規則に転用しない |
| [DORA: Test automation](https://dora.dev/capabilities/test-automation/) | 開発中の速いfeedbackと、対象に必要なテスト | 初期の配置相談へ全DB/統合試験を一律要求しない。後工程の検査を消す意味でもない |
| [Storybook: Simple component](https://storybook.js.org/tutorials/intro-to-storybook/react/en/simple-component) | 実コンポーネントをprops/fixtureで隔離して確認する | 新しくStorybookを全案件に必須導入しない。既存アプリ内のfixtureでもよい |
| [Cucumber: Example mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/) | 業務規則・例・質問を区別して会話し、未決事項を残す | 全文をGherkinへ書換えたり、全例の自動実装を会話の前提にしない |
| [Sadalage/Fowler: Evolutionary Database Design](https://martinfowler.com/articles/evodb.html) | データ変更を小さく追跡・検証する | UI終了までデータ設計を放置する根拠ではない。物理変更と業務上の意味を区別 |
| [Google SRE: Canarying releases](https://sre.google/workbook/canarying-releases/) | 配備対象を限定し、観測と回復に基づき拡大する | 配置試作に本番のcanaryを要求しない。正式配備の証拠はローカル試験で代用不可 |

## AI駆動開発の比較

| 一次資料・実体験 | 判断に使う内容 | 反証・制約 |
|---|---|---|
| [GitHub Spec Kit: Assessment](https://github.github.com/spec-kit/guides/assessment.html) / [Quickstart](https://github.github.com/spec-kit/quickstart.html) | 調査判断と実装を分け、賛否の証拠・対象外を残す。必要な部分だけ更新 | 全コマンドや追加文書群は輸入しない。採用可の判断だけで実装権限にはしない |
| [OpenSpec: spec-driven](https://openspec.dev/docs/schemas/spec-driven) | なぜ/何を/どうを分け、設計の必要性を条件判断。重複を避ける | validatorを通すために架空の要件を作らない。既存の正本へ別体系を重ねない |
| [BMad: Planning path](https://docs.bmad-method.org/plan/choose-a-planning-path/) | 意図が明確か、どの判断が不足かで必要な作業を選ぶ。分割後も全体の意図を保つ | 役割数や大量の文書・セッション数の目安を万能規則にしない |
| [Kiro: Quick spec](https://kiro.dev/docs/specs/quick-spec/) | 理解済みの小変更と不確実な設計を同じ重さで処理しない | 自動で中間承認を省く流れを、本件の人の判断gateへ無条件適用しない |
| [Superpowers: brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md) | spike/限定変更/architectureを分け、判断の規模に合わせる | 小変更をチャットだけに残す形は本件の再開要件に不十分。既存ファイルへ短く残す |
| [Claude Code: Best practices](https://code.claude.com/docs/en/best-practices) | 不確実なら調査・計画し、明白な変更へ大きな計画を押し付けない。検証可能な結果 | ドキュメントの推奨は、このハーネスを実際に読んで動いた証拠ではない |
| [GitHub Copilot: IDE chat](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide) | planと実行の分離、問いを残した人向け計画 | 利用できる機能はclient/versionに依存。コピー同期だけを実地動作と呼ばない |
| [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 単純な仕組みから始め、改善反復に評価条件と終了条件を持たせる | 2024年の原則資料であり最新SDKの証拠ではない。長い自律loopを全タスクの既定にしない |
| [Anthropic: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 実装と独立評価、モデル変化に伴う不要な足場の除去 | 複数時間の完成アプリ実験は初回配置相談と目的が異なる。費用・時間を同条件比較へ流用しない |
| [Anthropic: Managed agents](https://www.anthropic.com/engineering/managed-agents) | 耐久的な履歴と実行環境/agentの役割を分離、必要時にcontextを取得 | ホスト型基盤の採用をローカルハーネスへ強制しない |
| [Anthropic: Agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | 最終成果に加え過程を評価し、用途に合う判定を選ぶ | 採点AIの自己申告だけで正しさや承認を証明しない |
| [Vercel Labs: Ralph Loop Agent](https://github.com/vercel-labs/ralph-loop-agent) | tool呼出し終了と目的達成を分け、反復を制限する | 実験的実装。サンプルの文字列DONE判定は本件の受入根拠に使えない |
| [Böckeler: SDD three tools](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)（2025-10-15） | 小変更への文書過剰、既存構造の重複、specによる見かけの制御への注意 | 個人の限定的試行。2026年の各製品をこの古い評価だけで判定しない |
| [Böckeler: Harness engineering](https://martinfowler.com/articles/harness-engineering.html)（2026-04-02） | 指示とfeedbackを両方設計し、過剰実装をコード品質検査だけで検出できると思わない | 指示量を増やすだけでは利用成果の改善を証明できない |

## 最新研究の扱い

[Harness-of-Harness](https://arxiv.org/html/2609.01481v1)（2026-09-01）の序論・比較条件・継続実行の比較を確認した。小さな成果、計画/実装/独立QA、成果物を通じた継続という方向を参考にする。ただし3 loopの評価は同じtoken予算の比較ではなく、対象は当該benchmarks。人との配置相談や本件のDatabricks安全性に直接一般化しない。全文の全実験を追試したものではない。

contextファイルの効果に関する研究も一様な結論ではない。今回の実装判断は「文章を増やせば性能が上がる」には依存しない。最新モデル名の固定や定期的な高価モデルへの切替ではなく、同じ課題での結果を版・環境・modelごとに確認する。

## Databricksへの適用

- [AppKit architecture](https://developers.databricks.com/docs/appkit/v0/architecture) と [UI API](https://developers.databricks.com/docs/appkit/v0/api/appkit-ui): backend側とReact部品を区別する。data componentsには静的dataを使う経路もあるが、全componentが同じpropsで動くとは推測しない。installed版のAPIと描画を確認する。
- [Databricks development best practices](https://docs.databricks.com/aws/en/developers/best-practices): 環境・権限・版の管理を本実装と配備で検証。fixtureの成功を実workspaceの成功にしない。
- [MLflow evaluations](https://mlflow.org/genai/evaluations): モデル/プロンプトを版管理し、judgeを人の評価と照合する。探索に使う例と最終比較用の未使用例を分け、費用上限と終了条件を持つ。まず比較報告が目的ならServing配備まで勝手に進まない。
- [OpenAPI仕様](https://spec.openapis.org/oas/latest.html): 外部HTTPの仕様を機械可読にする。本ハーネスの限定的構造検査を、全OpenAPI仕様の準拠検証と呼ばない。

## 候補の失敗条件と評価

1. 速く表示したが近似部品へ置換した、全画面の設計を落とした、仕様がチャットだけに残った → 不合格。
2. 目的は配置相談なのにDB、業務計算、配備まで作った → 不合格。必要な小さな動作コードは許容する。
3. 小さく分けた結果、毎回新しい帳票・独立レビュー・承認を要求した → 不合格。正式受入と途中相談を区別。
4. 技術的に実現できるか不明な配置を説明せず承認した → 不合格。重要な制約は小さく確認する。
5. ローカルfixture成功で実provider/Databricks試験済みと記録した → 不合格。
6. 品質条件を下げて合格数を増やした → 不合格。既存の拒否試験を保持する。

実行計画は work/plans/2026-09-16-purpose-driven-delivery.md。既存のgolden課題に段階的UI確認・修正・再開を加え、別contextで手順の失敗を探す。実provider比較は同一課題・同一準備条件・同一model設定で、現行/候補をそれぞれ複数回実行する。未実行なら効果量を出さない。

## 今回の判断の限界

事例の数・調査時間・テスト件数は「世界最高」の証明ではない。ここで示したのは目的に合う最小対策と反証可能な検証方針。実際の一画面に時間がかかった原因、両providerの成績、実Databricks全workloadの安全な運用は、それぞれ対象を定めた実地検証が必要。新しい事実でこの設計が外れた場合は、現行方針へ文章を積まず、仮説と停止条件を見直す。
