# Changelog

## 0.3.2 — 2026-09-08 (private template documentation update)

- Added a concrete Japanese onboarding walkthrough covering template creation, clone location, Windows/shell setup, prerequisites, authentication, and the natural-language agent handoff.
- Mapped the supplied Databricks workspace and folder to explicit host/profile and Bundle configuration; distinguished setup completion from application dependencies, platform resources, and deployment.
- Expanded the existing HTML setup guide and corrected command copying when inline code precedes the command block, with focused regression coverage.
- Stamped a distinct release baseline while retaining 0.3.1 as immutable history. Local and hosted verification are recorded in `work/evidence/2026-09-08-setup-guide-release.md`; maturity remains L1.

## 0.3.1 — 2026-09-04 (private template publication candidate)

- Included the exact LICENSE and NOTICE accompanying the pinned Databricks Agent Skills, with explicit third-party scope. This is the Databricks License, not an Apache/MIT grant for all harness code.
- Added fail-closed notice acquisition before vendor replacement and deterministic notice-integrity checks, so refresh cannot silently discard the required distribution documents.
- This corrects a pre-publication audit finding. The local 0.3.0 snapshot remains unchanged; 0.3.1 gets its own release baseline.
- Actual private GitHub publication/CI results are recorded under `work/evidence/`; no live Databricks/provider validation or branch protection is implied.

## 0.3.0 — 2026-09-04 (local candidate)

- Added natural-language intake artifacts, material question ledger, source hashes, approval binding/invalidation, durable session and knowledge checks.
- Added explicit-profile OAuth connection diagnostics, pinned AppKit manifest plans, fixture-only app path, draft Genie/metric and tested data-update scaffolds.
- Added bounded single-iteration provider adapters, budget/gate/policy checks and evidence-backed completion.
- Hardened Claude/Copilot hooks, generated path-scoped instructions and cloud bootstrap; added 3-OS CI matrix.
- Added evaluation plans/results/comparison and conflict-preserving local release/update tooling.
- Added Japanese HTML/Markdown guide and scoped desktop/narrow browser smoke tests.
- Added original-template baseline registration, concurrent writer locks and stale mock-evidence rejection. Actual CLI testing corrected the assumption that AppKit mock initialization could run without workspace authentication.

Not a claim of live workspace, provider-host, production, or golden-model certification. See `docs/harness/operations/VALIDATION_STATUS.md`.
