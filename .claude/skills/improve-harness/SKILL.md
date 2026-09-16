---
name: improve-harness
description: Convert repeated agent failure or human rework into an evidence-backed harness improvement without weakening safety or quality gates.
---

# Improve the harness

1. Read `docs/harness/operations/IMPROVEMENT_LOOP.md` and related session or learning records.
   For harness-source maintenance, also read `docs/harness/operations/HARNESS_DEVELOPMENT.md`; check `node tools/harness-publication.mjs guard-status` and safely install a missing local guard. Preserve conflicting hooks. Never run product setup as source-maintainer setup.
2. Reproduce or corroborate the failure. Distinguish a product defect from a harness defect.
3. Identify the smallest load-bearing change: discovery, scoped instruction, deterministic enforcement, tool, template, or architecture.
4. Avoid broad prose in `AGENTS.md`; prefer scoped skills/docs and executable checks.
5. Add or update a golden task that fails before the change and passes after it.
6. Compare impact for Claude Code and GitHub Copilot where cross-agent.
7. Record cost, context, security, and regression tradeoffs in `docs/harness/`.
8. The implementation loop cannot approve changes to its own verifier, budgets, permissions, or acceptance criteria. Request independent and human review.
9. A request to publish/push the harness to main continues through `publish-harness`: version, stamp, cache-free update tests, review and remote verification are one delivery. Do not close that request at source-only push, ask again for an already granted adoption, or apply to real projects without their update request.
