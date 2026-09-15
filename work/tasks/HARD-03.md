---
id: "HARD-03"
title: "承認範囲の引継ぎ"
session: "20260909-214048-619-retrospective-hardening"
requirement: "docs/harness/requirements/retrospective-hardening.md"
architecture: "docs/harness/design/RETROSPECTIVE_HARDENING.md"
done_when: "対象・権限・費用の一致と拡大時停止を試験する"
risk: "high"
status: "verifying"
depends_on: []
evidence: ["work/evidence/2026-09-10-scoped-approval.md"]
verifier_evidence: "none"
created: "2026-09-09T22:23:00Z"
updated: "2026-09-10T14:18:33Z"
---

# Task HARD-03: 承認範囲の引継ぎ

## History

- 2026-09-09T22:23:00Z: created; planned

- 2026-09-10T13:47:52Z: planned -> ready; 再開承認と既存の範囲・期限未保持を確認。案件専用のローカル承認照合から着手。

- 2026-09-10T13:47:52Z: ready -> running; 厳密な範囲・期限・撤回・対象bytesを持つ承認台帳と読み取り照合の候補を作る。実行権限は追加しない。

- 2026-09-10T14:05:50Z: running -> verifying; ローカル限定scope台帳/照合を実装。50専用pass、全554pass/0fail/1skip。独立レビューと正式採用待ち。

- 2026-09-10T14:13:21Z: verifying -> running; 独立24試験で時計巻戻りによる期限下限の検査漏れ1件・2負例を再現。原試験を保持して最小修正する。

- 2026-09-10T14:18:33Z: running -> verifying; SIR-01時計巻戻りを最小修正。専用52＋原独立24の76pass、全回帰556pass/0fail/1skip。独立再レビュー中。
