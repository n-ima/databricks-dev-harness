---
name: mock-ui
description: Design and build an executable fixture-backed mock for a Databricks app, analytics page, dashboard, form, or Genie surface before production integration.
---

# Mock UI

1. Read the approved product requirement plus `docs/product/standards/FRONTEND.md`.
2. Create or update `docs/product/ui/<feature>.md` with users, decisions, journeys, states, responsive behavior, accessibility, and unresolved questions.
   Read `docs/harness/operations/DOCUMENTATION_STANDARD.md`. When layout/labels/navigation are uncertain, first use a small local HTML/CSS storyboard with synthetic data and links, without dependencies, Databricks login or live data. If behavior is the main question, skip this optional step and start with the executable fixture. A storyboard approval covers only the stated visual/flow choices and must not satisfy the ui-mock gate. Do not build two finished applications.
3. For the executable behavioral mock, scaffold with Databricks AppKit when available. Reuse the agreed storyboard decisions and synthetic fixtures in production components; do not build a disposable image-only mock.
4. Implement loading, empty, error, partial, permission-denied, and success states relevant to the journey.
5. Exercise the primary interaction in a browser. Capture desktop and narrow screenshots and record them in `work/evidence/`.
6. Stop for human mock approval before production data, write permissions, or backend optimization.
7. Checkpoint the session with the approved/rejected state and requested changes.

Use `npm run scaffold -- plan --kind app --purpose mock --name <ascii-name> --profile <explicit-dev-profile> --host <explicit-dev-workspace-origin>` for an official AppKit, fixture-only starter. CLI initialization requires development workspace authentication even for mocks; never assume it is offline or use an implicit default profile. If identity is not chosen, continue requirements/design and request that choice before initialization. It must have no live-data features or resource assignments. Review the pinned manifest's MUST rules, satisfy them, then apply the ready plan. Installed AppKit docs, not guessed APIs, determine component usage.

Retain mock fixtures and state tests in the application. Record the human decision with `npm run harness -- approval create --session ID --gate ui-mock --actor PERSON --evidence PATH --artifact MOCK_FILE` (repeat artifacts, including fixture/test files). Integration scaffolding validates the approval hashes again. A screenshot alone is neither an executable mock nor proof of approval.
