---
name: mock-ui
description: Design and build an executable fixture-backed mock for a Databricks app, analytics page, dashboard, form, or Genie surface before production integration.
---

# Mock UI

1. Read the approved product requirement plus `docs/product/standards/FRONTEND.md`.
2. Create or update `docs/product/ui/<feature>.md` with users, decisions, journeys, states, responsive behavior, accessibility, and unresolved questions.
   Read `docs/harness/operations/DOCUMENTATION_STANDARD.md` and `UI_RUNTIME_FIDELITY.md` in that directory. Design defaults to Databricks Apps hosting and AppKit, not only the eventual implementation. Record explicit product approval for an external frontend/alternative framework before using it. Reuse the actual app's components, shared styles, pinned packages and fixtures. For visual-only review, static HTML rendered from those components is allowed; standalone look-alike HTML is not. If runtime is unavailable, continue field/data/transition design and stop before UI approval instead of substituting a different UI.
3. Reuse an existing app; initialize a fixture-only AppKit app only if none exists. Keep its components and fixtures through integration. Do not regenerate a separate app and transfer approval. List component mappings, shared/entry sources, styles, versions, states and render/behavior evidence in the UI contract; obtain a fresh-context review before requesting human approval.
4. Implement loading, empty, error, partial, permission-denied, and success states relevant to the journey.
5. Exercise the primary interaction in a browser. Capture desktop and narrow screenshots and record them in `work/evidence/`.
6. Stop for human mock approval before production data, write permissions, or backend optimization.
7. Checkpoint the session with the approved/rejected state and requested changes.

Use `npm run scaffold -- plan --kind app --purpose mock --name <ascii-name> --profile <explicit-dev-profile> --host <explicit-dev-workspace-origin>` for an official AppKit, fixture-only starter. CLI initialization requires development workspace authentication even for mocks; never assume it is offline or use an implicit default profile. If identity is not chosen, continue requirements/design and request that choice before initialization. It must have no live-data features or resource assignments. Review the pinned manifest's MUST rules, satisfy them, then apply the ready plan. Installed AppKit docs, not guessed APIs, determine component usage.

Retain mock fixtures and state tests in the same application. Run `npm run harness -- delivery ui-check --contract docs/product/ui/FEATURE.json --phase mock`. After the actual human decision, record it with `npm run harness -- approval create --session ID --gate ui-mock --actor PERSON --evidence PATH --artifact MOCK_FILE --ui-contract docs/product/ui/FEATURE.json`. Contract references are bound automatically; repeat artifacts for additional tests. Missing/legacy/stale correspondence fails approval. Loop consumers revalidate; ordinary assisted work must do the same check before integration and after UI changes. Integration init is not supported; extend the reviewed app through build-work with separate data/permission/deployment gates. These checks do not certify pixels or authenticate the human.
