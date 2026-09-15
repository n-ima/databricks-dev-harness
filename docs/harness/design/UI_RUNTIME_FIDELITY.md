# UI設計と本実装の対応保証（ローカル候補）

## 原因と訂正

FRONTENDはAppKit・本番部品再利用を定める一方、DOCUMENTATION_STANDARDと生成計画が依存なしHTMLを推奨し、実装に移す時の差分を必須記録にしていなかった。approval createはファイルがあればUI承認可能で、scaffold側はHTMLやJSONの拡張子も実行モックの代用にできた。従来の「Apps前提」という説明は軽量HTMLまでの保証ではなかった。

## 方針

- hostingの既定はDatabricks Apps。UIの既定は既存のReact/AppKit。別hosting、別frameworkは利用者の明示選択を記録し、理由だけで勝手に切り替えない。
- UIを確認してもらう画面は、実装予定と同じ部品/テーマ/依存版をローカルで描画する。データとAPIはfixtureで代用し、実DB接続を要求しない。既存モックがあれば、それを設計確認へ再利用する。
- 技術基盤未設定時は画面一覧・遷移・データ定義を進める。Apps非依存の近似HTMLを完成画面の設計として提示しない。必要な初期化認証は人へ確認し、独自のHTMLへの切替で回避しない。
- HTML出力自体は禁じない。同じ部品から生成された静的出力は視覚確認に使えるが、入力/keyboard等の実行確認とは区別する。

## 最小実装

既存delivery入口にUI契約の準備/検査を追加する。契約はdocs/product/ui配下に置き、sessionの要件/主設計、実装targetと明示例外、版を含む依存manifest/lock、部品/スタイル/fixture、画面一覧・確認状態・残差分にhashで結び付ける。利用者はJSONを書かず、agentが生成・具体化する。

ui-mock承認にはその契約と別contextのレビュー記録が必要。承認時のhashへ取り込み、通常buildではui-approval-checkで現session/appを指定して再確認。loopはgate解除・以後のrun・provider/check後・完了判定で再検証し、別gateへ進んでもUI依存を保持する。旧承認は消さず、不足の補完・現物確認・再承認を案内し、そのまま新しいUI確認済み扱いにはしない。API-onlyの承認には追加しない。

scaffold integration-initは新旧計画とも実行を拒否する。既存fixture appを通常buildで延長し、UI承認を別アプリへ流用しない。scaffoldへ共通validatorを接続したのではなく、再生成経路自体を廃止する互換性変更である。新規のfixture-only初期化・上書き保護・認証/MUST-rule検査は維持する。詳細は [移行手順](../operations/UI_RUNTIME_FIDELITY.md)。

画面の見た目や真の人の判断をJSONだけで証明できない。機械検査は選択・証拠・coverage・変更検出を担い、実際の画面と部品対応は独立レビューと人の確認を必要とする。任意のチャットや外部ツールをOSレベルで強制する仕組みではない。この限界を隠して「必ず一致」と報告しない。

## 検証と費用

拒否試験はローカルの合成fixture。意味のない文字列一致だけでなく、承認が書き込まれないこと、旧hash変更で利用側が停止すること、非UIと明示例外の正常経路を検証する。実Claude/Copilot・AppKit画面・Databricksへは勝手に接続しない。並行するHARD-03を変更しない。

## 公式根拠

2026-09-15に[Databricks Apps](https://docs.databricks.com/aws/en/dev-tools/databricks-apps)と[開発手順](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-development)を確認（ページ更新2026-09-11）。Appsはローカル開発可能な実行基盤で、AppKitはReact/Node SDK。特定部品の存在・APIは採用版の公式docsと実パッケージで確認する。スクリーンショット中のTree/DataTable等の説明を検証済み仕様として転記しない。
