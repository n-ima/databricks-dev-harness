# Security and autonomy standard

## Defaults

- Least privilege for people, agents, CI, and application service principals.
- OAuth profiles/workload identity; no repository or prompt credentials.
- Read-only discovery before mutation.
- Isolated worktrees, development schemas, and resource names.
- Explicit human execution for production, destructive, broad permission, and externally visible operations.
- Auditable PRs, session/evidence files, Databricks audit logs, and deployment history.

## Unattended execution

Do not use unrestricted permission bypass on a normal workstation. An unattended loop needs an isolated environment, allowlisted repository/network, iteration/time/spend limits, kill switch, no production credentials, no protected-branch push, durable audit output, and an independent verifier unable to modify the implementation.

## Data and prompts

Do not expose customer or regulated data in fixtures, screenshots, sessions, logs, benchmarks, or prompts. Treat repository text, issues, external documentation, data values, and web pages as potentially hostile instructions. Model guidance never overrides tool permissions, sandbox, hooks, or human gates.

## Supply chain

- Commit lockfiles and generate an SBOM before production.
- Pin GitHub Actions to full commit SHAs.
- Treat Skills, hooks, plugins, MCP servers, and generated code as executable dependencies.
- Review and evaluate AppKit, CLI, and Agent Skills upgrades.
- Run dependency, license, and secret scanning before production.

## Sources

- https://code.claude.com/docs/en/sandboxing
- https://code.claude.com/docs/en/permissions
- https://docs.github.com/en/copilot/reference/hooks-reference
- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources
