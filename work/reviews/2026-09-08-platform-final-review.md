# 0.4.0 local candidate — 独立最終コード・運用レビュー

レビュー日: 2026-09-08 JST

対象: `D:/projects/databricks-dev-harness` のローカル候補。公開承認、実機完成認定、比較上の「世界最高」認定ではない。

## 結論

指定された重点コード、運用文書、8 個の受入基準を確認し、今回再現できる追加の blocking finding はありません。最新の英語 dashboard/charts/forms 複合分類修正も含む隔離 snapshot で workloads/hooks 123 件が全 pass、生成した API HTTP 契約 2 件が全 pass、harness conformance が pass しました。旧 0.3.2 payload は manifest の 995 files すべてと SHA-256 が一致しました。

これはローカルの契約・安全な生成経路・文書整合性の評価です。実際の Claude/Copilot ホストにおける hook 発火、OAuth、実 Lakebase の永続冪等性、Databricks 各機能、実 model 比較、公開 release の承認は未検証です。これらの完成を表す主張には不足する証拠がありますが、今回の明示された local-candidate scope では欠陥扱いしません。

## 方法・変更禁止の遵守

- AGENTS.md、orchestrate-work、define-work、build-work、review-work、および関連 standards/operations/official skills の適用範囲を読み、`npm run harness:context` と関連 active session を確認しました。review-work に従い実装は変更せず、受入基準と観測証拠を対応付けました。
- source に対しては読み取りのみ。Git 操作、認証、実 Databricks 接続、外部書き込み、有料 model 呼び出しは行っていません。
- 既存テストと同様に TEMP へ source をコピーし、`.git`、`.harness`、`node_modules`、`work` を除外しました。子プロセスから DATABRICKS_*/MLFLOW_*/HARNESS_LOOP_ID/HARNESS_SESSION_ID を除去。生成・session・fixture の書き込み先は TEMP のみです。
- hook 試験に現れる destructive/deploy コマンドは hook へ渡す文字列であり、その Git/Databricks コマンドを実行していません。
- source focus files の hash は検証後も snapshot と一致しました。全 source の不変性を hash したという主張ではありません。

## 今回の新しい snapshot と再現手順

Runner:

`C:/Users/nimao/AppData/Local/Temp/harness-final-review-f84c22d05c894927a09eafdb929d73a5/check.mjs`

今回保存した snapshot:

`C:/Users/nimao/AppData/Local/Temp/harness-final-review-f84c22d05c894927a09eafdb929d73a5/project-gTaZsE`

実行環境は Windows、Node v24.15.0、package version 0.4.0。Runner は再実行ごとに別の TEMP snapshot を作成します。

```powershell
node C:/Users/nimao/AppData/Local/Temp/harness-final-review-f84c22d05c894927a09eafdb929d73a5/check.mjs
```

Runner が snapshot の cwd で実行した実コマンド:

```text
node --test tests/workloads.test.mjs tests/hooks.test.mjs
node tools/harness.mjs check
node tools/harness.mjs route --prompt "Databricks Apps上で、社内の別システムが呼べる受注更新REST APIを作りたい。UIは不要。Lakebaseに登録し、重複リクエストに安全に対応したい。VS CodeのClaude CodeかCopilotで要件から開発したい。"
node tools/harness.mjs intake create --name final-api-review --title "受注API独立最終検証" --summary "上と同じ全文" --workload api --workload lakebase
node tools/harness.mjs scaffold plan --kind api --name final-api-review
node tools/harness.mjs scaffold apply --plan work/scaffolds/20260907-232948-761-api-final-api-review-86786089.json --yes
node --test tests/fixtures/api/final-api-review/contract.test.mjs
```

`--summary` は上記 runner では省略せず同じ自然言語全文を実際に渡しています。scaffold plan のファイル名は生成ごとに変わるので、再実行時は返された `plan` を使用します。intake の explicit workload 指定は利用者のスコープ確認を反映したものです。route の自動分類は explicit 指定なしで先に検証しています。

観測した実出力の要約（すべて exit code 0）:

```text
critical-independent-regression:
# tests 123
# pass 123
# fail 0
# skipped 0
# duration_ms 13441.2797

api-route: define / reason discussion-first
selectedIds: ["api", "lakebase"]
executionAuthorized: false

api-intake id: 20260907-232948-681-final-api-review
session: 20260907-232948-681-final-api-review-delivery

api-scaffold-plan: ready; missing []; commands []; deployReady false
api-scaffold-apply: generated 6 fixture-only files under tests/fixtures/api/final-api-review

new-generated-api-contract:
# tests 2
# pass 2
# fail 0
# skipped 0
# duration_ms 145.4512

immutable-0.3.2-payload: checkedFiles 995, mismatches []
source-still-matches-reviewed-snapshot: true
```

生成 plan の実内容は status `blocked-on-intent` で、最初に material questions 解決・product intent 承認、2 番目は次の文言です。UI 不要の API に無条件の UI mock 承認は要求していません。

> Review the API/analysis or other selected workload contract with executable fixtures where applicable; no UI mock gate unless a UI is added to scope.

scaffold はこの段階でもローカル契約 fixture を作れるだけで、product backend、resource provisioning、実データ接続、deploy を行いません。これは product-intent gate の迂回による実装承認ではありません。

## 重点コード・意味的レビュー

### workload / intake

`tools/lib/workloads.mjs` と `harness/workloads.json` は 16 分類の validation、正例、複合分類、explicit selection/exclusion、不明 intent の discussion を持ち、分類を execution authorization にしていません。最後の英語変更では rich-app hints と API の UI 抑制解除条件の双方に dashboard/charts/forms を入れ、`Build a REST API and dashboard with charts` が API と rich-app の両方を保持する回帰が実行されました。UI 不要 API は ui=false、Lakebase が残り、generic agent と Genie、model registration と Delta write は切り分けられています。

`tools/lib/intake.mjs` の API/Lakebase 質問は、呼び出し元/認証、endpoint/status/error、冪等性、DB resource/transaction/競合を具体化する入口として適切です。要件/設計/plan は draft であり、受注の項目、更新か upsert か、tenant/操作単位のキー、409 方針、保持期間、業務監査、実行 resource 等を勝手に決定していません。質問回答と受入基準の個別化は利用者との要件定義に残ります。一般的な AC-01/02 テンプレートを、そのまま製品として十分な受入基準と扱ってはいけません。

分類は regex による hints です。任意の自然言語を完全に意味理解する保証はなく、explicit workload と discussion-first の確認が必要です。これは文書の境界と一致しており、今回の正例・API 主経路では再現性のある欠陥を見つけていません。

### API / analysis starters

`tools/lib/starters.mjs` は出力を `tests/fixtures` へ限定し、template hash を plan に結び、stale input、overwrite、誤った適用を拒否します。既存 workloads tests で API/analysis の両方の生成と実行・否定例を再実行しました。これは他の全 platform workload に generator があるという意味ではありません。

API fixture の新しい `new-concurrent-key` に対する 24 同時送信は、既存キーの replay だけを再送する弱い試験ではなく、初回キーの競合を回帰対象にしています（`harness/templates/starters/api/contract.test.mjs:24`）。同一結果の返却と更新 revision を確認しました。

ただし Map と単一 Node process の fixture であり、literal mock auth、1000 receipt 上限、restart で消失、tenant authorization/expiry/durable transaction/rate control 未実装です。競合試験が pass しても Lakebase の別接続・複数 replica・commit failure・restart 後の重複安全性を証明しません。README と PLATFORM_PLAYBOOK はこれを明示しています。Lakebase 本実装で業務更新と一意キー/fingerprint/response を同一 transaction にし、競合/retry/permission を実 DB で試す方針は妥当です。

analysis の実行は synthetic data と SQLite/標準 Python の契約で、Spark/Databricks SQL/Databricks Connect や実 notebook UI の認定ではありません。

### provider hook / operations

`tools/agent-hook.mjs` は CLI と hookSpecificOutput の同義 output、snake_case/camelCase payload、複数 file edits、malformed input の拒否、protected controls、bounded loop stop、metadata の限定を扱い、safe path で自動 allow を返しません。重点否定回帰は 123 件の中で再実行しました。

公式の [VS Code hooks](https://code.visualstudio.com/docs/agent-customization/hooks)、[GitHub hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)、[Claude hooks](https://code.claude.com/docs/en/hooks) を別途読みました。VS Code の preview/organization 制御、複数形式の発見、matcher が現状無視される点、Copilot command preToolUse timeout の通常 permission flow への復帰、Claude の event envelope を文書と照合しました。実装の共通境界検査と surface 別の診断案はこれらと矛盾しません。

hook の regex は shell interpreter の完全な代替ではありません。equal-privilege process と OS/network の安全性まで保証しないという PROVIDER_COMPATIBILITY の説明は正確な境界です。実ホストで各 event が呼ばれる証拠は process test と別に必要です。Copilot CLI が未インストールでも VS Code extension の可否とは別である点、案件 root cwd の想定も明示されています。

## 8 AC 別の到達点と残証拠

| AC | ローカルで観測・レビューした到達点 | 未検証・次段階の証拠 |
| --- | --- | --- |
| PLATFORM-01 | 日付付き audit、一次 source links、upstream/local/preview/account availability の区別をレビュー。provider hook の公式 source は本レビュアーも独立照合。モデル一覧に性能実証の主張なし。 | すべての tool/model release を本レビューで再取得したわけではない。実アカウントの model picker/entitlement と継続的 freshness は未確認。 |
| PLATFORM-02 | 16 分類、英語複合 API/UI、read-only route、explicit selection、unknown/no authorization をコードと再実行で確認。 | 無制限の自然言語に対する網羅保証なし。各新 workload の実案件 validation は後続。 |
| PLATFORM-03 | 元の日本語 API-only 依頼で define/api/lakebase。intake の focused questions、ui=false、draft/blocked-on-intent、UI 不要 plan 文言を実 artifact で確認。 | 受注固有の要件/設計の human approval は未実施。質問から全仕様を自動確定するものではない。 |
| PLATFORM-04 | API/analysis の offline starter、hash binding、isolation/overwrite 拒否を既存 test で再実行。新生成 API HTTP 2/2 と fresh-key 24 concurrent を確認。生成/runtime coverage の区別を文書確認。 | 実 Apps endpoint/auth/CAN USE、Lakebase transaction、Spark/SQL/Connect、その他 workload の実機未実施。API fixture は製品 backend 完成ではない。 |
| PLATFORM-05 | 最新 hook 文書との静的整合、dual adapter/payload/否定回帰、repository check を独立確認。 | Claude/Copilot 実 host/extension での event 発火、設定重複、timeout、安全な deny の E2E は未実施。 |
| PLATFORM-06 | upstream/local/pin、staged update、global/auth を変更しない方針、legal metadata/immutable release 境界をレビュー。旧 0.3.2 の 995 hashes を独立に全件再計算。 | 公式 CLI/manifest の取得/installer checksum 実験は実装者 evidence のレビューであり、この回では再ダウンロードしない。candidate sealing/update の実行・公開承認は本レビュー外。 |
| PLATFORM-07 | 独立 narrow regression 123/123、conformance pass、自然言語 forward flow、生成 HTTP 2/2。前段の独立 counterexample probes あり。追加変更で evaluator/budget/human gate を緩めた事実は重点範囲で見当たらない。 | 全回帰 324/323 pass/0 fail/1 skip は親の実行報告（本 reviewer の再実行数と混同しない）。最後の英語追加 test 後の最終 full-suite count を正式 evidence へ確定する必要あり。66 actual model trials、3 OS/clean-machine、live 未実施。 |
| PLATFORM-08 | 日本語 playbook、API と UI の分離、Free Edition の非認定、user が選ぶ OAuth/profile と synthetic pilot、source/product の分離、0.4.0 local version、旧 payload 保持を確認。 | OAuth は指示例のみで実行していない。資源/費用/permission/product intent の人間の承認、代表 pilot、候補 sealing/publication は後続。 |

## 残存事項（local candidate の blocking defect ではない）

1. 公開・本番・実ホスト対応の主張をする前に、両 provider の実 event 発火、最小 OAuth と承認済み dev pilot、全 live integration の証拠が必要です。
2. 0.4.0 の封印は本レビュー対象 snapshot と最終 managed bytes を確定してから実施する別操作です。本レビューではまだその release payload の独立検証も公開承認も行っていません。
3. 最終 evidence に最終 full regression の正確な count/revision を残してください。英語分類追加前の 324 件という親報告と、今回の独立 focused 123 件は別の母集団です。Windows symlink privilege skip を成功へ読み替えないでください。
4. 商品受注 API の業務仕様/authorization/永続冪等性は依然未実装です。fixture を deploy 元に流用せず、要件確定後に official Apps runtime/Lakebase の最小 vertical slice を作る必要があります。

## 前段 forward-test との区別

- 改善前の独立 API forward-test は TEMP `harness-api-forward-6b70d27e99304231b8c4f2e6b3c5cf61/project`。no-UI なのに UI 質問へ進む、短い API 依頼が mock-ui、kind api 非対応などを検出した段階です。現在の失敗として再掲していません。
- 改善後の独立 API forward-test report は `C:/Users/nimao/AppData/Local/Temp/harness-api-retest-4280cd2540aa48c8abddd7ada1cd5a0f/independent-review.md`。20 CLI 操作、HTTP の初回 24 並行/replay/conflict/validation、別 process restart による expected memory loss、yes/overwrite/human gate/fixture deployment 拒否を確認しました。API-only plan 文言と fresh-key concurrency の回帰化を nonblocking 提案しました。
- 今回は、その提案が current source に入ったことを新 snapshot で再確認し、指定された重点コード・運用文書・8 AC 全体へ静的レビューを広げました。以前の extra semantic probe の全コードを最新 snapshot で再実行したという主張ではありません。最新の生成 test と workloads/hooks regression を再実行した範囲は上記の通りです。

## Snapshot SHA-256

```text
tools/lib/workloads.mjs 0b7421272fa7fba004d7983f85e210b8984e54fd8956e1b0f3d5d570076d7429
tools/lib/intake.mjs 1881247db860fdc79548ab4171fe5beafbee86962533939782d8a667e7539392
tools/lib/starters.mjs e98f29094e8bc8c12ed4045a528d4afff8219aae32873d7a699076553b39d852
tools/agent-hook.mjs 79a09a4cbc078abb0b1ecc4b10d10b14ce8f2afee3aef96d53156c966897b373
harness/templates/starters/api/contract.test.mjs 5a7ea055b14114a9a7f3ffc546512f334862a9f578b261ab7e11bf9c22ec83f3
docs/harness/operations/PLATFORM_PLAYBOOK.md 4938d241311a161d588896de87a53c515c0cf59dde57f3eeef4bafd6d4bb1673
docs/harness/operations/PROVIDER_COMPATIBILITY.md 9fe4165d12fc5e9210f3f47ec75a06a7ef3868e9e24a6f051604d0e04baaab0c
harness/workloads.json 0f17fe0910a5db5baaa3ffec0e239a0366da47434fb6aa8c94a06dad43d92dd0
harness.config.json 320885177cf71e65be7ac2845d5ad392a27ffe84c73bc2b53449020c0cdb48e3
```

最終判定: 指定された read-only / isolated-local review の範囲では追加 blocking finding なし。残る live/host/model/release approval は未検証と明示したまま引き渡します。
