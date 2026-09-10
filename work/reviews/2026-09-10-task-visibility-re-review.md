# タスク可視化・再開機能の独立再レビュー

2026-09-10 JST。Reviewer: `/root/visibility_fix_review`（実装者とは別の fresh agent）。判定: **F-01 / P1、F-02 / P2、F-03 / P2 はすべて解消を確認。今回の対象範囲で新たな再現可能な受入阻害指摘はない。**

対象は session `20260909-162346-724-task-visibility-and-reliable-resume`、task `HVIS-01` の3件修正版と関連回帰。[初回レビュー](2026-09-10-task-visibility-independent.md)の不具合を正常期待で再検証した。この文書は独立レビュー結果であり、draft 要件の受入承認、正式 receipt、task/session 完了、実 provider の成功、公開承認ではない。

## 個別判定と独立証拠

| 指摘 | 判定 | 修正箇所・確認結果 |
|---|---|---|
| F-01 / P1: 範囲外 verifier 参照保存後の context 停止 | 解消 | `tools/lib/tasks.mjs:156` で入力を保存文字列へ正規化し、`:163` で保存前の repository 境界を検証。公開 CLI の全14遷移について相対・絶対・Windows 区切り・前後空白付き範囲外参照56入力を拒否。task/session bytes は不変で、show/context/status/両開始 hook は利用可能。値なし・空・空白・重複指定と外部 directory junction 経由の参照も拒否。repo 内 draft 参照は正規化して保存できるが、unsealed receipt による done は拒否される。 |
| F-02 / P2: 旧 checkpoint の blocker 省略で待ち状態を落とす | 解消 | `tools/lib/session-state.mjs:34` で最後の明示非空 blocker を選ぶ。基底 commit の実際の旧 `memory.mjs` を fixture へ読み込み、その writer で記録を生成。LF/CRLF の両方で、明示待ち→省略→空白、明示 none→省略→空白、再び待ち→省略→空白を確認。current/next は最新値、blocker は最後の明示値となり、context/status/両 hook が一致する。読み取り前後の session bytes は不変。 |
| F-03 / P2: blocker 置換時の履歴消失 | 解消 | `tools/lib/memory.mjs:63`〜`:71` で置換前の blocker 本文を archive 対象に含める。初期複数行、旧 format-2、複数行・段落の手追記を独立 fixture で確認。省略時は現在本文を保持し、置換時には旧本文が archive に残る。同じ blocker の再保存では archive 件数が増えない。過去 summary と gate_status も保持される。 |

独立 script: [probes.mjs](../evidence/visibility-rereview/probes.mjs)。結果: [probes.log](../evidence/visibility-rereview/probes.log)。6群すべての正常期待 assertion が通り、最終行は `All reviewer assertions passed`。初回レビューの `visibility-review/probes.mjs` は不具合を assert する歴史的証拠として変更していない。

## 実行環境・commands・結果

Windows / PowerShell、Node.js `v24.15.0`、npm `11.12.1`。Git HEAD は `2ee3e7514f6cc937a75cb667065b9eeb0bc1ebe7`、対象は未コミット新規ファイルも含む working tree。すべて cwd は `D:/projects/databricks-dev-harness`。read-only 検査と隔離 fixture 試験を承認審査付き `require_escalated` で実行した。通常 `apply_patch` の sandbox helper 初期化失敗が1回あり、同じ apply_patch のローカル入口で reviewer-owned script/report を保存した。自動承認拒否は受けていない。

| Command | 結果 |
|---|---|
| `npm run harness:context` | exit 0。関連 session / HVIS-01 / current / next / blocker を確認 |
| `npm run harness:route -- --prompt "タスク可視化機能の修正3件を独立再レビューする" --intent review` | exit 0。review / review-work、executionAuthorized false |
| `npm run harness -- workload resolve --prompt "タスク可視化機能の修正3件を独立再レビューする"` | exit 0。analysis は「可視化」による heuristic。実データ分析へ範囲を広げていない |
| `node work/evidence/visibility-rereview/snapshot.mjs begin` | exit 0。26ファイルの開始 SHA-256 を生成 |
| `node --test --test-reporter=spec --test-reporter-destination=work/evidence/visibility-rereview/focused.log tests/task-visibility.test.mjs` | exit 0。24 tests / 24 pass / 0 fail / 0 skip、15,037.4844 ms |
| `node work/evidence/visibility-rereview/probes.mjs \| Tee-Object -FilePath work/evidence/visibility-rereview/probes.log` | exit 0。正常期待6群すべて成功。成功は pipeline exit だけでなく最終 assertion summary で確認 |
| `node --test --test-reporter=spec --test-reporter-destination=work/evidence/visibility-rereview/regression.log tests/*.test.mjs` | exit 0。349 tests / 348 pass / 0 fail / 1 skip、19,940.6694 ms |
| `npm run harness:check` | exit 0、Harness check passed |
| `git diff --check` | exit 0、出力なし |
| `git diff --exit-code -- tools/lib/shared.mjs tools/lib/evidence.mjs tools/lib/approval.mjs tools/lib/loop.mjs harness.config.json harness/router.json AGENTS.md package.json harness/evals` | exit 0。既存共通境界・receipt・承認・loop・設定・評価基準に差分なし |
| `node work/evidence/visibility-rereview/snapshot.mjs end` | exit 0。26件が開始時と一致。実装者の固定17件とも一致。hook の `const forbidden` 以降（policy/Stop を含む）が基底と一致 |

[関連24試験ログ](../evidence/visibility-rereview/focused.log)、[全回帰ログ](../evidence/visibility-rereview/regression.log)、[開始 snapshot](../evidence/visibility-rereview/snapshot-begin.json)、[終了 snapshot](../evidence/visibility-rereview/snapshot-end.json)。独立 probe の生成先は `mkdtemp` で作成した `harness-visibility-rereview-*` 一時ディレクトリに限定し、絶対パスの所有範囲を検証して cleanup した。既存試験の合成 receipt は一時 fixture 内だけの従来の試験データであり、実 session に対する receipt は発行していない。

## AC ごとの検証範囲

| AC | 今回確認した範囲 | 限界 |
|---|---|---|
| AC-01 | scope・安定 ID・done 条件・依存・状態・証拠の作成と読込、公開 CLI 作成→更新→show、context による表示を再実行 | 実モデルの自然言語からの task 分割は未試験 |
| AC-02 | 全回帰の不明/重複/欠落/循環/不正遷移/revision/lock/secret 等に加え、独立 F-01 probe で拒否後不変と利用継続を確認 | 同一権限の悪意ある writer の隔離保証は対象外 |
| AC-03 | 9 session/task、focus、環境変数、省略数、--all、不明 focus、両 provider envelope を再実行。F-01 拒否後も両 hook が成功 | 実拡張・CLI の発火と設定ロードは未試験 |
| AC-04 | current/next/gate/checkpoint/task 一覧と process 未観測表示。F-02 の旧 writer 生成記録を context/status/両 hook で確認 | 実 process 監視は要件対象外 |
| AC-05 | revision・pending gate・初期/手追記 archive の既存回帰。F-03 の blocker 履歴保全と重複 archive 抑止を独立確認 | OS 強制終了や保存直前の未記録操作は未試験 |
| AC-06 | receipt/evidence 必須・accepted 要件・policy/artifact hash・stale 依存証拠・終端拒否・session 不変の回帰。draft verifier で done が成立しない独立確認 | 正式 receipt 発行と reviewer 本人認証は未実施 |
| AC-07 | 全349件、旧 writer の LF/CRLF、template 初期化、両 hook、生成 skill 同期を再確認 | 下記実環境は未試験 |

未試験: 実 Claude Code terminal/extension、Copilot VS Code/CLI の model 実行、実 provider switch/compaction canary、Linux/macOS、公開 CI、Databricks、実データ・個別案件・CreateAppl、長時間 concurrent writer と OS process 強制終了。file symlink が host で許可されないため既存 `managed symlinks and junctions are rejected in release and destination` は skip。既存 directory junction 試験と今回の外部 verifier junction 拒否は pass。

## 対象版の SHA-256

以下は reviewer が実ファイル bytes から取得し、試験終了時にも照合した。追加の共通 validator、設定、初回 probe を含む全26件は上記 snapshot JSON に記録している。

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

## 引き継ぎ

`orchestrate-work` に従い対象 session・route・要求/設計を照合し、`review-work` に従い実装を変更せず全 AC の観測範囲と反例を確認した。reviewer の永続変更は本報告と `work/evidence/visibility-rereview/` のみ。親が更新する計画/task/session は実装固定 snapshot から除外した。

次は親担当が本報告を durable record へ反映する。F-01〜F-03 の追加修正要求はない。要件は draft、実 provider canary と最終受入は未実施であり、完了 receipt・seal・HVIS-01 の done・session close は行っていない。
