# 振り返り改善に関係する動向の再確認

確認日: 2026-09-10。既存の[40出典の台帳](2026-09-10-source-ledger.md)を置き換えず、今回の差分に関係する情報を追加する。世界全体の優越性を認定する調査ではない。

| 出典 | 確認できた主張／機能 | 今回の採否・証拠段階 |
| --- | --- | --- |
| [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)（2026-03-24） | 生成と評価の分離、事前の具体的な達成契約、モデルの変化に応じた構成要素の再評価を説明。 | HIMP-01は独立契約レビュー→反例試験→実装候補→独立再レビュー。安全上の独立確認をモデルが賢くなったという理由だけでは外さない。 |
| [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（2026-01-09） | agent評価で状態・tool calls・実行履歴・時間等を測る例を示す。 | 終了文言だけでなく、拒否後のファイル不変と下流副作用0回を受入条件に採用。後者はHIMP-02で実装予定。 |
| [GitHub: Copilot CLI customization comparison](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/comparing-cli-features)（確認時の公式資料） | skills/instructionsと、特定の実行時点へ制御・記録を追加するhooksの役割を区別。 | provider-neutralな共有検証を先に実装し、文書の注意だけで完了判定を委ねない。実Copilot/Claude canaryは別途。 |
| [Databricks: bundle command group](https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands)（表示更新日2026-09-02） | direct engineのplan適用、Bundleの配備identity、Appでは配備後のrunが必要なことを説明。 | 独自配備エンジンは作らず公式機能に適合する。source・target・承認・観測を結ぶ補完層を設計中。Private Previewの配備履歴機能は全環境の必須依存にしない。 |
| [Databricks: apps command group](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands) | App名なしのproject deployと、App名ありのAPI deployが異なる。project側の検証省略・test省略flag、非同期状態確認を記載。 | ローカルCLI v1.6.0のhelpでも照合済み。deployのskip-tests既定trueと、validateの既定falseの違いを設計へ反映。配備そのものは一切実行していない。 |
| [Geoffrey Huntley: Ralph](https://ghuntley.com/ralph/)（記事日付2025-07-14、今回再確認） | 小さな作業を反復し、失敗を観察し、既存実装を調べてから変更する手法を説明。 | 反例と小さな差分を採用。無制限loop・権限省略・掲載費用の再現保証は採用しない。既存bounded loopを保つ。 |
| [LoopsBench v2](https://arxiv.org/abs/2608.00267v2)（abstractとversion metadataを確認） | 長期開発を依存DAGと個別試験で扱い、完了した単位も回帰の義務として保持する評価を提案。 | 今回の新規47試験に加え、既存349試験を保持して全396試験を実行。研究ベンチマーク自体は未実行で、本ハーネスの優位性の証明には用いない。全文・ライセンス・課金を精査してから外部比較候補とする。 |
| [Eleven-system source-code study](https://arxiv.org/abs/2609.00006)（abstractのみ確認） | 複数のcoding harnessを共通の構成要素で比較する研究。 | 比較表の分類候補として記録。83ページ全文と元ソースの再確認は未実施。取得ページの表示日付とIDだけから新旧順位を推定しない。実装採用・順位付けの根拠にはしない。 |
| [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown) と npm metadata | MarkdownをASTへ変換する既存ライブラリ。npm viewで2.0.3と依存関係を確認。 | 共通Markdown全対応が必要な場合の候補。現在は依存なしCLIのbootstrap/配布変更を伴うためインストールせず、明示した受入記法のsubsetを厳格検証する。 |

## ローカル仕様との照合

Databricks CLI v1.6.0について、次の読み取りだけを実施した。

~~~text
databricks -v
databricks apps deploy --help
databricks apps validate --help
databricks bundle deploy --help
~~~

project deployはvalidation→deploy→runを持つ。deployはskip-tests既定true、validateはskip-tests既定false。両方の呼出しで検証条件を明示する必要がある。名前指定のAPI経路はproject経路の検査を実施した証拠にはならない。planはdirect engine用で、適用可否を能力検査に含める。profile/target文字列だけでworkspace identityが正しいと推測しない。

## 「世界最高」を判断するための方針

世界中のすべてに劣らないという無限定の命題を、自分のテスト件数だけで証明しない。比較対象、固定版、モデル、費用・時間・利用環境、評価課題を明示する。未実施はunknownと記録する。

- 安全性: 未検証の完了件数、未承認操作、失敗後の下流副作用は試験上0件を必須とする。
- 品質: 機能受入率、回帰、独立レビューでの流出欠陥。既存完了課題を新機能追加後も再検証する。
- 効率: 同条件の時間・費用・人の介入回数で比較し、外せる仕組みはablationで確認する。機能数だけで優劣を決めない。
- 可観測性: 対象・現在地・次の行動・待ち理由と、稼働観測の鮮度が区別できる。
- 適合性: Claude Code/Copilot、OS、CLI/AppKit版の実機証拠を区別する。形式互換と実機成功は同じではない。
- 採用: 出典→自分のfailure episode→受入条件→最小変更→独立確認→人の必要な判断→版管理→案件側更新→効果観測、をつなぐ。

今回のコード試験ではHIMP-01の候補を検証しただけであり、上記すべての比較が済んだとはしない。
