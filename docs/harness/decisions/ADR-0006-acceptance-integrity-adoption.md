# ADR-0006: 受入条件・完了判定の強化を正式採用

- Status: accepted — ローカルハーネスの仕様・実装への採用。未公開。
- Date: 2026-09-10
- Scope: HIMP-01 / HARD-01。残り7改善の承認・完了やreleaseとは分離する。
- Authorization: このタスクのユーザーによる「正式採用してよい」。直前に提示した対象は受入条件・完了判定の強化で、push・実DB操作・個別案件反映を含まない。
- Machine-readable record: [採用記録](../../../work/evidence/2026-09-10-acceptance-adoption.json)

## Decision

共有の受入ID検証、reviewとの集合一致、承認前の最終要件検証、解析した本文bytesと証跡hash・要件参照の一致を正式仕様として採用する。採用内容は[設計の第1節](../design/RETROSPECTIVE_HARDENING.md)と[受入記法](../operations/ACCEPTANCE_CONTRACT.md)。残りの設計節は引き続き提案段階である。

[独立再レビュー](../../../work/reviews/2026-09-10-acceptance-implementation-rereview.md)のIR-01〜IR-03解消、独立28件成功と、[全回帰](../../../work/evidence/2026-09-10-hardening-full-r2.log)の395成功・0失敗・1skipを根拠とする。正式採用直前にレビュー対象8ファイルのSHA-256を全件照合し、一致を確認した。採用のためにruntime・test・受入条件本文を変更しない。

今回の変更は承認記録、文書の採用状態と相互リンク、進捗の更新のみ。独立レビューの元snapshot・失敗履歴・元logは保存する。レビュー済み3文書の採用注記によるhash変化を、未レビューの実装変更と混同せず、受入条件本文の不変とruntime/test hashの一致を再確認する。

## Scope and limits

- 人によるHIMP-01の正式採用待ちは解消した。同じ採用判断を再度要求しない。変更範囲が広がった場合は別の判断とする。
- 8項目をまとめた要件文書は全体をacceptedへ変更しない。HIMP-01の採用だけを明記し、未完了7項目を保存する。
- 現行task doneはaccepted要件全体のreceiptを必要とする。HARD-01の記録上のverifyingは維持し、採用済みであることをplan/sessionに示す。採用記録を合格receiptへ偽装したり、task属性や完了条件を緩めたりしない。
- これは人の判断を記録したADRで、actorを暗号学的に認証する署名や実行許可tokenではない。既存CLIにないgate種別を追加・偽装して承認を通さない。
- runtimeの意味変更、受入条件追加・削除、予算・権限の変更は今回行わない。実Claude Code/Copilot canaryとgolden-task比較は未実施であり、採用により成功扱いにしない。
- CommonMark全対応、同一OS権限の全writer排除、あらゆる実装への優越性は保証しない。既存の互換性コスト・限界を保持する。
- commit/push、版のrelease、個別案件への移植、実Databricks・実DB操作は未実施で、今回の承認対象外。

## Next

次の改善はHARD-02/07の検証から配備までの停止制御・候補同一性、およびHARD-08の初期化再現性。まず副作用のないfixtureで実装・検証する。正式採用と公開、案件移植、実環境での効果確認は別段階として記録する。
