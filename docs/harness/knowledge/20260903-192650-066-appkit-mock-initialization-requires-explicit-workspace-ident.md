---
title: AppKit mock initialization requires explicit workspace identity
status: current
kind: fact
confidence: high
source: docs/harness/research/2026-09-04-evidence-review.md
verified_at: 2026-09-03T19:26:50Z
review_after: 2026-10-04
applies_to: Databricks CLI 1.6.0 AppKit scaffolding; recheck after CLI changes
supersedes: none
---

# AppKit mock initialization requires explicit workspace identity

Databricks CLI 1.6.0 apps init requires workspace authentication even for a server-only fixture mock. Require an explicitly selected development profile and expected host; inventory profiles with --skip-validate before authenticating only the selected profile. Do not infer init is offline from apps manifest. Regression tests cover omitted identity and altered mock approval artifacts.

## Applicability and exceptions

Databricks CLI 1.6.0 AppKit scaffolding; recheck after CLI changes
