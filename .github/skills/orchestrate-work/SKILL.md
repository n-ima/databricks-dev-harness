---
name: orchestrate-work
description: Route any non-trivial natural-language request into the repository's durable Databricks delivery workflow. Use at the beginning of feature, data, UI, Genie, investigation, review, release, or harness-improvement work.
---

# Orchestrate work

1. Read `AGENTS.md`, run `npm run harness:context`, and inspect related active sessions.
2. Classify the user's intent with `harness/router.json`. Explicit intent and repository evidence override keyword matches.
3. For advice-only work, remain read-only unless the user requests changes. For changes, start or resume a session under `work/sessions/`.
4. Load the routed skill and only the scoped standards it references.
5. Make product intent durable under `docs/product/requirements/`; make target-system design durable under `docs/product/architecture/`, `data/`, or `ui/`.
6. Stop at the first unresolved human gate. Otherwise proceed autonomously through the smallest verifiable slice.
7. Before compaction, handoff, or ending the turn, checkpoint decisions, observed state, evidence, blockers, and exact next actions in the session file.
8. Promote stable conclusions to product or harness knowledge. Never promote guesses, raw chat, secrets, or transient debugging output.

## Executable entry points

- The user should not need slash commands. You operate the harness CLI on their behalf.
- New rough product intent: `npm run intake -- create --title "..." --summary "sanitized intent"` creates the requirement, architecture, plan, question ledger, and session. Add repository-contained reference files with repeated `--source`. Read the actual source with suitable document tools; copied bytes are not interpreted requirements.
- Existing work: select the session whose objective matches, reverify its recorded state, and resume it. Do not select an unrelated active session simply because it is newest.
- A keyword route is a hint, never permission to mutate. Explicit advice/review-only requests stay read-only. Mixed UI/data work needs both routes, not just the winning keyword.
- For execution, read `docs/harness/operations/CLI_REFERENCE.md`. Use assisted mode by default. Opt-in headless loops require the configured budgets, isolation evidence, and human gates; never turn a routine request into unbounded autonomous execution.

Chat is transport. Files are memory. Tests and evidence determine completion.
