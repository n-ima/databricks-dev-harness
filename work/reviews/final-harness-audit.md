---
id: FINAL-HARNESS-AUDIT
status: local-candidate-conditional
reviewer: codex-repo-audit-subagent
reviewed_at: 2026-09-03T19:30:26Z
requirement: ../../docs/harness/requirements/HARNESS.md
scope: local-harness-contracts-and-claim-boundaries
release_signoff: false
---

# Final harness audit — 0.3.0 candidate

## Conclusion

The inspected snapshot supports an **L1 local implementation candidate**, not a release-ready, production-proven, or independently certified autonomous development service. No blocking defect remains in the local contracts exercised below. Real provider behavior, authenticated Databricks workloads, clean-machine setup, hosted CI, and organization controls remain unverified and must not be converted into passing acceptance results.

This reviewer used a separate agent context to challenge other agents' implementation, but also authored contract/hook/memory tests and previously participated in loop/intake refactoring. This is a skeptical cross-review, **not an independent release signoff for this reviewer's own changes**. Reviewer labels and hashes are not authenticated identities. A fresh reviewer and protected CI are still required for promotion.

## Directly reproduced checks

Environment: Windows, Node.js `v24.15.0`, npm `11.12.1`; execution on 2026-09-04 JST. External commands in the contract tests use injected fakes. Writable test fixtures are temporary repositories, not the user's product repository.

| Check | Observed result | Boundary |
|---|---|---|
| `node --test tests/contracts.test.mjs` | 56 tests passed, 0 failed | Includes all 20 harness AC identifiers, explicit profile/host, malformed auth, manifest contracts, approved artifact changes, intake gates, loop budgets and evidence refusal |
| `npm run harness:check` | Passed | Structure, supported schemas and generated provider asset conformance; not provider-host behavior |
| `npm run test:harness` | 299 tests: 298 passed, 0 failed, 1 skipped; 14.19 seconds | File-symlink test skipped because this Windows host lacks that privilege. The separate directory-junction rejection test passed. No skip is counted as a pass |
| Browser evidence hash recomputation | All five entries matched | Checked `docs/site/index.html`, `guide.css`, `guide.js`, desktop/narrow screenshots against `work/evidence/docs-browser.json`; this reviewer did not personally rerun the browser |
| CLI/document comparison | README, usage, CLI reference and mock skill agree on explicit profile/host | Documentation now distinguishes fixture-only business data from the workspace authentication required by AppKit initialization |
| `git remote -v` | No remote configured | No evidence of GitHub template activation, branch protection, hosted CI, or publication |

The full-suite count is a timestamped observation, not a claim that later edits were covered. Repeat the checks after subsequent changes. The browser record reviewed was generated at `2026-09-03T19:29:22.263Z`; its five artifact hashes matched at review time. It covers mouse/keyboard tabs, disclosure controls, basic page structure, no horizontal overflow at 1366×900 and 390×844, and no JavaScript errors. It does not certify axe, contrast, screen readers, the AppKit product UI, or public hosting.

## Counterexamples resolved during review

| Severity before correction | Finding | Correction and verification |
|---|---|---|
| P1 | Harness criteria used `H-01 Distribution:` while the evidence parser required `H-01:`; the harness could not prove its own full AC coverage | Requirement now uses `H-01:` through `H-20:`. A regression test asserts that the real requirement yields exactly those 20 IDs |
| P1 | Fixture-only AppKit was described as offline even though the official initializer authenticates | Every App plan now needs explicit profile and HTTPS host, uses nonvalidating profile inventory before checking identity, and rechecks identity before initialization. Missing identity does not authenticate or initialize. Documentation was corrected |
| P1 | A mock approval could remain apparently valid after changing the executable fixture | Approval requires a review plus separately hashed executable/fixture artifacts; planning and apply reject absent, empty, missing or changed artifacts. Contract tests cover missing hashes and changed fixtures before any init |
| P1 | Different ready scaffold plans could concurrently initialize the same output | Apply now holds both a plan lock and a kind/name output lock across generation and validation. Full-suite tests cover the same plan and different plans sharing an output |
| P1 | Completion could rely on divergent loop/session receipt interpretation | Central receipt validation now binds accepted requirement, session, policy hash, every AC and nonempty hashed evidence. Negative tests cover missing coverage, changed evidence, self-review, invalid independence and stale policy |
| P1 | Concurrent loop/intake updates could overwrite state or start duplicate work | State is reread after file-lock acquisition. Tests cover parallel runs/answers, conflicting checkpoints, approval locks and same-name intake creation |
| P1 | Authentication success could be inferred from stale inventory flags or an error JSON with process exit zero | Connection rejects host drift and auth errors before current-user lookup/persistence; doctor does not authenticate unspecified profiles. Dedicated identity tests cover credential precedence and CLI version bounds |
| P2 | App rules approval and required before-init evidence had no usable JSON example | CLI reference now documents `appkit-rules` manifest binding and per-rule result shape. Mock approval has an executable CLI command with repeated artifact arguments |
| P2 | Update adoption could be confused with blessing the current downstream bytes | Distribution docs explain upstream `base-release.json`, first-setup baseline registration and why a downstream snapshot must not be used as its own baseline; updater tests reject overwrite/downgrade/mutation |

The AppKit authentication correction is also supported by the pinned [Databricks CLI v1.6.0 initializer source](https://github.com/databricks/cli/blob/v1.6.0/cmd/apps/init.go#L142), where the command's pre-run requires a workspace client. Source inspection proves a CLI precondition, not a successful app build. The implementation team's failed implicit-profile attempt is explicitly disclosed in `docs/harness/operations/VALIDATION_STATUS.md`; it must not be restated as a successful authenticated smoke test.

## Remaining conditions by requirement

The detailed implementation matrix is in `docs/harness/operations/VALIDATION_STATUS.md`. These are the remaining acceptance boundaries and concrete next verification steps, not instructions to bypass human gates.

| Requirement | Local finding / remaining proof | Acceptance verification |
|---|---|---|
| H-01 Distribution | Scripts and updater exist; remote/template policy absent | Owner chooses repository/visibility; run actual template activation and create a separate pilot repo; inspect branch protection |
| H-02 Setup | Fresh temporary-copy and rerun tests pass; not a clean machine install | Run supported Windows entrypoint on a clean allowed host and macOS/Linux path; record tool versions and safe rerun behavior |
| H-03 Databricks connection | Fake CLI contracts pass; no selected live workspace | Owner supplies approved dev host/profile; OAuth, current identity, resource permissions and strict Bundle validation must pass without repository secrets |
| H-04 Provider parity | Generated assets and payload hooks agree | Verify discovery, lifecycle events and permission behavior in each intended Claude/Copilot VS Code, CLI and cloud host |
| H-05 Natural-language intake | Routing/intake are deterministic local contracts | Run ordinary Japanese/English pilot requests in real providers; confirm sessions/design and read-only requests behave correctly |
| H-06 Refinement | Material unanswered questions block approval | Product owner reviews actual semantics, authority and feature-specific acceptance criteria; retain explicit decisions |
| H-07 Design separation | Harness/product/work paths are distinct and tested | Review generated pilot requirement/design links; do not mix product architecture into harness design |
| H-08 Session memory | Locks, checkpoints, next action and gated close tested | Interrupt and switch real providers, resume from files, and verify no duplicated external write or lost decision |
| H-09 Knowledge | Provenance, freshness, indexing and supersession tested | Domain owner validates promoted facts and reviews expiration/conflict handling on a real case |
| H-10 UI | Fixture-only planning and hash-bound mock approval tested | Build and browse actual AppKit UI using selected development identity, required states and fixtures; human approves the exact mock before business-data integration |
| H-11 Workloads | App/data/Genie/metric starters are local/draft outputs | Actual AppKit build, Delta duplicate/late/conflict/retry behavior, Lakebase CRUD and Genie benchmarks remain necessary in isolated resources |
| H-12 Loop | Budget, lock, policy and receipt failures tested | Run isolated real provider iterations; externally verify process-tree termination and provider spending limits |
| H-13 Safety | Attack fixtures and fail-closed known cases pass | Configure OS/container restrictions, development-only credentials, protected branches and authenticated deployment approval; regex hooks are not a sandbox |
| H-14 Verification | Hash-bound all-AC receipts exist | Fresh reviewer verifies real user/data behavior; a seal cannot authenticate a reviewer or make fabricated evidence true |
| H-15 Evaluation | Plans/records/comparison reject incomplete or stale data | Run each required golden task for both providers with configured repetitions; collect actual cost, rework and outcome evidence |
| H-16 Improvement | Snapshot/update conflict and backup contracts pass | Evaluate a real candidate and review a downstream update PR; no automatic GitHub PR/publication has occurred |
| H-17 Documentation | Current CLI examples reviewed; browser artifact hashes match | Wider accessibility review as needed; public publication only if requested. The docs smoke is not a product mock test |
| H-18 Maintainability | Locked dependencies, generated assets and schema tests exist | Execute real pinned CI workflows, dependency/security checks and review upgrade provenance |
| H-19 Portability | Windows suite passed with one disclosed privilege skip | Execute Linux/macOS hosted CI and the skipped symlink scenario on a capable host; test each provider host |
| H-20 Evidence | Local checks, counterexamples and external limits are recorded | Do not seal all H-01–H-20 as passed or call release-ready until their remaining in-scope proof is present |

## Safety and evidence cautions

- Known-secret rejection/redaction is not a general data-loss-prevention system. Never put actual customer rows or credential material into prompts, fixtures, logs or approval evidence.
- Atomic file locks protect cooperative local operations. They do not make multi-file changes a transactional database, nor constrain another process with equal filesystem authority. Crash recovery requires inspecting side effects and any stale lock before retry.
- Loop process timeouts and stop records are not proof that all descendants were killed. Use an external container/job lifetime boundary. Provider credit flags may be soft limits.
- Approval records preserve a claimed actor and artifact snapshot; they do not authenticate the human or grant Databricks/GitHub permissions. Production authorization must remain outside ordinary agent credentials.
- The generated Python tests exercise the actual semantic reference and recorded Delta builder, but not Spark/Delta execution. Success must not be generalized to target-runtime concurrency, schema or privilege semantics without integration evidence.
- This review did not connect Databricks, start real Claude/Copilot golden runs, publish a website, create GitHub state, purchase credits or deploy production resources.

## Handoff

Keep the candidate at L1. Use the reviewed template and documented setup path for one explicitly scoped development pilot. Before external actions, obtain the repository/visibility, development workspace/profile, data authority and provider-host choices from the owner. Preserve this report alongside the final local-validation transcript and session checkpoint; a future verifier must recheck actual artifacts rather than treating this narrative as a completion receipt.
