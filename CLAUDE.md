@AGENTS.md

# Claude Code adapter

Use the shared contract above as the source of truth. Load project skills from `.claude/skills/` when their descriptions match the work. Keep Claude-specific configuration thin; reusable behavior belongs in `harness/skills/` and deterministic enforcement belongs in `tools/`.

Do not use bypass-permissions mode on a developer workstation. For long-running unattended work, use an isolated worktree or disposable environment with explicit budgets and stop conditions.

