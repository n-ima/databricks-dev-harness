---
name: build-work
description: Implement an approved Databricks product requirement through small verified slices, using AppKit and repository standards by default.
---

# Build work

1. Read the approved requirement, target design, `AGENTS.md`, relevant standards, and `harness/templates/execution-plan.md`.
2. Confirm all predecessor human gates are approved. Stop if a required gate is missing.
3. Create or resume a durable session and execution plan under `work/`. Record verified current state and stop conditions.
4. Implement the smallest end-to-end slice that proves user value. Keep the repository runnable.
5. Run deterministic checks before expensive integration or model-based checks.
6. Exercise user-visible behavior through the browser and Databricks behavior through an isolated development target.
7. Record evidence and request a fresh independent review. Do not grade your own implementation as accepted.
8. Iterate on genuine findings without weakening acceptance criteria or checks.
9. Checkpoint before every handoff or compaction. Stop at a new human gate; close only when the completion rule is satisfied.

Scaffold only the selected workload using `npm run scaffold -- plan` and inspect missing inputs before apply. App plans use the pinned official manifest and preserve its resource/MUST-rule gates. A scaffold is not a completed product: fill semantic contracts and prove actual behavior.

For long tasks use `npm run loop -- init --session ID --provider manual` to maintain a bounded assisted loop; run checks with `loop run --id ID --execute`, then record progress or a human gate. Headless Claude/Copilot is opt-in and needs committed feature-worktree isolation and reviewed development-only credentials. CLI flags do not replace an OS sandbox. Do not nest headless loops inside one another.

The independent verifier writes acceptance mappings to `work/reviews/`; `evidence seal` binds the reviewed files. Use that receipt for `session close --outcome completed --verifier-evidence ...`. A not-run platform/UI check is not pass. See `docs/harness/operations/CLI_REFERENCE.md`.
