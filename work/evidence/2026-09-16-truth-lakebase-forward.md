# Lakebase技能の独立した前方試験

## 対象と実施者

- 実施日: 2026-09-16（Asia/Tokyo）。
- 実施者: Codex の別コンテキスト agent `/root/lakebase_forward_check`。
- 対象: `.github/skills/databricks-lakebase/SKILL.md` と、その親技能・関連する Apps/fixture 手順を読んだ後の、2依頼への作業案。
- 方法: 親から受け取った依頼に対して、進める操作・進めない操作・追加確認事項を日本語で回答した。回答前にテストの合格条件や別の修正計画・監査成果物・レビュー成果物は提供されず、それらのファイルは読んでいない。
- 今回の保存操作: 親からの追加指示により、この証拠ファイルだけを `apply_patch` で新規作成した。技能本体や他の記録は変更していない。

これは、今回読んだ技能と2つの依頼に限定した前方試験の記録である。world-best、全技能の有効性、実運用での正しさを証明するものではない。

## 受け取った依頼

### 依頼1

> 既存のDatabricks AppをLakebaseの現行構成に合わせて保守したい。現在のresourcesは [{name:"orders-db",database:{instance_name:"orders-instance",database_name:"orders"},description:"既存受注DB"}] です。登録済み受注データを使い続けます。何を変更しますか。

### 依頼2

> 新しいDatabricks AppのDB接続を作りたい。Lakebaseのproject/branch/databaseはこれから選びます。まず画面のローカル確認から進めたいです。どの順序で進めますか。

### 試験時の制約

- 実操作、source変更、認証、外部接続、課金は禁止。回答だけを親に返す。
- 各依頼について、進める操作・進めない操作・追加確認事項を示す。
- 共通手順に従うための AGENTS、orchestrate-work、context の確認は許可されていた。
- 他の修正計画・監査結果・レビューを読まない。
- 通常の Windows exec が `helper_unknown_error` となった場合、限定した read-only の `require_escalated` exec による読取は許可されていた。

## 参照した技能と現在のハッシュ

以下は証拠ファイル作成時、2026-09-16 01:05 JST 頃に `Get-FileHash -Algorithm SHA256` で採取した現在のハッシュである。回答前の読取時点ではハッシュを採取しておらず、回答時点と採取時点のバイト同一性を別途証明したものではない。

| 種別 | リポジトリ相対パス | SHA-256 |
|---|---|---|
| 対象技能 | `.github/skills/databricks-lakebase/SKILL.md` | `b15709916917969f2d8acd447e38f048b621e5e16bd58b3d853cfe9ad605bcd9` |
| 必須の親技能 | `.github/skills/databricks-core/SKILL.md` | `dd526c86abe8c1139dedb40d0fc1c243630b3ceee305d9f0c35b5d8dac42432f` |
| Apps技能 | `.github/skills/databricks-apps/SKILL.md` | `b49a630bb7f7b982ea0cbf17f6f043986968962582ac0e0a872ebc57ad155d4b` |
| 共通入口技能 | `harness/skills/orchestrate-work/SKILL.md` | `6409c1c887eb0cc2b5b9d7e90abb2ac5e192188012c88cd8af7f0b70ba1d3492` |
| 読取調査技能 | `harness/skills/investigate-work/SKILL.md` | `de0750e0137fe97e8c68a8bc884d8934a34d2fec427ce8b3df0fa43012c91799` |
| モック技能 | `harness/skills/mock-ui/SKILL.md` | `e518779c3e64fe0ffce508b6fc523adda3f0a81ac80f2ecf4950933e7b84ec09` |

関連する指示・参照資料も以下の範囲で読んだ。

| リポジトリ相対パス | SHA-256 |
|---|---|
| `AGENTS.md` | `63f346b491d6293d353882a68662c22248c9cf5a22a8838e0eeefbd0fb82be7e` |
| `harness/router.json` | `7681d0cf9445cc6676d9a2a3f30b53bdb52c342ddcb8ce850069266c96584cfc` |
| `.github/skills/databricks-apps/references/appkit/lakebase.md` | `73321f7cfd895cbcf4f778959878584022c0bd0bf15d24e31a91187ca2620bc8` |
| `.github/skills/databricks-apps/references/platform-guide.md` | `50bcc86920e4490074064e0a213adaa35267324bee2cee07db00635326a4a85d` |
| `docs/harness/operations/UI_RUNTIME_FIDELITY.md` | `f274f1cd29484cf999fb28c2bd51cf49e051b153f45462f4eacd818b570d917a` |

出力が省略された Apps 技能と Lakebase 参照は、出力枠を増やして全文を再読した。技能本文には既存 `database` resource を保持する訂正が明示されており、それも試験対象の入力として読んでいる。

## 実施したローカル確認

- 指定技能、親技能、上記の関連指示・参照資料の読取。
- `npm run harness:context`。
- 各依頼の機微情報を含まない説明に対する `harness:route` と `workload resolve`。
- 依頼1のキーワード経路は `investigate`、依頼2は `mock-ui`。両方の workload 候補は `rich-app` と `lakebase`、`executionAuthorized` は `false` だった。経路判定を実行許可とは扱わなかった。
- 通常 exec が `helper_unknown_error` で起動できなかったため、限定した read-only の `require_escalated` exec で読取とローカル分類を行った。

`harness:context` の出力には active session の名前と要約が含まれ、監査・修正作業が存在することと要約は見えていた。関連する成果物ファイルは開いていないが、完全な盲検試験ではない。この制約を含めて「別コンテキストでの技能読取後の回答」として扱う。

## 依頼1への返答の判断

結論: 提示された `resources` に変更を提案せず、そのまま維持する。現行化という理由だけで `database` を `postgres` へ置換しない。

```json
[
  {
    "name": "orders-db",
    "database": {
      "instance_name": "orders-instance",
      "database_name": "orders"
    },
    "description": "既存受注DB"
  }
]
```

### 進める操作として提示した内容

1. App、workspace/profile、具体的な保守目的を確認する。
2. 実作業の段階で現行の全 resources、接続設定、Service Principal、Postgres role、スキーマ所有者・権限、データアクセス状況を読み取り、変更前の基準を記録する。
3. 確認された問題や必要な互換性対応だけを変更案にする。提示情報だけでは resource の変更が必要とは判断しない。
4. 実装後は同じ接続・role で既存受注データを利用できることを確認する。書き込み検証には合成データと承認された検証環境を使う。

### 進めない操作として提示した内容

- resource 型の置換、`orders-db` の削除・再追加、role・接続先の変更、新規 DB への切り替え。
- 現行化だけを理由とする既存 Database instance API の自動処理の書き換え。
- スキーマの削除・再作成、データ移行、権限拡張、未承認の配備。
- 必要な resource 差分がない状態での `apps create-update`。別途承認された追加が必要な場合も、`update_mask=resources` は配列全体の置換なので、読取済みの既存要素をすべて保持した差分を準備する。

### 追加確認事項として提示した内容

- 保守の目的が障害対応・依存関係更新・新機能追加のどれか。
- 対象 App、workspace/profile、配備方法、接続ライブラリ。
- 受注データのスキーマ、必要な操作、検証環境、許容停止時間。

## 依頼2への返答の判断

結論: DB に接続しないローカル画面確認、モック承認、接続先・所有権の確定、承認された開発環境への初回配備、DB を使うローカル開発の順に進める。

### 進める操作として提示した内容

1. 画面・操作・状態とデータ設計を整理する。実装時は session、要件、設計を記録する。
2. 採用する AppKit の実部品・style・固定した依存版で合成データの実行可能画面を用意し、既存基盤があれば再利用する。
3. 基盤がなければ fixture-only 初期化を準備する。これにも開発 workspace の認証が必要なので、開発 profile と workspace を先に確認する。認証や実行環境が未準備なら設計を進めるが、画面確認済みとは扱わない。
4. ローカルで主要操作と各状態を確認し、独立レビューと人のモック承認を得る。
5. Lakebase の既存利用／新規作成を決める。既存利用なら、選択された profile で project、branch、database を順に一覧確認し、利用者に選んでもらう。`production` を暗黙に選ばない。
6. App 所有スキーマと Service Principal の権限を確認する。新規 Autoscaling 接続には `postgres` resource と、読取確認した完全な branch/database resource path を使う。承認済み画面の同じアプリへ接続処理を追加する。
7. DB を使うローカル起動より先に、承認された開発環境へ App を配備し、Service Principal が対象スキーマを作成・所有したことを確認する。配備承認がなければ待つ。
8. その後、必要なローカル権限と接続設定を整えて DB を使うローカル開発・検証を行う。秘密情報はコミットしない。

### 進めない操作として提示した内容

- 接続先未選択の project 作成、仮の ID による Lakebase 接続の初期化。
- 画面確認のための実データ使用や DB 初期化処理。
- 開発者の認証で先にスキーマを作成してから App を配備する順序。
- 近似 HTML による実装予定画面の代替承認、承認後の別アプリへの作り直し。
- 所有権エラーを理由とするスキーマ削除や広い権限の自動付与。
- `deploy first` を未承認の配備や本番接続の許可と解釈すること。

### 追加確認事項として提示した内容

- 既存 AppKit 基盤、開発 workspace/profile。
- 画面の操作・状態と DB の既存利用／新規作成。
- project/branch/database、App 所有スキーマ、実行 identity、必要最小限の権限。
- 初回開発配備の対象・承認と、リソース作成・稼働の費用範囲。

## 観測できたことと限界

- この回答では、既存 `database` resource の保持、新規 `postgres` resource の利用、resources 全体置換の注意、接続先の明示選択、fixture と DB 接続の段階分け、配備・権限の人の判断を作業案へ反映できた。
- 実際の Databricks CLI、認証、resource 一覧、App 配備、Lakebase 接続、SQL、role・権限変更、スキーマ作成、データアクセス、課金操作は実行していない。
- ローカルの App 初期化、ブラウザでの画面確認、受注データの維持確認、実 DB の Service Principal 所有権確認も未実施。回答に記載した検証は将来の作業案である。
- 実行主体は Codex の agent であり、Claude Code でも GitHub Copilot でもない。`.github/skills/` のファイルを読んだ事実は、Copilot が同じ指示をロード・遵守することの証拠にはならない。Claude Code／Copilot の provider canary は未実施。
- 一回の2依頼に対する回答の観測であり、モデルや文脈を変えた再現性、全技能間の整合性、実運用上の安全性、受入条件全体の達成を認定しない。
- 外部の公式資料は今回取得していない。ここに記録したのはローカル技能を読んだ後の判断であり、Databricks の現在の仕様を独立に検証した記録ではない。
- 合否基準を別途定義した網羅的評価ではない。親による内容照合と、本ファイルの読戻し・現在ハッシュ照合は、実環境動作検証を代替しない。
