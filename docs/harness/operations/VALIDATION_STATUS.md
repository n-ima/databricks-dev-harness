# Validation status — 0.3.1 candidate

Last checked: 2026-09-04. This is a locally implemented, tested candidate, not a production-certified or published service. Maturity stays **L1** until real provider/workspace evidence supports promotion.

Private source-template publication and actual hosted CI results are tracked separately in `work/evidence/2026-09-04-github-publication.md`. The matrix below records implementation proof and the external checks needed for promotion; consult that publication record for checks performed after the original local audit. Version 0.3.1 adds the pre-publication third-party distribution correction described in `THIRD_PARTY_DISTRIBUTION.md`.

## Direct evidence

- Node contract, hook attack, fresh-template, memory, scaffold, evaluation and update suites: `npm run test:harness` (latest transcript in `work/evidence/2026-09-04-local-validation.md`). Tests use temporary repositories and fake external responses; they do not prove live OAuth, resource permissions, AppKit package builds or Delta runtime behavior.
- Generated Python standard-library tests run against the actual generated semantic reference and MERGE builder. Actual Spark/Delta integration remains not-run.
- Edge headless browser smoke: `work/evidence/docs-browser.json`, 1366×900 and 390×844, no horizontal overflow, tabs by mouse/keyboard, details, no JS errors. Desktop/narrow screenshots are retained and visually reviewed; source and screenshot hashes are recorded. No axe/contrast certification is claimed.
- Generated provider assets and supported durable schema checks: `npm run harness:check`.
- Independent audit and counterexamples: `tests/contracts.test.mjs`, `tests/hooks.test.mjs`, `tests/memory.test.mjs`, `tests/scaffold-data.test.mjs`; subagent review led to concrete fixes, not just approval prose.
- CLI 1.6.0 manifest/help were inspected. One attempted fixture-only `apps init` unexpectedly invoked the CLI's implicit default-profile OAuth path and failed before generation. Source inspection confirmed init requires authentication. The corrected harness requires explicit dev profile/host even for mocks, inventories profiles without authentication, and never retries an implicit identity. No successful live connection/build/deployment is claimed.

## Requirement-to-evidence matrix

| Criterion | Local implementation / evidence | Remaining external proof |
|---|---|---|
| H-01 Distribution | enable-template/new-project scripts; release/updater tests | GitHub repo/visibility, actual template activation and branch protection |
| H-02 Setup | fresh-template and rerun preservation tests; explicit prerequisite/version checks; Windows/shell entrypoints | clean-machine installs; macOS/Linux workflow execution |
| H-03 Connection | explicit profile/host/OAuth/current-user/strict validation contracts, no token storage | selected valid workspace/profile, actual permissions and Bundle validation |
| H-04 Provider parity | common skills, generated path rules, hook payload tests, cloud setup workflow | Claude/Copilot VS Code, CLI and cloud host smoke and sign-in |
| H-05 Natural language | orchestrate-work, router, Japanese routing and intake tests | real-provider behavior on the pilot task |
| H-06 Refinement | question ledger, sources/hashes, approvals and invalidation tests | product owner's actual semantics and approval |
| H-07 Separation | docs/harness versus docs/product; distinct generated artifacts | project-specific design review |
| H-08 Session memory | mandatory checkpoints/next action, locks, gated completion, provider-independent files | real provider switch/compaction resume trial |
| H-09 Knowledge | source/confidence/applicability/freshness/index/supersession tests | periodic human validation of domain facts |
| H-10 UI mock | AppKit fixture-only plan, approval hashes, no live-data resources; HTML guide browser smoke | actual product mock review, AppKit UI browser/accessibility tests |
| H-11 Workloads | data-update/Genie/metric scaffolds, AppKit plan, official Lakebase/Lakeflow/AI-BI skills | actual AppKit build, Spark/Delta/Lakebase/Genie runtime integration |
| H-12 Bounded loop | iteration/wall/process budgets, pending gates, policy hashes, crash-resume checks | actual isolated provider runs and process-tree containment |
| H-13 Safety | malformed input/command attacks/policy edits/known secret tests | OS sandbox, dev-only credentials, authenticated reviewers, CI/Environment policy |
| H-14 Verification | evidence seals, all-AC coverage, hash changes/false completion rejected | actual user/data surface; reviewer identity authenticated outside repo |
| H-15 Evaluation | versioned task×provider×repetition plan, result validation and baseline comparison | all real model trials; measured pass rate, cost and rework |
| H-16 Improvement | failure-to-regression workflow, snapshot/update conflict/backup tests | evaluated candidate release and reviewed downstream PR |
| H-17 Documentation | Japanese Markdown + local responsive interactive HTML | broader accessibility audit as needed; publication if requested |
| H-18 Maintainability | locked vendored skills, generated rules drift, schema checks, pinned CI actions | actual CI runs and reviewed dependency upgrades |
| H-19 Portability | temporary-repo deterministic tests; Windows local run; 3-OS CI matrix | Linux/macOS hosted CI and each provider host |
| H-20 Evidence | this matrix links local versus external proof separately | no release-ready claim until remaining in-scope proof is available |

## Explicit limits / safe pilot

1. Select GitHub repo/organization, Databricks workspace/profile, development catalog/schema/compute, and desired provider host. These are consequential choices; the harness must not infer them.
2. Create one small pilot repo; verify instructions/hooks load. Approve requirements and fixture UI before live data.
3. Run strict Bundle validation, approved isolated development deployment, actual user/data tests and independent review. For Apps, validate, deploy, run/restart and health evidence are separate steps.
4. Run golden trials for both providers before any L2/L3 or unattended-quality claim. A prepared plan and mocked subprocess tests are not model evaluations.
5. Set GitHub branch protection, Environment approval, OIDC identity and least-privilege Databricks service principals outside the coding runtime. Do not hand production credentials to an implementing agent.

Hooks and hashes are defense in depth, not an OS security boundary. Actor labels are records, not authentication. A process with equal filesystem access can alter its own guardrails. The provider process timeout does not prove all spawned descendants were killed; use an ephemeral container/job with an external lifecycle limit. The Copilot credits option is a soft provider limit, not a hard total spending cap. No background recurring monitor, public site deployment or production mutation is implied by this implementation. Private GitHub publication is a separately authorized operation with its own evidence record.
