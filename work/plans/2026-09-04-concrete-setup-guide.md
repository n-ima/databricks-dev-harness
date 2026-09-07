---
id: CONCRETE-SETUP-GUIDE
status: accepted
owner: repository-owner
scope: onboarding-documentation
---

# Concrete setup guide

The user requests more explicit instructions and asks whether an empty application directory plus setup.sh supplies everything. Claude Code and GitHub Copilot installation/sign-in are assumed complete. Explain exactly how the supplied Databricks workspace/folder maps to inputs and which additional platform prerequisites are required.

This is documentation and its regression verification, not authorization to create another GitHub product, log in to Databricks, create/grant/deploy resources, change permissions, or publish the guide externally. Existing local HTML and Markdown are the delivery surfaces. The harness source remains uninitialized as a product.

## Acceptance criteria

- GUIDE-01: Explain template creation/clone versus empty directory, source versus product roots, and the exact setup.sh/setup.ps1/new-project responsibilities and limitations; agents are assumed installed.
- GUIDE-02: Give concrete Windows and shell commands, cwd, placeholders versus supplied workspace values, successful-output checks, restart/recovery, and the natural-language handoff for either agent.
- GUIDE-03: Map screenshot host/path to setup/profile and Bundle variables. Explain dev Users default versus optional Shared root, persistent local variable configuration, and no implied deployment/data permission.
- GUIDE-04: Distinguish sufficient preparation for requirements/auth/mock from workload-specific catalog/schema/compute/App/Genie/Lakebase requirements, grounded in current primary docs and local code, including Free Edition limitations.
- GUIDE-05: Keep Markdown/HTML consistent, verify local serving/links and executable documentation contracts, and record independent review plus validation limits. Preserve the immutable 0.3.1 baseline; do not claim current changed source still matches that snapshot.

## Plan

Read actual bootstrap and connection code; obtain independent code audit and official-platform research. Expand a focused walkthrough and link it from the existing guide, correcting the setup section rather than redesigning the site. Add deterministic documentation/fixture checks. Run conformance/tests, record source and external evidence, and obtain independent verification. This is an unshipped documentation change unless a separate release snapshot is explicitly prepared; no automatic push or platform mutation.
