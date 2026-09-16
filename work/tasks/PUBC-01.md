---
id: "PUBC-01"
title: "ハーネス公開の再発防止と更新経路検証"
session: "20260916-010024-987-harness-publication-contract"
requirement: "docs/harness/requirements/2026-09-16-publication-contract.md"
architecture: "docs/harness/design/HARNESS_PUBLICATION.md"
done_when: "PUBC-01〜05を負例・正常系と独立レビューで検証する"
risk: "low"
status: "done"
depends_on: []
evidence: ["work/reviews/2026-09-16-publication-acceptance.md"]
verifier_evidence: "work/reviews/20260916-010024-987-harness-publication-contract.receipt.json"
created: "2026-09-16T01:02:19Z"
updated: "2026-09-16T01:39:35Z"
---

# Task PUBC-01: ハーネス公開の再発防止と更新経路検証

## History

- 2026-09-16T01:02:19Z: created; planned

- 2026-09-16T01:02:19Z: planned -> ready; 依頼の範囲と原因・設計・試験観点を記録。実案件を変更しない。

- 2026-09-16T01:02:19Z: ready -> running; 公開手順の独立設計確認と負例固定から着手。

- 2026-09-16T01:28:50Z: running -> verifying; 実装と独立指摘2件修正、forward指摘2件修正が完了。全回帰721成功/0失敗/2skip、0.7.0 stampとGit往復一致。実版の隔離更新と最終受入確認中。

- 2026-09-16T01:39:35Z: verifying -> done; PUBC-01〜05独立受入・receipt pass。0.7.0 stampと実0.6.1更新を確認。対策実装・配布準備完了、remote公開未実施。
