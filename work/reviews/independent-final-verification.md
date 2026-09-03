# Independent final verification — 0.3.0 local candidate

Date: 2026-09-04. Reviewer: independent Codex subagent `independent_release_check`, not an implementation author. Scope: bounded read-only verification, except this report, against `docs/harness/requirements/HARNESS.md`, the completion plan, and `docs/harness/operations/VALIDATION_STATUS.md`.

## Decision

**PASS for the exercised L1 local behaviors. Full H-01–H-20 acceptance and release readiness are NOT established.** No blocking implementation defect was reproduced in the tested setup/session/update and safety flows. Final distribution newline normalization, template stamping, and Git-checkout hash verification were still pending with the coordinating agent when this report was written; this report does not pre-approve those changes.

## Direct independent results

Environment: Windows, PowerShell, Node v24.15.0, npm 11.12.1, Python 3.11.15. Source is the current uncommitted working tree, not an immutable release commit.

| Check | Actual result |
|---|---|
| `npm run harness:context` | Pass: version 0.3.0, L1, product uninitialized, matching active completion-audit session discovered |
| `npm run harness:check` | Pass on both runs, including after Python setup/CI edits |
| `npm run test:harness` | Both runs passed: 299 tests, 298 pass, 0 fail, 1 skip; final duration 14,217 ms |
| `npm run harness:route -- --prompt '売上アプリの画面モックを作って'` | `mock-ui`, `ui-mock` gate |
| `npm run session:list` | Active completion-audit session and prior completed session discoverable |
| PowerShell parser on `scripts/setup.ps1` | Pass after Python prerequisite edits |

The skipped case was `managed symlinks and junctions are rejected in release and destination`: this Windows host cannot create the test file symlink. The separate Windows directory-junction rejection case passed. A skip is not a pass.

## User-flow and requirement evidence

- H-01/H-02/H-16 local distribution/setup: the passing fresh-template test executes the CLI in a temporary repository, preserves product configuration and customized Bundle on rerun, registers original upstream hashes, and preserves a newer installed baseline. Distribution tests reject tampering, unsafe ownership, stale plans, downgrades, same-version mutation, and downstream conflicts; replaced/deleted managed files are backed up. Inspected `distribution.mjs` and setup dispatch match the documented manual-review/update ownership limits.
- H-05/H-06/H-07/H-08/H-09 local workflow/memory: README, USAGE, CLI reference, router, orchestrate/review skills, intake and session implementations agree on explicit intent overriding keyword hints, mandatory material decisions, durable files, checkpoint next actions, and independent evidence before completion. Temporary-repository tests exercise actual CLI setup/start/checkpoint/blocked closure and reject premature completion; receipt, intake concurrency, and knowledge tests passed.
- H-03/H-04/H-10/H-11 local contracts: explicit profile/host matching, unvalidated inventory, malformed auth rejection, fixture-only AppKit plans, approval invalidation, generated Python contracts, and draft-only data/Genie/metric scaffolds passed with fake external responses. Scaffold now uses the shared profile environment sanitizer. These tests do not prove a real workspace connection, AppKit build, provider-host behavior, or Spark/Delta execution.
- H-12/H-13/H-14/H-15/H-18 local controls: budgets, locks, policy changes, hook attack cases, stale/false completion receipts, evaluation not-run handling, and generated asset/schema checks passed. Documentation correctly states that hashes/actor labels are not identity authentication and hooks are not an OS sandbox.
- H-17/H-19/H-20 scope honesty: the validation matrix distinguishes local tests from external proof and retains L1. Local guide HTTP/link/CSP tests passed in the suite. Browser screenshots, broader accessibility, other operating systems, and real provider trials were not independently rerun here.

## Pending finalization and not-run

1. The coordinator identified raw-byte release hashes versus Git newline conversion as a distribution portability concern. At this review, `.gitattributes` still used `text=auto` and PowerShell CRLF. Planned LF normalization, release stamping, and a temporary Git roundtrip with raw-hash comparison require fresh recorded results before declaring the distribution snapshot verified.
2. Python 3.10+ detection is present in both setup scripts; both CI workflows select pinned Python 3.12 and pass its executable to contract tests. USAGE documents the dependency. The HTML guide's Unix prerequisites still omitted Python at last inspection; the coordinator owns that small documentation correction. This reviewer parsed PowerShell but did not perform package installation or execute hosted CI.
3. Not-run: clean-machine Windows installation, macOS/Linux hosted workflows, GitHub repository/template activation/branch protection/Environment policies, authenticated Databricks/OAuth/permissions/strict Bundle checks, real AppKit/Spark/Delta/Lakebase/Genie integration, actual Claude/Copilot host goldens, authenticated independent reviewer identity, OS process-tree containment, production deployment, and published release.

No completion receipt was fabricated or sealed. Keep external criteria unaccepted and append separately attributable evidence for finalization rather than treating local tests as full product certification.

## Independent finalization addendum — 2026-09-04

Pending items 1 and 2 above are now resolved for this local Windows candidate. This same independent reviewer reran `npm run harness:context`, `npm run harness:check`, and `node tools/check-release.mjs` after finalization; all passed.

- The release check independently compared every one of the **981 managed files** against the stamped 0.3.0 manifest, then against a fresh temporary Git checkout configured with `core.autocrlf=true`: both raw-byte hash comparisons passed. Manifest SHA-256: `98fe579287b950c6af1745a902720860ff8807e8308689bc1adc71cea4059cdb`. Direct output is retained in `work/evidence/release-byte-validation.json` (checked at `2026-09-03T19:40:51.433Z`, 2026-09-04 Japan time). No network or commit to the actual project repository was used.
- The HTML guide now explicitly lists Python 3.10+ for local contract tests and distinguishes it from the product-specific Databricks Runtime Python version (`docs/site/index.html`, Unix setup panel).
- The coordinator reports the expanded full suite at 302 tests / 301 pass / 0 fail / 1 skip after adding three EOL regressions. That count is coordinator evidence, not a claim that this reviewer reran the expanded suite; this reviewer's directly executed full-suite results remain the 299-test runs above.

Final independent disposition: **L1 local behavior and finalized release-byte portability check PASS within the stated scope**. Full H-01–H-20 acceptance, real-provider/workspace execution, hosted Linux/macOS CI, publisher authentication, and every other external not-run item remain unestablished. No full-completion receipt is issued.
