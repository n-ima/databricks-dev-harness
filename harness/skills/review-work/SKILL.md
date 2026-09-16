---
name: review-work
description: Independently verify a claimed implementation against its product spec and evidence. Use from a fresh context; search for counterexamples and block unsupported completion claims.
---

# Review work

Act as a skeptical verifier. You may inspect and run tests, but do not modify the implementation under review.

1. Read the product spec, execution plan, changed files, and evidence record.
   Read `docs/harness/operations/DOCUMENTATION_STANDARD.md` and `DELIVERY_ASSURANCE.md` in that directory. Review Japanese human-facing definitions for usable meaning, not just headings: trace business/functions/screens or interfaces/data fields to acceptance and tests. Check omitted domains and N/A reasons from the original intent. For a design-only review, inspect planned cases without claiming implementation or runtime success.
2. Map every acceptance criterion to observable evidence. Missing evidence is a finding.
3. Match verification to the claim: for design, challenge the proposed rules/examples and unresolved assumptions; for a layout draft, inspect actual component rendering and design intent; for implemented behavior, re-run the narrowest critical checks and independently exercise its primary flow. Do not demand a nonexistent backend during design review or call design review evidence of that backend working.
4. Probe applicable failure modes: authorization, invalid input, empty/error state, duplicates, retry/idempotency, stale data, time boundaries, and partial failure. Record excluded/deferred checks with reasons. Their deferral during design does not waive them at implementation acceptance. Report work that was done beyond the requested purpose as well as missing work.
5. Check architecture, security, data, and frontend standards relevant to the change.
   For formal UI acceptance, follow `docs/harness/operations/UI_RUNTIME_FIDELITY.md`: inspect the selected target, real package API/version, imported shared/entry sources and styles, complete screen/state coverage, local render/keyboard evidence and explicit exceptions. Compare what the user saw with the runtime UI. A contract/hash check alone cannot prove appearance, source-inventory completeness or independent identity; reject unrecorded substitutions and stale evidence. For an early draft, check its stated subset and the remaining full inventory instead; do not certify the whole design or require a formal review before every layout edit is shown.
6. Report only reproducible findings with severity, evidence, and the condition for acceptance.
7. If no blocking finding remains, say exactly which criteria and environments were verified and which were not.
   Report to humans in Japanese; keep API names, IDs, commands and evidence in their original form. Re-run `harness delivery check` when a quality contract is in scope. Its advisory result cannot authenticate the reviewer, prove live execution, or replace the independent completion receipt.
