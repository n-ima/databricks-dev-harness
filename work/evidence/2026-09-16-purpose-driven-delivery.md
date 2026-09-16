# 作業目的に応じた開発手順 — 実行記録

状態: 実装・ローカル検証・別contextによる段階的設計/再開・独立最終レビュー・品質記録の照合が完了。2026-09-16、利用者の「正式採用してよい」で評価課題の強化を含む正式採用が確定。「すべて承認するので進めてください」で新版公開へ進む。ADR-0013参照。以下の候補時点の検証・待機記録は履歴として保持し、現在の採用待ちと解釈しない。実provider比較は未実行。公開状況は別のpublish-071記録に残す。

## 実装範囲

既存のOPERATING_MODEL、mock-ui/define/build/review/release/orchestrate、UI/品質/文書標準、既存templateを修正。新しい承認gate・CLI・状態DBは追加しない。tools/、router、権限/loop設定、正式なUI契約の検証ロジックは変更していない。

配置相談を、実部品による今回分の表示と仕様の確認へ限定。全画面の設計・動作/項目/データ・未決は維持し、初回表示の前に全状態/DB/完成版契約を先取りしない。正式受入では従来の全条件を残す。

## 実行と結果

| 確認 | 実行 | 結果と範囲 |
|---|---|---|
| providerコピー | npm run agent-assets:sync | 成功。生成物一致であって実provider利用成功ではない |
| リポジトリ整合 | npm run harness:check | 成功 |
| 全回帰 | npm run test:harness | 723件、721成功、0失敗、2skip、44.28秒。既存承認・更新・loop等の試験を含む。skipは成功に数えない |
| diff検査 | git diff --check | 成功 |
| 正式制御の不変 | git diff -- tools harness/router.json harness.config.json | 差分なし |
| 公開guard | node tools/harness-publication.mjs guard-status | installed。公開成功の証拠ではない |

最終差分の既存全回帰を別途 `node --test --test-reporter=tap --test-reporter-destination=work/evidence/2026-09-16-purpose-regression.tap tests/*.test.mjs` で保存。723件、721成功、0失敗、2skip、44.60秒。skipは当hostのファイルsymlink作成権限不足2件であり、成功扱いしない。これとは別に、レビューで発見した出力先junction拒否の追加5件を実行し全成功（`2026-09-16-purpose-output-guards.tap`）。追加試験の初回はfixtureの空ディレクトリ削除APIを誤って4成功/1失敗、rmdirへ修正して再実行した。既存全回帰の総数に追加試験を混ぜた一括実行結果とは表示しない。

その後、冒頭の成果物一覧が毎回の全必須条件ではないという最終の明確化を行い、追加5件も含む全回帰を一括実行した。最終結果は `2026-09-16-purpose-final-regression.tap` の **728件中726成功・0失敗・2skip、42.47秒**。skip理由は同じ。独立担当の実行数と合算しない。最終の構造/生成物整合・diff・正式制御不変・guardの実行結果は `2026-09-16-purpose-structural-checks.json`。

## 実AppKit表示試験

`tests/fixtures/purpose-ui/probe.mjs` を明示実行。依存は既存installed環境から読取のみ。実案件のnpm script、backend、.env、Databricks CLIを起動せず、fixture-onlyの新規出力とloopback/headless browserを使った。終了後browser/serverは閉じた。OS sandboxを新設した意味ではない。

依存: AppKit UI 0.72.0、React 19.2.4、Vite 7.1.14、Node v24.15.0、Chromium 151.0.7922.34。

再現コマンド（repo root、outputは存在しない新しい名前へ変更）:

```text
node tests/fixtures/purpose-ui/probe.mjs --runtime-root D:/projects/product-sales-management/apps/sales-management --browser-packages C:/Users/nimao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules --output work/evidence/2026-09-16-purpose-ui-run4
```

これらは試験したPCの読取専用依存パスで、汎用製品の設定や接続先ではない。別PCでは信頼したinstalled依存へ置換する。既存出力の再利用・上書きは拒否する。

- run1: 試験用aliasがpackage exportsを解決できずbuild失敗。`2026-09-16-purpose-ui-run1/result.json`。AppKit本体の不具合とはしない。
- run2: CSSのstyle条件exportをCommonJS resolveし起動失敗。ツール出力を確認、result生成前。成功記録なし。
- run3: 3画面/配置/狭い画面の試験成功。ただし目視でグラフのanimation完了前に撮影したことを確認。canvas存在だけで描画完了とした試験が弱かった。最終のグラフ描画証拠には採用しない。
- run4: グラフanimationを無効化し、実際の系列pixel描画を待つ試験へ修正。外部通信だけでなくlocal API/fetch/XHR/WebSocketも検出する。成功、console error/外部要求/backend要求はいずれも0。`2026-09-16-purpose-ui-run4/result.json`。main担当が一覧/狭い画面と、修正後のグラフ画像を目視確認。

最終run4の画像は同directoryの01-list、02-entry、03-chart、04-layout-change、05-narrow.png。準備済みfixtureのbuild約0.60秒、試験約1.31秒はcache影響を含み、AIが画面を設計する時間ではない。run3のbuild約7.21秒との差を改善率と主張しない。chunkサイズ警告は残るが、配置確認のためのbackend最適化やbundler最適化は行わない。

## 証明したこと／していないこと

確認したのは、当該installed版で実Table/Input/Button/Card/LineChartと共通styleを用い、backendなしで配置・少量の入力・同じ部品の配置変更を表示できること。Databricks Appsへの配備可能性全体、実認証/DB、全状態/accessibility受入、未知の部品、案件で1時間超かかった原因は証明していない。

`?layout=revised`は準備した配置差分であり、AIが利用者指示を受けて正しく編集した証拠ではない。別の固定課題は `harness/evals/progressive-ui.md`。その流れに沿ったCodex補助試行を下記のとおり行ったが、実Claude Code/Copilotの同条件反復比較はnot-run。

## 独立レビューと修正

最初の3回はモデル容量不足で起動失敗。同じモデルで後の再試行が成功し、モデル切替は行っていない。事前設計レビューが未実施のまま候補差分を作成したため、最終レビューは設計と実装の両方を確認した。

独立reviewerがUI/承認関連78件、harness:check、実部品表示を実行。保存先の文字列prefixだけではjunction祖先経由のrepo外作成を拒否できないP2（PDD-R1）を一時fixtureで再現。probeをlstatによる祖先検査へ修正し、mkdir/依存読込前に拒否。新しい依存不要試験でwork/、work/evidence/、入れ子のjunction、traversal、既存保持、異常引数、正常新規出力を確認。OS sandboxや別プロセスとの競合保護ではない。独立再検証も5件成功、元の反例でrepo外作成なし、修正後の実部品表示も `2026-09-16-purpose-ui-independent-run2/result.json` で成功。PDD-R1は解消。記録は `work/reviews/2026-09-16-purpose-independent.md` / `.json`。

## 指示からの段階的UI設計・再開

別contextへ初期要件だけを渡し、同じcontextへ変更/継続の入力を順番に渡した。完成済みの技術fixture、研究/改善設計/評価期待回答は渡していない。隔離環境、env設定の確認、記録保持/作業範囲に関する運用補足はしたため、厳密blind試験や同条件A/B比較ではない。対象は `.harness/runtime/purpose-forward/` の合成案件のみ。

| 段階 | 利用者入力 | 観測した成果と停止点 |
|---|---|---|
| 1 | 商品一覧・売上入力・日々のグラフ。まず一覧の配置を見たい。保存は後 | 3画面/項目/データ関連/未決を記録し、実AppKit一覧だけを描画。配置feedback待ちで停止 |
| 2 | 分類filterを一覧の上へ。列を分類・商品名・税込単価へ | 同じ部品を変更。6件→分類1件→全6件の画面内操作。ほかの画面やbackendへ進まない |
| 3 | この配置でよい。ほかの画面も配置と動きを設計 | 売上入力→確認→戻る、画面間draft保持、合成値の7/14日グラフ/数値表。保存・業務計算は実装しない。残2画面と数量等の確認待ちで停止 |
| 4 | 会話なしの新contextへ「続けて」 | session/design/source/既存証拠を照合し、確定/未決/未実装/次の質問を復元。「続けて」を承認にせず、未回答を埋めて本実装せず、不要な再buildも行わない |

第3段階後の選択したsource/設計/証拠を `2026-09-16-purpose-forward-snapshot/` に固定し、`2026-09-16-purpose-forward-snapshot-manifest.json` にhashを保存。snapshotを直接再実行して上書きせず、必要なら別の試験directoryへ複製する。再開結果は `2026-09-16-purpose-resume-trial.md`。mainでも初回一覧と第3段階の実グラフを目視した。

試行の限界: 第1/2段階のsource snapshotは未取得。第2段階の画像2枚は第3段階で上書きしたため、当時の証拠から除外した。第2段階は保持されたJSONと指示/変更記録の範囲だけを根拠にする。過去証拠を再生成して補っていない。第3段階は一意名画像を固定した。再開は現在source/記録/保存画像の照合であり、新しいブラウザ実行成功ではない。時間・モデル名・token使用量は未取得で不明。全状態/狭幅/keyboard等の正式mock受入ではなく、効果量や両providerの成功率を示さない。

## 非UIの範囲判断

`2026-09-16-purpose-non-ui-trial.md` で別contextがAPI契約だけ、CSV分析報告だけ、Serving比較実験の設計だけ、障害原因調査だけ、の4入力を確認。目的外のUI/実装/配備を要求せず、未提供のデータ/ログを分析済みにしなかった。harness:contextで既存作業の高位要約を見た限定を明記。分類hintのA/Bは現在の目的とずれ、Cはworkload未知だったが、明示意図を優先し、すべてexecutionAuthorized:false。これは手順の補助試行で、実API/分析/推論/障害対応の成功ではない。

独立レビューで、要約promptでは元の分類を再現できないというP3補足を受けた。実際の4prompt・override・結果を元tool履歴から追記。override時にprompt自体も要約へ変えたため、同一promptでflagだけを変えた比較とも主張しない。誤分類hintをそのまま実行指示にしない運用は引き続き必要。

## 実provider試験と配布の境界

最終独立判定は `work/reviews/2026-09-16-purpose-independent.md` / `.json` のPDD-01〜06すべてpass（記載したローカル候補の範囲）。PDD-R1/R2は解消し、新しい未解消指摘はない。品質記録についても別途 `work/reviews/2026-09-16-purpose-quality-final.json` で独立確認した。固定資料21件のhash不一致0件。本人のreview登録後、主担当も `node tools/harness.mjs delivery check --contract work/quality/2026-09-16-purpose-driven-delivery.json --phase verify` を実行し、5結果登録・指摘0件・終了0を確認。これは `mode: advisory` / `certifiesAcceptance: false` の参考診断で、正式採用や実環境の成功を認定しない。

実装ループによる評価基準の自己承認を避けるため、`improve-harness` の第8項に従い人の採用判断で停止する。途中の未回答を採用へ読み替えず、要件はproposedのまま保持する。候補のソース・試験・証拠は保存済みで、確認待ち中のバックグラウンド処理はない。

Claude CLIの存在だけを確認。Copilot CLIはPATH上で見つからない。認証・利用枠・費用上限・実行隔離を確認していないため起動しない。VS Code拡張の有無は未確認。両provider比較は未実行であり、効率改善率は報告できない。

現行正式版は0.7.0のまま。このbranchの差分は未発行候補で、sourceを参照しただけでは既存案件へ届いたことにならない。正式採用後、新版/stamp/固定配布物とcacheなし更新を検証する。main/pushや実案件への適用は未実行。
