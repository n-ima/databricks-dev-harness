# 品質契約の再監査報告・計画に対する独立レビュー

- Date: 2026-09-14 JST
- Reviewer: delivery_contract_design_review（実装・報告作成とは別agent context）
- Scope: 調査報告、設計、要件、計画。コードの技術レビュー・実環境検証・正式採用判断は対象外。
- Status: changes-requested — P2の文書補足2件。P0/P1の指摘なし。
- Method: orchestrate-work / review-workを読み、harness:context、review route、関連セッション、既存品質・受入・証拠規約を確認。仕様・コードは変更せず、このレビュー記録だけを作成した。

## レビューしたsnapshot

SHA-256はレビュー時点のbytes。後続修正で変化した場合、この表を付け替えず再確認記録を追加する。hashやcontext名は本人認証ではない。

| File | SHA-256 |
|---|---|
| docs/harness/research/2026-09-14-delivery-assurance-reaudit.md | 96bc65f2fa6b7ed814231239974d6b4f001a9fcef8fcd40955a02925ae697574 |
| docs/harness/design/DELIVERY_ASSURANCE.md | 43ac5bea2b4a8763649121912eb94fa3d096230b2bf781e71fc19716e0bb1ee0 |
| docs/harness/requirements/2026-09-14-delivery-assurance.md | b4734ac640df40cac5ce22c8040b3622eec1a8e4411c95acfb27eef7b4bb7716 |
| work/plans/2026-09-14-delivery-assurance.md | f746181506cf6bdf8d0975c2063976253bdb99fda08f75148651cd81990606bb |
| work/candidates/delivery-assurance/README.md | 5b44bfd3e5475c1701df62923cd7a222292480118b4350f81c06eb56ddf2239a |

## 指摘

### DRR-01 / P2 — 費用と人の負担の測定方法が項目列挙にとどまる

対象: 報告「費用・時間・人の負担」「評価計画と採用順序」（97–120行）、要件AC-08。

報告は総費用、受入成果当たり、人の介入を評価するが、取得元、数え方、欠測、分母を定めていない。既存 tools/lib/evaluation.mjs:229–270 は各runのwallSeconds/humanInterventionsとprovider別creditsの平均を集計する。provider間creditの金額換算や、承認と修正指示の分類、Databricks待機・保持・保守費用はこの集計からは得られない。「既存evaluationを使う」だけではAC-08の測定方法を満たさず、後から都合のよい比較を選べる余地が残る。

受入条件: 報告または計画に小さな測定表を加える。最低限、(a) provider課金記録とDatabricks利用明細等の取得元・単位・対象期間、(b)取得不能はunknownで0にしない、異種creditsを合算しない、(c)介入1回の定義と必須承認/再説明・修正の区別、(d)失敗試行も含む総費用と受入数による集計、受入0件時は算出不可、を定める。人の作業時間を費用換算する場合のみ単価・時間記録を追加し、未測定なら別途unknownとする。新しい計測サービスや評価器変更、課金実験は不要。

### DRR-02 / P2 — 現行command hookに直接関係するtimeout条件が抜ける

対象: 報告47行、GitHub hooks出典14。

報告はHTTP preToolUseのfail-openを説明するが、参照した公式資料の同じ節にはcommand preToolUseもtimeout時は通常permission flowへ戻るとある。現行 .github/hooks/harness.json はtype:commandのpreToolUseにtimeoutSec:10を設定している。HTTPだけに触れると、現行adapterに直結する未検証条件が読み手に伝わらない。これはhostの現挙動を再現した不具合指摘ではなく、報告から落ちている公式仕様と確認課題である。

受入条件: command hookの非zero/crashとtimeoutを区別し、timeoutは既定permission flowへ戻るという公式条件を追記する。実provider canaryで正常・明示拒否・非zero・timeoutと外側permissionの組合せを確認する計画を一文で残す。今ここでhook修正、権限変更、timeout実験を行う必要はない。

根拠: [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)、preToolUseのCommand vs HTTP fail behavior節（2026-09-14 JST確認）。

## 確認できたこと

- 過去の comprehensive-reaudit は契約、運用、費用、未知ケース、別contextを既に扱う。報告の「未調査だけが原因ではない」という区別は妥当。
- 現行の要件ID集合一致、選択artifactのhash、API fixtureを維持し、追加診断を既存receiptの代替にしない。旧設計レビューの4事項は設計文書に具体化されている。ただし実装適合は別技術レビューで確認する。
- 公開事例の効果量を自環境の成績に転用せず、モデル一覧とアカウント可用性を分け、3反復を統計的優越の証明にしない。世界順位・完全網羅・16領域完備の過大主張は確認されない。
- 運用責任、SLO、通知、復旧・backup、保持、費用、依存更新、廃止、匿名化knowledgeへの還元を含む。現行運用実績は未検証と明示する。別監視アプリや一律SLOの追加は求めていない。
- 固定版、互換性、license、非破壊更新、独立レビュー、人の採用判断を含む。後段のlive評価と配布の完了を現在のローカル候補から推定しない。

## 一次資料の独立確認範囲

全26出典の再監査ではなく、採否や安全境界を左右する節をサンプル確認した。全文の精読・外部効果量再計算はしていない。

| Source | 今回の確認 |
|---|---|
| [OpenAPI latest](https://spec.openapis.org/oas/latest.html) / [3.2.1](https://spec.openapis.org/oas/v3.2.1.html) | latestのversionが3.2.1、日付2026-09-10。candidateの全仕様適合を検証したものではない |
| [Databricks agent skills](https://docs.databricks.com/aws/en/agent-skills/) | skillsとmanaged MCPの役割差、旧AI Dev Kit skillsのdeprecated表示 |
| [Lakebase Data API](https://docs.databricks.com/aws/en/oltp/projects/data-api) | schema由来CRUD/RPC、PostgRESTの独立互換実装、authenticatorと利用roleの設定が別途必要な境界 |
| [Anthropic long-running harness](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 生成/評価分離と評価器校正。報告の自環境への効果量の非転用と整合 |
| [GitHub hooks](https://docs.github.com/en/copilot/reference/hooks-reference) | HTTP失敗とcommand timeoutのpermission flow、DRR-02の根拠 |

モデル全一覧、課金単価、Free Edition条件、全OWASP/SRE項目は今回独立再確認していない。報告内の確認記録を本人性や全文監査の証拠に読み替えない。

## 未確認と引継ぎ

候補check.mjsの正しさ・回帰件数の再実行は別agentの技術レビュー対象。作成中の work/evidence/2026-09-14-delivery-assurance.md はこのsnapshotレビューに含めていないため、報告の556成功/1skipや最終hashの証明には使っていない。最終報告時にメイン担当が証拠リンクの実在、集計結果、修正後snapshotを照合する。

次: DRR-01/02を文書に反映し、このレビュー担当が差分を再確認する。新機能の追加や既存評価器の変更を要求するものではない。AC-01/05/06/08の記述面を確認した範囲に限り、全ACの受入や正式採用を宣言しない。
