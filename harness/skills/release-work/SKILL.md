---
name: release-work
description: Prepare and verify a Databricks development, test, or production release with resource and permission evidence. Production execution always requires a human gate.
---

# Release work

1. Read the approved requirement, architecture, plan, evidence, and release runbook.
2. Run deterministic checks and `databricks bundle validate` against the intended non-production target.
3. Produce resource, configuration, data-migration, and permission diffs without secrets.
4. Verify rollback/recovery and observability.
5. A development target may be deployed when it is in scope and isolated. Production deploy and destructive commands must be executed explicitly by a human after reviewing the evidence.
6. Record the deployed version, target, result, and post-deploy checks in `work/evidence/`.
