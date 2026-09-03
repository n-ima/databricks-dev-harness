# ADR-0001: Template-first distribution

- Status: accepted
- Date: 2026-09-04

## Decision

Use a GitHub Template Repository as the bootstrap artifact. Vendor shared and official skills into each project, generate thin Claude/Copilot adapters, and later distribute harness-core upgrades as reviewed PRs.

## Rationale

The required artifact includes code layout, CI, design records, session state, tests, mock infrastructure, and Databricks Bundle configuration. A plugin alone cannot establish or version all of these, and Copilot cloud must work from repository-contained assets.

## Consequence

Template-derived repositories have independent histories, so upgrades require a separate versioned updater. Plugins remain optional convenience, not a correctness dependency.
