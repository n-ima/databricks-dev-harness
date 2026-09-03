# Local validation — 0.3.0 candidate

Date: 2026-09-04 JST. Host: Windows. This record is an observed local test summary, not a release approval, authenticated workspace result, or real model evaluation.

## Commands and observed results

| Check | Observed result | Scope |
|---|---|---|
| `npm run test:harness` | 299 tests; 298 pass; 0 fail; 1 skipped. Root run duration 14.258 seconds. Independently repeated by cross-review agent. | Temporary-repository contracts, hooks, intake, memory, gates, scaffold, evaluation, updater. External commands are fakes except documented subprocess/browser checks. |
| `npm run harness:check` | Pass | Canonical/generated provider assets, required files, supported schema checks. |
| `node --test tests/scaffold-data.test.mjs tests/databricks-identity.test.mjs` | 27 pass / 0 fail after sharing credential-environment sanitization between connection and App scaffolding. | Selected-profile boundary, artifact drift, parallel apply, generated Python contracts. |
| `npm run harness:doctor -- --json` | 7 pass / 2 warnings / 0 fail; selectedProfile null | Node 24.15.0, Git 2.53.0.windows.1, Databricks CLI 1.6.0, Claude Code 2.1.201. Copilot CLI absent and profile intentionally unselected. |
| `node tools/check-guide.mjs` with local Playwright and Edge | Both 1366×900 and 390×844 pass | Title, heading, overflow, mouse/keyboard tabs, disclosure, JS errors. See [browser evidence](docs-browser.json), [desktop](docs-desktop.png), [narrow](docs-narrow.png). Screenshots were also visually inspected. |
| Generated Python `unittest` | Actual generated reference transitions and MERGE builder assertions pass | Does not prove Spark execution, Delta concurrency, or a real Databricks Runtime. |
| PowerShell AST / Git Bash `bash -n` | Syntax pass; repeat after final setup-dependency edits | Does not prove clean-machine package installation. |

The skipped case needs Windows file-symlink privilege. A separate directory-junction escape test runs and passes without that privilege. Linux/macOS CI is configured but has not run in GitHub.

## Finalization after the initial 299-test run

- Final complete suite: **302 tests / 301 pass / 0 fail / 1 skip**, 14.348 seconds. Three release-newline tests were added; no external model/workspace execution was introduced.
- Final PowerShell AST validation passed for setup, new-project and enable-template; Git Bash syntax validation passed for setup.sh. The setup author additionally reported five mocked Python-prerequisite branches, mocked opt-in winget, both workflow YAML/pin checks, and no real package installation. CI Python is pinned through the [official setup-python v7 release](https://github.com/actions/setup-python/releases/tag/v7.0.0); the Windows package ID was checked against the [official winget manifest](https://github.com/microsoft/winget-pkgs/blob/master/manifests/p/Python/Python/3/12/3.12.10/Python.Python.3.12.installer.yaml).
- LF policy is explicit for all text, including PowerShell. The normalization command found no CRLF files to change in this working tree. Release creation now rejects future CRLF-managed text; binary bytes and existing baseline metadata are preserved.
- `release create --version 0.3.0 --stamp-template` produced the ignored local payload `.harness/releases/0.3.0/` and distributable `harness/base-release.json`. This created no GitHub release or source-repository commit.
- `node tools/check-release.mjs` passed: **981 managed files** match both the stamped source hashes and a fresh local Git checkout using `core.autocrlf=true`. [Machine-readable proof](release-byte-validation.json). Test commits existed only in a temporary repository that was then removed; no network, user-repository commit or push.
- Desktop/narrow browser checks and screenshots were regenerated after the final HTML Python-prerequisite correction. Source/screenshot hashes in `docs-browser.json` correspond to that final page.

## Real CLI experiment, failure, and correction

1. The installed CLI fetched the official AppKit `v0.69.1` manifest. Manifest digest: `bb4c64b5f02465e5e4f16c4ed7ca2af8f57f1130d768dd18c184ab128d4cee98`.
2. One server-only mock `apps init` attempt omitted identity under the incorrect assumption that it was connectionless. The CLI attempted its ambient default-profile OAuth path and failed before initialization. This is a failed experiment, not an AppKit build or connection success. No app deployment or business-data operation was performed. Credential-bearing output is not copied here.
3. Official CLI source confirmed unconditional workspace initialization: [init.go](https://github.com/databricks/cli/blob/v1.6.0/cmd/apps/init.go#L142), [auth.go](https://github.com/databricks/cli/blob/v1.6.0/cmd/root/auth.go#L247). The harness now requires an explicit development profile and expected host for all App init, including fixture mocks. Profile inventory uses `--skip-validate`; only the selected matching profile can be authenticated.
4. A post-fix probe using the real manifest produced `needs-input`, including `profile` and `host`. Applying that plan was rejected before init. This probe performed no workspace authentication. Runtime diagnostic plan: `.harness/runtime/appkit-validation/work/scaffolds/20260903-192828-039-app-identity-guard-check-1ceb8f59.json` (ignored local artifact).
5. Mock approval now binds review and executable fixture hashes and checks them at planning and immediately before init. Plan and output locks prevent simultaneous generation to the same destination. Both have passing regression cases.

## Research and review provenance

- [Evidence-based research](../../docs/harness/research/2026-09-04-evidence-review.md) separates official observations, practitioner experience, design choices, and unverified hypotheses.
- [Cross-review](../reviews/final-harness-audit.md) documents concrete counterexamples, fixes, and reviewer involvement limits.
- [Independent final verification](../reviews/independent-final-verification.md) records a fresh review that did not implement the harness; it is scoped to local evidence, not external acceptance.
- [Requirements matrix](../../docs/harness/operations/VALIDATION_STATUS.md) maps H-01 through H-20 to local implementation and outstanding external proof.

## Not run / not authorized by this local test

- No selected valid Databricks connection, strict online Bundle validation, AppKit dependency build, development deployment, real Delta/Lakebase write, or Genie benchmark.
- No Claude/Copilot model task, paid golden trial, VS Code extension sign-in, Copilot cloud job, or OS-sandbox containment test.
- No GitHub repository creation/push, template activation, protected branch/Environment/OIDC configuration, hosted CI or public documentation publication.
- No claim of full accessibility certification, production readiness, L2/L3 maturity, or superiority over every other harness.

Actor labels and hashes do not authenticate reviewers. The next meaningful step is one explicitly chosen pilot repository/workspace/provider, followed by real user/data-surface validation and human approvals.
