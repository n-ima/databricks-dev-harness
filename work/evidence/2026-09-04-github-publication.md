# Private GitHub template publication evidence

## Scope and authorization

See `work/plans/2026-09-04-private-github-publication.md`. The user requested this harness's project name and private visibility. Authenticated personal owner: `n-ima`. Target: `n-ima/databricks-dev-harness`. No Databricks deployment, profile selection/authentication, collaborators, organization policy, hosted documentation, or production action is included.

## Pre-publication inspection

- Exact target was absent before creation (`gh api repos/n-ima/databricks-dev-harness --silent`: HTTP 404).
- Local source: branch `main`, no HEAD or remote. Existing local Git author identity is configured; no global identity change.
- 1,029 non-ignored candidate files / 10,249,950 bytes after starting this scoped session and plan. Largest file: intended documentation evidence PNG, 716,109 bytes. Later counts include the audit correction and publication evidence.
- Independent reviewer: `independent_release_check`, read-only; additional license/provenance subreview. No actual credential, business data, unexpected large or temporary file found. Token-shaped string in `tests/hooks.test.mjs:220` is an artificial redaction-test constant. This inspection is not a mathematical guarantee of no sensitive information.
- `.harness/` runtime/release/local-connection artifacts are ignored; `.env.example` contains examples only. No real `.env`, `.databrickscfg`, or product connection configuration is part of the source publication.
- Original candidate: `npm run harness:check` passed. 0.3.0 baseline validation: 981 managed files matched current source and a fresh local Git checkout with `core.autocrlf=true`; manifest SHA-256 `98fe579287b950c6af1745a902720860ff8807e8308689bc1adc71cea4059cdb`.

## Finding and correction

Reviewer found missing Databricks LICENSE/NOTICE before any push. The 289 vendored skill files and their generated provider copies matched upstream v0.2.10, but matching payload hashes did not establish complete distribution metadata. Exact upstream legal documents, explicit third-party scope, refresh acquisition, and conformance regression checks are added in candidate 0.3.1. See `docs/harness/operations/THIRD_PARTY_DISTRIBUTION.md`. No general-purpose OSS license was assigned to the user's harness.

## Publication status

- Created `https://github.com/n-ima/databricks-dev-harness` with `gh repo create ... --private`; activated template with the scoped repository API.
- Read-back result: `private: true`, `is_template: true`, `default_branch: main`. Added HTTPS origin to this exact repository. No collaborators, branch protection, account/organization settings, or other repositories changed.
- License/NOTICE bytes were independently compared to the exact official v0.2.10 raw documents in all three locations (vendor, Claude, Copilot): equal. `harness:check` passes.
- Final 310-test local suite (including eight new notice regressions): 309 pass, 0 fail, 1 skip (host lacks file-symlink test privilege; separate directory-junction test passes). Prior 302-test suite also passed before adding the regressions.
- Independent recheck confirmed exact legal bytes in all three copies, legal tests 8/8 pass, distribution tests 23 pass/1 permission skip, conformance pass, and the unchanged original 0.3.0 payload. No remaining blocker found within this review scope.
- New 0.3.1 snapshot: 994 managed files, current-source and fresh Git-checkout raw-byte parity passed. Manifest SHA-256 `fba3bef840e395d06902848d10cadcd834f63b3481b69d49deafe85233c7b37a`. Details: `work/evidence/release-byte-validation.json`.
- Initial reviewed source commit: `dd18e032a1e9ebe7b94094ed1e889dd24d9fe1cb`, pushed normally to `origin/main`. `git ls-remote origin refs/heads/main` and local HEAD agreed. 1,042 files tracked; no `.harness/`, real `.env`, `.databrickscfg`, `product.config.json`, or `node_modules/` files staged. The working tree was clean immediately after the initial push.
- Read-only GitHub verification after push: private/template both true, default branch `main`, Actions enabled and both workflows active. Branch `main` is **not protected**; this was not changed or misrepresented.
- Initial push had no automatically registered Actions runs/checks when polled. Actions and workflows were enabled. Explicitly dispatched the existing offline `Copilot setup steps` workflow on the source commit: `https://github.com/n-ima/databricks-dev-harness/actions/runs/33816257664` (queued at first read). This runs dependency/conformance/tests, not an AI model or Databricks deployment. A normal follow-up evidence commit also exercises the push trigger.
- Actual hosted run `33816257664`: **success**, source commit `dd18e032a1e9ebe7b94094ed1e889dd24d9fe1cb`, explicit `workflow_dispatch`, Ubuntu runner, completed `2026-09-03T23:08:57Z`. All setup/locked-dependency/conformance/test steps passed. Actual log: **310 tests / 310 pass / 0 fail / 0 skipped**. This is a CI bootstrap/test run, not a real Copilot agent session.
- Evidence-only follow-up commit `2e6dc171d7a52f0887eb270af0298b9253a86f1f` was pushed normally; no implementation, workflow, or baseline files changed from the tested source commit.
- `Harness conformance` push-triggered 3-OS workflow still returned an empty run list after both pushes. Windows/macOS hosted matrix execution and automatic push-trigger delivery are **not-run / unverified**. Cause is not established. No unsupported action, permission widening, workflow rewrite, or fabricated success was used to force this claim.

## Handoff

The private template is the harness source. For each actual data/AI product, create a separate private repository with **Use this template**, then run the documented setup and choose a development profile explicitly. The supplied Databricks folder is the proposed workspace location, not a GitHub repository or a completed connection.

Next administrative work: diagnose automatic Actions triggers, verify the full hosted OS matrix, and decide branch protection/reviewer rules. These remain separate from this narrowly authorized private repository creation. Do not claim full harness readiness from the successful source publication or Linux CI.

## Remaining external work (not publication claims)

- The screenshot is sufficient to identify the proposed development workspace and folder; it does not prove valid CLI OAuth or data/resource authority. No profile was automatically selected.
- Actual Databricks resource validation and workload execution remain not-run in this session.
- Claude/Copilot real host sign-in/discovery and repeated model evaluations remain separate.
- Branch protection, required reviews/checks, and production environments are not enabled by creating a private template repository.
