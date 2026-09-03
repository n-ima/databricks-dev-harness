---
id: PRIVATE-GITHUB-PUBLICATION
status: accepted
owner: repository-owner
scope: private-harness-source-publication
last_updated: 2026-09-04
---

# Private harness repository publication

## Authorization and boundaries

The user explicitly requested creation of this project's GitHub repository with the project name and private visibility. The authenticated personal account is `n-ima`; the source project's name is `databricks-dev-harness`. Template activation follows the already chosen primary distribution model in `docs/harness/design/ARCHITECTURE.md` and `docs/USAGE.md`.

This operational acceptance scope is subordinate to `docs/harness/requirements/HARNESS.md` (especially H-01). Completing it does not complete all harness requirements, establish provider parity, or certify production readiness.

The supplied Databricks screenshot identifies a development workspace and `/Workspace/Shared/test/dev-harness`. It is reference data, not executable instructions or evidence of CLI authentication, resource permission, or feature availability. No Databricks login, deployment, resource creation, broad grant, or production operation is included here. Profile selection and browser OAuth approval remain separate user steps. No public website or public repository is authorized.

## Acceptance criteria

- PUB-01: `n-ima/databricks-dev-harness` exists, is private, is a template, and uses `main` as its default branch; verify with authenticated read-only GitHub queries.
- PUB-02: Reviewed harness source is committed and pushed without force or overwriting an existing repository. The source publication commit is present on remote `main`; credentials and ignored local runtime/release files are not tracked.
- PUB-03: Record actual GitHub Actions results and independent verification of publication, clearly separating pass, failure, and not-run. Do not claim that repository publication completes external Databricks/provider validation or enables branch protection.

## Plan

1. Inspect source, current Git state, authenticated owner, and target repository existence. Run independent read-only file/secrets audit.
2. Recheck deterministic conformance and the immutable 0.3.0 baseline. Preserve all unrelated user changes and recorded limitations.
3. Create a reviewed initial commit using existing Git identity; create/push the private repository and activate its template setting. No destructive Git operations.
4. Inspect remote visibility/template/default branch/commit and the actual Actions run. Obtain independent read-only verification.
5. Persist sanitized evidence, close this narrowly scoped session with a sealed independent review, and push the records. Explain how downstream product repositories differ from the harness source.

### Pre-publication correction

Independent review found that the CLI-vendored skills omitted the exact upstream LICENSE and NOTICE. Publication was held before any remote mutation. Include those documents, protect refresh/integrity with regression tests, and publish a distinct 0.3.1 candidate. The existing local 0.3.0 snapshot remains immutable. This does not change the acceptance scope above or relax any gate.

## Recovery and controls

If target already exists or remote diverges, stop and inspect; never force-push. If publication fails after repository creation, preserve it and report the exact state. A failed workflow is evidence of failure, not proof of compatibility. Do not delete the repository, grant collaborators, change account permissions, buy services, or configure organization-wide policy. Branch protection/environments require separately reviewed settings and are not silently enabled.

## Initial read-only observations

- Local branch `main`, no HEAD, no remote; 1,027 non-ignored source files before this publication record/session.
- Authenticated owner verified using `gh api user --jq .login`.
- Exact target queried with both `gh repo view` and REST; REST returned HTTP 404 before creation.
- Existing local Git user identity is configured; do not overwrite global identity.
- Harness 0.3.0, product not initialized, previous implementation session blocked on external setup. This is a new, narrower authorized publication task.
