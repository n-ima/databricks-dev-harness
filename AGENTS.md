# Agent operating contract

This file is the map, not the encyclopedia. Read only the linked material relevant to the task.

## Mission

Build maintainable Databricks data and AI products from explicit intent. Optimize for correctness, user outcomes, reproducibility, and future-agent legibility—not code volume.

## On every non-trivial natural-language request

1. Load the `orchestrate-work` skill. Run `npm run harness:context` and inspect related active sessions before editing.
2. Route the request with `harness/router.json`. Advice and inspection may remain read-only; non-trivial changes require a durable session.
3. Start or resume `work/sessions/<id>.md`. Do not rely on chat history as project memory.
4. Locate the product requirement and design under `docs/product/`. Create them from templates when missing.
5. For user-facing UI, build an executable fixture-backed mock first. Do not connect production data before mock approval.
6. Implement the smallest complete slice, run checks, and verify through the user surface.
7. Checkpoint decisions, evidence, next actions, and blockers before compaction, handoff, or ending the turn.
8. Never claim completion without acceptance-criterion evidence and independent verification.
9. Stop at human gates: product intent, mock approval, sensitive data/permission changes, destructive migration, and production deployment.

## Repository map

- `ARCHITECTURE.md`: short boundary map for harness design versus product design
- `docs/harness/`: harness architecture, operations, research, decisions, and knowledge
- `docs/product/`: target product requirements, architecture, UI, data, decisions, runbooks, and knowledge
- `docs/product/standards/`: Databricks, frontend, quality, and security invariants
- `work/sessions/`: durable per-agent work state and handoff records
- `work/plans/`, `work/evidence/`, `work/reviews/`: delivery state and proof
- `harness/skills/`: canonical reusable agent workflows
- `harness/router.json`: deterministic natural-language intent routing
- `vendor/databricks-skills/`: pinned official Databricks skills
- `.claude/skills/`, `.github/skills/`: generated provider copies; do not hand-edit
- `tools/harness.mjs`: deterministic harness checks and asset synchronization

## Architecture invariants

- Prefer Databricks AppKit for new rich applications. Use Python UI frameworks only for justified exceptions.
- UI design and previews default to Databricks Apps hosting and the same production components/styles as the app; standalone look-alike HTML is not an approval surface. External hosting requires an explicit product decision. Follow `docs/harness/operations/UI_RUNTIME_FIDELITY.md`.
- Use AppKit UI chart and table primitives before adding another visualization library.
- Use Lakebase for transactional CRUD and Delta tables for analytical storage and batch/stream processing.
- Put reusable business metrics in Unity Catalog metric views where practical.
- Treat external inputs and API responses as untrusted; validate at boundaries.
- Do not hardcode workspace IDs, resource IDs, tokens, catalog names, or secrets in application code.
- Production deployment and destructive operations require explicit human approval.

## Commands

```text
npm run harness:doctor       # local tool inventory; read-only
npm run harness:context      # active sessions and durable context
npm run harness:check        # deterministic repository checks
npm run agent-assets:sync    # regenerate provider skill copies
npm run session:start -- --title "..." --intent define --objective "..."
databricks bundle validate   # validate Databricks bundle when present
```

## Learning rule

When an agent mistake repeats, do not add vague prose. Capture one concise rule, then prefer an executable test, linter, schema, hook, or generator. Changes to the harness require their own evidence and must not weaken security or completion gates.
