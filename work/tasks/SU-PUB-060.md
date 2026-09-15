---
id: "SU-PUB-060"
title: "安全更新0.6.0の採用とprivate公開"
session: "20260915-013942-357-publish-safe-update-0-6-0"
requirement: "docs/harness/requirements/2026-09-15-safe-update-publication.md"
architecture: "docs/harness/design/SAFE_LOCAL_UPDATE.md"
done_when: "P060-01〜04を独立確認しremote SHAと実施範囲を記録する"
risk: "low"
status: "done"
depends_on: []
evidence: ["work/reviews/2026-09-15-publication-061-pub-acceptance.json"]
verifier_evidence: "work/reviews/2026-09-15-publication-061-pub.receipt.json"
created: "2026-09-15T01:43:12Z"
updated: "2026-09-15T02:49:54Z"
---

# Task SU-PUB-060: 安全更新0.6.0の採用とprivate公開

## History

- 2026-09-15T01:43:12Z: created; planned

- 2026-09-15T01:46:28Z: planned -> ready; 利用者の正式採用・公開承認を記録し、未採用機能を除いた公開indexを構成

- 2026-09-15T01:53:18Z: ready -> running; 0.6.0公開用snapshotで581件成功、1067管理ファイルのsource/Git照合完了。独立旧版更新試験中

- 2026-09-15T02:01:02Z: running -> verifying; 公開0.4/0.5からの独立更新、案件保持・backup・導入後CLIと競合停止を確認。最終レビュー記録とpush後remote確認を残す

- 2026-09-15T02:15:30Z: verifying -> blocked; 公開済みだがP060-01のID形式がsealに拒否。検証器/immutable配布物を変えず、次patch版で形式訂正と再検証を残す

- 2026-09-15T02:27:24Z: blocked -> ready; 0.6.1の形式訂正・再検証・公開について利用者承認を取得。元の4条件は不変

- 2026-09-15T02:34:32Z: ready -> running; 旧4条件の本文不変でPUB IDへ訂正。厳格parserとsealの回帰試験成功、新しい独立receiptを準備中

- 2026-09-15T02:40:22Z: running -> verifying; 旧4条件の本文完全不変とPUB形式への訂正を確認。厳格sealの独立再検証を待つ

- 2026-09-15T02:49:54Z: verifying -> done; 条件本文は不変でP060表記をPUBへ訂正。原0.6.0公開の4条件を独立再確認し公開用policyでpass receiptを検証
