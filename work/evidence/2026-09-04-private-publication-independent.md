# Independent private publication verification

Checked: 2026-09-04 08:08 JST. Reviewer: `independent_release_check` (Codex); read-only verification apart from the two explicitly authorized independent evidence files. Scope is PUB-01–PUB-03 in `work/plans/2026-09-04-private-github-publication.md`, not all harness requirements.

## PUB-01 — pass

Authenticated, read-only `gh repo view n-ima/databricks-dev-harness --json nameWithOwner,url,isPrivate,isTemplate,defaultBranchRef` returned:

- Repository: https://github.com/n-ima/databricks-dev-harness
- `isPrivate: true`, `isTemplate: true`, default branch `main`.
- Independent branch API read returned `protected: false`. Branch protection was not enabled or claimed.

## PUB-02 — pass

- Remote `main` and GitHub's commit endpoint both identify publication commit `dd18e032a1e9ebe7b94094ed1e889dd24d9fe1cb`.
- GitHub reports commit tree `ebb3f329f075422371b3d6010604af6226827f74`, equal to the independently queried local commit tree. This binds the remote content to the exact audited commit, not subsequent working-tree edits.
- Read the committed blobs using `git ls-tree -rz COMMIT` and `git cat-file --batch`: 1,042 files, 10,295,817 bytes. No tracked `.harness/`, real `.env`, `.databrickscfg`, `product.config.json`, `node_modules/`, build/runtime directories, private-key files, or symlinks were found.
- Credential-shape scan of the committed text found only the previously inspected artificial redaction regression constant at `tests/hooks.test.mjs:220`. No actual credential was identified. This is scoped inspection, not a guarantee against every possible secret format.
- The committed vendor and both provider trees include LICENSE, NOTICE, and THIRD_PARTY.md. Exact upstream legal-byte parity was independently checked before publication; original skill files were unchanged.
- The committed 0.3.1 baseline contains 994 managed entries. Every committed managed blob matches its declared SHA-256. Baseline SHA-256: `fba3bef840e395d06902848d10cadcd834f63b3481b69d49deafe85233c7b37a`.
- Initial local no-HEAD/no-remote state was independently observed during the pre-publication review. Target absence, normal initial commit/push commands, and no-overwrite operation are recorded in the coordinator's `work/evidence/2026-09-04-github-publication.md`; present-day API state alone does not prove historical push flags.

## PUB-03 — pass for actual CI result reporting, with explicit not-run limits

At the initial independent observation, `gh run list --repo n-ima/databricks-dev-harness` returned an empty list and the publication commit's `check-runs` API returned `total_count: 0`. No success was inferred from that state.

The coordinator subsequently dispatched the existing `Copilot setup steps` workflow. This reviewer independently read its terminal run/job/step metadata and logs:

- Run: https://github.com/n-ima/databricks-dev-harness/actions/runs/33816257664
- Event: `workflow_dispatch`; tested commit: `dd18e032a1e9ebe7b94094ed1e889dd24d9fe1cb`.
- Job `copilot-setup-steps`: completed successfully at `2026-09-03T23:08:57Z` (2026-09-04 JST), using the workflow's Ubuntu hosted runner. All reported steps succeeded, including dependency installation, Python version verification, harness conformance, and the test suite.
- Independently read log totals: **310 tests / 310 pass / 0 fail / 0 skipped**, duration 19,270.957452 ms. Node logged v24.20.0. This is real hosted execution, separate from the earlier Windows local result.
- `Harness conformance` workflow API still returned `total_count: 0`. Its three-OS matrix and automatic push-trigger behavior are **not-run**, with the missing-trigger cause undetermined. The successful Ubuntu setup workflow is not three-platform CI proof and not a real Copilot model task.
- Remote `main` subsequently moved to `2e6dc171d7a52f0887eb270af0298b9253a86f1f`. GitHub compare reports one commit ahead, zero behind the tested publication commit, with only the coordinator evidence and publication session changed. The tested source commit remains in `main` history; source code was not changed by that follow-up.

PUB-03 passes its narrow requirement to record actual CI results and independent publication verification while distinguishing success and not-run. It does not mean every configured workflow ran. Read-only Actions settings show enabled workflows; those settings alone are not execution evidence. Branch protection remains false.

## Limits

Publication does not complete H-01–H-20, establish Claude/Copilot runtime parity, validate a Databricks identity or workload, activate branch protection/production environments, or certify production readiness. No Databricks resources, credentials, collaborators, permissions, repository settings, source files, commits, or remote objects were changed by this reviewer.
