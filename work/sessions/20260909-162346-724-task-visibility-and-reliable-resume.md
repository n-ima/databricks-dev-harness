---
id: 20260909-162346-724-task-visibility-and-reliable-resume
title: task visibility and reliable resume
status: active
intent: improve-harness
provider: codex
phase: review
gate: none
gate_status: not-applicable
started: 2026-09-09T16:23:46Z
updated: 2026-09-09T20:49:00Z
last_checkpoint: 2026-09-09T20:49:00Z
requirement: docs/harness/requirements/task-visibility.md
architecture: docs/harness/design/TASK_VISIBILITY.md
plan: work/plans/2026-09-10-task-visibility.md
branch: unassigned
worktree: .
resources: none
checkpoint_format: 2
focus_task: HVIS-01
---

# Work session: task visibility and reliable resume

## Objective

RH01〜RH03の最小実装として永続タスク、現在地表示、focus付き再開、checkpointの現状更新を追加する。承認・policy・完了validatorの判定は変更しない。

## Verified current state

- 依頼されたF-01〜F-03の修正と独立再レビューが完了。全3件解消、新規阻害指摘なし。独立全回帰348 pass/0 fail/1 skip、追加probe6群成功。HVIS-01全体は実provider未試験・要件draftのためverifyingを維持。

## Decisions

- taskを正本、status/contextを共通投影とする。実行processの監視とは分離する。
- task doneは既存receiptと証拠を要する。自己試験までの今回はverifyingで止める。
- skillへの追加は入口2項目に絞り、詳細はdocs/harness/operations/TASK_VISIBILITY.mdへ分離した。

## Progress and evidence

- 2026-09-09T16:23:46Z — Session started.

## Next actions

- 今回の修正・再レビュー結果を報告。全体受入へ進むには実Claude Code/Copilot canaryの対象環境と範囲を確認し、最終受入の判断を得る。公開・実DB操作は別途。

## Blockers and human gates

- 今回3件の未解消指摘なし。HVIS-01全体の実provider試験と要件の最終受入は未実施。

## Handoff

- 要件AC-01〜AC-07、設計、work/evidence/2026-09-10-task-visibility.mdと実差分を別reviewerへ渡す。実providerの動作や独立確認が済んだと推定しない。

## Previous state archived 2026-09-09T16:46:27Z

### Previous verified current state

- Repository inspection is pending.

### Previous next actions

- Read linked requirement/design, resolve material questions, then take the smallest complete slice.

## Checkpoint 2026-09-09T16:46:27Z

- summary: task/status/contextとcheckpoint更新を実装。追加18試験成功。全回帰の最終再実行と差分確認を行う。実provider・独立レビューは未実施。
- evidence: work/evidence/2026-09-10-task-visibility-tests.log
- next: 全回帰結果を証拠に記録し、HVIS-01をverifyingとして独立レビューへ渡す。
- task: HVIS-01

## Checkpoint 2026-09-09T16:49:55Z

- summary: RH01〜RH03の最小実装と追加18試験、全回帰342 pass/0 fail/1 skipを確認。HVIS-01はverifying。実provider・独立レビュー未実施、公開・pushなし。
- evidence: work/evidence/2026-09-10-task-visibility.md
- next: 独立レビューを別担当へ依頼し、AC-01〜AC-07を実差分と試験で確認する。provider canaryの範囲・利用環境は別途確認。
- blocker: 独立レビュー担当と実provider canaryが未確定。実装完了の認定は保留。
- task: HVIS-01

## Checkpoint 2026-09-09T17:11:35Z

- summary: ユーザーのOKを受け、別エージェントvisibility_independent_reviewがRH01〜RH03の独立レビューを実施中。実装・仕様・テストを固定し、親は記録のみ更新。HVIS-01はverifying、要件はdraft。
- evidence: work/evidence/2026-09-10-task-visibility-review-request.md
- next: 独立レビューの再現結果とAC対応を照合し、指摘・検証限界・次の作業を記録する。
- blocker: 独立レビューの結果待ち。要件受入と実Claude Code/Copilot canaryは未実施。
- task: HVIS-01

## Checkpoint 2026-09-09T17:19:51Z

- summary: 独立レビュー完了。P1 1件/P2 2件を再現し要修正と判定。親も3件を追試。全回帰は独立再実行で342 pass/0 fail/1 skip。実装は未修正、HVIS-01はverifying、要件はdraft。
- evidence: work/reviews/2026-09-10-task-visibility-independent.md; work/evidence/2026-09-10-task-visibility.md
- next: F-01の不正verifier参照保存、F-02の旧blocker引継ぎ、F-03のblocker履歴消失を修正し、反例を回帰へ追加して修正版を独立再レビューする。今回はレビュー結果を報告して終了。
- blocker: 独立レビュー指摘3件が未解消。実Claude Code/Copilot canaryと要件の最終受入も未実施。
- task: HVIS-01

## Checkpoint 2026-09-09T20:30:14Z

- summary: ユーザーが3件の修正と再レビューを指示。修正前ソースは独立レビューsnapshotと一致。HVIS-01をrunningへ戻して再発防止テストから着手。
- evidence: work/reviews/2026-09-10-task-visibility-independent.md
- next: F-01〜F-03の失敗テストを先に確認し、最小修正、全回帰、別エージェントの独立再レビューを行う。
- blocker: 修正作業を止めるblockerなし。要件の受入・実provider試験・公開は別途未実施。
- task: HVIS-01

## Previous state archived 2026-09-09T20:38:13Z

### Previous verified current state

- ユーザーが3件の修正と再レビューを指示。修正前ソースは独立レビューsnapshotと一致。HVIS-01をrunningへ戻して再発防止テストから着手。

### Previous next actions

- F-01〜F-03の失敗テストを先に確認し、最小修正、全回帰、別エージェントの独立再レビューを行う。

### Previous blockers and human gates

- 修正作業を止めるblockerなし。要件の受入・実provider試験・公開は別途未実施。

## Checkpoint 2026-09-09T20:38:13Z

- summary: F-01〜F-03を最小修正、新規6件を修正前失敗/後成功で確認。全回帰348 pass/0 fail/1 skip。修正版17fileを固定し、別エージェントvisibility_fix_reviewが独立再レビュー中。
- evidence: work/evidence/2026-09-10-visibility-fixes.md
- next: 独立再レビュー結果を受けて3指摘の解消と残る条件を照合し、証拠・計画・現在地へ記録する。
- blocker: 独立再レビュー結果待ち。実provider試験と要件受入は別途未実施。
- task: HVIS-01

## Previous state archived 2026-09-09T20:49:00Z

### Previous verified current state

- F-01〜F-03を最小修正、新規6件を修正前失敗/後成功で確認。全回帰348 pass/0 fail/1 skip。修正版17fileを固定し、別エージェントvisibility_fix_reviewが独立再レビュー中。

### Previous next actions

- 独立再レビュー結果を受けて3指摘の解消と残る条件を照合し、証拠・計画・現在地へ記録する。

### Previous blockers and human gates

- 独立再レビュー結果待ち。実provider試験と要件受入は別途未実施。

## Checkpoint 2026-09-09T20:49:00Z

- summary: 依頼されたF-01〜F-03の修正と独立再レビューが完了。全3件解消、新規阻害指摘なし。独立全回帰348 pass/0 fail/1 skip、追加probe6群成功。HVIS-01全体は実provider未試験・要件draftのためverifyingを維持。
- evidence: work/reviews/2026-09-10-task-visibility-re-review.md
- next: 今回の修正・再レビュー結果を報告。全体受入へ進むには実Claude Code/Copilot canaryの対象環境と範囲を確認し、最終受入の判断を得る。公開・実DB操作は別途。
- blocker: 今回3件の未解消指摘なし。HVIS-01全体の実provider試験と要件の最終受入は未実施。
- task: HVIS-01
