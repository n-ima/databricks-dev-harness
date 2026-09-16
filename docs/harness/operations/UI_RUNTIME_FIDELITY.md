# UI設計を実際のApps画面に対応させる

状態: 2026-09-16 正式採用（[ADR-0012](../decisions/ADR-0012-ui-scope-adoption.md)）。ローカル実装・独立レビュー済み。実provider/実画面の受入、更新payload発行・既存案件への適用は別工程。

画面がある案件では、**設計からDatabricks Appsを既定**とする。AppKitは本ハーネスの既定UI frameworkであって、Databricksが他frameworkを禁止しているという意味ではない。人が確認する画面を、後から別部品に置換して見た目が変わる前提にしない。

## 普通の指示から進める流れ

利用者は「この資料を基にUIを設計して」でよい。次はagentの作業であり、人にJSONやコマンドの記入を求めない。

### 途中の相談と正式承認を分ける

最初は「今回の画面の配置・ラベル・密度・必要な動きを判断できるか」を確認する。実部品と共通styleで今回分を描画し、表示を妨げるエラーや実データへのアクセスがないことを確かめたら相談に出す。入力・タブ・ダイアログ等の少量の内部コードは必要に応じて作る。保存API、DB、業務計算、全状態の実装、完成版の契約/hash・独立レビューは**初回表示の必須条件ではない**。単なる時間短縮ではなく、今の判断に不要な作業を先取りしないための区別である。

全画面は既存の設計書に一覧化し、画面ごとの動作・遷移、未描画/相談中/合意済み、未決と解決期限を残す。一覧の一部を表示したことを全画面の設計完了にしない。全画面ができるまで初回相談を遅らせることもない。画面とデータ/ERは並行して詳細化し、仕様をチャットだけに置かない。未知の部品制約が配置を変えるなら、その部分だけ小さく実現性を確認する。

途中のfeedbackは変更の指示・相談の記録であり、正式なui-mock承認ではない。`ui-check --phase preview` も正式な記録整合の検査で、下書きを表示する許可コマンドではない。途中で通らない契約を無理に埋めたり、未知を削って通したりしない。正式な操作確認では下記の既存条件を全て維持する。

1. 要件と主設計、既存アプリを確認する。画面一覧・機能・項目・テーブル/ER・外部境界は並行して具体化する。UI終了後までデータ設計を省略しない。
2. Apps/AppKitを既定とする。別サーバーの画面からDatabricksを使う構造、または別UI frameworkが明示された場合だけ、対象・理由・制約と実際の人の判断を記録する。
3. 既存AppKitアプリがあれば、その部品・共通style/theme・固定した依存版でfixture画面をローカル表示する。なければ承認された開発接続でfixture-only初期化。接続未設定なら設計書は進められるが、近似HTMLで代替承認しない。実業務データは使わない。
4. 同じ部品から描画した静的HTMLは、配置・ラベル等だけの確認に使える。単独CSSやspanで似せた紙芝居は、実装予定UIの確認対象にしない。入力・状態・keyboardは同じアプリの実行可能fixtureで確認する。
5. 正式な操作確認へ進むときに下記のUI対応契約を完成させ、採用版の部品API/制約と全対象画面/状態を別contextでレビューする。tree/table等の実現方法や差異は未記録のままにしない。利用者には日本語で画面と差分を見せる。
6. 操作確認、独立レビュー、人の承認が揃ってからui-mock承認を記録。同じアプリを本実装へ延長する。データ権限や配備は別gate。

## agent用コマンド

```text
npm run harness -- delivery ui-init --contract docs/product/ui/FEATURE.json --session ID --app-root apps/NAME
npm run harness -- delivery ui-hash --contract docs/product/ui/FEATURE.json
npm run harness -- delivery ui-check --contract docs/product/ui/FEATURE.json --phase preview
npm run harness -- delivery ui-check --contract docs/product/ui/FEATURE.json --phase mock
npm run harness -- approval create --session ID --gate ui-mock --actor PERSON --evidence work/evidence/HUMAN.md --artifact apps/NAME/src/SCREEN.tsx --ui-contract docs/product/ui/FEATURE.json
npm run harness -- delivery ui-approval-check --approval work/approvals/ID/ui-mock.json --session ID --app-root apps/NAME
```

実在するID/pathへ置換。ui-initは不完全な下書きの作成だけ。上書きを拒否する。他のdelivery UIコマンドは読み取り専用。ui-checkは成功終了でも画面一致や人の承認を証明しない。失敗時は終了値が非0で理由を返す。ui-hashはレビュー対象hashの計算のみ。

## UI対応契約（agentが作成・更新）

`docs/product/ui/FEATURE.json`、schemaVersion: 1。参照refは `{path, sha256}`。正確な実行可能仕様は `tools/lib/ui-contract.mjs`、合成例は `tests/helpers/ui-fidelity.mjs`。例の架空証拠を案件へ流用しない。

| 欄 | 記録する内容 |
|---|---|
| sessionId / producer | 対象session、作成agent/context |
| requirement / architecture | sessionに結び付いた正本要件・主設計のref |
| target | hosting: databricks-apps、framework: databricks-appkit、appRoot: 対象アプリの相対path、exception: 通常null |
| target.exception | 例外時だけactor、decision: approved、hosting/framework、requirementSha256、evidence: 人の判断ref。外部はhosting: external |
| runtime | version: 解決した正確な版、manifest/lockfileのref、sources: 画面/entry/共通部品の全関連ref、styles: theme等のref、fixtures: 合成データref |
| screens | id、source: 実画面ref、components: 実部品名と対応説明、states: 対象状態ID、previews、behavior |
| previews | state、mode: runtime または runtime-html、source: 実画面/生成HTMLのref、runtimeSha256: 実画面hash、evidence: 描画コマンド/条件/観察結果/画像等のref |
| behavior | state、evidence: 入力・エラー・keyboard等の実行と観察証拠ref。mockでは全対象状態に必要 |
| unresolved | 未解決差異。確認済み判定には空が必要。差異を消して通すのでなく解決・対象見直し・再確認する |
| review | 別actor/context、status: pass、reviewedSha256: ui-hashの値、screens: 全画面ID、evidence: 独立レビューref |

AppKitのpackage.jsonとnpm package-lock.jsonで、appkit/appkit-uiの解決版と宣言の整合を検査する。対応する依存指定は正確な版、stable版のcaret/tilde。pre-releaseはexact一致。alias/URL/複合range/別lock形式は推測せず未対応として停止する。実際の依存インストール/build検証の代替ではない。独立レビューは、列挙から漏れたimport・共有style・全画面/状態がないか、元の要件から逆に確認する。

## どこで止めるか

- `approval create`: 契約なし、近似HTML、未解決差異、未確認状態、古い/自己レビュー、hash不一致を拒否。契約の全参照をreceiptへ結び付ける。
- `ui-approval-check`: 現session・現appRootを指定し、契約だけでなく人の承認receiptとの対応も再確認。通常の対話型buildで承認を使う前に実行する。
- loop: gate解除、以後のrun、provider/check実行後、完了判定で再検証する。別gateに進んでもUI承認依存を保持する。UI変更で停止した場合は差分確認と再承認後、未完了iterationの状況を記録し、必要なら新loopへ引き継ぐ。旧receipt/stateを手編集して続行しない。
- scaffold: 新規fixture-only初期化は継続。`purpose integration`で別アプリを再生成しUI承認を流用する経路は停止。旧ready計画もapply前に拒否する。既存appの部品へ通常buildで接続処理を追加する。

## 既存案件への移行

mainへのソース反映だけでは、利用中案件へ届かない。この変更を含む更新payloadの発行後、[安全な更新入口](SAFE_LOCAL_UPDATE.md)で案件を更新し、新contextで読み直す。既存0.6.1のpayloadには今回の変更は含まれない。

旧HTML・要件・設計・承認・実装は削除しない。既存UIに不足がある場合は「旧確認範囲」「実部品との差異」「未確認の状態」を記録し、実際の部品で必要部分だけ再描画する。旧承認を自動で新形式へ変換しない。現在の要件・設計・アプリについて再レビューと人の再確認を行う。アプリ全体の作り直しは既定ではない。

旧 `scaffold --purpose integration` は互換性変更の対象。Apps initをやり直さず、既存appを保つ通常buildへ移る。fixture-onlyの隔離Bundle/markerを自動解除しない。接続先・identity・権限・resource・BundleのMUSTルールと必要な人の判断を別の統合設計に記録してから進める。更新は配備権限を付与しない。

## 保証しないこと・運用

hash/schemaは、記録の整合を検査する。全import graph、画面のpixel一致、実行事実、actorの実在/本人認証、虚偽の証拠までは証明しない。任意shellや指示を無視したagentの全行動を遮断するOS sandboxでもない。標準入口の拒否、別contextでの実画面/証拠レビュー、人の画面確認を併用する。

UI契約は各1 MiB、参照各8 MiB、合計64 MiB/256fileまで。リポジトリ内の通常fileのみ、symlink等は拒否。スクリーンショットは合成データにし、資格情報を入れない。UIに関係ないbackend変更まで全ファイルhashへ巻き込まず、低コストの差分検査を先に実行する。source選択漏れはレビュー対象。ownerは案件のUI担当、失敗は現在sessionへ記録、依存版更新時は再描画・再確認する。

根拠: Databricks公式は[Appsの複数frameworkとローカル開発](https://docs.databricks.com/aws/en/dev-tools/databricks-apps)および[AppKitと開発フロー](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-development)を説明している（2026-09-15確認）。実部品で設計し承認を紐づける制約は、その上に置く本ハーネスの品質方針。
