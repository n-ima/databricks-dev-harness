---
name: release-work
description: Prepare and verify a Databricks development, test, or production release with resource and permission evidence. Production execution always requires a human gate.
---

# Release work

This skill is for product deployment to Databricks. For publishing the harness source to Git main, use `publish-harness`; do not ask for a Databricks profile or deploy the harness itself.

1. Read the approved requirement, architecture, plan, evidence, and release runbook.
2. Run deterministic checks and validate the actual delivery method against the intended non-production target. When the product uses a Bundle, run `databricks bundle validate`; otherwise follow its approved workload-specific release path and record equivalent configuration/resource evidence. Do not invent a Bundle for an unrelated contract fixture, analysis report or SDK-managed delivery. Validate-only does not mean deployed.
3. Produce resource, configuration, data-migration, and permission diffs without secrets.
4. Verify rollback/recovery and observability.
5. A development target may be deployed when it is in scope and isolated. Production deploy and destructive commands must be executed explicitly by a human after reviewing the evidence.
6. Record the deployed version, target, result, and post-deploy checks in `work/evidence/`.
