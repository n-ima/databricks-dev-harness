# 日本語文書・品質契約の独立設計再レビューと模擬利用

- 日付: 2026-09-15 JST
- レビュー担当: `/root/human_docs_design_review`（原作者 `/root` とは別agent context）
- 結論: HDR-01は解消。この限定した設計再レビューと模擬利用に未解消の阻害指摘なし。実装・生成処理・実provider・実環境の受入を意味しない。
- 変更範囲: 確認済み結果をこのレビュー記録に保存することのみ。レビュー対象の実装・設計・スキルは変更していない。

## 対象と確認方法

最初に `AGENTS.md`、`orchestrate-work`、`review-work` を読み、関連sessionを `npm run harness:context` で確認した。対象は [要件](../../docs/harness/requirements/2026-09-15-human-readable-delivery.md)、[設計](../../docs/harness/design/HUMAN_READABLE_DELIVERY.md)、[採用ADR](../../docs/harness/decisions/ADR-0010-human-readable-delivery.md)。前回候補設計、独立再レビュー、今回計画、既存の品質・安全性・UI標準と照合した。

修正後は更新された `orchestrate-work`、`define-work`、[文書標準](../../docs/harness/operations/DOCUMENTATION_STANDARD.md)を全文確認し、参照される運用モデル・要件ひな型・品質契約ガイド・platform playbook・workload定義も確認した。本文の省略された取得結果は再取得した。

## HDR-01 [P2] — 解消

### 初回指摘

要件HD-02は用語・業務・機能・データ・画面・遷移・外部境界を列挙するが、初回設計は「文書標準をoperationsへ置く」までだった。定義の最低属性、ID対応、未確定事項の具体的な扱いを確認できる正本への参照がなく、見出しだけの文書と実装判断に使える定義書を区別できなかった。

受入条件は、簡潔な文書標準を正本としてリンクし、各一覧の必要属性、ID間の対応、未確定・仮定・適用外の区別と対象slice実装前に解決する事項を明記すること。小案件で別紙の大量作成は求めていない。

### 修正の確認

- `HUMAN_READABLE_DELIVERY.md:9` から実在する文書標準へリンクされ、最低属性・ID対応・未確定の扱いを正本に委ねている。
- `DOCUMENTATION_STANDARD.md:25` 以降に、用語・業務・機能・データ・項目・画面/遷移・外部境界・試験の必要属性がある。データの粒度・所有者・型/NULL・出典、外部境界の送受信・認証・失敗/再送等を含む。
- 同文書40行で、業務→機能→画面/外部IF→データ項目→受入条件→テスト→証拠をIDで対応付ける。
- 同文書44行以降で、未確定に質問ID・判断担当・解決工程を求め、仮定と適用外を区別する。
- 同文書62行で、全欄「未確定」や文書の存在、JSON整形成功を実装準備完了や業務受入にしない。

以上は初回指摘の受入条件を満たす。

## 維持された設計境界

- 軽量HTMLは、配置・ラベル・導線の不確実性を低コストで確認する任意工程。入力・状態・keyboard操作を確認するならfixtureモックから開始できる。
- 紙芝居承認だけでは `ui-mock` を解除しない。本実装コンポーネント・fixture・状態・アクセシビリティの確認版を承認へ対応付ける。
- API-onlyへUI工程を要求しない。小案件は要件書と設計書の表にまとめ、必要な部分だけ詳細化する。
- 診断は参考情報であり、既存receipt・承認・実行事実・本人認証を代替しない。
- 入力資料や仮定を承認に変換せず、承認済み文書を一括翻訳しない。採用方針と実装検証の完了を区別する。

## 別contextでの模擬利用

### 模擬依頼

> 受注APIと取込バッチを作りたい。画面は不要。取引先仕様のCSVに受注日/商品コード/数量があるが重複時ルールは未決。担当者が日本語で要件と項目を確認したい。まだ実装やDB接続はしない。

この節は更新されたスキル・文書から導いた対応のシミュレーション。案件文書・品質JSON・アプリは実際には生成していない。

### 行うこと・作るもの

「要件定義のみ」と扱い、対象案件に既存資料があれば確認する。明示済みのAPI＋CSV取込バッチ、画面不要、日本語文書、実装・DB接続なしを記録する。

日本語の要件書と設計書を主な2文書にし、業務・用語・機能・データ項目・外部境界を表で整理する。計画・質問台帳・sessionと品質契約案を対応付ける。技術製品や保存先は要求から自動確定しない。

| 項目 | 依頼から分かること | 未確認事項 |
|---|---|---|
| 受注日 | CSVに存在するとの利用者申告 | 業務上の日付の意味、形式、必須性、許容範囲 |
| 商品コード | CSVに存在するとの利用者申告 | 桁数、先頭ゼロ、文字種、参照先、必須性 |
| 数量 | CSVに存在するとの利用者申告 | 単位、小数可否、ゼロ/負数、上限、必須性 |

CSV原本は未提供・未読のため「取引先仕様で検証済み」とは記録しない。3項目を重複判定キーとは決めない。APIとバッチの関係、CSV一行の意味、受注の識別、重複/訂正/再送規則、APIの呼出元・操作・応答、項目型・制約、正本と責任者は未確定として残す。

### 質問の優先順位

最初は次の事項に絞り、既存の仕様で回答できるものを先に確認する。

1. APIが受け付ける受注とCSVバッチは、同じ受注を扱う別経路か、バッチがAPIを呼ぶ関係か。
2. CSV仕様の正本と一行の意味、同じ受注を識別する情報は何か。
3. 重複ルールを決める担当者は誰か。未決の間は該当処理の実装前に解決する質問として保持する。

頻度・件数・期限・訂正・認証等は質問台帳へ残す。cloud/editionやDB選定の未確定は、現在の文書作成を止める理由にしない。未決の業務規則を仮定で承認済みにしない。

### 適用外・実施しないこと

画面一覧・画面遷移・HTML紙芝居・UIモック承認は、利用者が画面不要と明示したため適用外。認証やデータ保持など未回答の事項は適用外にせず、未確定として扱う。

アプリ/バッチ実装、fixture server生成、DB/OAuth接続、resource作成、試験実行、承認記録の作成には進まない。重複時の上書き・無視・エラー等を推測で確定しない。

品質契約案には通常・不正形式・欠損・同一ファイル再投入・重複・部分失敗の観点を置ける。ただし重複時の期待結果は判断待ち、実行結果はすべて `null`。JSON生成成功を設計合格とはしない。HTTPの仕様が未定でも、HTTP境界を空欄にして隠さない。CSV境界はデータ契約のartifactと対応試験として扱う。

## 独立して実行したローカル分類

Windows / PowerShellのローカルCLIで次を確認した。実装試験ではなく、スキルが利用する分類入口の確認である。

```text
npm run harness:context -- --session 20260914-230811-631-human-readable-delivery-adoption
npm run harness:route -- --prompt "受注APIと取込バッチの要件と項目を日本語で定義する。画面不要。重複ルール未決。実装とDB接続は禁止。" --intent define
npm run harness -- workload resolve --prompt "受注APIと取込バッチ。取引先CSVの受注日、商品コード、数量を扱う。画面不要。要件定義のみ。" --without rich-app
npm run harness -- workload resolve --prompt "受注APIとCSV取込バッチの要件定義。画面不要。実装とDB接続なし。" --workload api --workload data-pipeline --without rich-app --without ingestion
```

- route: `define` / `define-work` / firstGate `product-intent` / `executionAuthorized:false`。
- heuristic: `api / data-pipeline / ingestion`。取込という語からmanaged ingestionまで拾った。これを承認された構成とは扱わなかった。
- 明示選択: `api / data-pipeline`、除外 `rich-app / ingestion`、`mode:explicit-selection`、`needsDiscussion:true`、`executionAuthorized:false`。

`orchestrate-work` の「分類はヒント、明示意図で修正する」を適用すると、UIやCDC/streamingを勝手に追加せず進められた。これはハーネスの分類区分であって、Apps・Delta・Lakeflow等の製品構成の確定や利用可能性の証明ではない。提供方式・永続化の選定は引き続き設計上の判断事項。

## Snapshot (SHA-256)

最終記録保存前にも以下4ファイルのhashを再確認し、模擬利用時と一致した。

| 対象 | SHA-256 |
|---|---|
| harness/skills/orchestrate-work/SKILL.md | c0e42b8305fdc1360bbc320f7b24b32c81ab4dfe8266196d5378ac5ff2f2d7eb |
| harness/skills/define-work/SKILL.md | 4f8a2b91a761dda15f27e6ca134fb4d8b0a8a223d58068b903921c1775383738 |
| docs/harness/operations/DOCUMENTATION_STANDARD.md | 9efa954e8bbca8918af41e9a0d8e05c9961da2335a1f94d2ce3ac7f6722538c0 |
| docs/harness/design/HUMAN_READABLE_DELIVERY.md | 72ff0637b5355fe022af2fe470b862ca974719025acda9b8983f74c26d1e3f76 |

初回設計レビューの対象bytesは次の通り。初回設計は修正前であり、上表と区別する。

| 対象 | 初回SHA-256 |
|---|---|
| docs/harness/requirements/2026-09-15-human-readable-delivery.md | 51ea7b7046c86dbecb8c7fa265624858950cce1a44b96e3a77aa5b68c3b95b1b |
| docs/harness/design/HUMAN_READABLE_DELIVERY.md | ab61f30924a8fc35cf69296eb166b3ae2a3f47f1afefc5281405d52088a1796d |
| docs/harness/decisions/ADR-0010-human-readable-delivery.md | 19263304fa01fb6d390c86540b772212a4807853045c1d0a0dbd1834b15c6f44 |

## 検証境界と残り

HDR-01の修正、HD-02の定義方針、HD-04のUI適用判断、HD-05の自然言語入口に関するスキル上の対応を確認した。HD-01の診断実装・配布、HD-02の実生成、HD-03の互換性回帰、HD-05のprovider同期・実provider挙動を、この記録で受入判定していない。

コード生成処理・実装コード・試験suiteは別担当の検証範囲。実provider、Databricks、DB、課金、remote操作、外部出典の再取得は未実施。この模擬利用は別contextでの指示解釈とローカル分類の証拠であり、Claude Code / Copilotの実host canaryを代替しない。

次は親taskが実装・生成・回帰・配布の独立検証とこの結果を統合し、sessionへ現在地と未検証境界をcheckpointする。設計指摘の解消だけで案件やハーネス全体の完了を主張しない。
