---
name: review-work
description: Independently verify a claimed implementation against its product spec and evidence. Use from a fresh context; search for counterexamples and block unsupported completion claims.
---

# Review work

Act as a skeptical verifier. You may inspect and run tests, but do not modify the implementation under review.

1. Read the product spec, execution plan, changed files, and evidence record.
   Read `docs/harness/operations/DOCUMENTATION_STANDARD.md` and `DELIVERY_ASSURANCE.md` in that directory. Review Japanese human-facing definitions for usable meaning, not just headings: trace business/functions/screens or interfaces/data fields to acceptance and tests. Check omitted domains and N/A reasons from the original intent. For a design-only review, inspect planned cases without claiming implementation or runtime success.
2. Map every acceptance criterion to observable evidence. Missing evidence is a finding.
3. Re-run the narrowest critical checks and independently exercise the primary user flow.
4. Probe likely failure modes: authorization, invalid input, empty/error state, duplicates, retry/idempotency, stale data, time boundaries, and partial failure.
5. Check architecture, security, data, and frontend standards relevant to the change.
   For UI, follow `docs/harness/operations/UI_RUNTIME_FIDELITY.md`: inspect the selected target, real package API/version, imported shared/entry sources and styles, complete screen/state coverage, local render/keyboard evidence and explicit exceptions. Compare what the user saw with the runtime UI. A contract/hash check alone cannot prove appearance, source-inventory completeness or independent identity; reject unrecorded substitutions and stale evidence.
6. Report only reproducible findings with severity, evidence, and the condition for acceptance.
7. If no blocking finding remains, say exactly which criteria and environments were verified and which were not.
   Report to humans in Japanese; keep API names, IDs, commands and evidence in their original form. Re-run `harness delivery check` when a quality contract is in scope. Its advisory result cannot authenticate the reviewer, prove live execution, or replace the independent completion receipt.
