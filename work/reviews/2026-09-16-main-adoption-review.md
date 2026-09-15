# main採用・統合の独立レビュー

2026-09-16 JST。reviewer: `/root/main_adoption_review`。実装・採用記録の作成担当とは別context。

## push前の結論

MAIN-01/02は確認範囲でpass、阻害指摘なし。MAIN-03はpush前のためnot-run。この記録だけではmain反映済みとしない。

利用者の「であれば、mainに反映してください」を、直前に説明済みのUIFとHARD-03の限定した実装範囲の採用として扱うことは妥当。採用判断と、実provider・実画面・Databricksでの受入完了を混同していない。

## 確認範囲

`review-work`と`orchestrate-work`、文書標準、品質契約、UI対応手順、採用要件、ADR、変更文書・session/task、過去のUI/scope/是正の独立レビューを読んだ。context/route/workloadは読み取りのみ。製品の新しいUI/API/データ処理を作らない採用・Git統合であるため、workload分類のunknownから無関係な案件定義を追加せず、要件の明示範囲を優先した。

| 受入 | 結果・根拠 |
|---|---|
| MAIN-01 | pass。ADRとopsはApps/AppKitの既定・実部品との対応・旧integration-initの非互換・旧成果物保持を明記。HARD-03はローカル台帳/照合/撤回に限定し`executionAuthorized: false`、本人認証/費用強制/live adapterがないことを明記。旧sessionの現在欄とUIF taskから採用待ち停止を除き、過去履歴は保持。親HARD全体の未完了まで完了にしていない。 |
| MAIN-02 | pass。`acc506aa4de4e28e15400b92da06df2c2dfa2a8e`に存在するdocs/work以外の全1,042 tracked filesについて、`git cat-file --batch`のblobと実ファイルのraw bytesを独立照合し不一致0。既存4版manifestと全4,204 payloadのSHA-256を過去の保存値に独立照合し不一致0。採用差分全文はops注記とsession/task状態の記録変更のみ。新規証拠runnerはローカル既存testを呼び、既存ログを`wx`で非上書き保存するもの。実装/生成asset/依存/版の変更ではない。 |
| MAIN-03 | not-run。push後にprivate/default branch、remote main=local main、元mainとレビュー済みcommitの祖先関係を別途確認する。 |

当担当が実行した`npm run harness:check`、採用差分の`git diff --check acc506a`、`git merge-base --is-ancestor a77c96a acc506a`は成功。Git/index/remoteは変更していない。

主担当の全回帰ログとJSONを独立に読み、711 tests / 709 pass / 0 fail / 2 skip / 0 cancelled / 0 todoを確認。全回帰を当担当も実行したとは主張しない。skipはホストのfile-symlink権限による2件で、実provider/Databricksは未試験。原ログSHA-256は`4f211f1cf8943f09eec1208d4b191bab1537d3403bf5a63dc3136a39bb0859ae`。

今回、既存の機能/振る舞い/評価器を変更しないため、文書標準の軽微な差分例外に沿って新しい品質JSONは不要。過去のreceiptを現在の変更済みopsに無条件流用せず、過去commitの機能証拠と今回の採用差分の確認を分けている。

## 保存・限界

既存リリース: 0.4.0=1,012、0.5.0=1,057、0.6.0=1,067、0.6.1=1,068 files。manifest hashは[JSON](2026-09-16-main-adoption-review.json)に記録した。レビュー時点の採用文書5件のhashも同JSONへ記録。

mainソースの更新は既存0.6.1 payloadの更新、案件への適用、Databricks配備、実環境成功を意味しない。当担当は認証変更、実DB/モデル呼出、案件変更、公開版再生成を行っていない。既存修正の全安全性の再証明ではなく、既にレビューされた実装の不変性と今回の採用記録・統合に限る。ローカル`.harness/agent-assets/backups`は非追跡でありpush対象に含めないことを確認条件とする。
