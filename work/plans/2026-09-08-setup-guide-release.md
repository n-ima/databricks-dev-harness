---
id: SETUP-GUIDE-RELEASE-0.3.2
status: accepted
owner: repository-owner
scope: private-template-publication
---

# Setup guide private-template publication

The repository owner requested that the reviewed concrete setup-guide change be pushed to the existing private GitHub template. The subsequent request to continue preserves that authorization. Publish a distinct 0.3.2 snapshot in accordance with the existing distribution design.

## Acceptance criteria

- RELEASE-01: Verify the prior independent review's artifact hashes before release metadata changes, and preserve its guide implementation and stated validation limits.
- RELEASE-02: Version metadata and current-version documentation identify 0.3.2; create a new matching release baseline and preserve the immutable 0.3.1 payload.
- RELEASE-03: Complete the documentation tests, full harness test suite, conformance, release-byte verification, and whitespace checks. Record actual failures, skips, and external verification limits.
- RELEASE-04: Push the scoped changes to the existing origin/main and verify local/remote commit agreement and private/template settings. Record actual GitHub Actions status, using prior independent guide review and hosted deterministic checks as separate evidence.

## Scope and execution

Use the accepted guide requirement and independent receipt under work/plans and work/reviews. Change only release metadata and related release records in addition to that reviewed implementation. Run deterministic checks, stamp 0.3.2, commit, and push. Inspect the remote and hosted CI, then record and independently verify the publication evidence before closing the session. No Databricks or application deployment is included. Maturity remains L1; provider golden trials are not claimed.

## Recovery

A publication problem is investigated at the reported commit. A correction is a normal reviewed follow-up commit; a managed-payload change after stamping requires a new version. Do not rewrite remote history or repack a version. The prior source and 0.3.1 manifest remain retrievable from commit 065374e002ad527c67a4852cd9f9551db046f20a and its history.
