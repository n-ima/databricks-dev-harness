---
id: "UIF-WORK-01"
title: "UI設計のDatabricks Apps整合性を強制する"
session: "20260915-143222-315-ui-runtime-fidelity"
requirement: "docs/harness/requirements/2026-09-15-ui-runtime-fidelity.md"
architecture: "docs/harness/design/UI_RUNTIME_FIDELITY.md"
done_when: "UIF-01〜04のローカル検証と独立レビューを記録し、正式採用・実providerの未実施を区別する"
risk: "low"
status: "verifying"
depends_on: []
evidence: ["work/evidence/2026-09-15-ui-fidelity.md","work/reviews/2026-09-15-ui-fidelity-final.md","work/evidence/2026-09-15-ui-fidelity-final-quality-verify.json","docs/harness/decisions/ADR-0012-ui-scope-adoption.md"]
verifier_evidence: "none"
created: "2026-09-15T14:34:11Z"
updated: "2026-09-15T16:54:18Z"
---

# Task UIF-WORK-01: UI設計のDatabricks Apps整合性を強制する

## History

- 2026-09-15T14:34:11Z: created; planned

- 2026-09-15T14:35:08Z: planned -> ready; 利用者の既定方針と修正対象を記録、独立設計レビュー開始

- 2026-09-15T14:35:09Z: ready -> running; 単独HTMLをUI承認できる旧動作の再現と最小の契約設計を実施

- 2026-09-15T15:06:34Z: running -> verifying; ローカル修正と全回帰成功。最終独立レビューと正式採用判断を残す。

- 2026-09-15T15:13:27Z: verifying -> blocked; ローカル修正・独立レビュー・品質診断が完了。承認方式とintegration-init互換性変更の正式採用判断待ち。push/配布/実案件更新は未実施。

- 2026-09-15T16:54:18Z: blocked -> ready; 利用者のmain反映指示で正式採用。採用待ちを解消し、完了記録の確認へ引継ぐ。

- 2026-09-15T16:54:18Z: ready -> running; 実装を変更せず採用記録とmain統合を確認する。

- 2026-09-15T16:54:18Z: running -> verifying; 実装とローカル独立検証は完了、正式採用済み。main統合はMAIN-0916で検証する。実provider受入は別工程。
