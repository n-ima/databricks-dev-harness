# HIMP-01 受入条件の完全性 — 改善候補の証拠

状態: human-adopted / local-unreleased。2026-09-10。session: 20260909-214048-619-retrospective-hardening / task: HARD-01（元提案HIMP-01）。ユーザーの正式採用承認と対象snapshotは[採用記録](2026-09-10-acceptance-adoption.json)、[ADR-0006](../../docs/harness/decisions/ADR-0006-acceptance-integrity-adoption.md)へ保存。

## 対象

[要件](../../docs/harness/requirements/retrospective-hardening.md)のHIMP-01。[設計](../../docs/harness/design/RETROSPECTIVE_HARDENING.md)、[運用記法](../../docs/harness/operations/ACCEPTANCE_CONTRACT.md)。8件全体を完了とはしない。

変更: 新しいtools/lib/acceptance.mjs、evidence.mjs、approval.mjs、intake.mjs、tests/acceptance.test.mjs。入出力の共有検証、不正条件の拒否、要件とreviewの集合一致、承認前の最終要件検証を追加。

## 実装前後の証拠

- 初期の新規22試験: 2成功、20失敗（実装前）。[redログ](2026-09-10-acceptance-red.log)
- 独立契約指摘を踏まえ、38試験へ拡張。関連既存を含む160試験は全成功。[focusedログ](2026-09-10-acceptance-green.log)
- 全回帰: 387件中386成功、0失敗、1skip。[全回帰ログ](2026-09-10-hardening-full.log)
- 独立実装指摘IR-01〜03の追加9再現は、修正前に9件すべて失敗（全47件中38成功・9失敗）。[競合等のred](2026-09-10-acceptance-races-red.log)
- 修正後の専用47件は全成功、既存関連を含む169件も全成功。[専用green](2026-09-10-acceptance-races-green.log)、[関連回帰](2026-09-10-acceptance-races-related.log)
- 再修正後の全回帰: 396件中395成功、0失敗、1skip、18.3秒。[r2全回帰](2026-09-10-hardening-full-r2.log)。skipはこのWindowsホストでfile symlink作成が許可されない試験。directory junction拒否試験は成功しており、skipを成功に算入していない。
- harness:check成功。
- 既存accepted HARNESS.mdのH-01〜H-20と、新しいdraft要件2文書のIDを読取確認。すべて解析成功・bytes不変。draftをacceptedとみなす確認ではない。
- 案件のaccepted要件を読み取りだけで解析: AC-D01〜AC-D05を認識し、ファイルbytes不変。SHA-256: a362bd9c2c9b07b449350298997073fea2ac909041e836d4097cfddf36519b5c。案件へ新検証器を配布した意味ではない。

## 独立確認

[独立契約レビュー](../reviews/2026-09-10-acceptance-contract-review.md)の3指摘を設計・試験に反映。[初回独立実装レビュー](../reviews/2026-09-10-acceptance-implementation-review.md)では独立23試験中17成功・6失敗、原因3件を指摘。親の全回帰成功だけでは完了にしなかった。

- IR-01: H-D01/装飾IDの見出し・Unicode bulletによる条件脱落。見出しの候補判定を統一し、先頭装飾や不可視format文字も検知して元の不正記法を拒否。
- IR-02: product-intentの本文検証後、要件本文／session参照先が変化したまま承認。解析したbytesのhashを固定し、session lock内で参照・現hashの一致を再確認。
- IR-03: receiptの要件hash照合後に、別読取の小さいID集合で完了。hash照合とstatus/coverage解析に同じbytesを使用。sealも解析したreview/要件のbytesをhashへ結び付けて保存前に再確認。

修正後の8対象ファイルを固定した[独立再レビュー](../reviews/2026-09-10-acceptance-implementation-rereview.md)でIR-01〜03の解消を確認。独立28試験は全成功・0失敗・0skip。限定範囲の未解消阻害指摘なし。元22試験を維持し、IR-03の旧2回目read依存の試験を単一snapshot実装へ適合、seal競合等を5試験追加した。元試験/log/指摘と修正後証拠を別々に保持しており、失敗履歴は消していない。

独立レビューは限定snapshotへの確認であり、要件のaccepted化、正式受入receipt、8改善全体や実providerの成功を意味しない。

## スコープと限界

- 実Databricks、実provider model、UI/browser、外部配備、実DBの変更なし。CLI確認はversionとhelpだけ。
- 正式な受入要件のaccepted化・独立receipt・リリース・push・案件更新は未実施。
- ローカルhashは同一OS権限の悪意ある改ざんを防ぐ署名ではない。
- [golden task候補](acceptance-golden-candidate.json)を準備したが、固定評価catalog・予算・合否閾値は変更していない。両providerのmodel runは未実施。
- 直前のtask visibility対象17ファイルは保存したSHA-256と全件一致。先行する修正を変更していない。
- riskを既定lowで登録したHIMP-01〜08は、履歴を残してcancelledとしHARD-01〜08へ同じ対象範囲のまま引き継いだ。承認・検証・配備・dev接続に関わる01/02/03/05/07はhigh、表示・版別生成・初期化の04/06/08はmedium。immutableなtask属性は直接上書きしていない。

## Provider・費用・contextの影響

両providerが呼ぶ共有CLIの同じ入口を変更し、生成skillコピーは変更していない。新規runtime依存・network・有料model runは0。実Claude Code/Copilotの追従率・費用・時間比較は未実施。文書の厳格化で以前無視された不正文書がエラーになる互換性コストと、承認/sealでの再照合I/Oを受け入れる。広域指示を増やさず、詳細はscoped文書・失敗試験へ置いた。

## 正式採用時の確認（2026-09-10）

ユーザーの「正式採用してよい」を受け、HIMP-01だけをローカル仕様・実装として採用した。採用直前に独立レビュー対象8ファイルが一致。採用注記後も[採用整合性チェック](2026-09-10-acceptance-adoption-check.mjs)で実装・テスト5ファイルのbytes不変、文書3ファイルは指定した状態表示・リンク追加だけ、8受入条件の本文不変を確認した。

専用47件と独立担当が作成した28件を親エージェントが再実行し、75件成功・0失敗・0skip。[採用後再実行log](2026-09-10-acceptance-adoption-replay.log)。新しい独立レビューを実施したという意味ではない。harness:checkとgit diff --checkも成功。今回の新規チェックでは当初taskの引用付きfrontmatterを汎用parserで比較して失敗したが、既存のtask専用parserを使うよう修正して合格した。ハーネスruntime・テスト・判定基準は変更していない。

## 次の作業

人による今回の正式採用判断は得られた。承認対象はローカルハーネスの仕様・実装であり、push・案件更新・実DB操作を含まない。HIMP-02/07は[次slice設計](../../docs/harness/design/DEPLOYMENT_EXECUTION_CONTRACT.md)までで、実行器は未実装。残り7項目は計画上の未完了として保持する。実provider canary、release/下流更新、効果測定は別段階であり、正式採用から自動的に省略しない。
