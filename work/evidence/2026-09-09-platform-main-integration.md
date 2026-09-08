# 0.4.0 main integration

Date:2026-09-09 JST. This extends the separately authorized publication recorded in2026-09-09-platform-publication.md.

## Authorization and exact scope

The assistant explicitly asked whether PR1 could be merged into main. The owner replied to proceed. The authorization was recorded in work/plans/2026-09-09-platform-release.md and the publication session before execution. It is approval of this source merge, not a Databricks deployment, permission change, new product specification, model trial or complete runtime certification.

## Observed integration

- Before merge:private=true,template=true,main=c2362bedd866f3ec6c492cd5f6a0e555f420de6c; PR1 head=f5a7bbbfb44ed456e9b53307b7b717a8c9c3470a,open,mergeable. The difference from CI-tested f90000b was confined to five work evidence/plan/session files.
- Executed gh pr merge with --merge and --match-head-commit f5a7bbbfb44ed456e9b53307b7b717a8c9c3470a. No --admin, force push, branch deletion or policy change.
- GitHub confirms [PR1](https://github.com/n-ima/databricks-dev-harness/pull/1) MERGED at2026-09-08T21:56:00Z, merge commit296d2790717e61e61e21d88498de89418f1e3818.
- Merge tree5f87f8602dccd10b1a5c4cea3ada650d32e2d0ca equals the approved PR-head tree. The tree diff is empty. Local main was fast-forwarded normally and selected; authorization records were preserved.
- Conformance passed after merge. All1012 managed files retain the0.4.0 manifest hashes, including fresh isolated Windows Git checkout parity. Report:work/evidence/2026-09-09-platform-merged-byte-validation.json. Manifest SHA-256:90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c.

## Post-merge hosted checks

Automatic CI was not observed in the initial merge-commit run list. The existing Copilot setup steps workflow was manually dispatched against main. [Run34283374957](https://github.com/n-ima/databricks-dev-harness/actions/runs/34283374957), job102253178625, completed successfully for exactly merge commit296d2790717e61e61e21d88498de89418f1e3818. Locked dependency install, conformance and325/325 tests passed,0 failed,0 skipped, duration21780.51415ms. API metadata and observed counters:work/evidence/2026-09-09-platform-main-hosted-ci.json.

The post-README-update local suite also passed:325 tests,324 pass,0 fail,1 Windows file-symlink privilege skip; duration14299.2841ms. The README and work-record follow-up commit is bookkeeping, not a new managed-source release and not a replacement for the hosted run's exact headSha.

## Documentation, recovery and limits

README is updated to identify private-main availability; README and work records are outside the1012 immutable managed files. Candidate implementation, controls, legal metadata and manifest bytes are unchanged. The prior0.3.2 and0.4.0 snapshots and Git history are retained. Source rollback would require a separately reviewed revert of the merge; no rollback or data operation was executed.

The five previously documented blank-line-at-EOF warnings remain non-semantic review nits. They were not silently marked clean or fixed by restamping the same release. Hosted three-OS automation, actual Claude/Copilot host behavior, Databricks OAuth/resources and paid model evaluation remain outside this merge certification.

Next product-specific gate:select the initial synthetic pilot and its repository name, then initialize a separate product repository. Databricks OAuth requires the owner's browser interaction. No product has been initialized in this source harness.
