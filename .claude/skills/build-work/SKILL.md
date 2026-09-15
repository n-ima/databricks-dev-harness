---
name: build-work
description: Implement an approved Databricks product requirement through small verified slices, using AppKit and repository standards by default.
---

# Build work

1. Read the approved requirement, target design, `AGENTS.md`, relevant standards, and `harness/templates/execution-plan.md`.
2. Confirm all predecessor human gates are approved. Stop if a required gate is missing.
   For UI, read `docs/harness/operations/UI_RUNTIME_FIDELITY.md` and run `delivery ui-approval-check --approval RECEIPT --session ID --app-root apps/NAME` before using the approval. Checking a newly edited contract alone does not validate the old human approval. Reuse the approved app and its actual components, styles and fixtures; do not reinitialize an integration app. If target/components/styles/versions or behavior change, assess the difference and obtain a fresh review/approval; old HTML or approval hashes are not sufficient. Backend integration and deployment remain separate approvals.
3. Create or resume a durable session and execution plan under `work/`. Record verified current state and stop conditions.
   Follow `docs/harness/operations/DOCUMENTATION_STANDARD.md` and `DELIVERY_ASSURANCE.md` in that directory. Before implementing behavior changes, make the slice's field/business/interface definitions concrete, prepare the quality contract and test cases, and obtain a fresh-context design review. Run `harness delivery check --contract work/quality/FEATURE.json --phase design`. For trivial behavior-preserving edits, record the documented omission rationale instead of producing full new paperwork. Neither a generic scaffold nor an all-unknown design is ready for implementation.
4. Implement the smallest end-to-end slice that proves user value. Keep the repository runnable.
5. Run deterministic checks before expensive integration or model-based checks.
6. Exercise user-visible behavior through the browser and Databricks behavior through an isolated development target.
7. Record evidence and request a fresh independent review. Do not grade your own implementation as accepted.
   Update actual artifacts/results, run the quality contract with `--phase verify`, and include its snapshot/diagnostics in the existing evidence review. A zero-finding advisory report is not acceptance and does not replace `evidence seal`. Explain findings and remaining work in Japanese.
8. Iterate on genuine findings without weakening acceptance criteria or checks.
9. Checkpoint before every handoff or compaction. Stop at a new human gate; close only when the completion rule is satisfied.

Scaffold only the selected workload using `npm run scaffold -- plan` and inspect missing inputs before apply. App plans use the pinned official manifest and preserve its resource/MUST-rule gates. A scaffold is not a completed product: fill semantic contracts and prove actual behavior.

`--kind api` creates a local HTTP/OpenAPI contract fixture without UI or Databricks auth; it is not a deployable backend. `--kind analysis` creates an executable synthetic-data Notebook/SQL/Python fixture, not remote Spark or an ML model. Both stay under `tests/fixtures/`. For real Apps HTTP, ML/Serving, agents/MCP, ingestion or platform resources, follow the selected catalog skills and `docs/harness/operations/PLATFORM_PLAYBOOK.md`; do not use an unrelated app/data-update generator as a substitute. Never copy fixture authentication or in-memory transactional state into deployment.

For long tasks use `npm run loop -- init --session ID --provider manual` to maintain a bounded assisted loop; run checks with `loop run --id ID --execute`, then record progress or a human gate. Headless Claude/Copilot is opt-in and needs committed feature-worktree isolation and reviewed development-only credentials. CLI flags do not replace an OS sandbox. Do not nest headless loops inside one another.

The independent verifier writes acceptance mappings to `work/reviews/`; `evidence seal` binds the reviewed files. Use that receipt for `session close --outcome completed --verifier-evidence ...`. A not-run platform/UI check is not pass. See `docs/harness/operations/CLI_REFERENCE.md`.
