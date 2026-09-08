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

- Source commit f90000b1b4ae3ffad9ac810f632822ddfbf65ab2 was normally pushed to origin/codex/platform-development-harness. git ls-remote returned the identical SHA; the worktree was clean after the source commit.
- Created PR [#1](https://github.com/n-ima/databricks-dev-harness/pull/1), base main, head codex/platform-development-harness. No merge, force push, reviewer impersonation, visibility or branch-policy change was performed.
- No automatic push/PR run was observed. Actions is enabled and Harness conformance is active; the cause of missing automatic runs was not established. Dispatched the existing Copilot setup steps workflow explicitly against the feature branch.
- Hosted run [34280734934](https://github.com/n-ima/databricks-dev-harness/actions/runs/34280734934), job102244592960, completed successfully for exactly the source SHA above. Ubuntu, Node24, Python3.12.14:locked install, conformance,325 tests/325 pass/0 fail/0 skip; duration19729.071504ms. The machine-readable API result and observed test counters are in work/evidence/2026-09-09-platform-hosted-ci.json.
- The hosted workflow's name does not mean a real Copilot model was invoked. Actual coding-provider host/LLM and Databricks checks remain unrun; the automatic3-OS matrix remains unobserved. A manual Ubuntu run does not certify those scopes.
- This final evidence, PR-description and session update is an evidence-only follow-up to the tested source commit. Managed candidate files and version metadata are unchanged. The follow-up's own SHA is not substituted for the workflow headSha.

## Next gate

Human review of the PR before main integration. Then choose a small synthetic API or read-only analysis pilot and initialize a separate product repository. OAuth requires the owner's browser interaction; the source harness is not the product workspace.
