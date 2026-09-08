# Harness architecture

Last verified: 2026-09-04  
Review after: 2026-10-04

## Objective

Human attention is the constrained resource. The harness converts intent and judgment into discoverable files, executable constraints, observable product behavior, and bounded agent loops.

The target is not an infinite autonomous process. It is a system that can prove progress, survive context loss, stop safely, and request human judgment only where it changes business meaning, authority, irreversible state, or release risk.

## Runtime flow

```text
Natural-language request
  -> provider hook loads repository context
  -> orchestrate-work reads active sessions and knowledge
  -> deterministic intent route + agent judgment
  -> requirement and product design
  -> executable mock when UI exists
  -> human gate where judgment is load-bearing
  -> bounded end-to-end implementation slices
  -> deterministic checks and development-environment verification
  -> fresh skeptical verifier
  -> evidence-backed PR
  -> human production release
  -> telemetry/failure/rework -> harness learning
```

The keyword router is a hint, not an LLM replacement. Explicit user intent and repository evidence take precedence.

## Repository layers

| Layer | Path | Stability | Purpose |
|---|---|---|---|
| Shared contract | `AGENTS.md` | high | Small map loaded by every agent |
| Harness design | `docs/harness/` | high | Distribution, sessions, safety, improvement |
| Product design | `docs/product/` | evolves with product | Requirements and target-system design |
| Work state | `work/` | short/medium | Sessions, plans, reviews, evidence |
| Agent workflows | `harness/skills/` | versioned | Provider-neutral reusable behavior |
| Official skills | `vendor/databricks-skills/` | pinned | Databricks-maintained product knowledge |
| Provider adapters | `.claude/`, `.github/` | generated/thin | Discovery and lifecycle hooks |
| Enforcement | `tools/`, CI, tests | high | Deterministic checks and policy |
| Product implementation | `apps/`, `src/`, `resources/`, `tests/` | product | Deployable code and resources |

Provider files never become competing manuals. Common skills are authored once and generated. CI fails on drift.

## Session and memory architecture

There are four memory temperatures:

1. Hook context: a small, regenerated primer for the current agent session.
2. Work session: durable current state under `work/sessions/`.
3. Product knowledge: verified domain facts and decisions under `docs/product/`.
4. Harness knowledge: cross-project lessons and policies under `docs/harness/`.

Raw transcripts are intentionally excluded. They are verbose, provider-specific, may contain secrets, and preserve rejected hypotheses. An agent checkpoints the compact facts needed to resume.

## Databricks product defaults

```text
Sources -> Lakeflow Jobs/Pipelines -> Bronze/Silver Delta
  -> Gold tables/views + UC Metric Views
     -> AppKit analytics UI (ECharts/TanStack Table)
     -> Genie + benchmark suite
     -> optional managed AI/BI dashboard

Operational writes -> AppKit application -> Lakebase
  -> validated synchronization -> analytical Delta model
```

Use managed Databricks features before custom orchestration. Use AppKit for rich Node.js/React applications. Use Lakebase for transactional writes and Delta for analytical or streaming processing. Put reusable measures in Metric Views.

## Isolation and permissions

- One branch/worktree and isolated development resources per autonomous task.
- No production credentials in unattended environments.
- No direct push to protected branches.
- Hooks block production deploy, destructive Bundle commands, force push, and broad permission/data mutation.
- The implementer cannot change acceptance criteria, verifier, security policy, or loop budget to make its own work pass.
- Production execution remains a human action.

## Distribution

The primary product is a GitHub Template Repository because a working project needs code layout, CI, design records, session state, mocks, tests, and Bundle configuration. Plugins are an optional convenience layer for provider-specific commands and hooks.

The template creates independent project history. The local versioned updater snapshots managed files, proposes an update, rejects downstream conflicts and backs up replaced files. It does not push or open a PR. Maintainers review that diff and submit the PR. Product code/docs, work records and local credentials are never owned by the updater.

The maintainer stamps `harness/base-release.json` from a reviewed release snapshot. First setup records that original upstream manifest as the installed baseline; reruns preserve a newer installed baseline. Never replace it with hashes of the downstream product's current files. Manifest hashes provide integrity, not publisher authentication: verify the trusted upstream commit/tag. Package scripts, README and VS Code settings are explicit manual migrations, not silently replaced.

The Databricks official Agent Skills are vendored with:

```text
databricks aitools install --path vendor/databricks-skills
```

They are then copied with the harness skills to both provider directories. This supports local agents and Copilot cloud without assuming a user-level plugin installation.

## Maturity

- L0 documented: completed
- L1 repository routing, durable state, generated skills, tested local guardrails: current (see validation status)
- L2 autonomous fixes, independent verifier, isolated development deployments, human merge: next production target
- L3 unattended bounded loop: only after golden-task evaluation, budgets, kill switch, audit, and recovery are operational

## Measures

Optimize accepted-task success, lead time, human interventions, review findings, escaped defects, deploy/rollback success, cost per accepted task, context size, architectural drift, and user task completion. Do not optimize code volume or the number of autonomous turns.

## Implemented module boundaries

2026-09-08追加: `harness/workloads.json` は16領域の発見・質問・公式技能・検証境界の台帳。`workloads.mjs` はCLI/hook共用のヒント分類器で、明示選択を優先する。intakeは選択内容のsnapshot/hashを持ち、製品設計へ必要な境界だけ展開する。`starters.mjs` はAPI/analysisの非deploy契約fixtureをhash-boundなplanから生成する。ML/Serving/MCP等は公式技能経路で、generatorやlive検証済みを装わない。[設計判断](../decisions/ADR-0005-platform-workloads.md)

`tools/harness.mjs` is the CLI dispatch and bootstrap. `tools/lib/intake.mjs` handles question/approval state; `memory.mjs` handles sessions and knowledge; `databricks.mjs` validates explicit identity; `scaffold.mjs` plans local generation; `loop.mjs` enforces bounded execution; `evidence.mjs` seals independent review snapshots; `evaluation.mjs` compares repeatable trials; `distribution.mjs` preserves downstream changes. `schema.mjs` checks the repository's limited schema vocabulary and rejects unsupported assertion keywords; it is not a general JSON Schema implementation.

UI fixtures are created using an official AppKit starter without live-data plugins. CLI 1.6.0 initialization still requires workspace authentication: both an explicit development profile and expected host are verified before init, even for a mock. Authentication does not authorize live business data. Its Bundle is quarantined under a fixture-only filename. Approved integration is a separate plan and component bundle in `apps/<name>/`; root data/Genie bundles and app component bundles are validated separately. This avoids silently merging independently generated deployment definitions.

Local hashes and actor labels detect drift but do not authenticate humans or constrain a malicious process with equal OS privileges. Reviewer identity, immutable CI artifacts, branch protection and production credentials are controlled outside the agent runtime. Provider/CLI/OS support is promoted only using the evidence matrix, not assumed from compatible file formats.
