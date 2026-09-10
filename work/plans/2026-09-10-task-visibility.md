# RH01〜RH03 最小実装の作業計画

対象session: 20260909-162346-724-task-visibility-and-reliable-resume。
ハーネス共通コードだけを変更する。実Databricks、案件、CreateAppl、commit/push、releaseは対象外。

| ID | 作業 | 状態 | 証拠 |
|---|---|---|---|
| TV01 | 要件・設計の最小仕様を固定 | 原稿作成済み・未承認 | docs/harness/requirements/task-visibility.md |
| TV02 | 9session/旧checkpoint/タスク不正更新を再現するtest | 初回18件に修正回帰6件を追加、24件成功 | tests/task-visibility.test.mjs |
| TV03 | 永続taskと共通status/context、checkpointを実装 | 初回指摘F-01〜F-03を修正、独立再レビューで全件解消 | work/reviews/2026-09-10-task-visibility-re-review.md |
| TV04 | 自然言語workflow・利用手順へ統合 | 反映・同期・構造検査済み | canonical skillとCLI reference。実host試験は未実施 |
| TV05 | 回帰・実CLI/両hookfixture・引継ぎ | 自己検査と独立再実行で成功 | 全体348 pass / 0 fail / 1 skip。work/evidence/2026-09-10-visibility-fixes.md |
| TV06 | 独立レビューと実provider canary | 独立再レビュー完了・実provider未実施 | work/reviews/2026-09-10-task-visibility-re-review.md |

現在: 今回依頼されたF-01〜F-03の修正と独立再レビューは完了。全件解消、新規阻害指摘なし。新規6試験は修正前6 fail→修正後成功、独立全回帰348 pass / 0 fail / 1 skip。work/evidence/2026-09-10-visibility-fixes.mdを参照。HVIS-01全体は実provider canaryと要件受入が未実施のためverifyingを維持。公開は行っていない。

## 独立指摘の修正・再レビュー

| ID | 作業 | 現在 |
|---|---|---|
| F-01 | 不正verifier参照の保存前拒否と拒否後の利用継続 | 修正・独立確認完了、解消 |
| F-02 | 旧checkpointのblocker引継ぎと明示none | 修正・独立確認完了、解消 |
| F-03 | 置換前blocker本文の履歴保全 | 修正・独立確認完了、解消 |

HVIS-01の完了には要件全体の受入が必要。3件の修正だけを理由にdoneやsession完了にしない。
