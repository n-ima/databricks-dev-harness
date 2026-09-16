# 第3段階・残り2画面の配置と動き

日付: 2026-09-16。Codex補助contextの独立forward試行。実案件承認、Claude Code/Copilot評価、正式mock全状態の検証ではない。

## 依頼と停止点

利用者入力: 「この配置でよい。ほかの画面も配置と動きを設計してください。」

商品一覧の配置は合意済みとし、売上入力・日々の売上グラフを同じappに追加した。配置と局所的な動きを提示できるところで停止。人の確認待ちであり、全体設計完了、正式ui-mock承認、backend着手許可へは置き換えない。

## 成果と確認

- `SalesViews.tsx`: AppKit Input/Select/Dialogによる売上入力と内容確認、LineChartのdata modeとTableによる日別グラフと数値表示。
- `App.tsx`: 同じshellで3画面を切り替える。商品分類の選択、売上draft、グラフ期間を親stateで保持する案。
- `fixtures.ts`: 既存6商品に、2026-09-03〜16の日別合成金額14件を追加。入力の数量×単価や業務集計を計算していない。
- `design.md`: 3画面の目的・項目・動作・未決・状態を更新。金額は税込円、税計算なし。
- installed AppKit UI 0.72.0のInput/Select/Dialog文書、LineChart型定義と実装、ChartWrapperのdata/query分岐を読取確認。新しい依存やサービスは追加していない。
- build成功。envDir=false/envPrefix=[]の解決後assert成功。chart追加による500 kB超chunk警告は残るが、今回の配置相談を妨げるエラーではなく、性能最適化はしていない。
- 1440×960で、3画面遷移、商品分類filter、空欄時の確認button無効、2026-09-15/コーヒー/数量2の入力→dialog→戻る、画面往復後のdraft保持を確認。
- chart canvas 1054×340で実系列を描画。7日間の数値表7行、14日間の数値表14行、期間ラベルの変更、数値表の開閉を確認。
- page errors 0、external requests 0、local assets 3。全ページ要求をローカルbuildからfulfillし、他originはabort。永続化、auth、API、DB、Databricks操作なし。
- 観測: [render-evidence-step3.json](render-evidence-step3.json)。実行はNodeからbuild.mjs/verify.mjsを直接呼出す。npm scriptsと実案件.envは使用しない。

## 現段階の採用画像

- [商品一覧](stage3-product-list.png)
- [分類絞り込み](stage3-product-list-filtered.png)
- [売上入力](stage3-sales-entry.png)
- [入力内容の確認](stage3-sales-confirmation.png)
- [日別グラフ・7日間](stage3-daily-sales-7days.png)
- [日別グラフ・14日間](stage3-daily-sales-14days.png)

上記はすべて第3段階の画像。CSS transition途中の薄い表示を写さないよう、Playwright screenshotのanimations:'disabled'で動きを確定して撮影した。入力・dialog・グラフ画像を実際に目視確認し、ラベル/値の重なりや描画欠けは見られなかった。keyboard全経路やnarrowの受入証拠ではない。

## 証拠保持の限界と訂正

第1/2段階のsource snapshotを当時取得していなかった。後から再構成して当時sourceと呼ばない。現在sourceは第3段階のもの。

第3段階へのverify拡張時に `product-list-filter.png` と `product-list-filter-active.png` を現在の有効ナビを含む画像で上書きした。この2枚は第2段階当時の証拠として採用不可。第2段階の根拠は保持された `render-evidence-step2.json` と利用者指示・変更記録の範囲に限定する。第1段階の `product-list.png` と第1/2段階JSONは保持されている。第2段階画像は復元しておらず、後から撮り直して過去証拠にしない。

`sales-entry.png` / `sales-confirmation.png` / `daily-sales-7days.png` / `daily-sales-14days.png` は第3段階途中の画像で、transition途中の画像を含む。最終提示には上のstage3-*だけを使う。これら途中画像も削除しない。

first-view所要時間、model名、token使用量は取得しておらず不明。tool単位の所要時間から全体を推定しない。

## 未決と次の人の確認

1. 売上入力の縦配置、右側の商品情報、確認→戻るの動きでよいか。
2. 数量の単位・整数/小数・許容範囲。現在は文字列の表示確認であり、入力可能な文字列が業務的に有効という意味ではない。
3. 画面間でdraftを保持する案、グラフ7日間/14日間と数値表を開く案でよいか。

Q-04〜06の売上粒度/重複訂正/取消、売上時単価と日別集計、分類masterは本実装前の未決としてdesign.mdに残す。未描画の画面はないが、全状態・狭幅・keyboard受入は未実施。保存・業務計算・権限・実データは未実装。ここからの安全な次手は利用者のfeedbackを受けて同じ部品を修正すること。正式mock全状態や本実装は今回の配置相談と分ける。

## 利用者へ返す内容

「売上入力と日別グラフの案を追加しました。入力は確認画面から戻して直せて、画面を移動しても保持されます。グラフは7日間/14日間と数値表を切り替えられます。保存はまだ行いません。この配置と動きで進めてよいか、あわせて数量の単位・小数の扱いを確認したいです。」として売上入力とグラフを提示する。
