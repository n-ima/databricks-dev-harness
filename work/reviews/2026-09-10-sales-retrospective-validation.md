---
title: Sales management retrospective — current harness validation
date: 2026-09-10
status: assessed
scope: read-only-implementation-comparison
session: 20260909-210805-919-sales-retrospective-current-harness-validation
independent_review: not-performed-for-this-assessment
implementation_changes: none
---

# 個別アプリの振り返りと現行ハーネスの照合

## 結論

8件とも対象とする問題は妥当。ただし、既存の安全策・最近のタスク可視化改善と重複する部分があり、提案をそのまま8機能として追加する判断はしない。現行実装では5件が一部反映、3件は提案の具体的な問題が未解決または対応未移植。どの項目も、提案全体の受入条件を満たしたとは判定できない。

最優先はHIMP-01。案件で起きた「完了できない」だけでなく、現行コードで「未対応形式の受入条件を見落としたまま完了できる」反例を再現した。次にHIMP-02の検証結果と配備対象を結び付ける実行制御が必要。タスク一覧を再実装することや、案件固有のAppKit対策を無条件に共通化することは不要。

今回は検証用スクリプト・ログ・比較記録・本報告・セッションだけを作成。ハーネスの実装、既存テスト、案件側ファイル、実DB、Databricksリソースは変更していない。修正、配布、pushの完了報告ではない。

## 比較の基準と限界

- 入力: [案件の振り返り](D:/projects/product-sales-management/docs/harness/research/2026-09-10-sales-management-retrospective.md)。提案は検証材料であり、実装・外部操作への承認とは扱わない。
- ハーネス: Git HEAD `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7` **と現在の未コミット差分**。設定は0.4.0 / L1。
- 案件: Git HEAD `06f5f3928bd51e68451908672053aba75e5977a5` 時点のローカルファイル。設定は同じ0.4.0だが、同一実装ではない。
- [ファイル比較](../evidence/retrospective-validation/source-comparison.json)では、現行の `session-state.mjs`、`tasks.mjs`、`work-state.mjs` は案件側に存在しない。一方、`evidence.mjs`、`approval.mjs`、`scaffold.mjs`、`intake.mjs`、`loop.mjs`、対象の既存テストは両者で同じハッシュ。
- したがって「最近ハーネスを改善したから案件の問題もすべて解決済み」「どちらも0.4.0だから同じ」はどちらも誤り。現在の差分は、この検証では案件へ更新していない。
- 直前の3件修正・再レビュー対象17ファイルは、その後変更されていない。前回の独立レビューはその変更範囲の証拠であり、本比較やハーネス全体の合格証拠には流用しない。
- 案件の実稼働記録は過去の観測証拠として読む。現在のURL到達性、稼働状態、DB内容、認証をこの検証で再確認したわけではない。
- 新しいAppKit/Databricks版を外部調査・実行した評価ではない。バージョン依存の事象は案件で使った0.72.0の記録と現行既定0.69.1を区別する。
- 親エージェントによる再現・コード照合であり、この比較への新しい独立レビューは未実施。実装変更や正式な完了承認は行っていない。

## 8件の判定

| ID | 現行判定 | 既にあるもの／並行改善で反映したもの | 残る差分と扱い |
| --- | --- | --- | --- |
| HIMP-01 | 未解決・反例再現 | accepted要件、レビューのID重複拒否、証拠ハッシュ、完了receipt検証 | 要件IDの共通文法・要件側重複拒否・不明形式の明示拒否がない。混在時の検証漏れも修正対象。 |
| HIMP-02 | 一部反映 | release手順、provider/check失敗記録、完了制限、危険配備を拒否するhook、scaffold検証失敗時の停止 | 検証成功した同一候補だけをdeploy/start/healthへ進める一連の実行制御はない。 |
| HIMP-03 | 一部反映 | session/gateに結び付いた承認記録、根拠・成果物ハッシュ、pending gate制限 | 環境・App・DB・主体・権限・費用などの承認範囲の機械照合と引継ぎモデルは未実装。 |
| HIMP-04 | 一部反映・タスク層は改善済み | タスクMD、sessionとの接続、status/current/next/blocker、再開・履歴保全、確認済みの3件修正 | 製品の稼働URL・環境・deployment ID・観測時刻・証拠確定状態の統合は別機能として残る。 |
| HIMP-05 | 一部反映・方針は既存 | mock先行、最小の縦断実装、明示的dev検証という設計と手順 | モック・権限承認後、早期にログイン→保存→再読込と認証拒否を確認する必須工程・証拠がない。 |
| HIMP-06 | 具体対策は未移植・版の前提が異なる | AppKit標準、版固定、生成時検証、frontend標準 | 0.72.0案件でのWindows/build/install/identity/host/theme対策を、0.69.1既定へそのまま移せない。対応版ごとの試験が先。 |
| HIMP-07 | 一部反映・レビュー運用は改善済み | review/requirement/evidenceのハッシュ固定、今回以前の独立レビュー範囲固定と再レビュー、harness配布manifest | アプリ配備候補と実行入力・配備ID・観測・レビュー対象の対応は共通モデル化されていない。harness配布manifestとは別。 |
| HIMP-08 | 具体的な問題は未解決 | 上書き拒否、パス境界、再初期化時の改名拒否、生成失敗記録 | freshテストの案件設定混入を再現。CLIが入れ子生成する場合の実ルート識別もない。安全な拒否を緩めず直す。 |

「一部反映」は完全解決の意味ではない。逆に「未解決」は関連する安全策や設計を全く持たないという意味でもない。

## 個別の検証と採否

### HIMP-01 — 受入条件IDと完了判定（最優先）

根拠: [evidence.mjs](../../tools/lib/evidence.mjs) の `acceptanceIds`、`sealEvidence`、`validateReceipt` と [intake.mjs](../../tools/lib/intake.mjs) の承認処理。

現行の抽出文法は `[A-Z]+-\d+`。案件でacceptedになっている `AC-D01`〜`AC-D05` は0件として扱われる。レビューには5件が記載されているため、案件でのseal失敗を説明できる。同じ処理が現行ハーネスにも残っている。

隔離fixtureでは次を確認した。案件の要件を書き換えたり、実セッションを完了させたりはしていない。

| fixture | 現行の結果 | 判定 |
| --- | --- | --- |
| 正常なAC-01のみ | seal成功、session close成功 | 正常系 |
| AC-D01のみ | 「全条件をレビューせよ」というエラー、未完了 | 未対応形式の診断が不適切 |
| AC-01とAC-D01、レビューはAC-01だけ | seal成功、session close成功 | 未検証条件が脱落したまま完了できる |
| 要件に異なる内容のAC-01が2件、レビューは1件 | seal成功、session close成功 | 要件側重複がdedupeされ、検証対象の欠落を検出できない |

採用すべき差分は、要件生成・承認・レビュー・receipt検証が共有する構造化された抽出／検証と、不正・0件・重複・不足の明確な診断。単に正規表現の許容範囲を広げるだけでは足りない。既存のaccepted要件を都合よく改名しない。review側の既存重複拒否は保持する。

受入の目安: 上記不正fixtureがすべてfail-closed、AC-D01形式の正当な全件レビューは成功、要件変更後の古いreceiptは無効、既存形式は互換。verifier変更なので、実装者自身の判断だけで昇格・承認しない。

### HIMP-02 — 検証失敗後の配備停止

根拠: [release-work](../../harness/skills/release-work/SKILL.md)、[loop.mjs](../../tools/lib/loop.mjs)、[agent-hook.mjs](../../tools/agent-hook.mjs)、[scaffold.mjs](../../tools/lib/scaffold.mjs)。

既存hookはApp配備などの危険操作を拒否し、loopも失敗を記録して完了を制限する。scaffoldも検証失敗を成功扱いせず、`deployReady: false` を保つ。この基盤を「何もない」と評価してはいけない。

一方、loopはprovider実行の後にchecksを実行するため、providerが先に行った副作用を取り消せない。dev Bundle配備の例外も、直前のテスト結果やコードハッシュを照合するものではない。文字列 `npm run tests-that-fail; databricks bundle deploy -t dev --profile DEV` をhookの入力として調べたところ、Claude/Copilotともdenyは返さなかった。**文字列を実行したのではなく、配備呼出しは0回。denyがないことを操作の承認と解釈しない。**

採用すべき差分: 検証→候補確定→deploy→非同期終端確認→start→healthの順序と、同じコード・cwd・環境・承認を共有する実行記録。失敗、タイムアウト、中断、候補変更なら下流呼出し0回になるfake runner試験が必要。任意の直接CLI実行まで完全に封じられると主張せず、資格情報・外部実行権限の境界も明記する。

### HIMP-03 — 承認範囲の引継ぎ

根拠: [approval.mjs](../../tools/lib/approval.mjs)、[loop.mjs](../../tools/lib/loop.mjs)、scaffoldのresources/permissions記録。

承認にはsession、gate、actor、evidence、artifact hashesがあり、記憶頼みではない。ただしactorはローカル記録上の名前で、認証済み人間を証明する仕組みではない。承認対象の環境・App・schema・principal・操作・権限・費用上限を型として保持し、次の操作と照合する処理はない。

採用すべき差分は既存receiptへの範囲モデルと一致判定。根拠ファイルに文章で書けることと、機械的に範囲を検証できることを区別する。同一範囲の有効な承認を再利用する設計は有用だが、UI承認をDB権限変更へ流用したり、別sessionの承認を無条件に使ったりしない。外部承認者のdenyは迂回対象ではない。

受入の目安: 同一対象・操作は記録を引き継げる一方、環境変更、権限拡大、費用増、根拠変更、有効性喪失は新しい人の判断を要求する。

### HIMP-04 — タスクの進捗と製品の稼働状態

根拠: [work-state.mjs](../../tools/lib/work-state.mjs)、[TASK_VISIBILITY.md](../../docs/harness/design/TASK_VISIBILITY.md)、[前回の再レビュー](2026-09-10-task-visibility-re-review.md)。

タスク／sessionのcurrent・next・blockerは並行改修で改善済み。現在のタスク層を置き換えるのではなく、以下を分離して接続するのがよい。

1. 作業状態: 誰のどのタスクが進んでいるか。
2. 製品の観測状態: どの環境のどの配備版を、いつ、どのURLで確認したか。
3. 証拠・承認状態: レビュー、seal、本番承認は何が未完了か。

現行statusの `execution: not observed` は、保存済み進捗から稼働中と誤推測しないための正しい制約。これを単純にrunningへ変更してはいけない。案件の「devでは使えるがseal未完了」という手書きの区別は良い入力例であり、製品状態生成の完成証拠ではない。

受入の目安: 開発環境の最終確認済みURLと未完了の証拠処理を同時に示す。古い観測を現在の正常稼働と表現しない。複数sessionから同じ製品を見る場合も配備対象を取り違えない。

### HIMP-05 — 早期の最小dev縦断確認

根拠: [OPERATING_MODEL.md](../../docs/harness/operations/OPERATING_MODEL.md)、[HARNESS.md](../../docs/harness/requirements/HARNESS.md)、intakeのexecution plan。

「モックを先に確認する」「最小の縦断実装」は既存方針。提案の価値は新しい標語ではなく、早期にdev上の認証・永続化・ビルド・実行環境まで通す終了条件を持つことにある。

採用するなら、モックおよび必要な権限の承認後に、専用dev環境のfixtureデータでログイン→1件保存→再読込、未認証拒否、App主体の必要最小権限を確認し、その証拠を残す。これをUI機能の大量実装より先に配置する。モック確認前に実データへ接続する変更や、production配備の前倒しではない。

### HIMP-06 — AppKitの版別適合

根拠: [toolchain.lock.json](../../harness/toolchain.lock.json)、[FRONTEND.md](../../docs/product/standards/FRONTEND.md)、案件の[package.json](D:/projects/product-sales-management/apps/sales-management/package.json)、[tsdown設定](D:/projects/product-sales-management/apps/sales-management/tsdown.server.config.ts)、[runtime記録](D:/projects/product-sales-management/work/evidence/2026-09-10-dev-runtime.md)。

現行既定はv0.69.1、案件のappkit/appkit-uiは0.72.0。版固定と生成時検証は既存だが、案件の次の具体的な適合対策はハーネスへ共通移植されていない。

- Windowsのローカルモジュールのbundle判定。
- 配備時ビルドに必要な依存関係のインストール契約。
- IdPの主体IDとworkspaceの主体IDの区別、信頼できる認証境界。
- hostの正規化・許可先固定・redirectなどの拒否。
- OSのdark設定と、承認された明るいデザインの整合。

採用は一律コピーではなく、対応するAppKit版／OS／ビルド方式ごとの小さな検証済みadapter・fixture・手順とする。`include=dev`、特定のbundle override、SCIM照合、`class="light"` は案件の選択であり、すべてのアプリに無条件で必要な既定値とは判定できない。vendor/node_modulesを勝手に修正せず、クリーン生成とクリーンインストールから正負両方を検証する。

### HIMP-07 — レビュー候補の固定と終了条件

根拠: [evidence.mjs](../../tools/lib/evidence.mjs)、[distribution.mjs](../../tools/lib/distribution.mjs)、前回の再レビュー、案件の[配備元比較記録](D:/projects/product-sales-management/work/evidence/2026-09-10-dev-runtime-source-comparison.json)。

証拠をハッシュで固定する機構は既存。直近の3件修正でもレビュー対象を固定し、再レビュー後のソース不変を確認した。この部分は運用上反映している。追加の漠然とした「独立レビュー必須」ルールは不要。

残る差分はアプリの配備候補IDに、実行入力、配備元ハッシュ、deployment ID、環境、レビュー、観測結果を束ねるモデル。harness配布manifestはこの役割ではない。案件の30ファイル一致は参照されたworkspaceソースとの比較であり、実行中コンテナの全ファイル一致を証明したものではない。

実行入力／検証専用ファイル／更新可能な進捗を分類すれば、後で追加した検証スクリプトを「配備された」と誤報したり、無関係な進捗更新だけでアプリの全配備試験を繰り返したりするのを防げる。一方、実行入力・認証・配備版・評価範囲の変更には影響に応じた再検証が必要。HIMP-02、04と候補・配備識別子を共有し、別々の真実の台帳を増やさない。

### HIMP-08 — 初期化fixtureと生成ルート

根拠: [harness.test.mjs](../../tests/harness.test.mjs) のfresh-template試験、[scaffold.mjs](../../tools/lib/scaffold.mjs) のAppKit生成、[scaffold-data.test.mjs](../../tests/scaffold-data.test.mjs) のfake CLI。

現行のfresh-template試験は実行元repoをコピーし、除外対象は主に.git/node_modules/.harness。初期化済み案件のproduct.config.jsonまで持ち込み、別名でsetupしようとして、正常な改名拒否に当たる。今回、合成した初期化済みfixtureの中で現行の同じ試験を動かすと、この失敗が再現した。元の設定は不変だった。

また、生成先直下をコンポーネントルートと仮定してvalidateする。案件で記録された入れ子生成をfake CLIで模したところ、実際のpackage.jsonの1階層上をvalidateしてfailedになった。既存fake CLIは直下へ書くため、実CLIの入れ子契約を検証していない。これは条件付きの再現であり、v0.69.1の実CLIも同じ出力をするという検証ではない。

採用すべき差分は、版管理された未初期化fixtureと既存案件fixtureの分離、および想定ルート／実ルートの安全なpreflight。想定外なら具体的な差分で停止する。自動の再帰移動、既存案件の改名、設定削除によってテストを通す対応は採らない。既存の同名再実行・改名拒否テストは維持する。

## 実行した検証

| 検証 | 結果 | 証拠の意味 |
| --- | --- | --- |
| 既存の全回帰テスト | 349件中348成功、0失敗、1skip | 現在のテストが覆う範囲の結果。追加反例がないことの証明ではない。 |
| HIMP-01の実要件読取＋隔離fixture | 不正完了を含む反例を再現 | 仮のreceipt/sessionだけを使用。案件の要件・完了状態は不変。 |
| Claude/Copilotのhook判定 | 検査文字列にdenyなし | policy関数の検査のみ。provider実機・配備・権限の試験ではない。 |
| 入れ子生成のfake CLI | 想定ルートとの差でvalidate失敗 | 実Databricks呼出し0回。実CLI版ごとの生成挙動は別途確認が必要。 |
| 初期化済みfixtureで現行fresh試験 | 改名拒否で失敗、元設定不変 | 安全策は正常、試験入力の分離が不足。 |
| ソース比較 | 前回レビュー対象17ファイル不変 | 本検証で前回の修正実装を変えていない。 |
| 報告後の整合性確認 | harness:check成功、ローカル参照30件すべて存在、比較対象ソース変更0件 | 報告を保存した後にも実装の不変と参照先を確認。 |

実行コマンド:

```text
node work/evidence/retrospective-validation/probes.mjs
node --test --test-reporter=spec --test-reporter-destination=work/evidence/retrospective-validation/regression.log tests/*.test.mjs
```

[追加検証スクリプト](../evidence/retrospective-validation/probes.mjs) / [追加検証ログ](../evidence/retrospective-validation/probes.log) / [全回帰ログ](../evidence/retrospective-validation/regression.log) / [ソース比較](../evidence/retrospective-validation/source-comparison.json)

追加検証スクリプトのexit 0は、反例を含む観測が完了したという意味であり、ハーネスが合格したという意味ではない。temp fixture以外のコードは書き換えず、実際の配備コマンドを起動しない。検証用スクリプト自体は正式な回帰テストへの取り込み前であり、改修時にはred/greenの受入試験として整理する。

## 次の改善順序の提案（未着手）

1. **HIMP-01:** 完了判定の欠落を先に修正。正式verifierの変更なので、人の確認と独立レビューを通す。
2. **HIMP-02 + HIMP-07の候補識別部分:** 同一候補・同一環境・有効な承認での一連の実行を、fake runnerでfail-closedにする。これなしに「失敗後の配備を防げる」としない。
3. **HIMP-08:** 次の新規案件／テンプレート更新前に初期化fixtureと出力ルート契約を修正。元提案はP2だが、既存案件で現行テストが壊れる再現性の問題なので後回しにし過ぎない。
4. **HIMP-03 + HIMP-04 + HIMP-07の状態表示:** 既存承認・タスク・receiptを利用し、承認範囲、配備版、最終観測、証拠確定の区別を統合する。
5. **HIMP-05 + HIMP-06:** 対応版を明示した最小dev経路を設計し、ローカル適合試験後、別途承認されたdev環境でのみ実証する。

これは検討順序であり、新たな実装や実環境アクセスの承認ではない。既存のverifier・承認・セキュリティ制約を弱める変更はしない。
