---
name: define-work
description: Turn a short Databricks product request into a durable product requirement and design skeleton, identify only material questions, and define mock and human approval gates.
---

# Define work

1. Read `AGENTS.md`, `docs/harness/operations/OPERATING_MODEL.md`, and `harness/templates/product-requirement.md`.
2. Inspect existing product requirements, design, knowledge, data contracts, and related sessions before asking questions.
3. Translate the request into outcomes, users, journeys, data authority, read/write behavior, and observable acceptance criteria.
4. State assumptions. Ask only questions whose answers alter behavior, sensitive-data handling, authority, cost, or irreversible design.
5. For user-facing work, define an executable mock gate before backend integration.
6. Create or update one requirement under `docs/product/requirements/` and a design skeleton under `docs/product/architecture/`.
7. Checkpoint the durable session with decisions, open gates, and the exact next step. Do not implement during an intent-definition-only request.

Use `npm run intake -- create` for new products/features and `intake answer` to preserve answered material questions. Combine related questions into a short conversation; do not dump the entire ledger onto the user. Record answers already explicit in supplied material with their source, and ask only unresolved material questions. Refine generic scaffold acceptance criteria into feature-specific, observable cases before requesting approval.

After the actual human decision, `intake approve --id ... --actor ... --evidence "reference to the user's decision"` binds requirement/design hashes and updates the session. An actor string is a record, not authenticated identity. Never invent approval. If intent changes, update the ledger; prior approval is revoked and must be obtained again.
