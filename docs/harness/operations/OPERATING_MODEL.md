# Operating model

Last reviewed: 2026-09-16（手順の見直し。実providerでの有効性認定ではない）

## One request, durable artifacts

A human may begin with one sentence. Across the product lifecycle, the agent creates or updates the relevant records below. They are not all prerequisites for every intermediate reply or layout discussion; formal completion and approval still require their applicable evidence.

1. A work session containing current state and handoff.
2. A product requirement containing outcomes and acceptance criteria.
3. Target design and, for UI, an executable mock.
4. An execution plan for non-trivial implementation.
5. Evidence mapped to acceptance criteria.
6. A review record from a fresh skeptical context.
7. Knowledge or a harness learning when the result is reusable.

## Stage model

工程名は固定の直列作業を強制しない。今の依頼で決めることを選び、既存の計画またはsessionに **目的・必要十分な成果/証拠・今は行わないこと・終了/再検討条件** を短く残す。同じ内容を全帳票へ複製しない。軽微な変更は既存記録の差分でよい。問いが解けたら目的外の作業へ広げず、許可済みの次の作業へ進むか必要な人の判断を求める。

| Stage | Agent action | Human involvement | Exit evidence |
|---|---|---|---|
| Intake/Define | 目的・範囲・業務上の意味・権限・受入を具体化 | 重要な未決と意図の承認 | 他のagentが意味を推測せず次の対象作業を選べる |
| Design | 画面・動作・データ・IF・運用を対象に応じ並行設計 | 配置/業務意味、不可逆・security判断 | 今回の判断が可能な案と制約。設計完了時は対象全体の定義と未決の扱い |
| 技術検証 | 設計を左右する仮説だけを隔離して試す | 新権限・費用等が必要な場合 | 仮説の可否・条件・証拠。製品の実装/配備完了とはしない |
| Mock | 初期の配置相談→同じ実部品による操作確認 | 途中feedbackと正式ui-mock承認を区別 | 初期は判断できる表示、正式承認は全対象画面/状態・操作・独立証拠 |
| Build/Verify | 合意した範囲を実装し、主張に必要な検査 | 原則自律、追加権限等は別gate | 対象受入条件と同じ環境で観測した結果 |
| Review | 別contextで、依頼された成果に反例を探す | 受容できるリスクの判断 | 受入条件に対する判定と未検証範囲 |
| Release | 実際の配備方法に応じ差分・回復・観測を確認 | 本番操作の実行 | 対象版/環境での配備と事後確認。設計・分析のみなら配備は不要 |
| Learn | 失敗原因の最小対策と効果の再確認 | ハーネス方針の承認 | 元の失敗が改善し、別の品質/安全性を損なわない証拠 |

技術検証や配置相談に必要な少量のコードと、製品の本実装を混同しない。検証は仮説・範囲・終了条件を記録し、架空データ/隔離環境で行う。実現性が設計を変える疑問は早く試すが、検証を口実にDB/権限/配備を進めない。既存のhuman gateを解除する証拠にも代用しない。

### 対象別の停止点

| 今の依頼 | 必要な成果 | 先取りしないこと |
|---|---|---|
| UIの配置を相談 | 実部品による今回分の表示、全画面一覧と動作仕様/未決 | 全backend、全状態の完成、完成版の契約/独立承認を初回表示の条件にすること |
| APIの契約を相談 | 境界/入出力/正常異常例と未決。必要ならfixture応答 | 本物の認証・DB接続・公開。後の統合検証は別に計画 |
| データ更新方式の設計 | キー/粒度/遅延/再送/照合の意味、合成例 | 本番データへの書込み。実Delta等の検証を合成例で済ませること |
| 分析して結果を知る | 問いに答える分析、出典・前提・再現手順・限界 | 頼まれていないアプリ/API/定期jobの構築 |
| モデル/プロンプト比較 | 分離した開発/最終評価データ、校正したjudge、品質/費用と終了基準 | 評価例への過適合、上限なし改善loop、依頼外のServing配備 |
| 障害の原因を調べる | 観測、原因/仮説、影響と対応案 | 依頼されていない修正、再実行、DDL/権限変更 |

「今は行わない」と「製品で不要」を区別する。後で必要な作業は既存計画へ残す。UIがある場合の詳細は [UI_RUNTIME_FIDELITY](UI_RUNTIME_FIDELITY.md)。各workloadの実環境検証と配備境界は [PLATFORM_PLAYBOOK](PLATFORM_PLAYBOOK.md)。

## Question policy

Ask only when the answer changes business behavior, authoritative data, sensitive-data handling, permissions, substantial cost, irreversible design, mock acceptance, or production release. Otherwise inspect, state a reversible assumption, record it, and continue.

## Human gates

Approval of one gate never implies another.

- Product intent: outcome, scope, owner, authoritative source.
- UI mock: journey, language, information hierarchy, density.
- Data and permissions: classification, write authority, least privilege.
- Destructive migration: impact, backup/recovery, execution window.
- Production release: exact version, resource/permission diff, timing.

## Completion

“Implemented” is not complete. Completion requires every acceptance criterion to have observable evidence, required checks to pass, user-visible behavior to be exercised, independent verification to have no blocking finding, generated assets and documentation to be synchronized, remaining risks to be explicit, and no gate to be bypassed.

## Concurrent work

Agents must not share a mutable worktree, local server, schema, or development resource unless explicitly designed for safe concurrent use. Each session names its branch/worktree and target resources. Integration occurs through PR review, not implicit shared context.
