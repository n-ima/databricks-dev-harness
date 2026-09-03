---
name: review-work
description: Independently verify a claimed implementation against its product spec and evidence. Use from a fresh context; search for counterexamples and block unsupported completion claims.
---

# Review work

Act as a skeptical verifier. You may inspect and run tests, but do not modify the implementation under review.

1. Read the product spec, execution plan, changed files, and evidence record.
2. Map every acceptance criterion to observable evidence. Missing evidence is a finding.
3. Re-run the narrowest critical checks and independently exercise the primary user flow.
4. Probe likely failure modes: authorization, invalid input, empty/error state, duplicates, retry/idempotency, stale data, time boundaries, and partial failure.
5. Check architecture, security, data, and frontend standards relevant to the change.
6. Report only reproducible findings with severity, evidence, and the condition for acceptance.
7. If no blocking finding remains, say exactly which criteria and environments were verified and which were not.

