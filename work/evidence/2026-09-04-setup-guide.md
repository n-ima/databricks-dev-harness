# Concrete setup guide validation

Date: 2026-09-04. Scope: `work/plans/2026-09-04-concrete-setup-guide.md`, not product/workspace setup or complete harness certification.

## User outcome and changes

- Added `docs/harness/operations/SETUP_WALKTHROUGH.md` and linked it from README, USAGE, and the expanded existing local HTML setup section.
- Assumed Claude Code and GitHub Copilot are already available. Removed mandatory extension-install flags from the primary examples.
- Explained template create/clone versus an empty directory; setup resolves its own script/repository location, not the caller's current directory. `new-project.ps1` rejects an existing LocalPath, even empty.
- Split OS/tool checks, optional Windows prerequisite install, harness file generation, OAuth, connection verification, npm/app dependency installation, and platform resource/deployment work.
- Used only the user-supplied non-secret workspace origin and folder. Marked `harness-dev`, `sales-operations`, `workspace`, `sales_dev`, and developer suffix as examples or choices, not established resources/identity.
- Added persistent local Bundle variable JSON, `team_root` versus dev Users root distinction, optional scoped Shared path change, separate app Bundle configuration, failure recovery, and natural-language handoff.
- Clarified that requirement/design work may start before Bundle execution readiness. Validation and deployment are not conflated.
- Corrected guide copy selection from the first inline code element to `pre code`, with a regression test executing the actual script against a small document/clipboard fixture. No new runtime dependency.

## Evidence and validation

- Main implementation inspection: `scripts/setup.sh`, `scripts/setup.ps1`, `scripts/new-project.ps1`, `tools/harness.mjs` setup/bundle generation, `tools/lib/databricks.mjs` connection, current `.gitignore`.
- Independent setup-contract audit by `databricks_audit`, read-only, agreed with the boundaries documented above.
- CLI help checked locally without authentication: `databricks workspace get-status --help` confirms positional PATH; `databricks bundle validate --help` confirms `--strict`, explicit profile and target.
- `node --test tests/docs.test.mjs`: final **7 passed / 0 failed / 0 skipped**. Includes live local HTTP route/link/CSP checks, code and JSON parity, explicit-profile/host checks, unsafe-command exclusion, and the copy-button fixture. An initial test failed because the text said 'not an installer' instead of explicitly saying 'does not install'; clarified the guide and reran without weakening the assertion.
- `npm run test:harness`: final **315 tests / 314 passed / 0 failed / 1 skipped**, duration 14,597.4962 ms on the local Windows host. Skip is the existing file-symlink-privilege limitation; separate directory-junction test passes.
- `npm run harness:check`: passed. `git diff --check`: passed.
- HEAD requests to the retained local guide and new Markdown route each returned HTTP 200. Existing local preview handoff was queued; no new hosting site or deployment was created.
- Independent final documentation review by `independent_release_check`: GUIDE-01 through GUIDE-05 pass; reran the final seven focused tests (7/7 pass). The review corrected ambiguity between optional interactive login and connection checks that run whenever a profile is supplied. No open finding remained.

## Primary-source research

Main agent and a separate read-only research agent consulted current official pages. The independent documentation reviewer did not re-fetch every source; source verification and code review are separate evidence.

- [Workspace identifiers](https://docs.databricks.com/aws/en/workspace/workspace-details): workspace origin versus object identifiers.
- [Workspace objects](https://docs.databricks.com/aws/en/workspace/workspace-assets): right-click Copy URL/path → Full path, `/Workspace` prefix.
- [OAuth user authorization](https://docs.databricks.com/aws/en/dev-tools/auth/oauth-u2m): profile-oriented CLI login and home-directory token cache; do not copy credentials into the repo.
- [Bundle variables](https://docs.databricks.com/aws/en/dev-tools/bundles/variables): `.databricks/bundle/<target>/variable-overrides.json`, declared variables and precedence. Local source, not the external page, establishes this harness's dev/test/prod defaults.
- [Compute connection details](https://docs.databricks.com/aws/en/integrations/compute-details): SQL Warehouses → Connection Details.
- [Apps authorization](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/auth): app identity and user identity are separate, with scoped resource access.
- [Free Edition limits](https://docs.databricks.com/aws/en/getting-started/free-edition-limitations) and [overview](https://docs.databricks.com/aws/en/getting-started/free-edition): non-commercial scope, serverless/resource limits, no full-platform or AppKit-plugin guarantee inferred from a screenshot.

## Limits and release state

No new GitHub product repo, Databricks login, profile selection, software install, resource creation, permission grant, data access/write, deploy, commit, or push was performed for this request. The source harness remains without product.config.json or a root databricks.yml. No actual developer bootstrap against the supplied workspace was run.

No browser DOM/screenshot/visual test was requested or performed this turn. Older browser screenshots and their source hashes are historical evidence for the prior guide, not proof of this changed HTML/CSS/JS. The new tests validate bounded static/HTTP/script behavior, not appearance or comprehensive accessibility.

The published 0.3.1 manifest remains unchanged: SHA-256 `fba3bef840e395d06902848d10cadcd834f63b3481b69d49deafe85233c7b37a`. Independent reviewer also checked all 994 files in its immutable local payload. Current working-tree documentation differs from that release intentionally; do not claim current checkout parity with 0.3.1 or repack it under the same version. This local change requires a new reviewed version/snapshot before subsequent template release. Previous hosted CI success applies to the published source, not this unpushed update.
