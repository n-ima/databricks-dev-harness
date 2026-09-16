# 作業目的に応じた開発手順 — 独立レビュー

レビュー担当: purpose_design_review / Codex（実装者とは別context）。確認日: 2026-09-16。候補の静的設計レビューと狭い独立再実行であり、正式採用・公開・実provider有効性の認定ではない。

## 現在の判定

手順の差分は、全画面・動作仕様・実AppKit部品・正式なui-mock条件を保持している。完成版の承認条件を初回相談の前提にしない方針は一貫し、新しい必須gate/帳票は追加されていない。正式承認・loop・権限検証の実装に差分はない。

追加runnerのP2と記録再現性のP3は、修正・補足後の独立再検証で解消した。現在、未解消の指摘はない。固定された全3画面/仕様と別context再開記録も確認し、PDD-01〜06を下表の候補範囲でpassとする。実Claude Code/Copilot比較、厳密な現行/候補の効率比較、正式採用/公開/案件適用を認定するものではない。品質契約への結果集約後の最終verify診断は別に確認する。

## 指摘

### PDD-R1 / P2: junctionを経由すると出力範囲を越える

- 箇所: `tests/fixtures/purpose-ui/probe.mjs` の出力先決定と `mkdir(output)`（初回レビュー時13–15行）。対象hash: `3b91f21ef95f08be8fe05affe1be6be14466464c4d30941d443cf40400ccc310`。
- 根拠: `output.startsWith(...)` は文字列の検査であり、`work/evidence` または配下の祖先がjunction/symlinkの場合の実際の出力先を検査しない。
- 独立再現: 改変しないrunnerを一時repoへコピーし、`repo/work/evidence` を同じ一時領域内の `outside-repo` へjunction化。無効な依存先で実行すると依存読み取りはENOENTで終了したが、その前に `outside-repo/proof` が作成された。`outputCreatedOutsideRepo:true`。実案件や本リポジトリの出力パスは変更していない。作成した一時領域は確認後に除去した。
- 受入条件: 作成前に出力経路のsymlink/junction祖先を拒否する。祖先がリンクの場合に、リンク先へ何も作らない回帰試験を追加し、独立再実行する。通常の新規出力成功と既存出力の上書き拒否も維持する。
- 状態: 解消。下記の独立再検証で、作成前のリンク拒否と通常表示の成功を確認した。

## 独立して確認した証拠

| 確認 | 実行/観測 | 結果・範囲 |
|---|---|---|
| 要件・設計・手順 | 要件、設計、比較記録、plan/session、canonical skills、文書/UI/品質標準、差分を読取 | 配置相談の限定、未決の期限、全画面維持、同じ実部品の継続、正式gate不変を確認 |
| 承認の狭い回帰 | `node --test tests/ui-contract.test.mjs tests/approval.test.mjs tests/scoped-approval.test.mjs` | 独立実行78件成功、失敗0、skip0、約20.22秒。合成fixtureの拒否試験であり実UIの受入ではない |
| 整合 | `npm run harness:check` / `git diff --check` | 独立実行成功。canonicalと両providerのmock-ui hashも一致 |
| 正式制御 | `git diff -- tools harness/router.json harness.config.json` | 差分なし |
| 実部品表示 | 下記の完全なコマンドで独立再実行 | 3画面、未接続入力、同じ部品のfilter位置変更、narrowの横溢れなし。console error/remote/backend要求0 |
| 目視 | 独立run1の `01-list.png` / `03-chart.png` / `05-narrow.png` | 表、青い系列、未接続表示、狭い一覧を確認。全状態・keyboard・正式UI受入ではない |
| 品質診断 | `npm run harness -- delivery check --contract work/quality/2026-09-16-purpose-driven-delivery.json --phase verify` | 当時は5件のnot-runとMISSING_REVIEWを検出。自己検証を独立passとしていない。契約は主担当が整備中 |

実部品の独立再実行:

```text
node tests/fixtures/purpose-ui/probe.mjs --runtime-root D:/projects/product-sales-management/apps/sales-management --browser-packages C:/Users/nimao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules --output work/evidence/2026-09-16-purpose-ui-independent-run1
```

結果: `work/evidence/2026-09-16-purpose-ui-independent-run1/result.json`。AppKit UI 0.72.0、React 19.2.4、Vite 7.1.14、Node v24.15.0、Chromium 151.0.7922.34。既存installed依存を読み取り、実案件のscripts・環境設定・backendは使っていない。準備済みfixtureの表示試験であり、AIが仕様から作成/編集した能力や所要時間を測ってはいない。build約0.60秒、全体約1.34秒を開発効率改善率にしない。

## 受入条件との対応

| ID | 判定 | 根拠・限界 |
|---|---|---|
| PDD-01 | pass | 比較記録は出典・現行根拠・採否・反証・未検証を区別。下記一次資料を抜き取り再確認。全外部資料の全文追試はしていない |
| PDD-02 | pass | OPERATING_MODEL/既存plan template/skillsで目的・成果・対象外・停止条件を扱う。新gate/全帳票の一律追加なし。実provider行動は未検証 |
| PDD-03 | pass | 実部品の独立表示に加え、固定された3画面・動作/データ/未決の設計とソース、別contextがそれらから安全な再開点を復元した記録を照合。初回/変更当時のsource欠落があり、厳密な全段階再現・効率比較・正式mock受入は認定しない |
| PDD-04 | pass | API/データ/分析/AI比較/障害調査/技術検証の停止点と、実環境受入の境界が明記。これら全workloadの実行試験ではない |
| PDD-05 | pass | 正式承認回帰78件・手順反例レビュー・実部品独立表示を確認。PDD-R1は追加5件と元の独立反例で解消を確認。未実行試験を成功にしていない |
| PDD-06 | pass | providerコピー一致、非破壊移行と正式配布の別工程を確認。Claude Code/Copilot未実行が明示されている。実provider成績を認定しない |

## 一次資料の抜き取り照合

[GOV.UKの試作](https://www.gov.uk/service-manual/design/making-prototypes)は、その時点の目的に合う試作を選び、本番コード品質と区別する趣旨を確認。[DORAの小さい変更](https://dora.dev/capabilities/working-in-small-batches/)は早いfeedbackを推奨する一方、APIから進める記述は本番配備の文脈であり、調査記録はその制約を明記している。[AppKit UI公式API](https://developers.databricks.com/docs/appkit/v0/api/appkit-ui)はReact primitiveとdata modeを説明しており、実installed版での独立表示結果も対応する。その他資料の全内容・全研究条件は本レビューで再検証していない。

## 未検証と判断の境界

- 初回/変更当時のsourceを含む全段階の厳密な再現、現行/候補の同条件反復比較。UI/非UIの今回の限定Codex試行を、全案件・全入力での一般的な有効性へ外挿しない。
- Claude Code/Copilotの同条件反復比較、費用/利用量、実案件で一画面に1時間超かかった直接原因。
- Databricks Apps配備、実認証/権限/DB、全画面状態・keyboard・accessibility、本番の見た目とソース対応。
- ハーネスの正式採用、version/stamp/main公開、既存案件更新。

通常sandboxはhelper起動障害のため実行できず、明示した読み取り/隔離試験を昇格経路で実施した。これは検査対象の不具合ではない。主担当の721成功の全回帰は独立実行数へ合算していない。

## PDD-R1修正後の独立再検証

修正版 `probe.mjs` は `lstat` により出力パスからrootまでのsymlink/junction祖先を `mkdir` 前に拒否する。修正版hashは `6977066acde3c30520e5c667e124f362ff3fa664c636b1ec105a12aa52d95ded`。検査と作成の間に別プロセスが祖先を差し替える競合を防ぐOS隔離ではなく、そのようにも主張していない。

- 元の独立反例を修正版へ再実行: `linkRejected:true`、`outputCreatedOutsideRepo:false`。依存読み込み・出力作成の前に拒否した。
- `node --test tests/purpose-ui-probe.test.mjs`: 独立実行5件成功、失敗0、skip0、約0.64秒。work/work-evidence/入れ子junction、traversal、既存保持、異常引数、新規の通常出力を確認。試験hashは `cf09b7c956eee735b1a4780d150d6053789081a6da6c89e0140efeff14d7d3c5`。
- 修正版の実部品表示を下記で独立再実行: `work/evidence/2026-09-16-purpose-ui-independent-run2/result.json` はpass。console error/remote/backend要求0。build約0.63秒、全体約1.36秒。画面・style・indexのhashは独立run1から不変であり、既存の目視証拠の範囲も変わらない。
- 品質診断を独立再実行した時点では終了値1。修正前のprobe hash、5件のnot-run、MISSING_REVIEWを検出した。主担当のhash更新後にも独立再実行し、ARTIFACT_MISMATCHが消え、未実行5件とMISSING_REVIEWは残ることを確認した。結果/reviewを未登録のまま合格にはなっていない。最終診断は主担当による契約集約後の別記録と照合する。

```text
node tests/fixtures/purpose-ui/probe.mjs --runtime-root D:/projects/product-sales-management/apps/sales-management --browser-packages C:/Users/nimao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules --output work/evidence/2026-09-16-purpose-ui-independent-run2
```

主担当の当時の全回帰記録 `work/evidence/2026-09-16-purpose-regression.tap` は723件・721成功・失敗0・skip2。独立の78件と追加5件とは別に報告する。この修正確認時点ではPDD-03の行動試験は未検証としていた。後述の追加確認により候補範囲での判定を更新し、実provider比較は未検証を維持する。

## 追加差分と非UI・UI途中証拠の照合

OPERATING_MODEL冒頭の追加1行は、lifecycle全体の記録と途中の配置相談の前提を分け、正式完了/承認の適用証拠を維持する内容である。Stage modelやmock-uiと整合し、新しいgate省略はない。確認したhashは `31b78e427b2eef865924d3e4de20a07153a97ad6295ee9f8eaf04bee41128480`。

主担当の最終一括回帰 `work/evidence/2026-09-16-purpose-final-regression.tap` は728件・726成功・失敗0・skip2・42.47秒。追加5件も収録され、skipはhostのsymlink権限による2件と記録されている。これは主担当の保存ログの確認であり、独立全回帰を実行したとはしない。

`work/evidence/2026-09-16-purpose-non-ui-trial.md` は別contextによる手順/回答の試行を実処理と区別し、CSV・PDF・障害ログが未提供であること、完全blindではないこと、実provider未試験を明記している。4題の停止判断は適切で、認証未定を無認証許可へ、モデル比較の設計を有料推論/Serving配備へ、原因調査を変更権限へ拡張していない。

PDD-R2 / P3（証拠の再現性、機能阻害ではない）は解消。A入力欄の要約ではdefine/apiとなり、raw観測表のrelease/apiを再現しなかったため、正確な入力保存を求めた。補足された実入力には「公開したい」が含まれ、正確な4入力を独立再実行するとA release/api、B define/analysis、C define/unknown、D incident/unknownで元記録と一致した。3つのoverrideも独立再実行して一致し、全route/resolveでexecutionAuthorized:falseを維持。override時にはpromptも短く変更したことが明記され、同一promptのflag比較とは主張していない。補足後記録hashは `9dfac397f122bc94103f2d2425f0090f7a00836d86431105c03ba05b242d3784`。

固定UIスナップショット `work/evidence/2026-09-16-purpose-forward-snapshot/` の設計・session・source・第3段階観測を照合した。3画面と動作/遷移、データの意味/関連、Q-01〜06の未決/期限、正式mock前の残作業が保存されている。ソースは実AppKit Table/Select/Input/Dialog/LineChartと共通styleを使い、永続化・認証・売上計算を実装していない。第3段階の一覧・確認dialog・14日グラフを独立目視し、記録内容と一致を確認した。初回/変更当時のsource snapshot欠落と、第2段階画像の上書きは明記され、当時の証拠には不採用としている。このため厳密な全段階再現や効率比較には使わない。

## 保存された新context再開記録の確認

`work/evidence/2026-09-16-purpose-resume-trial.md`（hash `2489c151f7ca9db418749528f6c5a1f39a0daa28c750f481a525ea01325cbf14`）を全文確認した。過去会話なしで「続けて」を受けた別contextは、3画面の現在状態、一覧だけの配置合意、残2画面とQ-01〜03の回答待ち、Q-04〜06と正式mock前の残作業を既存session/design/sourceから復元した。保存された返答案もその状態に対応し、追加実装・再build・承認の創作をせず、具体案を再提示して未決への回答を求める判断となっている。

再開記録に列挙された10個のsource/画像/JSON hashを固定スナップショットから独立再計算し、全て一致した。記録は今回build/ブラウザ操作を再実行していないことを明記し、以前の自己実行を新しい独立実行へ言い換えていない。この確認は再開点の復元の証拠であり、正式UI承認や新たな実環境実行を認定しない。

以上からPDD-03を限定Codex試行・現在のsource/設計/再開記録の範囲でpassへ更新した。PDD-R1/R2とも解消し、実装・記録の未解消指摘はない。最新の品質契約はdesign診断を独立実行して指摘0、recordedExecutions=0だった。結果集約後のverify診断はこの後の確認対象である。
