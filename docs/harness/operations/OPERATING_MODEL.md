# Operating model

Last verified: 2026-09-04

## One request, durable artifacts

A human may begin with one sentence. The agent expands it and leaves:

1. A work session containing current state and handoff.
2. A product requirement containing outcomes and acceptance criteria.
3. Target design and, for UI, an executable mock.
4. An execution plan for non-trivial implementation.
5. Evidence mapped to acceptance criteria.
6. A review record from a fresh skeptical context.
7. Knowledge or a harness learning when the result is reusable.

## Stage model

| Stage | Agent action | Human involvement | Exit evidence |
|---|---|---|---|
| Intake | inspect context, route, start/resume session | only material ambiguity | durable objective |
| Define | requirement, data authority, acceptance criteria | approve business intent | approved requirement |
| Design | target architecture and risks | approve irreversible/security decisions | design record/ADR |
| Mock | executable fixture-backed UI states | approve workflow and meaning | screenshots + decision |
| Build | vertical slices, tests, checkpoints | normally none | runnable slice |
| Verify | deterministic, data, browser, dev target | none unless authority missing | evidence record |
| Review | fresh agent tries to disprove completion | resolves accepted risk | review record |
| Release | prepare diff and rollback | executes production action | deployment evidence |
| Learn | classify rework and improve | approves harness policy | evaluated harness PR |

## Question policy

Ask only when the answer changes business behavior, authoritative data, sensitive-data handling, permissions, substantial cost, irreversible design, mock acceptance, or production release. Otherwise inspect, state a reversible assumption, record it, and continue.

## Human gates

Approval of one gate never implies another.

- Product intent: outcome, scope, owner, authoritative source.
- UI mock: journey, language, information hierarchy, density.
- Data and permissions: classification, write authority, least privilege.
- Destructive migration: impact, backup/recovery, execution window.
- Production release: exact version, resource/permission diff, timing.

## Completion

“Implemented” is not complete. Completion requires every acceptance criterion to have observable evidence, required checks to pass, user-visible behavior to be exercised, independent verification to have no blocking finding, generated assets and documentation to be synchronized, remaining risks to be explicit, and no gate to be bypassed.

## Concurrent work

Agents must not share a mutable worktree, local server, schema, or development resource unless explicitly designed for safe concurrent use. Each session names its branch/worktree and target resources. Integration occurs through PR review, not implicit shared context.
