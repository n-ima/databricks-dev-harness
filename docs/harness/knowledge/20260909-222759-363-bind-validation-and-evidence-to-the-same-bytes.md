---
title: Bind validation and evidence to the same bytes
status: current
kind: pitfall
confidence: high
source: work/reviews/2026-09-10-acceptance-implementation-rereview.md
verified_at: 2026-09-09T22:27:59Z
review_after: 2026-12-10
applies_to: tools/lib/approval.mjs, tools/lib/evidence.mjs, acceptance verification
supersedes: none
---

# Bind validation and evidence to the same bytes

受入条件の解析と承認・完了のhash対象は同じbytesと要件参照へ結び付ける。解析後の再読取で別内容をhashしない。承認参照をlock内で再確認し、変更時は書込前に拒否する。ローカル時点整合性は全writer排除の保証ではない。

## Applicability and exceptions

tools/lib/approval.mjs, tools/lib/evidence.mjs, acceptance verification
