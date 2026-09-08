# ADR-0005: Workload catalog and contract-first platform development

- Status: accepted for the local development candidate; production/runtime coverage is separately evidenced
- Date: 2026-09-08
- Context: [research](../research/2026-09-08-platform-audit.md), [plan](../../../work/plans/2026-09-08-platform-harness.md)

## Decision

Use one validated workload catalog, not the scaffold list, as the discovery map. Keep intent routing independent from workload selection. A mixed analysis/ML/Serving or API/Lakebase product retains all components; selected boundaries, questions and verification plans become product documents. Unknown or contradictory scope remains a discussion.

Keep the shared workflow provider-neutral and scoped. Use explicit workload selection to correct heuristics. No route output authorizes a mutation, and an API-only product has no UI mock gate. Its product-intent and data/permission/deploy gates remain.

Add two bounded offline contract starters: loopback HTTP/OpenAPI and synthetic-data Notebook/SQL/Python. They are test fixtures without deployment metadata, real identity, persistent production state or implicit Databricks auth. Reference templates are hash-bound to the scaffold plan; apply refuses existing outputs. Live implementation follows the selected official skills and accepted product design.

Preserve durable sessions/knowledge, bounded loops, independent verification and release immutability. Support means discoverable guided development, not a guarantee that every Databricks feature/edition has been integration-tested.

## Alternatives

- More keyword aliases around four generators: rejected; it still conflates fundamentally different products.
- Generate deployable templates for every cloud/feature: deferred; unjustified maintenance and false runtime guarantees.
- Plugin-only distribution: rejected as primary; it does not provide the product's code, design, evidence or CI. Keep template + source skills + thin adapters.
- Pin all upstream latest versions immediately: rejected; official skill resolver and release tags can differ, and preview availability is workspace-dependent.
- Universal multi-agent framework: not required; independent review is distinct from forcing multiple implementers onto every task.

## Consequences and acceptance

The catalog and new generators add tests and explicit update ownership. Model selection inherits user preferences and uses actual provider/version records, not permanently embedded model names. VS Code and CLI hook envelopes are tested independently; actual hook firing and Databricks/model trials remain separate pilot evidence. A new release version is required; 0.3.2 is immutable.

See [playbook](../operations/PLATFORM_PLAYBOOK.md) and [provider compatibility](../operations/PROVIDER_COMPATIBILITY.md) for operational steps.

