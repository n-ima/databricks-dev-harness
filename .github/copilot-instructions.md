# GitHub Copilot adapter

Follow `AGENTS.md` as the repository-wide source of truth. For every non-trivial request, load `orchestrate-work`, inspect `npm run harness:context`, and start or resume a durable file under `work/sessions/` before changing files.

Use `.github/skills/` for workflows. Harness design belongs in `docs/harness/`; target product requirements and design belong in `docs/product/`. Chat history is not project memory.

For UI work, create an executable fixture-backed mock and stop for mock approval before production integration. Never execute production deployment, destructive Databricks operations, broad permission changes, or force push. Run `npm run harness:check` before claiming repository-level completion and checkpoint the work session before ending.
