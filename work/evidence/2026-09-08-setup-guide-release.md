# Setup guide 0.3.2 publication evidence

Date: 2026-09-08 JST. Scope: `work/plans/2026-09-08-setup-guide-release.md`.

## Authorization and prior independent review

- The repository owner explicitly requested push, then instructed continuation. Destination: the existing `https://github.com/n-ima/databricks-dev-harness.git`, branch `main`.
- Initial local HEAD and origin/main: `065374e002ad527c67a4852cd9f9551db046f20a`. GitHub API confirmed `isPrivate: true`, `isTemplate: true`, default branch `main` before changes.
- All 10 artifact hashes in `work/reviews/20260903-234524-803-concrete-setup-guide.receipt.json` matched before release metadata changes. The independent guide review covers GUIDE-01 through GUIDE-05. Its README hash is historical after this release's version/evidence-link update.
- Followed `orchestrate-work`, the existing release/distribution procedure, and a new durable release session. The ordinary sandbox command and patch helper failed during initialization; explicitly approved elevated execution of the same local commands and apply_patch implementation worked.

## Change scope

- Includes the previously reviewed setup walkthrough, README/USAGE links, expanded HTML setup section, CSS, command-copy fix, and documentation tests.
- Release-only changes: package/config version 0.3.2, changelog, current-version references, a new release manifest, and scoped work records.
- Keeps L1 maturity and previous validation limits. The prior 0.3.1 snapshot is immutable; this release is a distinct version.

## Validation

- `npm run harness -- release normalize --yes`: passed; zero files needed normalization.
- `npm run test:harness`: 315 tests, 314 passed, zero failed, one skipped; duration 14,032.6352 ms on Windows. The existing file-symlink privilege skip remains; the separate directory-junction test passes. All seven documentation tests passed in this run.
- `npm run harness:check`: passed. `git diff --check`: passed.
- The immutable 0.3.1 manifest hash and all 994 payload hashes still match the original snapshot.
- `npm run harness -- release create --version 0.3.2 --stamp-template`: created a distinct payload with 995 managed files.
- `node tools/check-release.mjs`: current-source and fresh-Git-checkout byte parity both passed for all 995 files. Manifest SHA-256: `75104b43d71ccd961c650f45ddf9a21f56451babfbdc9ab1638042be2bbbd6b2`. The exact generated report is retained at `work/evidence/2026-09-08-release-byte-validation.json`; the tool's generic report path was restored to its historical 0.3.1 content to preserve the earlier sealed evidence.
- Version metadata and current documentation were updated; the prior guide implementation is unchanged except README's current-version/evidence reference. No new semantic guide review, browser visual review, or provider evaluation is inferred from these release checks.

## Remote publication and CI

Not pushed yet. Remote commit and actual hosted-CI results will be recorded after publication.

## Limits

No Databricks authentication, resource or permission mutation, data write, product creation, or application deployment was performed. No public-site deployment, branch-policy change, or force push was performed. This request does not claim real-provider golden evaluation, L2/L3 maturity, live workspace validation, or new browser visual/accessibility evidence.
