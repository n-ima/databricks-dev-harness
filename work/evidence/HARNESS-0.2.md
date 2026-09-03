---
work_item: HARNESS-0.2
verified_at: 2026-09-04
implementer: Codex
verifier: deterministic-suite
environment: local-Windows
---

# Harness 0.2 implementation evidence

## Implemented

- Template-first distribution and automated GitHub project bootstrap.
- Cross-platform local setup with optional Windows prerequisite installation and OAuth login.
- Repository-contained Claude Code and GitHub Copilot instructions, Skills, hooks, and verifier profiles.
- Official Databricks Agent Skills 0.2.10 vendored through Databricks CLI 1.6.0.
- Natural-language intent routing into define, mock, build, investigate, review, release, and harness-improvement flows.
- Durable session lifecycle and knowledge promotion.
- Separate canonical paths for harness design, product design, and work state.
- Agent-side blocks for production deploy, Bundle destruction, force push, broad deletion, and broad data/permission changes.

## Verification

| Check | Result |
|---|---|
| `npm run harness:check` | pass |
| `npm run test:harness` | 6/6 pass |
| Fresh template setup in temporary copy | pass |
| Product config and Bundle generation | pass |
| Session start and close in temporary copy | pass |
| Japanese UI request route | `mock-ui` |
| Copilot production-deploy hook | deny |
| Claude/Copilot hook JSON parse | pass |
| PowerShell setup/project/template scripts parse | pass |
| `npm install --package-lock-only --ignore-scripts` | 0 vulnerabilities |

## Tool versions

- Node.js 24.15.0
- Git 2.53.0.windows.1
- Databricks CLI 1.6.0
- Claude Code 2.1.201
- Databricks Agent Skills 0.2.10

## Not verified in this environment

- GitHub Copilot CLI is not installed; its repository assets and hook contract were tested, but not executed by Copilot itself.
- No GitHub remote is configured, so the Template repository setting was not changed.
- No workspace/profile was supplied, so OAuth, Bundle validation against a workspace, and development deployment were not run.
- A separate model-based verifier was not invoked in this run; provider profiles and golden-task protocol are present for the release gate.
