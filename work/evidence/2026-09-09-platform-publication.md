# 0.4.0 private GitHub publication evidence

Date: 2026-09-09 JST. Scope: work/plans/2026-09-09-platform-release.md.

## Authorization and preflight

- User instructed continuation of the proposed source publication and subsequent, separately scoped pilot.
- GitHub API confirmed n-ima/databricks-dev-harness isPrivate=true, isTemplate=true, default branch=main. Main remains unprotected; policy and visibility are unchanged.
- Remote main and local starting HEAD: c2362bedd866f3ec6c492cd5f6a0e555f420de6c. No remote codex/platform-development-harness branch existed at preflight.
- Existing independent review is work/reviews/2026-09-08-platform-final-review.md. No new semantic implementation was added for publication; the managed source remains frozen at the reviewed 0.4.0 candidate.
- Source publication will use the existing feature branch and a PR. It does not approve its own policy changes, merge main, or certify production operation.

## Revalidation

- npm run test:harness:325 tests,324 pass,0 fail,1 Windows file-symlink-privilege skip; duration15341.0187ms. The separate junction test passed.
- npm run harness:check:pass.
- work/evidence/2026-09-09-platform-byte-validation.json:pass. All1012 managed files match the candidate and a fresh isolated Windows Git checkout with core.autocrlf=true.
- Candidate manifest SHA-256 remains90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c. The0.3.2 snapshot is not restamped.
- No Databricks authentication, resource/permission/data mutation, model trial, global tool installation or production deploy was performed.
- All9 focus-file SHA-256 values in the independent final review still match. The scoped pre-commit inventory contains63 changed/new files, including publication records. No local runtime, release payload directory, environment file or credential configuration is included.
- Supplemental recognizable-credential-pattern scan found only the pre-existing synthetic secret in the hook-event sanitization test at tests/hooks.test.mjs. It is unchanged from HEAD and explicitly asserts that the test value never appears in persisted event/output. This limited pattern scan is not a complete secret-security audit.
- After staging, git diff --cached --check reported five non-semantic blank-line-at-EOF warnings in newly added ADR-0005-platform-workloads.md, PLATFORM_PLAYBOOK.md,2026-09-08-platform-audit.md,tests/helpers/workloads.mjs and tools/lib/starters.mjs. The earlier unstaged diff check did not include these untracked files. This is a warning-bearing check, not a pass. The existing0.4.0 managed bytes remain unchanged; no lint configuration or test was weakened. Surface these formatting nits in review and normalize them in a distinct future snapshot if required.

## Remote results

Pending source commit, push, PR and hosted checks. Record the actual source revision and run URL after execution; do not infer hosted success from local tests.

## Next gate

Human review of the PR before main integration. Then choose a small synthetic API or read-only analysis pilot and initialize a separate product repository. OAuth requires the owner's browser interaction; the source harness is not the product workspace.
