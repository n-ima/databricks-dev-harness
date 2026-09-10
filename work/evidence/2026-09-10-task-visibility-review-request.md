# タスク可視化 — 独立レビュー依頼記録

2026-09-10 JST。ユーザーが「別エージェントにレビューを依頼してよいですか」に「OK」と回答。

- 対象: HVIS-01、RH01〜RH03、AC-01〜AC-07。ハーネス共通のtask/status/context/checkpoint実装と関連テスト・手順。
- Reviewer: `/root/visibility_independent_review`。実装者とは別のエージェントで、実装者の結論を前提にしない独立確認を依頼。
- 成果物: `work/reviews/2026-09-10-task-visibility-independent.md` と必要な `work/evidence/visibility-review/`。
- 作業: 実差分・新規ファイル・要件・設計を読み、回帰テストを独立再実行し、隔離fixtureで反例を探索する。
- 凍結: レビュー中は以下の実装・仕様・テスト・手順を変更しない。親エージェントは依頼記録、計画、session、生成statusだけを更新する。
- 境界: 独立レビュー実施の承認のみ。要件はdraftのまま。指摘修正、要件受入、receipt発行、完了承認、push/release、実provider/model canary、Databricks操作、個別案件・参考repositoryの変更には広げない。
- 判定: レビュー完了と実装合格は別。レビュー報告を照合してから結果・未検証範囲を記録する。HVIS-01はverifyingを維持する。

## レビュー開始時のソースsnapshot

基底commit: `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`。未commit差分・新規ファイルを含む。SHA-256はfile bytesから算出。作業中に更新する状態記録は対象外。

| File | SHA-256 |
|---|---|
| `tools/lib/session-state.mjs` | `e746fedf68db0987c556a914ecf5df5939bb39b55bd899c2081215db23600e48` |
| `tools/lib/tasks.mjs` | `4c29d5b2d1be24c4f3846df35ff5dc78d34542f2d1a245928fa5277cf4f21666` |
| `tools/lib/work-state.mjs` | `a5c029dc58294e894d0c2a7a9db3492a336f16edbf3a215447667b3f06b73459` |
| `tools/lib/memory.mjs` | `504abe2d8baa093ab24ffb62c34ff9b0722764818cac61e55aa3862272a06c6a` |
| `tools/harness.mjs` | `11fd7be9073f164cf7e9df3f568791cff299b6fe31595a9afa33db90e8f59862` |
| `tools/agent-hook.mjs` | `6b30cb667d0f5af3a3c3e9b0e70dcbc00ad8f47ef90476b7d97ba8d3adc29f16` |
| `harness/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `.claude/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `.github/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `tests/task-visibility.test.mjs` | `7376f1238be52d5a6ab0dea816466139fc7a696a24059203e5038b350785a5e4` |
| `tests/fixtures/task-visibility/golden-task.md` | `4b78562084bdd9241ddb9870b02bdca0a0e44e4e843edf4bd5f2a1c6ca992465` |
| `docs/harness/requirements/task-visibility.md` | `eebd8b222a5e6539d706dac408d70510b768200033ba2e644a133a968c9d6a6c` |
| `docs/harness/design/TASK_VISIBILITY.md` | `e73f1b17edc4aefd0df709daf838a1c003ccf9e85d093181595c423bc15951f9` |
| `docs/harness/operations/TASK_VISIBILITY.md` | `2fba2505e898513b8ea17b8f815e2c991a9dbe807cc69d44351dcab979eb656b` |
| `docs/harness/operations/CLI_REFERENCE.md` | `8a895dde26c1b7323838ff5d741f8f1ac66beb19b45b3569b295219895f8cdbc` |
| `docs/harness/operations/SESSION_AND_KNOWLEDGE.md` | `9cbe7995cdcbe32bce63e040375292eaeef1197249362411fa862afe7ee7902e` |
| `docs/harness/operations/VALIDATION_STATUS.md` | `67d94184554bdd3be8a9dd28a86aae5771b4dca325a6ee277fe435d1350e9323` |

