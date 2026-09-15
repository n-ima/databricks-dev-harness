---
name: define-work
description: Turn a short Databricks product request into a durable product requirement and design skeleton, identify only material questions, and define mock and human approval gates.
---

# Define work

1. Read `AGENTS.md`, `docs/harness/operations/OPERATING_MODEL.md`, and `harness/templates/product-requirement.md`.
2. Inspect existing product requirements, design, knowledge, data contracts, and related sessions before asking questions.
3. Translate the request into outcomes, users, journeys, data authority, read/write behavior, and observable acceptance criteria.
   Resolve workloads first (`harness workload resolve`). Confirm cloud/edition, scope and all mixed components. Keep Apps HTTP contracts, Model Serving, platform API clients, and UI as separate decisions; no UI gate for a genuinely API-only product. Use the catalog's focused questions and verification boundary, not a fixed all-platform architecture.
4. State assumptions. Ask only questions whose answers alter behavior, sensitive-data handling, authority, cost, or irreversible design.
5. For user-facing work, define an executable mock gate before backend integration.
   UI design itself defaults to Databricks Apps with the app's actual AppKit components, not framework-independent HTML. Apply `docs/harness/operations/UI_RUNTIME_FIDELITY.md`; external hosting requires an explicit product decision. Data/field/ER design progresses with UI design, not only after UI completion.
6. Create or update one requirement under `docs/product/requirements/` and a design skeleton under `docs/product/architecture/`.
   Read `docs/harness/operations/DOCUMENTATION_STANDARD.md`. Define the scoped business journeys, glossary, functions, data/field dictionary, UI inventory/transitions where applicable, and external interfaces with stable cross-references. Keep small scopes in the two documents; split only when useful. Resolve behavior-critical unknowns for the slice before implementation. Read `docs/harness/operations/DELIVERY_ASSURANCE.md` for requirement/risk/test mappings; generate them for the user, not as a form the user must fill.
7. Checkpoint the durable session with decisions, open gates, and the exact next step. Do not implement during an intent-definition-only request.

Use `npm run intake -- create` for new products/features and `intake answer` to preserve answered material questions. Combine related questions into a short conversation; do not dump the entire ledger onto the user. Record answers already explicit in supplied material with their source, and ask only unresolved material questions. Refine generic scaffold acceptance criteria into feature-specific, observable cases before requesting approval.

For selected scope use repeated `--workload api --workload lakebase` or `--workload analysis --workload ml --workload model-serving`. Unknown capabilities remain a material question, not an automatic SDK call. Catalog hints are not accepted decisions: verify the actual workspace/edition supports the chosen feature. Follow `docs/harness/operations/PLATFORM_PLAYBOOK.md` for contract-first paths and identity/compute boundaries.

After the actual human decision, `intake approve --id ... --actor ... --evidence "reference to the user's decision"` binds requirement/design hashes and updates the session. An actor string is a record, not authenticated identity. Never invent approval. If intent changes, update the ledger; prior approval is revoked and must be obtained again.
