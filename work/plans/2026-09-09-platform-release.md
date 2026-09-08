---
id: PLATFORM-SOURCE-PUBLICATION
status: accepted
owner: repository-owner
---

# 0.4.0 candidate: private GitHub publication

The user instructed continuation after being told that the next step was committing and pushing the reviewed 0.4.0 candidate, followed by a separate product pilot. This authorizes scoped source publication to the existing private template repository. It does not authorize Databricks deployment, new resources, credentials, paid models or a new product's requirements.

Destination: https://github.com/n-ima/databricks-dev-harness. Use the existing codex/platform-development-harness branch and an evidence-backed pull request to main. Do not force-push, change visibility/branch policy, or self-approve policy changes. Main integration remains a separate human review decision.

## Acceptance criteria

- PUB-01: Reverify the private/template destination, remote baseline, scoped changes, candidate bytes and existing independent review.
- PUB-02: Re-run local regression/conformance, commit only the reviewed source and scoped evidence, and push the existing feature branch normally.
- PUB-03: Open a pull request with the scope and verification limits, inspect actual hosted CI for its source revision, and record pass/failure/not-run accurately.
- PUB-04: Persist the commit/PR/CI result and precise next human gate. Preserve old release snapshots and separate source publication from runtime/product readiness.

## Evidence and design

- Design: docs/harness/design/ARCHITECTURE.md; docs/harness/operations/OPERATING_MODEL.md.
- Candidate requirement: work/plans/2026-09-08-platform-harness.md.
- Independent review: work/reviews/2026-09-08-platform-final-review.md.
- Publication evidence: work/evidence/2026-09-09-platform-publication.md.

Hosted checks execute existing read-only-permission Node/Python test workflows without Databricks credentials. If automatic execution is absent, inspect workflow metadata and run the existing workflow_dispatch path against this explicit source branch, without changing repository policy.
