---
id: "HARD-01"
title: "受入条件・完了判定の完全性"
session: "20260909-214048-619-retrospective-hardening"
requirement: "docs/harness/requirements/retrospective-hardening.md"
architecture: "docs/harness/design/RETROSPECTIVE_HARDENING.md"
done_when: "不正ID・混在・重複・不足を承認から完了まで拒否し、AC-D01の正常系と互換性を試験する"
risk: "high"
status: "verifying"
depends_on: []
evidence: ["work/evidence/2026-09-10-acceptance-hardening.md"]
verifier_evidence: "none"
created: "2026-09-09T21:44:11Z"
updated: "2026-09-09T22:23:00Z"
---

# Task HARD-01: 受入条件・完了判定の完全性

## History

- 2026-09-09T21:44:11Z: created; planned

- 2026-09-09T21:44:11Z: planned -> ready; 現行の反例・変更範囲と独立契約レビューを準備

- 2026-09-09T21:44:11Z: ready -> running; ローカルのred試験と改善候補作成を開始。人の最終昇格と独立再レビューは別途。

- 2026-09-09T22:05:51Z: running -> verifying; 全回帰386成功/0失敗/1skip。独立実装レビュー中に見出し形式の条件脱落を確認、未解消。最終合格ではない。

- 2026-09-09T22:20:10Z: verifying -> running; 独立実装レビューIR-01〜03の修正を開始。再現9失敗→新規全47成功。状態更新を記録。

- 2026-09-09T22:23:00Z: running -> verifying; IR-01〜03の修正候補。全396件中395成功/0失敗/1skip、関連169成功。対象8ファイルを固定し独立再レビュー中。
