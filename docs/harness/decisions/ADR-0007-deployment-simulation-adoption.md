# ADR-0007: ローカル模擬配備・候補識別を正式採用

- Status: accepted — ローカルハーネスへの採用。未公開。
- Date: 2026-09-10
- Scope: HARD-02/07のsimulation-only部分。HIMP-02/07全体の採用・完了ではない。
- Authorization: このタスクで、直前に提示した「ローカル模擬試験機能の正式採用。実配備・公開の承認は含まない」に対するユーザーの「正式採用してよい」。
- Machine-readable record: [採用記録](../../../work/evidence/2026-09-10-deployment-adoption.json)

## Decision

固定fixtureによる配備停止制御、候補入力とpolicy/dispatcherのraw-byte識別、fixture承認範囲との一致、合成配備/health記録と読取CLIを正式採用する。対象は[実行契約のsimulation-only範囲](../design/DEPLOYMENT_EXECUTION_CONTRACT.md)と[操作手順](../operations/DEPLOYMENT_SIMULATION.md)。

根拠は[独立再レビュー](../../../work/reviews/2026-09-10-deployment-simulation-rereview.md)のIR-01〜04解消と、専用62試験・独立32試験の成功、[全回帰](../../../work/evidence/2026-09-10-deployment-full-regression-r2.log)の457成功/0失敗/1既存skip。これらは別suiteで重複coverageを含み、単純合計を固有scenario数とはしない。

採用直前にレビュー対象11fileのSHA-256一致を確認した。実装・試験・既存policy・元レビュー・元の失敗log・合成観測のbytesを変更しない。採用のために変更するレビュー済み文書は、設計と操作書の採用状態・ADRリンクの1行ずつだけ。許可した注記差分を機械可読記録へ残し、それ以外の本文が不変であることを照合する。

採用後にmainが同じ専用/独立試験を[再実行](../../../work/evidence/2026-09-10-deployment-adoption-replay.log)し、94件成功・失敗0を確認した。元の独立レビューと、実装者による追試を区別する。既存HIMP-01の採用確認、harness check、差分検査も成功した。

## Scope and limits

- 今回の限定採用待ちは解消。同じscopeへの採用判断を再度要求しない。
- 採用は実Databricksの接続・配備・DB作成、実承認/権限/費用、公開、案件反映を許可しない。実CLI adapterは未実装。
- 合成成功は実アプリのbuild/test成功・実配備成功・現在稼働を表さない。fixture approvalを実承認へ流用しない。
- [HIMP-01の正式採用](ADR-0006-acceptance-integrity-adoption.md)は維持。今回の記録は別の限定scopeであり、その既存記録や検証器を変更しない。
- 8項目の要件文書はdraftのまま。HIMP-02/07の残りとHARD-03〜06/08は未完了。元の受入条件・task done条件・verifier・budgetを緩めない。
- HARD-02/07はverifyingを維持する。現行task doneが要求するaccepted要件全体のreceiptは未作成であり、この採用記録を代用しない。
- canonical golden-task提案は未昇格。Claude Code/Copilotのモデル付き評価、実環境適合性・実artifact同一性・製品runtime表示は今回の採用で合格扱いにしない。
- ローカル記録は人の判断の記録であり、actor認証の署名や実行許可tokenではない。同一OS権限writerの完全統制を保証しない。
- versionは0.4.0のまま。commit/push/releaseと下流更新は行わない。

## Next

次の改善対象はHARD-08: 未初期化fixtureと案件fixtureの分離、および生成先の想定/実ルートの安全な検査。改名・上書き拒否を保ち、未知の出力を再帰移動しない。今回の採用記録のみでHARD-08の着手・完了を主張しない。
