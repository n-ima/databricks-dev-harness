# Research basis and decision record

Verified: 2026-09-04

For the source-by-source follow-up, local CLI observations, corrected version assumptions, and explicit verification gaps, see the [2026-09-04 evidence review](2026-09-04-evidence-review.md). That review separates observation, recommendation, and inference; neither research document certifies implementation or production readiness.

## Findings adopted

- OpenAI's harness engineering report treats the repository as the system of record, keeps the root agent file as a short map, exposes UI/logs/metrics to agents, and turns recurring quality issues into mechanical checks.
- Anthropic's long-running application work uses structured artifacts, initializer/planner/generator/evaluator roles, end-to-end browser verification, and a separate skeptical evaluator.
- GitHub Copilot supports repository instructions, path-scoped instructions, Agent Skills, custom agents, and repository lifecycle hooks. Copilot cloud has an ephemeral Linux environment and only repository-provided hooks, so local plugin installation cannot be a dependency. Copilot CLI also reads compatible project hooks from `.claude/settings.json`; shared commands must therefore not fail when Claude-only environment variables are absent.
- Claude Code supports repository CLAUDE.md, Agent Skills, subagents, hooks, plugins, session resume, and compaction lifecycle events.
- Databricks CLI 1.x can install official Agent Skills to an explicit path. The official repository ships routing/context/auth hooks and explicitly recommends vendoring skills for Copilot cloud.
- Databricks custom Bundle templates are valid for Bundle-only scaffolding. This harness is broader than a Bundle, so the GitHub template remains the outer bootstrap; the generated `databricks.yml` is its deployment boundary.
- Practitioner reports from Mitchell Hashimoto and Geoffrey Huntley reinforce short feedback loops and converting repeated agent failures into discoverable rules or programmed feedback. Their techniques are adopted only with budgets, stop conditions, independent verification, and human escalation.

## Deliberately rejected

- One giant instruction file: degrades discovery and becomes stale.
- Raw chat as knowledge: noisy and sensitive.
- Infinite “keep trying” loops: no trustworthy stop condition or budget.
- Agent self-certification: the implementer is not an independent verifier.
- Plugin-only distribution: fails repository bootstrap and cloud portability.
- UI screenshots without executable states: cannot prove interaction.
- Production credentials in autonomous sessions: authority exceeds the task.

## Primary sources

- https://openai.com/index/harness-engineering/
- https://www.anthropic.com/engineering/harness-design-long-running-apps
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://docs.github.com/en/copilot/reference/custom-instructions-support
- https://docs.github.com/en/copilot/reference/hooks-reference
- https://code.claude.com/docs/en/features-overview
- https://code.claude.com/docs/en/hooks
- https://github.com/databricks/databricks-agent-skills
- https://docs.databricks.com/aws/en/dev-tools/bundles/templates
- https://github.com/databricks/appkit

## Practitioner sources

- https://mitchellh.com/writing/my-ai-adoption-journey
- https://ghuntley.com/ralph/

Refresh this record when provider hook formats, Databricks CLI/AppKit compatibility, or supported skill locations change.
