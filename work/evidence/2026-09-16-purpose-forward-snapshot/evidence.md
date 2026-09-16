# 初回の商品一覧の描画証拠

2026-09-16、Codex補助contextの隔離forward試行。製品承認・Claude Code/Copilotの受入ではない。

計測上の限界: 開始時刻とfirst-view時刻を時計で取得していないため、first-view所要時間は不明。model名/token使用量の取得もしていないため不明。個々のtoolが返した所要時間から全体時間を推定しない。

- 実部品: installed `@databricks/appkit-ui` 0.72.0のTable/TableHeader/TableBody/TableRow/TableHead/TableCell、Card、Badge、Button。
- 共通style: installed AppKit `dist/styles.css` をTailwindで処理し、同じtheme tokenで青基調を設定。独立した近似UIではない。
- runtime: 既存React/Vite/Tailwindをread-only利用し、`build.mjs`をNodeで直接実行。npm scriptsや.env読取、初期化、Databricks認証・API、DB、installは行っていない。
- build: 成功。3,609 modulesを変換、HTML/CSS/JSを隔離distへ生成。
- 実描画: `verify.mjs`がローカルbuildをブラウザのrequest interceptionで返却。`.invalid`の予約originを使い、実ネットワークへ転送しない。他originはabortする。
- 観測: 1440×960、表の3列とfixture6行、実AppKit Tableのdata-slotを確認。青のprimary `#1764c0`、背景 `rgb(243, 247, 252)`。page errors 0、external requests 0。詳細は[観測JSON](render-evidence.json)。
- 画像: [商品一覧](product-list.png)。商品名の長いfixtureも表示され、分類と金額が分離し、列見出しと行に重なりは見られない。右端の金額は右寄せ。
- 現在の受入対応: AC-01は3列・6行の実描画、AC-02は実画面画像、AC-03はdesign.mdの3画面一覧で確認。これは一覧の途中相談に必要な自己確認で、全設計の完了/正式受入ではない。
- 未検証: 売上入力/グラフ、全状態、keyboard journey、狭幅、実データ、保存、権限。現在の一覧配置を出す条件にはしない。

## 環境上の観測と修正

1. 標準exec・既存fileのapply_patch更新・view_imageはsandbox helper_unknown_error。読取/隔離試行のrequire_escalatedを使用。編集はapply_patch実体を直接起動して実施。scope外のファイルは書き込んでいない。
2. 初回buildでWindows ESM import形式とJSXのtable headerを修正し、build成功を再確認した。
3. 最初のloopback HTTP描画では、ホスト環境由来と推定するAdGuard injectionがlocal.adguard.orgへの2要求を起こした。全てrouteで遮断され、画面自体は描画できた。通信なしの証拠を明確にするため、HTTP serverを使わないlocal fulfillに変更。再実行は3つのlocal assetだけ、external requests 0、page errors 0。AdGuardの設定は変更していない。

## 利用者へ提示する内容

画像とともに「一覧の配置案を用意しました。商品名を広く、分類を中央、税込単価を右端にそろえています。この列幅と余白感で進めてよいでしょうか。売上入力・日々のグラフは次に順番に確認します。」と伝える。相談対象は一覧の配置であり、3画面の設計完了や正式mock承認を求めない。

## 停止点

利用者の「まず一覧の配置を見て決めたい」に従い、商品一覧を提示してfeedback待ちで止める。mock-uiの「If feedback is needed to choose the layout, stop there rather than implementing speculative downstream work.」にも一致する。全画面実装、完成版UI契約、正式独立レビュー、ui-checkは初回表示前に実行していない。

## 2回目: 分類絞り込みと列順の修正

利用者の追加指示を同じAppKit画面へ反映した。Select/Labelの実APIをinstalled資料で確認。分類の単一選択を一覧上へ置き、列順を商品分類・商品名・税込単価にした。選択はfixtureを画面内で絞り込むだけで永続化しない。

- 再build成功。browserで3列の順序、分類選択の下端が表の上端より上にあること、初期6件を確認。
- 「ギフト」選択で対象1件と「1 / 6 商品を表示」を確認。「すべての商品分類」で6件へ復帰。
- page errors 0、external requests 0、local assets 3。観測は[2回目JSON](render-evidence-step2.json)。
- この段階では一覧と絞り込み時を画像確認したが、後の第3段階実行でproduct-list-filter.png / product-list-filter-active.pngを上書きしてしまった。現存するこの2枚は第2段階当時の画像証拠として不採用。第2段階の根拠は保持されたJSONと指示/変更記録の範囲に限定する。初回product-list.pngは保持。詳細はevidence-stage3.md。
- 変更file: App.tsx、styles.css、design.md、verify.mjs、session.md、evidence.md。build出力はdist、証拠は上記のJSON/画像のみ。すべて隔離ディレクトリ内。
- 利用者への返答: 「商品分類の絞り込みを一覧の上へ追加し、列を『商品分類・商品名・税込単価』の順に変更しました。分類を選ぶと一覧が絞られ、全件表示にも戻せます。」に画像を添える。
- 停止点: 今回の修正画面を提示したところ。ほか2画面・保存・税計算・正式mock契約/承認は実施していない。追加指示は変更feedbackとして記録し、承認へ置き換えない。

### Vite環境読込設定の確認

主担当から隔離条件の確認依頼があり、installed Viteだけを調べた。隔離root直下の.env*は0件。実案件の.envにはアクセスしていない。

一次根拠はinstalled `vite/dist/node/index.d.ts` のenvDir宣言（3348行）とdeprecatedなenvFile宣言（3481行）、`vite/dist/node/chunks/dep-ySrR9pW8.js` の35407〜35409行および11673〜11680行。既存の `envFile:false` もこの版では `envDir:false` に変換され、環境ファイル一覧が空になるため有効だった。これは.env読込の不具合修正ではない。

build.mjsを明示的な `envDir:false` へ整理し、`envPrefix:[]` でprocess由来の公開環境変数も取り込まない設定にした。解決後設定をassertし、変更画面のbuildで `Fixture isolation confirmed: envDir=false, envPrefix=[]` を観測。buildと今回分の小さなブラウザ確認は成功し、表示/分類選択/解除とエラー0・外部要求0は変わらない。全画面等の広い試験は行っていない。
