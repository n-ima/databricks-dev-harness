# Third-party distribution check

Last verified: 2026-09-04

## Observed failure

The CLI-installed Databricks Agent Skills 0.2.10 payload contained 289 skill files but omitted the upstream repository's LICENSE and NOTICE. Skill-copy parity and release-byte parity both passed: they prove matching bytes, not complete third-party distribution metadata. A fresh pre-publication reviewer detected the missing documents before any upload.

The pinned [upstream LICENSE](https://github.com/databricks/databricks-agent-skills/blob/v0.2.10/LICENSE) and [NOTICE](https://github.com/databricks/databricks-agent-skills/blob/v0.2.10/NOTICE) are copied without modification. The license limits use to Databricks-related services and requires license/attribution retention. This repository does not label the entire harness or these skills Apache/MIT. Review any broader distribution or different use against the actual terms; this check is not a legal certification.

## Smallest correction

- Canonical vendor tree contains LICENSE, NOTICE, and an explicit third-party scope explanation.
- Provider copies and versioned release/update payloads carry the same documents.
- Refresh obtains notices from the same upstream version before replacing the current vendor tree. Unknown version, HTTP failure, missing or invalid document, and acquisition failure stop replacement.
- Lock metadata records source/version and notice hashes; conformance fails on missing or changed notices.
- Isolated deterministic regression tests cover missing/modified documents, failed acquisition, and release inclusion. Model/provider execution is unnecessary for byte-preservation behavior, and no provider-parity claim is made from these tests.

## Tradeoffs and review

This adds two bounded official-source requests to an explicit skills refresh, and a few KB of notices to each provider copy. Normal context loading need not read legal text; it remains available to recipients. Refresh may stop when upstream licensing changes, intentionally requiring review instead of silently shipping an incomplete package. No permission, budget, production gate, or verifier threshold is relaxed. Release 0.3.1 records the fix; the local 0.3.0 snapshot is not repacked under the same version.
