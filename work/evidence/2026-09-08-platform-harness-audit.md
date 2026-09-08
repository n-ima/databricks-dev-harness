# Platform harness audit: local evidence

Date: 2026-09-08 JST. Branch: codex/platform-development-harness.
Scope: work/plans/2026-09-08-platform-harness.md. Candidate work; no production certification.

## Preconditions and external boundary

The owner confirmed no Databricks CLI profile is configured. No real workspace authentication, Bundle deploy, data write, permission grant, model training/serving or paid provider trial was performed. The previous screenshot establishes only the workspace host, Free Edition and a Shared folder; it does not establish resource IDs or permissions.

Baseline main: c2362bedd866f3ec6c492cd5f6a0e555f420de6c. Prior source release 0.3.2 remains immutable. Current source and documentation changes are not a new main publication.

## Primary-source tool observations

- Local PATH: Databricks CLI 1.6.0; Claude Code 2.1.201; VS Code 1.136.1; Copilot CLI not found on PATH.
- Official GitHub release APIs: Databricks CLI 1.15.0 (2026-09-03), AppKit 0.72.0 (2026-09-04), Databricks Skills 0.2.15 (2026-09-07), Claude Code 2.1.263 (2026-09-06), Copilot CLI 1.0.83 (2026-09-04).
- Downloaded official Windows amd64 CLI1.15.0 zip into ignored .harness/runtime/audit-cli-1.15.0. SHA-256 verified against official release SHA256SUMS:
  8a079e66b9fd79307660aa67769522d330afba6930f69e9c19770f9da42a8bf1.
- Isolated CLI -v and environments setup-local --help succeeded. No global installation or environment setup executed.
- apps manifest --version v0.72.0 --profile HARNESS_OFFLINE_RESEARCH -o json succeeded. This deliberately nonexistent profile avoids selecting an actual identity; manifest retrieval required no workspace authentication.
- Canonical JSON manifest SHA-256:
  bb4c64b5f02465e5e4f16c4ed7ca2af8f57f1130d768dd18c184ab128d4cee98.
  Schema2.0, plugins agents/aiSearch/analytics/database/files/genie/jobs/lakebase/server/serving; server mandatory; agents/aiSearch/database beta.
- The same CLI's aitools install --path .harness/runtime/skills-0.2.15-audit reported **Using skills version 0.2.10**, then **Wrote 29 skills**. The directory name is an audit label, not the resolved version. No vendor, legal lock, global plugin or agent configuration was overwritten by this acquisition.
- Pins remain CLI compatibility >=1.6 <2, AppKit v0.69.1, vendored skills0.2.10. Latest upstream candidates are documented, not falsely reported as locally adopted and runtime-verified.

## Verification sequence

1. Independent before-change API and analysis/ML/Serving trials reproduced UI/no-UI, model registration and discussion/deploy routing failures.
2. Added catalog/resolver/intake, API/analysis contract starters, hook-envelope and multi-file-edit checks.
3. Focused workloads/contracts/concurrency run: 81 tests,81 pass,0 fail,0 skip.
4. Hook and fresh-template run: 121 tests,121 pass,0 fail,0 skip.
5. Full suite before final review refinements: 324 tests,323 pass,0 fail,1 skip (Windows file-symlink privilege; existing junction test remains). Duration13604.9758ms.
6. Independent API retest: route/intake correct,6 isolated generated files,2 generated HTTP tests pass, additional first-key24 concurrent requests pass, no-overwrite and human-gate probes pass.
7. Independent analysis retest found compact ISO dates accepted by Python but filtered by SQL. Tightened row/start/end to canonical ASCII YYYY-MM-DD and added regression cases. Fresh replan: generated3 tests pass; independent24 noncanonical cases reject,2 canonical boundary cases match SQL,Notebook code cell executes with quantities5,4.
8. Added the API review's first-key concurrent probe to the generated regression test and made non-UI execution-plan wording explicit. Final suite/result recorded below after rerun.

Provider hooks were executed as real Node processes using documented synthetic payloads. This does not certify host discovery, actual VS Code/Claude/Copilot hook firing, OS/network containment, or model performance. Existing high-risk failure, concurrency, integrity, approval and distribution tests were not weakened.

## Requirement evidence map

- PLATFORM-01: docs/harness/research/2026-09-08-platform-audit.md; primary URLs and observations above.
- PLATFORM-02: harness/workloads.json; tools/lib/workloads.mjs; tests/workloads.test.mjs.
- PLATFORM-03: tools/lib/intake.mjs; canonical skills; independent before/after task trials.
- PLATFORM-04: tools/lib/starters.mjs; harness/templates/starters; actual HTTP/SQL/Python/Notebook tests.
- PLATFORM-05: tools/agent-hook.mjs; tests/hooks.test.mjs; PROVIDER_COMPATIBILITY.md. Host-level trials explicitly remain not-run.
- PLATFORM-06: isolated official CLI/manifest/skill-resolution evidence; PROVIDER_COMPATIBILITY.md; legal/vendor unchanged.
- PLATFORM-07: focused/full suites and independent forward-test records; no live/model trial marked pass.
- PLATFORM-08: PLATFORM_PLAYBOOK.md, USAGE, CLI_REFERENCE, ADR-0005; distinct candidate and old-release integrity to be checked.

## Final local regression and independent artifacts

- Final source suite:325 tests,324 pass,0 fail,1 Windows file-symlink-privilege skip; duration13260.3287ms. All16 workload positive cases and English API/dashboard composition are included.
- Generated asset sync, conformance, git diff --check and managed LF normalization passed. Normalization changed0 files.
- Old0.3.2 immutable payload:995 files individually rehashed against its own manifest, all match. The old snapshot was not restamped.
- API independent report: work/reviews/2026-09-08-platform-api-forward-test.md. Its original snapshot precedes the two nonblocking review suggestions incorporated into the final source.
- Analysis independent report: work/reviews/2026-09-08-platform-analysis-forward-test.md. It preserves the discovered date bug and fresh-plan verification of its correction.
- Stable lesson recorded under docs/harness/knowledge with source, confidence, applicability, review date and executable regression references.

## Final candidate packaging and review

- Final independent code/operations review: work/reviews/2026-09-08-platform-final-review.md. No additional blocking finding in the stated local scope. Independent latest workloads/hooks:123/123 pass; newly generated HTTP contract:2/2 pass. These are subsets, not extra full-suite passes or actual provider-host trials.
- Created the distinct local .harness/releases/0.4.0 snapshot and stamped harness/base-release.json after the managed source was frozen. The manifest contains1012 managed files. This is packaging, not release approval or publication; no source-repository commit or push was performed.
- Base manifest SHA-256:90f06b95119d9c3d5f04d6e4d9863a310bea24851af06b7c12fb3ff1323b5b8c. This identifies the managed candidate; HEAD remains the baseline commit and must not be presented as the revision containing these uncommitted changes.
- work/evidence/2026-09-08-platform-byte-validation.json: pass at2026-09-07T23:38:40.123Z. All1012 source hashes and a fresh isolated Windows Git checkout with core.autocrlf=true match. Network not used; the only Git commits made by that checker were in its disposable fixture repository. Linux/macOS and publisher authentication are not covered.
- Post-packaging full regression: npm run test:harness,325 tests,324 pass,0 fail,1 Windows file-symlink-privilege skip; duration13803.2371ms. This supersedes the pre-packaging duration above, with unchanged counts. No managed implementation edits followed packaging.
- Post-packaging npm run harness:check: pass. Old0.3.2 payload remains unchanged;995 hashes were also independently rechecked by the final reviewer.

## Remaining promotion evidence (not-run)

Both real providers on supported surfaces, first OAuth and explicitly approved dev resources, live AppKit/Lakebase/Delta/Genie/ML/Serving/MCP integration, clean-machine/3-OS testing for this revision, complete real model golden-task matrix and independent release approval remain unexecuted. The golden-task catalog now has11 tasks; both providers x3 repetitions requires66 actual trials, not66 generated success claims. Static/fixture results do not certify all platform functionality or Free Edition suitability for business.

The next human step is the OAuth command in PLATFORM_PLAYBOOK.md in an initialized target-product repository. Non-commercial synthetic pilot first; real business use needs an appropriate workspace/terms/security review.
