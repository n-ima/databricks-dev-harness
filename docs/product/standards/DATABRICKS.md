# Databricks engineering standard

Last verified: 2026-09-04  
Review after: 2026-10-04

## Toolchain and deployment

- Use Databricks CLI 1.x with OAuth profiles and explicit `--profile`.
- Use the Databricks VS Code extension when remote Python execution or Databricks Connect adds value.
- Define jobs, pipelines, apps, dashboards, Genie spaces, permissions, and other supported resources in Declarative Automation Bundles.
- Use the direct deployment engine; do not introduce new dependencies on the retired Terraform-backed Bundle engine.
- Vendor compatible official Agent Skills with `databricks aitools install --path vendor/databricks-skills`.
- Pin AppKit and dependencies. Upgrade through an evaluated PR.

Targets:

- `dev`: developer identity, isolated names/data, development mode.
- `test`: service principal, integration data, production-like permissions.
- `prod`: service principal, production mode, explicit human execution.

Bundle validation is necessary but not sufficient. A production candidate needs a successful isolated dev/test deployment plus resource, migration, and permission evidence.

## Data

- Bronze: source-faithful ingestion and audit metadata.
- Silver: validated, deduplicated, conformed records.
- Gold: user-facing models, governed views, and Metric Views.
- Use Delta `MERGE` for analytical upserts and prove idempotency.
- Use Lakebase for transactional CRUD, concurrency, and application state.
- Do not use a SQL Warehouse as ad-hoc OLTP storage.

Every write contract defines owner, schema, business key, deduplication, late-arrival behavior, delete semantics, retries, idempotency, reconciliation, time zone, retention, classification, and access.

## Semantics and Genie

Define reusable measures once in Unity Catalog Metric Views when practical. Apps, Genie, SQL, and dashboards should not reimplement KPI formulas independently.

Genie spaces are narrow, curated domains with business comments, relationships, example questions, trusted assets, and explicit limitations. Maintain benchmark questions with expected SQL/result semantics and test paraphrases, ambiguity, empty results, access restrictions, and time boundaries.

Try managed Supervisor Agent capabilities before custom multi-agent orchestration. Use a custom Databricks App only when routing, workflow, or UI requires it.

## Applications

Use App resources and the application service principal with least privilege. Never hardcode workspace URLs, resource IDs, catalog/schema names, or credentials in source.

- Read-only analytics: AppKit analytics plugin and query files.
- Conversational analysis: AppKit Genie plugin.
- Transactional CRUD: AppKit Lakebase plugin.
- Job control: AppKit jobs capabilities.
- Unsupported mutation/API: validated server endpoint with authorization and input schemas.

## Sources

- https://docs.databricks.com/aws/en/dev-tools/bundles/resources
- https://github.com/databricks/appkit
- https://github.com/databricks/databricks-agent-skills
- https://docs.databricks.com/aws/en/uc-semantics/metric-views
- https://docs.databricks.com/aws/en/genie-agents/monitor
- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources
