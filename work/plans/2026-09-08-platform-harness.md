---
id: PLATFORM-HARNESS
status: accepted
owner: repository-owner
scope: broad-databricks-development
---

# Platform development harness: audit and improvement

The user requests a fresh audit, current primary-source research, and implementation of an efficient and safe harness for Databricks applications, APIs, analytics, and the wider platform, through VS Code / Claude Code / GitHub Copilot. Ordinary language must lead through the appropriate requirements discussion, design, implementation, and evidence. The existing platform-specific skill library should be discoverable without pretending that four scaffold generators cover the whole platform.

The user confirmed that no Databricks CLI profile is configured; only the earlier workspace screenshot is available. Repository and fixture verification can proceed. Live workspace authentication and validation require a later user OAuth step. Product-specific resource, cost, data, UI, and production decisions retain their existing gates.

## Acceptance criteria

- PLATFORM-01: Record dated primary-source findings and local audit evidence for Databricks, VS Code/Copilot, Claude Code, current models, and harness/agentic development. Distinguish current upstream releases, locally verified versions, preview features, and account-specific availability.
- PLATFORM-02: Provide an extensible, validated workload catalog and a read-only discovery command covering Apps, HTTP APIs, notebooks/SQL, data ingestion/processing, Lakebase, metrics/dashboards, Genie, ML/Serving, RAG/agents/MCP, governance/sharing, and platform automation. Mixed workloads retain all relevant components; explicit choices override heuristic hints.
- PLATFORM-03: Integrate discovery into intake and generated product requirements/design/plans, with focused workload questions and verification requirements. API-only requests do not require UI; generic agent work does not imply Genie; model registration does not imply a Delta write. Unknown intent remains a discussion, never silent execution authorization.
- PLATFORM-04: Add executable local contract-first starters for API-only work and analysis work where they improve the developer path; other workloads have precise official-skill/runbook routes and clearly stated generator versus runtime coverage. Generated fixtures must be isolated from deployment and must not overwrite existing product artifacts.
- PLATFORM-05: Verify current provider hook contracts and fix reproducible compatibility/discovery issues with tests. Keep source-of-truth generation and explicit surface-specific setup/diagnostics. Hooks remain defense in depth, never an OS/network permission boundary.
- PLATFORM-06: Make upstream freshness, selected model/tool versions, and safe update procedures explicit. Verify current official CLI/manifest/skill packages where possible without changing global tooling or selecting a workspace identity. Preserve upstream legal metadata and release immutability.
- PLATFORM-07: Run relevant deterministic tests, conformance and independent forward-tests; record actual failures and unrun live/model trials. Do not relax evaluator, budget, or human gates to obtain a passing result.
- PLATFORM-08: Deliver clear Japanese usage, support/verification boundaries, and the minimal user steps for first OAuth and a representative pilot. Keep harness design and target-product design separate. Retain the existing 0.3.2 payload and use a new version for a releasable candidate.

## Work plan

1. Inspect code and run independent realistic workflow trials; research exact official APIs, tool releases, and runtime surfaces.
2. Implement workload discovery and selected-context intake, plus bounded local API/analysis contracts.
3. Correct provider integration only where source-backed evidence shows a gap; verify source/adapter parity and failure behavior.
4. Update operational documentation, tooling/model freshness records, and actionable platform coverage.
5. Run independent forward-tests and repository regressions. Prepare a distinct candidate release only after the managed bytes are final. Report live/provider/model evidence separately.

## Review boundaries

No product is initialized in this harness-source repository. No production deploy, broad grant, external data write, permission bypass, or unbounded agent loop is authorized. The implementation does not change its own acceptance/evaluator thresholds or autonomy budgets. Proposed policy-affecting changes remain reviewable in the feature branch. A globally best ranking cannot be inferred from repository tests; comparable real tasks and operational evidence are required.
