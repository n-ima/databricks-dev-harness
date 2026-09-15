# 承認・品質・完了制御の事実監査

2026-09-16。独立読取監査。`review-work` と `orchestrate-work`、文書標準、品質契約、関連受入条件を読み、関連sessionと `harness:context` を確認した。実source・受入条件・資格情報・実案件・DBは変更していない。報告と再現scriptのみ追加し、試験の書込みは専用tempに限定した。

## 結論

「必要な設計・安全性・独立レビューが全て実装で担保される」という説明は強すぎる。受入ID・証拠hash・一部承認・loop予算等の実装はあるが、設計の意味、データ項目/ERの網羅、HTTP以外の外部契約、通常対話の別contextレビューは主にskillと人のレビューに依存する。品質診断は公式に参考診断として採用されており、session完了への必須機械gateではない。

加えて、通常コマンドだけで再現できるsession/loop間の状態不整合を2件確認した。どちらもローカル候補だけでなく、固定公開payload `.harness/releases/0.6.1/files` の実装で再現する。HARD-03やUIFの未採用状態とは無関係である。

## 再現した不具合

### GATE-01 / P1: loopの人の承認待ちを残したままsessionをcompletedにできる

- 箇所: `tools/lib/memory.mjs:81`、特に91–93行。`closeSession` はsessionの `gate_status` とreceiptだけを検査し、同じsessionのloopを確認しない。
- 経路: accepted要件とactive/approved sessionからloopを初期化 → 正規 `setLoopGate` で `sensitive-data-or-permission-change` をpending → 正規 `sealEvidence` → 正規 `closeSession(... completed)` が成功する。loop側はpendingのまま残る。
- 根因: `tools/lib/loop.mjs:195` のgate更新がloopに閉じている一方、完了判定はsessionに閉じている。
- 影響: 未解決の人の判断がある作業を、永続記録上「完了」とできる。実際の権限変更をこの試験で実行できたという主張ではない。
- 受入の根拠: AGENTSの「人のgateで止まる」「受入証拠なく完了を主張しない」、CLI_REFERENCEのpending gate拒否。CLI_REFERENCEはloop利用時にはloop achievedも記録するよう説明するが、順序を誤ってsession closeを直接実行した場合にこの条件を強制しない。
- 修正を受け入れる条件: 関連loopにpending gate/未完了実行があればsession完了を拒否し、session/loop間のgate状態を一貫して扱う。複数loop、旧loop、終了済みloopを含めた合成試験が必要。

### GATE-02 / P2: blockedで閉じたsessionに紐づくloopが次の実行を開始する

- 箇所: `tools/lib/loop.mjs:269`。run時はloop状態・policy・固定要件・UI承認等を検査するが、現sessionがactiveかを再確認しない。sessionのactive確認は `initLoop` の時だけ。
- 経路: active sessionからloopを初期化 → 正規 `closeSession(... blocked)` → 正規 `runLoopIteration(... execute:true)` がproviderとcheckのstubを呼ぶ。
- 影響: 作業をblockedとして閉じても既存loopは実行可能なまま。これは実行中processへの割込み可否とは別問題で、次の実行開始前に発生する。
- 修正を受け入れる条件: provider/check開始前に現sessionの状態とgateを再検証し、blocked/completed/supersededと承認待ちなら開始しない。明示再開時にのみ新しい状態へ進める。

### 再現証拠

`node work/reviews/2026-09-16-gates-truth-probe.mjs` はexit 0。ローカル、公開0.6.1それぞれで以下をassertした。reviewは合成であり業務受入ではない。provider・Git・checkは全てstubで、実providerや費用の発生する実行はない。

| 対象 | 操作後session | loop側の観測 |
|---|---|---|
| local / pending-loop-close | completed | sensitive-data-or-permission-change: pending |
| published-0.6.1 / pending-loop-close | completed | sensitive-data-or-permission-change: pending |
| local / closed-session-run | blocked | claude、synthetic-checkのstub呼出し |
| published-0.6.1 / closed-session-run | blocked | claude、synthetic-checkのstub呼出し |

再現scriptはfixtureを消さずtempに残す。今回のrootは `harness-gates-truth-imdjQE`、`harness-gates-truth-0VxK0J`、`harness-gates-truth-51c1jK`、`harness-gates-truth-ZMg05J`（Windowsユーザーtemp配下）。既存ファイルや既存承認の手編集は再現に不要。

## 明示済みの保証範囲と説明上の修正

以下を新しい実装欠陥と取り違えない。

| 対象 | 実装で確認する範囲 | 残る人/agentの仕事 |
|---|---|---|
| 要件・意図 | intakeのmaterial question未回答を拒否し、accepted要件と承認証拠を紐づける | 元資料から質問/要件が漏れていないか、回答内容が妥当か |
| 項目・テーブル/ER・非HTTP外部IF | 文書標準とテンプレートに最低属性・相互参照を定義 | 実案件の全項目/関係/制約の網羅と意味。これらを一律検証するmachine schemaはない |
| HTTP・試験 | delivery診断が受入ID完全一致、operationId一覧、正常/異常別case、IFの8観点、運用6観点、結果・環境・hashを検査 | API/リスク自体の記載漏れ、適用外の妥当性、期待値の意味、実行事実。OpenAPI全仕様validatorではない |
| 別contextレビュー | delivery verifyは異なるactor/context文字列とcoverageを検査。headless loopは実装/検証providerを分ける | actor認証・実contextの独立性。通常session receiptはcontext欄を持たず、quality診断も必須でない |
| session完了 | accepted受入IDの完全一致、pass、evidence実在/hash、policy hash等を検査 | どの実装ファイル/品質JSON/診断結果をseal対象へ選ぶか。receiptだけで全実装網羅は保証しない |
| 通常対話の安全性 | hookが既知のproduction/destructive/権限迂回command等を拒否 | 任意shell/API全行動の遮断、Databricks実権限、課金側予算。hookはOS sandboxではない |
| headless制御 | dry-run既定、反復/壁時計/process時間制限、policy/要件変更停止、Gitと隔離記録の確認 | sandboxの実構築と資格情報隔離、実provider適合、孫process停止。記録だけで実環境は作られない |

根拠: `docs/harness/operations/DELIVERY_ASSURANCE.md` の冒頭・通常手順5・末尾、`ADR-0010-human-readable-delivery.md`、`tools/lib/delivery-assurance.mjs:101`、`tools/lib/evidence.mjs:21`/57、`tools/lib/memory.mjs:81`。品質JSONをsealへ含めるのは標準手順だが、`closeSession`/`sealEvidence`から `checkDelivery` を呼ぶ接続や必須quality参照はない。これは「CIの新しい強制gateを意味しない」とする採用仕様と整合する。

費用は総額の機械保証と説明すべきでない。`loop.mjs:149` でClaudeの `maxUsd` は省略時null、指定した額は96行で各provider invocationへそのまま渡される。累積課金額を取得・差引く処理はない。Copilotは104行で各invocationに指定値/既定5 creditを渡す。CLI_REFERENCEは課金側予算とprovider側上限の確認が必要と明記する。

## PUB-POLICY / P2: 公開評価規定とL1公開判断の区別が文書上不十分

`harness/evals/golden-tasks.json:6` は `modelRuns: before-harness-release`、7行はproviderごと3回。`IMPROVEMENT_LOOP.md` も両providerのgolden-task評価の後にversioned releaseを置く。しかしVALIDATION_STATUSは実model trialsを未実施と明記し、0.6.1は公開済み。

`eval compare` は未実行・全matrix不足・不合格をpromotable:falseにする（`tools/lib/evaluation.mjs:259`–267）。一方 `release create`（`tools/lib/distribution.mjs:295`）と `tools/check-release.mjs` は梱包・版・bytesを確認するだけで、評価比較結果を参照しない。CLI_REFERENCEも「snapshot作成は公開・品質認定ではない」とする。したがってrelease作成成功やbytes一致は実モデル評価合格ではない。

`ADR-0011-safe-local-update-adoption.md:15` と公開sessionには、L1維持・実provider未確認を明示して公開する人の判断がある。よって「無承認公開」「未実施を隠した」とは断定しない。ただし探索した規定には、`before-harness-release` をL2/L3昇格へ限定する文言や、L1向け明示例外の対応付けが見当たらない。規定を条件付きにするか、今回の例外と未検証範囲を公開判断へ明確に紐づけるのが受入条件。許可なく実model試験を開始して解決する項目ではない。

## 検証範囲

- 新規の4合成scenarioが上記2件を再現した。
- ローカルの既存 `approval.test.mjs`、`contracts.test.mjs`、`delivery-assurance.test.mjs`、`hooks.test.mjs` は213成功/0失敗/0skip。既存試験の成功と新しい反例は両立する。
- 実provider、Databricks、課金、実権限、現行API仕様のlive検証はしていない。UIF/HARD-03の正式採用や公開は主張しない。
- 全不具合がないことは確認していない。再現と関連sourceの独立再確認を主担当へ依頼した。
