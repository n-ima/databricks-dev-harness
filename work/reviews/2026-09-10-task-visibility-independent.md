# タスク可視化・再開機能の独立レビュー

2026-09-10 JST。Reviewer: `/root/visibility_independent_review`。判定: **受入候補に対して修正が必要（P1 1件、P2 2件）**。既存回帰の成功は確認したが、独立した反例で AC-02 / AC-04 / AC-05 / AC-07 の不足を再現した。要件は draft のままであり、この文書は受入承認や完了 receipt ではない。

## 対象版と方法

基底 commit は `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`。未コミットの新規ファイルも含め、以下の SHA-256 を reviewer が実ファイルから再計算した。レビュー開始時の[依頼 snapshot](../evidence/2026-09-10-task-visibility-review-request.md)にある17件と一致した。作業計画・session・生成 status は親担当が並行更新しており、実装 snapshot には含めない。

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

`AGENTS.md`、`orchestrate-work`、`review-work`、要件・設計・作業計画・自己検証記録、QUALITY/SECURITY 基準を読み、実差分・新規ファイルを照合した。route は review / review-work だった。workload の analysis は「可視化」による heuristic と判断し、実データ分析・Databricks 接続へは広げていない。

検証環境は Windows、Node.js `v24.15.0`、npm `11.12.1`、PowerShell。通常 sandbox helper の初期化が失敗したため、承認審査付きの `require_escalated` で読み取りと隔離 fixture 試験を実行した。自動承認の拒否は受けていない。

## 再現できた指摘

### F-01 / P1: 範囲外の verifier receipt 参照を保存すると全体の context が読めなくなる

最小箇所: `tools/lib/tasks.mjs:156`。関連箇所: `tools/lib/tasks.mjs:160`、`:168`、reader の `:75`。

`updateTask` は `verifier_evidence` を入力から引き継ぐが、evidence 配列と違い、done 以外の遷移では参照先の repository 境界を確認していない。planned → ready で次を渡すと、exit 0 で既存 task が書き換わる。

```text
node tools/harness.mjs task update --id REV-01 --status ready --summary "Valid transition with invalid receipt reference" --expected-revision CURRENT_SHA256 --verifier-evidence ../outside-receipt.json
```

保存された `verifier_evidence: "../outside-receipt.json"` は次回 `taskRecords` が拒否する。隔離 fixture の実測は次のとおり。

| 操作 | 実測 |
|---|---|
| 不正参照を含む update | exit 0、`recordChanged: true` |
| `task show --id REV-01` | exit 1、`path must stay inside the repository` |
| `status --json` | exit 1、同エラー |
| Claude 開始 hook | exit 1、context envelope を返せない |
| Copilot 開始 hook | exit 1、context envelope を返せない |

collection を読むすべての task 更新も保存済み不正参照で失敗するため、同じ CLI で正常な参照へ修復できない。一つの入力ミスで session 全体の表示・開始 hook を停止させるため P1 とした。repository 外の file を読んだり、承認・外部実行が成立したことは観測していない。

AC-02 の「repository 外への参照を拒否」「失敗時は既存記録を変更しない」を満たさない。受入条件は、保存するすべての verifier 参照を状態にかかわらず保存前に境界検証し、不正入力を拒否した後も元 task bytes と一覧・開始 hook が正常なままであること。

再現: repository root で `node work/evidence/visibility-review/probes.mjs`。出力キー `outside-verifier-reference`。最小 fixture と CLI 呼び出しは同スクリプトに含む。

### F-02 / P2: 旧 checkpoint で最新回の blocker が省略されると、記録済みの待ち状態を落とす

最小箇所: `tools/lib/session-state.mjs:30`〜`:35`。`value()` が最後の checkpoint 一個だけを見るため、任意項目 blocker を前の checkpoint から引き継がない。

基底 commit の実際の `memory.mjs` を隔離 fixture に読み込み、旧 `checkpointSession` を以下の順で実行した。

1. 初期本文の blocker は `Initial important blocker`。
2. checkpoint に summary / next / `blocker: Waiting for existing user decision` を保存。
3. 次の checkpoint は summary / next を更新し、任意の blocker を省略。
4. 今回の実装の `context --json` と両開始 hook で表示。

summary / next は最新値になるが、blocker は古い本文の `Initial important blocker` に戻った。記録に残っている `Waiting for existing user decision` は context と両 hook に現れない。ファイル bytes は読み取り前後で同一。これは新規の手書き架空形式だけの試験ではなく、固定基底 commit の旧書き込み処理から生成した記録で再現した。

AC-04 の現在状態表示と AC-07 の旧 session 互換を妨げる。実際の `gate_status` を承認・解除する不具合ではないが、再開時に必要な人の判断を表示から落とす。受入条件は、旧形式でも最後に明示された blocker を取得し、その後の省略を解除と解釈しないこと。明示 `none` と省略を区別する回帰が必要。

再現: `node work/evidence/visibility-review/probes.mjs` の `legacy-omitted-blocker`。実測 `reproducedFromBaseCommit: true`、`bothHooksLostLatestBlocker: true`、`readOnlyPreserved: true`。

### F-03 / P2: 初期本文の blocker を checkpoint 更新すると過去の情報が消える

最小箇所: `tools/lib/memory.mjs:69`。関連箇所: archive の `:60`〜`:65`。

`Blockers and human gates` を新しい blocker で置換する一方、archive に保存するのは Verified current state / Next actions の二節だけ。初期本文だけに記録された blocker、または現在節へ手で追記した blocker が checkpoint 履歴にまだ存在しない場合、その内容を復元できなくなる。

隔離 fixture で初期 blocker `Initial important blocker` を持つ session に、`checkpointSession(root, { id: "S-1", summary: "New state", next: "New next", blocker: "none" })` を一回実行した。新しい blocker は正しく none になるが、保存後 file 全体から `Initial important blocker` が消えることを確認した。旧実装は blocker を履歴に追記していたため、初期節の情報は残っていた。

AC-05 の過去の現状の保持、設計の「初回置換前の旧本文を履歴に保存」を満たさない。受入条件は、blocker の現在節を置換する前に失われる内容も保存し、初回更新と後からの手追記の両方で復元できること。

再現: `node work/evidence/visibility-review/probes.mjs` の `initial-blocker-history`。実測 `priorBlockerRetained: false`。

## 再実行と結果

すべて `D:/projects/databricks-dev-harness` を cwd とした。実装・task/session・要件・承認・policy の変更、正式 receipt 発行、commit/push、Databricks 接続、個別案件や参考 repository への操作は行っていない。既存テスト内部の合成 receipt は従来どおり一時 fixture にのみ作成され、fixture とともに削除される。

| Command / 確認 | 結果 |
|---|---|
| `npm run harness:context` | exit 0。対象 session と HVIS-01 の verifying、現在/次/待ち状態を読み取り |
| `npm run harness:route -- --prompt "タスク可視化機能を要件に照合して独立レビューする"` | exit 0。review / review-work、executionAuthorized false |
| `npm run harness -- workload resolve --prompt "タスク可視化機能を要件に照合して独立レビューする"` | exit 0。analysis heuristic、executionAuthorized false |
| `npm run harness:check` | exit 0、Harness check passed |
| `git diff --check` | exit 0、出力なし |
| `node --test --test-reporter=spec --test-reporter-destination=work/evidence/visibility-review/regression.log tests/*.test.mjs` | exit 0。343 tests、342 pass、0 fail、1 skip、19,148.1448 ms |
| `node work/evidence/visibility-review/probes.mjs` | exit 0。上記3不具合の観測を再現。script の exit 0 は実装合格を意味しない |
| `node work/evidence/visibility-review/probes.mjs \| Tee-Object -FilePath work/evidence/visibility-review/probes.log` | 同じ反例を再実行し、生成ログへ保存 |
| `Get-FileHash -Algorithm SHA256` による対象17ファイルの確認 | 開始 snapshot と全一致。canonical skill と両生成コピーも byte hash 一致 |

証拠: [全回帰ログ](../evidence/visibility-review/regression.log)、[独立再現 script](../evidence/visibility-review/probes.mjs)、[再現結果ログ](../evidence/visibility-review/probes.log)。script の生成先は自ら `mkdtemp` で作成した `harness-independent-visibility-*` に限り、cleanup 前に絶対パスの所有範囲を検証する。

追加の境界観測として、task の session を fixture 内で存在しない ID に手変更すると、`task show` はそれを返し、`status` からは task が消えることも記録した（`orphaned-task-reader`）。公開 create/update がこの孤立状態を作ることは今回再現していないため、上記の受入阻害3件には数えていない。

## AC ごとの検証範囲

| AC | 今回確認した範囲 | 判定・不足 |
|---|---|---|
| AC-01 | 新規18テストを含む全回帰、公開 task CRUD の JSON 往復、scope 継承、状態/focus の表示。独立 fixture でも作成→更新→読込を実行 | 正常系のローカル CLI 範囲は確認。自然言語からの task 分割は未試験 |
| AC-02 | 重複、不明 session/task、依存欠落/循環/跨 session、遷移、stale revision、lock、secret、範囲外 requirement などの既存試験を再実行。独立して範囲外 verifier 参照を試験 | **不適合: F-01**。全ての範囲外参照拒否・失敗時不変を認定できない |
| AC-03 | 9 session、9 task、focus の優先、環境変数、`--all`、省略数、不明 focus 拒否、両 provider envelope の fixture 試験 | 正常な記録でのローカル試験は成功。実 provider の発火・設定ロードは未試験。F-01 の後続障害も残る |
| AC-04 | current/next/gate/last checkpoint/tasks 表示、running を実 process 稼働と断定しない表示を確認。旧 checkpoint の blocker を独立検証 | **不適合: F-02**。実 process 監視は要件外 |
| AC-05 | summary/next 更新、初期 current/next と手追記の archive、checkpoint 履歴、期待 revision、pending gate の拒否試験を再実行。初期 blocker 更新を独立検証 | **不適合: F-03**。全状態履歴の保全を認定できない |
| AC-06 | 合成 fixture で receipt 必須、evidence 必須、accepted requirement・policy/artifact hash 検証、終端再開拒否、stale 依存証拠拒否、session 不変を再実行。実装の既存 validator 呼出しを確認 | この範囲で承認 bypass/外部実行の再現なし。本人認証・実 receipt の発行は未実施 |
| AC-07 | 既存全回帰、両 hook、旧 summary/next 優先、template 初期化、生成 skill 同期を検証 | 既存回帰は成功するが、**旧 session の blocker 互換は F-02 で不適合**。実 host/model canary は未実施 |

未実施環境は実 Claude Code terminal/extension、Copilot VS Code/CLI のモデル実行、公開 CI、Linux/macOS、Databricks。Windows の file symlink 権限がないため、既存 `managed symlinks and junctions are rejected in release and destination` の1件が skip した。別の Windows directory junction 回帰は pass。OS process 強制終了、同一権限の悪意ある writer、実際の長時間 concurrent writer までの網羅はしていない。

## 引き継ぎ

対象版の独立レビューはここまで。F-01〜F-03 を修正した版で対応する反例と関連回帰を再検証する必要がある。今回の全回帰成功やレビュー文書の存在から、draft 要件の受入、HVIS-01 の done、session 完了、公開可を推定しない。
