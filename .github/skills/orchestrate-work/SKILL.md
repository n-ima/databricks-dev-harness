---
name: orchestrate-work
description: Route any non-trivial natural-language request into the repository's durable Databricks delivery workflow. Use at the beginning of feature, data, UI, Genie, investigation, review, release, or harness-improvement work.
---

# Orchestrate work

1. Read `AGENTS.md`, run `npm run harness:context`, and inspect related active sessions.
2. Classify intent with `npm run harness:route -- --prompt "sanitized intent"`; discover all workload components with `npm run harness -- workload resolve --prompt "sanitized intent"`. `harness/router.json` and `harness/workloads.json` are the executable maps. Explicit intent and repository evidence override keyword matches; use `--intent` and repeated `--workload` / `--without` to correct hints.
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
- For multi-step changes, read `docs/harness/operations/TASK_VISIBILITY.md`; create durable `task` records linked to the session's requirement/design. Use `context --session ID` and checkpoint `--task TASK_ID` to keep the focus explicit. Advice-only requests remain read-only.
- At start, meaningful transitions, gates, and handoff, show a compact task/current/next/wait summary from `status`. Recorded `running` is not proof of a live process. Preserve the main task through side questions; do not imply background execution after the response ends.
- A keyword route is a hint, never permission to mutate. Explicit advice/review-only requests stay read-only. Mixed UI/data work needs both routes, not just the winning keyword.
- Workloads include API-only Apps, Notebook/SQL, ML training/registry/Serving, RAG/MCP and platform operations—not just the available scaffold kinds. Keep all selected components in the intake/design. Read `docs/harness/operations/PLATFORM_PLAYBOOK.md` and only the selected official skills (including their required parents/references). A generic agent is not necessarily Genie; model registration is not a table update; Apps hosting does not imply a UI.
- Pass the confirmed workload IDs to `intake create` with repeated `--workload`. The exact selection replaces heuristic classification. Use `--without rich-app` for API-only scope. An answer does not silently change workload selection; if existing intent changes, revoke/revisit the approval and update the durable design/questions explicitly before implementation.
- For execution, read `docs/harness/operations/CLI_REFERENCE.md`. Use assisted mode by default. Opt-in headless loops require the configured budgets, isolation evidence, and human gates; never turn a routine request into unbounded autonomous execution.

Chat is transport. Files are memory. Tests and evidence determine completion.
