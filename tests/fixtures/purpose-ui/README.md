# 実部品の小さな配置確認fixture

製品ではなく、実AppKit部品をbackendなしで表示・変更できるかを調べるハーネス用試験。実案件の画面・データ・環境設定はコピーしない。公式初期化や本番配備の代替starterではない。

対象全画面は商品一覧・売上入力・日々の売上の3画面。部品はAppKit Table/Input/Button/Card/LineChart、共通styles.cssを使用。全画面の完成アプリを生成するAI試験ではなく、準備済み表示fixtureの動作確認である。期間集計、伝票、DB保存、認証、厳密な入力検証は対象外。

## 手順

`node tests/fixtures/purpose-ui/probe.mjs --runtime-root INSTALLED_APP_DIRECTORY --browser-packages PLAYWRIGHT_NODE_MODULES --output work/evidence/UNIQUE_DIRECTORY`

引数はagentが確認した既存のinstalled AppKit/React/Vite/Tailwind環境とPlaywrightのpackageディレクトリ。インストール・npm scripts・.env読込・Databricks CLIは実行しない。試験は新規出力ディレクトリにbuildし、loopbackだけの一時serverとheadless browserで行い、終了時server/browserを閉じる。出力は上書きしない。信頼する依存だけを使う。これはOS sandboxを構築するものではない。

## 観測と限界

3画面の描画、入力、未接続表示、変更後のfilter位置、narrow表示、外部通信/console errorを観測し、画像と結果を保存する。未接続ボタンは成功したように見せない。`?layout=revised`は同じ部品の配置変更済みfixtureであり、AIが利用者指示から変更した成績とは別。

初回表示→修正→他画面→別context再開の**agent行動**は `harness/evals/progressive-ui.md` の別試験。実providerの有効性・本番Appsでの動作・全UI品質の承認を、このrunnerの成功から主張しない。
