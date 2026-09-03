---
id: HARNESS
status: accepted
owner: repository-owner
last_updated: 2026-09-04
scope: databricks-development-harness
---

# Databricks development harness requirements

## Outcome

A person can place a rough requirement or reference material into a repository, open VS Code, and describe the desired result in ordinary language. Claude Code or GitHub Copilot then discovers the durable context, asks only consequential questions, produces product requirements and design, obtains required human decisions, implements in bounded slices, verifies through the real user/data surface, and leaves enough evidence and knowledge for a fresh agent to continue.

The harness is Databricks-specific where platform knowledge improves correctness, while remaining capable of building general internal business applications on Databricks Apps.

## Users

- Product owner: supplies goals, business meaning, constraints, and approvals.
- Engineer/data engineer: owns environments, credentials, review, and operations.
- Implementing agent: plans and changes code within approved boundaries.
- Independent verifier: attempts to disprove completion without changing implementation.
- Harness maintainer: evaluates and releases harness improvements.

## Principles

- Files, executable checks, and external state are authoritative; chat is transport.
- Human judgment is used for product meaning, sensitive authority, irreversibility, and production—not routine mechanics.
- Autonomous loops are bounded, observable, restartable, and independently verified.
- Prompt guidance is not a security boundary; permissions, isolation, hooks, CI, and platform controls enforce policy.
- The smallest useful end-to-end slice is preferred over layer-by-layer bulk generation.
- A claim is complete only when its acceptance evidence covers the claim's full scope.

## Acceptance criteria

- [ ] H-01: Distribution: a GitHub Template Repository is the reproducible bootstrap, and template activation/new-project creation are automated.
- [ ] H-02: Local setup: one supported command configures the repository on Windows; a supported shell path exists for macOS/Linux; prerequisites and reruns are safe and documented.
- [ ] H-03: Databricks connection: OAuth profile creation, profile selection, reachability, current identity, and strict Bundle validation are automated without storing secrets in the repository.
- [ ] H-04: Provider parity: Claude Code and GitHub Copilot discover equivalent canonical workflows, current Databricks skills, path-scoped rules, lifecycle context, and safety gates without hand-maintained drift.
- [ ] H-05: Natural-language intake: ordinary Japanese or English requests are routed by explicit intent plus deterministic hints; the agent creates/resumes durable work before editing.
- [ ] H-06: Refinement: rough text and supplied repository documents become an accepted requirement with assumptions, material questions, data authority, observable acceptance criteria, and human gates.
- [ ] H-07: Design separation: harness design, target-product design, and transient work state have distinct canonical paths and are mechanically checked.
- [ ] H-08: Session memory: work can resume after provider change or context compaction from a compact file containing verified state, decisions, evidence, blockers, and exact next actions; raw transcripts are not required.
- [ ] H-09: Knowledge: reusable product and harness knowledge has source, confidence, freshness, applicability, conflict/supersession behavior, and an index.
- [ ] H-10: UI: user-facing work produces executable fixture-backed mocks, required states, responsive and accessibility evidence, and waits for semantic mock approval before production integration.
- [ ] H-11: Databricks workloads: skills and scaffolding cover Delta/Lakeflow processing, Lakebase CRUD, Metric Views, Genie with benchmarks, rich AppKit applications, and Bundle resources.
- [ ] H-12: Bounded loop: an implementation loop persists state, enforces iteration/time/process budgets, has machine-checkable stop conditions, separates implementer/verifier, and cannot silently weaken its evaluator or policy.
- [ ] H-13: Safety: production deploy, destructive operations, broad grants, secret leakage, and protected-policy modification have defense in depth and explicit human gates.
- [ ] H-14: Verification: deterministic checks, platform checks, browser/data checks, independent review, and evidence mapping are available and do not reduce to self-reported completion.
- [ ] H-15: Evaluation: versioned golden tasks can be run repeatedly for both providers, results are recorded in a comparable schema, and release thresholds are explicit.
- [ ] H-16: Improvement: failures and human rework become minimal episodes, then the smallest evaluated rule/tool/template change, versioned release, and downstream update PR.
- [ ] H-17: Documentation: Markdown and an accessible responsive HTML guide explain architecture, features, setup, Databricks connection, daily use, gates, troubleshooting, and why each design choice exists.
- [ ] H-18: Maintainability: generated assets have a single source of truth, dependencies are locked, stale references and malformed artifacts fail CI, and updates are reviewable.
- [ ] H-19: Portability: deterministic tests exercise a fresh template copy and provider hook payloads; OS/provider limitations are explicit rather than hidden.
- [ ] H-20: Evidence: every criterion above is linked to direct file, command, runtime, or external-state evidence before the harness is called release-ready.

## Human gates

- Changing the harness security policy, verifier contract, evaluation threshold, or autonomy budget.
- Activating a GitHub repository as a template and organization policy configuration.
- Providing/approving Databricks workspace, profile, catalog/schema, compute, and service-principal authority.
- Publishing a hosted documentation site or production release.

## Non-goals

- Claiming perfect output from every model or eliminating human product judgment.
- Treating a regex hook as the sole security boundary.
- Automatically storing raw prompts, hidden reasoning, production rows, or credentials.
- Shipping one mandatory application architecture for workloads whose constraints justify an ADR-backed alternative.
