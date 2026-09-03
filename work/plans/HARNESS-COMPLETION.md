---
id: HARNESS-COMPLETION
requirement: ../../docs/harness/requirements/HARNESS.md
design: ../../docs/harness/design/ARCHITECTURE.md
status: active
owner: codex
started: 2026-09-04
updated: 2026-09-04
session: ../sessions/20260903-181031-109-harness-completion-audit.md
---

# Harness completion plan

## Goal and stop condition

All H-01 through H-20 criteria have direct evidence, deterministic and applicable integration tests pass, Claude/Copilot parity has an independent review, the HTML guide builds and is inspectable, and remaining external human gates are accurately distinguished from implementation gaps.

## Verified baseline

- Harness 0.2.0 has repository-local skills, provider hooks, session/knowledge files, setup scripts, vendored Databricks skills, six tests, and design documents.
- Current gaps include no executable bounded agent loop, shallow Databricks doctor/connect flow, no HTML guide, no automated evaluation runner, limited schema validation, no downstream updater, and no real provider/workspace validation evidence.
- Existing files contain several doubled apostrophes introduced by an earlier patching workaround; correction has started.

## Slices

- [x] S1 — Research/current-state audit and requirements-to-evidence matrix.
- [x] S2 — Harden core CLI, schemas, session/knowledge validation, and provider hooks.
- [x] S3 — Implement Databricks connect/doctor/scaffold flows with safe dry-run and test seams.
- [x] S4 — Implement bounded loop state machine, implementer/verifier separation, budgets, and resume.
- [x] S5 — Implement repeatable golden-task evaluation and results schema. Actual model trials remain not-run.
- [x] S6 — Implement responsive HTML guide and local browser/link/keyboard checks. Full accessibility certification is not claimed.
- [x] S7 — Implement template release/update lifecycle and CI/security checks. GitHub-side activation remains a human gate.
- [ ] S8 — Run independent audit, provider/tool smoke tests, evidence mapping, and release-readiness review.

S8 local audit is complete: final 302 tests / 301 pass / 0 fail / 1 privilege skip; generated checks and browser smoke pass; 981 release-file hashes survive a fresh local Git checkout. Real provider-host parity, authenticated Databricks workloads, clean-machine installs, hosted CI and organization policy remain external proof, not local implementation completion. See docs/harness/operations/VALIDATION_STATUS.md and work/evidence/2026-09-04-local-validation.md.

## Verification order

1. JSON/Markdown/schema and generated-asset conformance.
2. Node unit and integration tests in temporary repositories.
3. PowerShell and Bash syntax plus platform-specific dry runs.
4. Provider hook payload fixtures and deny/allow cases.
5. Local HTML build/link/accessibility/static validation.
6. Databricks CLI dry-run and authenticated development checks when a profile is available.
7. Claude Code and GitHub Copilot golden-task runs in isolated worktrees when both providers are available.
8. Fresh independent review against H-01 through H-20.

## Recovery

All generated provider assets are reproducible from `harness/skills/` and `vendor/databricks-skills/`. External mutations remain behind explicit commands. Loop runs use disposable worktrees and persistent state so they can be stopped without losing accepted work.
