---
name: mock-ui
description: Design Databricks Apps UI with actual components and fixture data, from progressive layout feedback through executable mock approval, without premature backend implementation.
---

# Mock UI

Read the approved requirement, existing app and UI design, `docs/product/standards/FRONTEND.md`, and `docs/harness/operations/DOCUMENTATION_STANDARD.md` / `UI_RUNTIME_FIDELITY.md`. Follow the actual request: layout discussion, interaction design, or formal mock acceptance are different outcomes, not one mandatory full-build sequence.

## 配置・動きの設計を段階的に確認する

1. In the existing UI design, retain **every in-scope screen**, its purpose, fields, actions/transitions and current status. Keep data/field/ER design in parallel. Record unknown behavior as a question with its decision deadline; do not invent an implementation.
2. Reuse the actual app, pinned AppKit components and shared styles with synthetic fixtures. No separate look-alike HTML or reinitialized integration app. Static HTML rendered from those actual components is suitable for visual-only discussion. Label what is fixture-only/unconnected.
3. For the current screen/group, build only what lets the user judge layout, labels, density and the requested movement. Small local state, inputs, tabs, dialogs and fixture selection are allowed when needed. Do not implement persistence, real auth, business calculations, cross-system consistency or broad E2E just to show a layout.
4. Check that this view really renders with the intended components/styles, has no render-blocking errors, and does not contact live data. Show the current view when those questions can be answered. **Do not wait for all screens/states, a complete UI contract, or a fresh-context formal review before showing a discussion draft.** Do not run `ui-check` merely to earn permission for this first display.
5. Capture feedback and update the same components/spec. Continue through the remaining inventory; partial feedback is not full-design completion. Keep layout decisions, action/transition rules, unrendered screens/states and next action in files so a fresh session can continue. If feedback is needed to choose the layout, stop there rather than implementing speculative downstream work.

If a component limitation, tree/grid interaction or identity assumption could invalidate the layout, resolve it with the smallest scoped technical probe before presenting it as feasible. Use installed package docs, not guessed APIs. Do not hide the issue behind a plausible-looking fixture. A probe is not permission for live resources.

## 操作確認と正式承認

Once the requested layouts/meaning are settled, extend the **same app** with fixture-backed behavior for the complete agreed scope. Exercise relevant success/loading/empty/error/partial/denied states, primary journeys and keyboard paths; capture desktop/narrow evidence. Backend business rules may remain specified and simulated, never claimed as implemented. This is the formal mock evidence, not a prerequisite for the first layout conversation.

Now complete the UI contract (all scoped screens/states, actual source/style/version, render/behavior evidence), obtain a fresh-context independent review and run `npm run harness -- delivery ui-check --contract docs/product/ui/FEATURE.json --phase mock`. `--phase preview` is also a formal recorded correspondence check, not a permissive draft mode. These checks do not certify pixels or authenticate people.

Stop for the actual human mock decision. After approval, use `approval create --session ID --gate ui-mock --actor PERSON --evidence PATH --artifact MOCK_FILE --ui-contract docs/product/ui/FEATURE.json`. Draft comments, static HTML alone, or partial layout agreement **never** unlock this gate. Keep existing stale/missing/legacy-contract rejection. Before integration, validate the receipt with `delivery ui-approval-check --approval RECEIPT --session ID --app-root apps/NAME`; extend the reviewed app through build-work and separate data/permission/deployment gates.

## 初期化が必要な場合だけ

Reuse an existing app first. If none exists, use `npm run scaffold -- plan --kind app --purpose mock --name NAME --profile EXPLICIT_DEV_PROFILE --host EXPLICIT_DEV_ORIGIN`. Official initialization requires development workspace authentication even for fixture-only mocks; inspect the pinned manifest and satisfy its MUST rules. No live-data features or resource assignments. If identity/runtime is unavailable, continue written fields/data/transitions and stop before runtime UI approval; do not substitute look-alike HTML. Integration init is not supported. Preserve the same components, fixtures and tests for later implementation.
