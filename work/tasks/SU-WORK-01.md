---
id: "SU-WORK-01"
title: "安全なローカル更新入口と独立検証"
session: "20260915-010502-538-safe-local-harness-update"
requirement: "docs/harness/requirements/2026-09-15-safe-local-update.md"
architecture: "docs/harness/design/SAFE_LOCAL_UPDATE.md"
done_when: "SU-01〜05の隔離試験・別contextレビューを記録し残る採用判断を明示する"
risk: "low"
status: "done"
depends_on: []
evidence: ["work/reviews/2026-09-15-publication-060-safe-update-acceptance.json"]
verifier_evidence: "work/reviews/20260915-010502-538-safe-local-harness-update.receipt.json"
created: "2026-09-15T01:05:33Z"
updated: "2026-09-15T02:04:45Z"
---

# Task SU-WORK-01: 安全なローカル更新入口と独立検証

## History

- 2026-09-15T01:05:33Z: created; planned

- 2026-09-15T01:08:46Z: planned -> ready; 設計確認と先行する12ケースで入口の不足を再現

- 2026-09-15T01:16:42Z: ready -> running; 更新入口、両providerスキル、途中失敗と旧版から次版の隔離試験を実装。14試験成功、独立反例確認中

- 2026-09-15T01:27:24Z: running -> verifying; 専用15、全体633成功/0失敗/1skip。独立27成功、公開旧版の隔離更新を確認。最終証拠照合と正式採用待ち

- 2026-09-15T02:04:45Z: verifying -> done; 正式採用済み0.6.0のclean snapshotでSU-01〜05の独立証拠と品質契約を固定。公開はSU-PUB-060へ分離
