# 商品・売上画面の独立した配置試行

- ID: purpose-forward
- 作成者: Codex 補助コンテキスト /purpose_forward_trial
- 種別: 隔離したスキルforward試行。製品承認、Claude Code/Copilot評価ではない。
- 作業場所: `.harness/runtime/purpose-forward/` のみ。
- route: `mock-ui`（router.jsonを読み取り。画面・グラフ・設計という依頼意図に一致）。
- 許可: 要件対象とfixture設計、既存installed依存の読取、ローカル描画。
- 今の判断: 一覧配置の合意を受け、残る売上入力・日々のグラフの配置と主要な動きを利用者が選べること。
- 必要十分な成果: [要件・設計](design.md)、実AppKit一覧、実描画の画像、表示阻害エラーと外部通信の観測。
- 今は行わない: 保存、DB/API、認証、税計算、数量/売上金額の業務ルールの推測実装、全状態・全操作試験、正式UI契約・承認。
- 終了条件: 残る2画面を提示し、配置/動き/未決のfeedback待ちで止まる。部分のfeedbackはui-mock gateを解除しない。
- 再検討条件: 一覧の列・分類の意味や利用者feedbackが配置を変える場合。
- 制約による代替: npm scripts禁止のためharness:context/route/session/task CLIは実行せず、AGENTS/skill/router/標準および既存sessionファイル名を読取。実案件session・研究報告は再利用せず、この隔離sessionを正本とする。
- 現在: 第3段階を提示できる状態で停止。商品一覧の配置は利用者が合意、売上入力とグラフは実描画・主要な局所動作を自己確認し、利用者確認待ち。背景での継続作業は行わない。
- 次: 利用者の売上入力/グラフの配置feedbackと、数量ルール・draft保持・期間案の回答を受け、同じ部品を更新する。正式mockの全状態/独立確認はその後の別工程。
- 証拠: [第3段階記録](evidence-stage3.md)、[第3段階JSON](render-evidence-step3.json)、stage3-*画像。第2段階JSONは保持。第2段階の2画像は第3段階で上書きしてしまったため当時証拠には不採用（詳細は第3段階記録）。全3画面の設計完了や正式ui-mock承認ではない。

## タスク

| ID | 対象 | 状態 | 終了条件 |
|---|---|---|---|
| PF-01 | 3画面の対象・項目・関連を記録 | 記録済み | 全画面とデータの意味、未決を追跡できる |
| PF-02 | 商品一覧の配置案 | 利用者による配置合意のみ | 正式mock承認とは区別して維持する |
| PF-03 | 売上入力と日々の売上グラフ | 描画/局所動作の自己確認済み・利用者確認待ち | 2画面の案と未決を提示して止まる |

## 実行環境

AppKit UI 0.72.0、既存React/Vite/Tailwindをread-onlyで利用。実部品のAPIとtheme資料をinstalled package内で確認した。公式初期化・新規依存install・外部hosting・Databricks操作はしない。試行のローカルpreviewは製品のDatabricks Apps hosting選択を変更しない。

## 2回目のcheckpoint

2026-09-16。追加依頼は「商品分類の絞り込みを一覧の上へ」「商品分類、商品名、税込単価の列順」。同じApp.tsx/styles.cssに実AppKit Select/Labelと小さな内部stateを追加。installed docsでAPI確認済み。全6件→ギフト1件→全6件、列順、filter位置、表示エラー0/外部要求0を観測。利用者へは変更画面を返す。この入力の範囲を終え、残り2画面やbackendは先行しない。

隔離条件の追加確認: installed Vite実装で既存envFile:falseも有効だったと確認。envDir:falseへ明示的に整理、envPrefix:[]と解決後assertを追加。隔離rootに.env*は0件、実案件.env未アクセス。変更画面のbuild成功。これは既存無効化の不具合とは記録しない。

## 第3段階の引継ぎcheckpoint

2026-09-16。利用者の「この配置でよい」は商品一覧の配置合意のみ。指示された残2画面を同じAppへ追加。売上入力の空欄→入力→確認dialog→戻る、画面往復でdraft保持、グラフ7/14日と数値表の切替を観測。page errors 0、external requests 0。正式mock承認なし。

- 未描画の画面: なし。未描画/未確認の状態: loading/empty/error/partial/denied、売上0/欠測、数量エラー、保存成功/失敗/競合、narrow、keyboard全経路。
- 未実装: 永続化、auth、API/DB、税計算、売上金額の業務計算・集計、権限・実環境接続。
- 人の確認待ち: UI-02/UI-03の配置/動き、Q-01数量の単位・整数/小数/範囲、Q-02入力保持、Q-03表示期間。Q-04〜06は本実装前。
- 次に可能な作業: feedbackへの同じ部品の修正、数量等の定義更新。新contextはdesign.mdとevidence-stage3.mdおよび第3段階画像/JSONを読めば再開点を確認できる。
- 証拠限界: stage1/2 source snapshot未取得。stage2の一覧画像2枚をstage3の現在画像で上書きしたため、stage2はJSONと記録の範囲のみ。再現して当時証拠とはしない。現在の画像名はstage3-*で明示。
- 停止: 新しい指示を待つ。正式全状態や追加機能は続けない。
