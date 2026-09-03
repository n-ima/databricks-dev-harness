---
name: improve-harness
description: Convert repeated agent failure or human rework into an evidence-backed harness improvement without weakening safety or quality gates.
---

# Improve the harness

1. Read `docs/harness/operations/IMPROVEMENT_LOOP.md` and related session or learning records.
2. Reproduce or corroborate the failure. Distinguish a product defect from a harness defect.
3. Identify the smallest load-bearing change: discovery, scoped instruction, deterministic enforcement, tool, template, or architecture.
4. Avoid broad prose in `AGENTS.md`; prefer scoped skills/docs and executable checks.
5. Add or update a golden task that fails before the change and passes after it.
6. Compare impact for Claude Code and GitHub Copilot where cross-agent.
7. Record cost, context, security, and regression tradeoffs in `docs/harness/`.
8. The implementation loop cannot approve changes to its own verifier, budgets, permissions, or acceptance criteria. Request independent and human review.
