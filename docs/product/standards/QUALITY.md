# Quality and evaluation standard

## Order of checks

1. Repository conformance, format, lint, type, schema, and generated-asset drift.
2. Unit and contract tests.
3. SQL/data quality, duplicate, late-data, retry, and idempotency tests.
4. Integration tests against isolated development resources.
5. Browser E2E, accessibility, visual states, console and network errors.
6. Fresh independent review against acceptance criteria.
7. Human judgment gates.

An agent fixes implementation defects; it does not weaken a failing test, baseline, linter, evaluator, security policy, or acceptance criterion unless the responsible human approves that policy change separately.

## Evidence

Each accepted change records:

- acceptance criteria addressed;
- exact commands, versions, environments, and results;
- screenshots/recordings for visible behavior;
- data reconciliation and idempotency results;
- Databricks resource and permission changes;
- independent findings and re-verification;
- unresolved risks and follow-up.

Tests prove external behavior. Data changes cover nulls, duplicates, late arrivals, schema evolution, retries, deletion, and reconciliation. CRUD covers invalid input, conflicts, authorization, and idempotency. Genie runs representative and paraphrased benchmarks.

## Harness measures

Track accepted-task success, time to merge, human interventions, escaped defects, review findings, deploy/rollback success, flaky tests, cost and wall time per accepted task, context size, architecture drift, and user task completion.
