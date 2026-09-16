# 非UI依頼4件の限定Codex手順試行

実施日: 2026-09-16。実施context: `/root/purpose_scope_trial`。候補実装者とは別context。これは回答・手順の試行であり、API実装、実Claude/Copilot、実Databricksの試験ではない。

## 範囲と独立性

- ローカルのAGENTS、orchestrate-work、define-work、investigate-workと必要な標準・公式技能を読んだ。実サービス呼出し、実装、設定/branch変更、追加agent委譲は行っていない。
- `harness:context` は既存sessionの高位要約を出力した。そのため完全blind試行ではない。研究報告・改善設計書・golden期待回答・他reviewer/agent成果の本文は開いていない。以下の判断根拠には既存session要約を使用していない。
- CSV、画像/PDF、失敗ログは実際には渡されていない。以下は各依頼を受けた際の作業判断であり、分析・推論・障害再現の成功記録ではない。

## 入力ごとの私の判断

| 入力 | 今行う作業と成果 | 必要な確認・試験 | 未決と停止点 |
|---|---|---|---|
| A: Databricks Appsの受注API。IF定義のみ。認証・利用者未定 | API-onlyとしてOpenAPI案を作る。境界、operationId、入出力項目の意味/型/必須、正常・異常例、再送/競合/上限の論点を定義する。受注の登録/照会等も未指定なら提案と確定を分ける | OpenAPIの構造検査、例とschemaの整合、欠損/不正値/権限拒否/重複の契約ケースの定義。実認証や永続化の試験は後段の未実行項目 | 呼出主体、利用者、認証/業務認可、対象操作、受注データの意味と正本が未決。認証未定を無認証許可と解釈しない。未決を明示した定義案の提示で今回終了。UI、DB接続、API実装、公開へ進まない |
| B: 手元の合成CSVを分析し根拠付き報告のみ | 指定CSVをローカルで読み、粒度・期間・欠損・重複を確認。売上の推移/寄与/変化を集計し、入力の版、定義、前処理、集計結果、再現手順、限界を報告する | 行数/件数と総額の照合、代表値の独立再計算、除外や欠損の影響確認。図は報告に必要な場合のみ | 今回はCSV本体/所在がないので実分析は未実施。金額・通貨・税・取消・時刻帯など結果を変える意味は資料から確認。データ取得後、問いへの回答と検算根拠が揃えば終了。合成データから実売上の結論へ一般化しない。UI/Apps/API/Job/本番接続は不要 |
| C: 画像/PDFテキスト化のServing LLM比較とprompt改善。まず設計 | モデル比較とモデル別prompt改善を分けた実験計画を作る。文書種別/言語/表/画質の層、前処理・出力形式、共通baseline、モデル/パラメータ/prompt版、改善回数、費用・時間・停止条件を定義。開発データと未使用の最終評価を文書単位で分離する | 正解転記との文字誤り/欠落/創作/構造保持を確認する計画。judgeを使うなら人の採点と校正し、失敗例・不一致・位置/モデル名バイアスを検査。同一評価集合で品質/費用/遅延とばらつきを比較する。最終評価でpromptを再調整しない | データ利用/送信/保持許可、対象endpointと対応入力、予算、judge/判定閾値が未定。判断可能な設計案を提示して今回終了。許可未確定のデータ送信や有料推論、無制限改善、Serving作成/配備/本番prompt昇格へ進まない |
| D: 本番の昨日の失敗ログ。原因調査のみ | 渡されたログを読取専用で調べ、対象日/時刻帯/環境/版/相関IDを揃え、発生順・正常時との差・影響を整理する。観測事実、仮説、反証、結論と対応案を分けた報告を作る | ログ箇所と時刻へ主張を対応付け、別イベントとの照合で仮説を反証する。既存情報で確定できなければ確度と必要最小限の追加証拠を示す | 今回はログ未提供で原因を断定できない。「昨日」の期間/時刻帯、欠落ログ、直前変更は未決。根拠ある結論または絞り込んだ追加証拠の依頼で停止。修正、再実行、restart、DDL、権限変更は行わない。機密情報は証拠記録前に除く |

指標・具体的検算・文書単位splitなどは、私が入力に適用した設計判断であり、スキルに同じ具体例が書かれているという主張ではない。

## 読んだスキル・標準の根拠

- `harness/skills/orchestrate-work/SKILL.md`: 明示意図がkeywordより優先。助言はread-only。stage名は全後続工程の実行指示ではない。Apps hostingはUIを意味しない。
- `harness/skills/define-work/SKILL.md`: API-onlyにはUI gate不要。定義だけの依頼中は実装しない。今回のsliceを左右する未決を明示する。
- `harness/skills/investigate-work/SKILL.md`: 読取専用の観測を優先し、修正依頼がなければ修正しない。事実・仮説・試験・結論を分離する。
- `docs/harness/operations/OPERATING_MODEL.md` 19行目および34〜45行目: 必要十分な成果と終了条件を対象別に選ぶ。API契約、分析、モデル/prompt比較、障害原因調査の停止点を区別する。
- `docs/harness/operations/DOCUMENTATION_STANDARD.md`: HTTPはOpenAPIを正本とし、未確定/仮定/適用外を区別。帳票数を品質指標にしない。
- `docs/harness/operations/DELIVERY_ASSURANCE.md`: 未実行を成功にしない。設計診断は実行済み結果を要求せず、診断だけでは受入にならない。
- `docs/harness/operations/PLATFORM_PLAYBOOK.md`: workload分類は承認ではない。ローカルfixtureと実環境検証を区別する。
- `vendor/databricks-skills/databricks-apps/SKILL.md` と `references/platform-guide.md`、必須親 `databricks-core/SKILL.md`: Appsの接続/権限/公開は後段の境界。今回はCLI認証やresource操作へ適用しない。
- `vendor/databricks-skills/databricks-model-serving/SKILL.md`: endpoint管理と評価は別技能。実在model/endpointを未確認のまま固定しない。
- `vendor/databricks-skills/databricks-mlflow-evaluation/SKILL.md` と `references/user-journeys.md` Journey 0: コードや評価実行の前に対象・指標・dataset・成功基準を揃える。後続の最適化/昇格手順は今回の許可に含まれない。

## ローカルCLIで実際に観測したこと

`npm run harness:context` と4入力それぞれの `harness:route` / `workload resolve` を実行した。

| 入力 | raw route / workload | 明示意図による扱い |
|---|---|---|
| A | release / api | `--intent define` でdefineへ修正できた |
| B | define / analysis | `--intent investigate` でinvestigateへ修正できた |
| C | define / unknown | `--workload model-serving` で明示選択できた。評価技能は依頼内容から別途読んだ |
| D | incident / unknown | incidentを採用。ログの発生元未判明なのでworkloadを憶測で補完しない |

すべて `executionAuthorized:false`。これらのCLI成功は分類機構の観測であり、API/分析/評価/障害対応の受入証拠ではない。

## 全工程の無条件適用について

上記回答は4件へ一律のUIモック、本実装、全量品質契約、実環境試験、配備を要求していない。A/Cは設計資料、Bは分析報告、Dは原因調査報告が利用者の成果。必要な追跡記録は既存文書に小さく残し、段階完了と製品完成を分ける。

残る運用上の注意は、A/Bのraw routeが現在の目的と一致せず、Cには評価の自動workload経路がないこと。スキルの明示意図優先を実際に適用する必要がある。AGENTSの一律に見える帳票記述や上流技能の後続実装手順だけを読むと過剰工程へ進む余地はあるが、orchestrate-workとOperating modelには範囲を限定する根拠がある。

通常execは `helper_unknown_error` で開始できず、read-only `require_escalated` で読み取り/ローカルCLIを実行した。実サービス試験は行っていない。

## 再現性の補足: 実際に渡したpromptとoverride

2026-09-16追記。上の「入力ごとの私の判断」表の入力欄は説明用の要約であり、CLIへ渡したpromptそのものではない。特にAの実入力には「公開したい」が含まれる。表の要約を再入力した結果を、下記の元観測と同一入力の再現結果として扱わない。

以下はこのcontextに保持されたtool入力とtool結果から転記した元観測である。この追記のためにroute/workloadコマンドを再実行しておらず、新観測への置換はしていない。実行時の作業ディレクトリはすべて `D:\projects\databricks-dev-harness`、shellはPowerShell。各A〜Dは独立したexecで、同じexec内のrouteとworkloadは以下の順で連続実行した。

### Aの元コマンド

```powershell
npm run harness:route -- --prompt "Databricks Appsで受注APIを公開したい。今はインターフェース定義だけを作ってください。認証方式と利用者は未定です。"; npm run harness -- workload resolve --prompt "Databricks Appsで受注APIを公開したい。今はインターフェース定義だけを作ってください。認証方式と利用者は未定です。"
```

### Bの元コマンド

```powershell
npm run harness:route -- --prompt "手元の合成CSVの売上傾向を分析して、根拠付きの報告だけほしい。"; npm run harness -- workload resolve --prompt "手元の合成CSVの売上傾向を分析して、根拠付きの報告だけほしい。"
```

### Cの元コマンド

```powershell
npm run harness:route -- --prompt "画像/PDFテキスト化を複数のServing LLMで比較し、モデルごとのpromptも改善したい。まず比較実験の設計を。データ利用許可、実行予算、judgeは未確定。"; npm run harness -- workload resolve --prompt "画像/PDFテキスト化を複数のServing LLMで比較し、モデルごとのpromptも改善したい。まず比較実験の設計を。データ利用許可、実行予算、judgeは未確定。"
```

### Dの元コマンド

```powershell
npm run harness:route -- --prompt "本番の昨日の失敗ログを渡すので原因を調べて。直す作業はまだしないで。"; npm run harness -- workload resolve --prompt "本番の昨日の失敗ログを渡すので原因を調べて。直す作業はまだしないで。"
```

### 元結果の判定フィールド

完全JSONの再掲ではなく、当該tool結果に含まれる分類フィールドの転記。

| 入力 / tool結果chunk | route | skill | firstGate | reason | route.workloads | resolve.selectedIds / unknown |
|---|---|---|---|---|---|---|
| A / `d569ae` | release | release-work | production-deploy | keyword-hint | `["api"]` | `["api"]` / false |
| B / `760cbc` | define | define-work | product-intent | keyword-hint | `["analysis"]` | `["analysis"]` / false |
| C / `15d268` | define | define-work | product-intent | discussion-first | `[]` | `[]` / true |
| D / `c3ffeb` | incident | investigate-work | none | keyword-hint | `[]` | `[]` / true |

4つのexecはすべてexit_code=0。routeとresolveはいずれも `executionAuthorized:false`。各resolveは `mode:"heuristic-hints"`、`needsDiscussion:true`、`excluded:[]`、`catalogVerifiedAt:"2026-09-08"`、`catalogHash:"e244ffcee352dbfb9b973afcce774fc5b055131a02f7435ca1cd0be96c18983f"` を返した。

### 実行したoverrideコマンドと元結果

次の3コマンドは、同一execでこの順に実行した（元tool結果chunk: `b5e86b`、exit_code=0）。ここでは元の長いpromptをそのまま再利用せず、当時のtool入力にある下記の要約promptへ変更している。したがって「同一promptへflagだけを追加した比較実験」とは主張しない。

```powershell
npm run harness:route -- --intent define --prompt '受注APIのインターフェース定義のみ'; npm run harness:route -- --intent investigate --prompt '合成CSVの売上分析と報告のみ'; npm run harness -- workload resolve --prompt '複数のServing LLMによる画像/PDFテキスト化比較の実験設計' --workload model-serving
```

| 対象 | 元結果の判定フィールド |
|---|---|
| Aの意図指定 | `route:"define"`、`skill:"define-work"`、`firstGate:"product-intent"`、`reason:"explicit-intent"`、`workloads:["api"]`、`executionAuthorized:false` |
| Bの意図指定 | `route:"investigate"`、`skill:"investigate-work"`、`firstGate:"none"`、`reason:"explicit-intent"`、`workloads:["analysis"]`、`executionAuthorized:false` |
| Cのworkload指定 | `mode:"explicit-selection"`、`selectedIds:["model-serving"]`、`excluded:[]`、`unknown:false`、`needsDiscussion:true`、`executionAuthorized:false`。catalogVerifiedAt/catalogHashは元resolveと同じ |

Dのoverrideコマンドは実行していない。今回追記した内容は、誤分類ヒントを実行許可として扱わず明示意図を採用した補助試行の再現用記録であり、製品実装や実サービスの成功を示すものではない。
