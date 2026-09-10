# F-01〜F-03 修正と独立再レビュー

2026-09-10 JST。対象session: `20260909-162346-724-task-visibility-and-reliable-resume`、task: `HVIS-01`。
ユーザーの「3件の修正と再レビュー を進めて」を受け、[初回レビュー](../reviews/2026-09-10-task-visibility-independent.md)の3件に対応する。実DB・案件repository・CreateAppl・公開/commit/push・実provider/model canaryは対象外。要件はdraftのまま、承認/receipt/policy/予算の既存判定を変更しない。

## 現在の結果

実装と独立再レビューが完了。別エージェント `/root/visibility_fix_review` がF-01 / P1、F-02 / P2、F-03 / P2の全件解消を確認し、今回の対象範囲で新たな再現可能な阻害指摘はないと判定した。[再レビュー報告](../reviews/2026-09-10-task-visibility-re-review.md)。要件全体の最終受入・実provider canary・正式receipt発行・公開とは区別する。

## 独立再レビュー結果

- 関連24試験成功。全回帰349件中348 pass / 0 fail / 1 skip（19,940.6694ms）。[独立全回帰ログ](visibility-rereview/regression.log)。
- 独立probe6群成功。全14公開遷移の範囲外参照56入力、値なし/空/繰返し指定、外部junction参照を拒否し、bytes不変とCLI/両hookの継続利用を確認。
- 固定基底commitの実writerで作成したLF/CRLFの旧記録により、省略/空/none/再待ちの引継ぎを確認。初期/旧format-2/手追記blockerの履歴保全も確認。[独立probeログ](visibility-rereview/probes.log)。
- 独立snapshot26ファイルは試験前後で不変、下記の親snapshot17件とも一致。既存hookのpolicy/Stop部分も基底commitと一致。親も報告全文、probeの実装とログを照合した。
- 今回依頼された3件の修正・再レビューは完了。HVIS-01全体は要件draftと実provider未試験を維持するためverifyingに残す。受入条件を変更せず、receipt/seal/session closeは行わない。実DB・案件・公開への操作なし。

| 指摘 | 変更 | 再発防止テスト |
|---|---|---|
| F-01 / P1 | verifier参照を保存文字列へ正規化して境界検証。値なし/空/繰返し指定も拒否。done以外でも保存前に検査 | 複数遷移・相対/絶対/空白付き範囲外参照、拒否後bytes不変と一覧/両hook継続、repo内draft参照が承認にならないこと |
| F-02 / P2 | blockerは最後の明示非空値を採用。省略/空と明示noneを区別 | LF/CRLF旧checkpoint、複数回省略・none・空値、context/status/両hook、read-only保持 |
| F-03 / P2 | blockerの旧本文もarchiveし、変更のない再保存で履歴を増やさない | 初期複数行本文、手追記、未記録の旧format-2本文、置換時復元、非変更時のarchive件数 |

設計のトレードオフは `docs/harness/design/TASK_VISIBILITY.md` に記録。golden scenario candidateにも同じ観測を追記したが、正式なevalsや受入基準は変更していない。古い独立レビューのprobeは不具合をassertする歴史的証拠なので変更していない。

## 自己検査の順序と結果

1. 実装修正前に新規6試験を追加。0 pass / 6 failで全指摘を再現。
2. 実装3moduleを最小修正。追加テストのassertを変更せず、全task-visibility試験24 pass / 0 fail / 0 skip（9,657.1188ms）。
3. 全回帰349 tests、348 pass / 0 fail / 1 skip（17,582.2087ms）。skipは既存Windows file symlink権限条件。directory junctionの別試験は成功。
4. `npm run harness:check` と `git diff --check` は成功。実Claude Code/Copilotでの発火/モデル動作は未試験。両hook試験は隔離fixtureのsubprocessのみ。

実行command:

```text
node --test --test-name-pattern=F-0 --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-visibility-fixes-red.log tests/task-visibility.test.mjs
node --test --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-visibility-fixes-focused.log tests/task-visibility.test.mjs
node --test --test-reporter=spec --test-reporter-destination=work/evidence/2026-09-10-visibility-fixes-full.log tests/*.test.mjs
npm run harness:check
git diff --check
```

[修正前失敗ログ](2026-09-10-visibility-fixes-red.log)、[関連試験ログ](2026-09-10-visibility-fixes-focused.log)、[全回帰ログ](2026-09-10-visibility-fixes-full.log)。いずれも自作の一時fixture内でデータを変更し、明示所有範囲を確認してcleanupする。

## 再レビュー開始時snapshot

基底commit: `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`。以下には未commit新規fileを含む。レビュー中は以下のsourceを凍結し、親は計画/session/task/生成status/証拠記録だけを更新する。独立reportの予定先は `work/reviews/2026-09-10-task-visibility-re-review.md`。

| File | SHA-256 |
|---|---|
| `tools/lib/session-state.mjs` | `ad009bc5727ee8d70c48139932aa805de5ed75f0d8a63cefbe95b998f804fbde` |
| `tools/lib/tasks.mjs` | `402264587bca1058e03751fd95a10a53f782dfbb36b0c04fc08b07fdef6d2b87` |
| `tools/lib/work-state.mjs` | `a5c029dc58294e894d0c2a7a9db3492a336f16edbf3a215447667b3f06b73459` |
| `tools/lib/memory.mjs` | `a12149f1db2e4442ef12e2778423701b97272a4dc4daf3bebcb6163570db9801` |
| `tools/harness.mjs` | `11fd7be9073f164cf7e9df3f568791cff299b6fe31595a9afa33db90e8f59862` |
| `tools/agent-hook.mjs` | `6b30cb667d0f5af3a3c3e9b0e70dcbc00ad8f47ef90476b7d97ba8d3adc29f16` |
| `harness/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `.claude/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `.github/skills/orchestrate-work/SKILL.md` | `e4bc674a9130f1d5a387c0e5bccc628cc364dc08588a3fe2a9272f7338f41361` |
| `tests/task-visibility.test.mjs` | `fe0b974640f4897d212ed3a06aeff5b5600317139aff01dda2ff8359078252cf` |
| `tests/fixtures/task-visibility/golden-task.md` | `9454f511592909632c7a4f2b1c2b30a0b997a9c993ca040ecdbc49b4b6018f5d` |
| `docs/harness/requirements/task-visibility.md` | `eebd8b222a5e6539d706dac408d70510b768200033ba2e644a133a968c9d6a6c` |
| `docs/harness/design/TASK_VISIBILITY.md` | `234f3edc197a0d7b1f708f2802b98fc7b9e739a59818c13850a69b3d3cb5b9db` |
| `docs/harness/operations/TASK_VISIBILITY.md` | `22908356cf0aebcebc559f5fd638f8dc6d75ed80f1ebc21904261b9c99a74cc1` |
| `docs/harness/operations/CLI_REFERENCE.md` | `8a895dde26c1b7323838ff5d741f8f1ac66beb19b45b3569b295219895f8cdbc` |
| `docs/harness/operations/SESSION_AND_KNOWLEDGE.md` | `9cbe7995cdcbe32bce63e040375292eaeef1197249362411fa862afe7ee7902e` |
| `docs/harness/operations/VALIDATION_STATUS.md` | `56c5ea5e883f83499af96ecb591e57134c6b7d1faef13d2d783871c7e1c0d2cd` |
