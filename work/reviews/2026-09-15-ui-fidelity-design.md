# UI設計と本実装の対応保証: 独立設計レビュー

- 確認日: 2026-09-15
- レビュー担当: `/root/ui_fidelity_design_review`（実装担当と別context）
- 対象: `docs/harness/requirements/2026-09-15-ui-runtime-fidelity.md`、`docs/harness/design/UI_RUNTIME_FIDELITY.md`
- 判定: 方針は妥当。下記の利用側・scope・描画証拠の条件を具体化してから実装受入を判断する。これは実装完了のレビューではない。
- 範囲: ローカルの要件・設計・既存実装の読取と本レビューの記録のみ。実案件、Databricks、認証、公開には触れていない。HARD-03を変更していない。

## 事実確認

`FRONTEND.md:22` は実行可能モックに本番部品と合成fixtureを使用する方針を持つ。一方で `DOCUMENTATION_STANDARD.md:52-54` と `mock-ui/SKILL.md:10` は、設計補助として依存なしHTMLを明示的に許している。したがって「UI設計のHTML自体が常にApps/AppKit前提」という従来説明は、標準全体については正確ではない。既存のApps方針だけを引用し、紙芝居の例外を省略して説明してはいけない。

`approval.mjs:30` はui-mockでartifactが存在することしか要求しない。`scaffold.mjs:209-228` はhashと拡張子による代用を行い、sessionや対象appとUIの意味上の対応を確認しない。`loop.mjs:352-360` はgate解除時にreceiptを確認するが、その後の各runでUI証拠を再検証しない。`agent-hook.mjs` は危険なコマンドとループによるpolicy変更を制限するが、HTMLの見た目の対応や人の判断を証明するものではない。

親担当から単独HTMLを受け入れる旧動作のred test結果を受領した。本担当はそのテストを独立再実行していないため、再現実行済みとは主張しない。上記のコード上の欠落は独立に確認した。

## 設計上の必須修正

### UIF-D01: 承認を作る時だけでなく、使う時に共通検証する

重要度: 高。`approval create`、scaffoldのplan/apply、loopのgate解除/次runに同じUI契約validatorを接続する。契約なしの旧承認をgate解除済みとして引き継がない。plan作成後やgate解除後に部品・style・fixture・依存版・レビューが変わった場合も停止する。拒否時はapproved receiptを書かず、外部generator/providerを呼ばないことを試験する。

UI hashが変化したら何でも全業務を止めるのではなく、UI承認を利用する操作を止めて再確認へ案内する。backendだけの変更までUI hashへ取り込む必要はない。loopが別gateへ進む場合も、過去のUI承認依存を無言で捨てない構造が必要。

### UIF-D02: 別案件・別appへの承認流用を防止する

重要度: 高。UI契約をsessionの要件/主設計、実際に描画したappRoot、Apps/例外hosting、採用UIと依存版に束縛する。scaffold側は自分が生成するtargetと対応しない承認を拒否する。外部hosting/別frameworkの例外は理由の自己申告だけでなく、対象選択と人の判断記録へ結び付ける。ローカルのactor文字列を本人認証済みとは表現しない。

既存scaffoldは同一appRootへの再initを上書き保護で拒否するため、appRoot一致を追加するだけでは既存integration initが使えなくなる。この点を隠さず、最小案は次のように整理する。

- 既存のfixture appは同じソースを通常buildで実装/接続へ進め、再initしない。
- 別outputへのintegration initに既存UI承認を流用しない。新appならpurpose mockで初期化し、そのappのUIを確認してbuildへ進む。
- 現在の上書き保護は保持し、「再初期化ではなく既存appを再利用」の具体的な案内を出す。
- 再配置のhash比較/再承認を伴う専用workflowは今回作らない。互換性が狭まる点を移行説明へ明記する。

### UIF-D03: 近似HTMLと同一部品からの描画を区別する

重要度: 高。artifactの拡張子や`rendered: true`という自己宣言だけでは受理しない。契約に、採用package/lock、実装ソース、共通部品、style/theme、fixture、画面IDと状態ID、描画/操作確認の証拠、別contextのレビューを対応付ける。空の画面一覧や全状態の未確認を通さない。hashに列挙した範囲から抜ける共通style等がないかを独立レビューで確認する。機械だけでimport graphの完全性やピクセル一致まで保証するとは説明しない。

同じruntime部品から生成した静的HTMLは視覚設計の確認に使えるが、操作確認済みui-mockとは区別する。単独HTMLを後からAppKit部品に置換する予定、未対応のtree/table、未解決のstyle差分は、現在のUI確認条件の解消にはならない。解決・範囲縮小・実際の画面での再確認が必要。静的出力の出典ソースやbuild条件を示せないものは近似HTML扱いにする。

## 最小化・適用境界

- 既存delivery入口に`ui-init`/`ui-check`を追加し、JSONを人に書かせない方針はよい。追加の管理画面は不要。
- 共通validatorは`tools/lib`に置き、既存policyHashの対象に含める。HARD-03混在の`tools/harness.mjs`を変更しない構成は妥当。
- 規約、intake/product-documents生成、canonical skillと両providerの生成コピーが一致することを試験する。
- API-only/分析だけの案件へUI契約を要求しない。Apps上のAPIとApps上のUIを混同しない。
- 既存案件の文書や承認は保持し、不足の補完と再承認を案内する。旧承認を削除・自動承認しない。
- 今回は添付のTree/DataTable等のAPI説明を真実として転記しない。採用版に必要な部品の実現性は各案件で実パッケージ/公式docsを確認する。
- 任意チャットや任意shellの全動作をOSレベルで強制するものではない。使える標準入口でのfail-closed、独立レビュー、人の画面確認の三層と、未検証の実provider/実案件を分けて報告する。

## 必須回帰ケース

1. 単独HTML、空一覧、未解決差分、欠落/古い契約、自己レビュー、別session/別app/別hosting/別依存版を拒否。
2. 正当なApps UI、明示的な外部hosting/別framework例外、同じ部品の静的出力の視覚確認、API-onlyが意図通りに分岐。
3. approval後、plan後、loop gate解除後の証拠変更をそれぞれ拒否。generator/providerが一度も呼ばれないことを確認。
4. 旧案件はデータと既存記録を保持して補完へ誘導し、適合済みと誤認しない。
5. 依存ロックやtheme/共通部品の変更、画面/状態coverageの欠落、レビュー対象hash不一致を拒否。
6. 両providerコピーの生成同期、CLI単体回帰、非UI回帰、HARD-03および公開payload不変を確認。

## 結論

ユーザーが求める「設計から既定Databricks Apps、実際に確認するUIは本実装と対応する」は合理的であり、既存文書の例外を修正する必要がある。規約の追記だけでなく、上記の入口/利用側と証拠scopeを一貫させる最小強化を推奨する。最終採用可否は、修正後の実装・拒否試験・独立再レビューで判断する。
