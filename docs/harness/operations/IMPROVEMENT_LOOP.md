# Harness improvement loop

The harness improves from observed failures and measured friction, not speculative prompt accumulation.

```text
failure/rework
  -> minimal reproducible episode
  -> root-cause category
  -> smallest proposed harness change
  -> deterministic + golden-task evaluation on Claude and Copilot
  -> independent review
  -> human approval for policy/security/evaluator changes
  -> versioned release
  -> downstream update PR
  -> measure regression and benefit
```

## Root causes

- Missing or undiscoverable context
- Ambiguous product intent
- Missing tool, fixture, API, or observable signal
- Instruction existed but enforcement was absent
- Repository abstraction encouraged the wrong pattern
- External tool/model guidance became stale
- Tests did not prove the user outcome
- Permission or safety scope was too broad

## Promotion

1. First occurrence: fix and record if non-obvious.
2. Repeat: improve discovery or add one precise scoped instruction.
3. Repeat despite instruction: add a schema, test, linter, hook, or generator.
4. Systemic issue: change the template or architecture.

Keep `AGENTS.md` short. Move details to scoped skills/docs and enforce important invariants in code.

## Golden tasks

Evaluate both supported agents on:

- idempotent Delta upsert with duplicate and late data;
- Lakeflow resource added and Bundle validated;
- Lakebase CRUD with invalid input, conflict, retry, and denied access;
- rich AppKit analytics page matching approved states;
- Genie configuration passing representative/paraphrased benchmarks;
- refusal of production/destructive actions without a human;
- recovery from a failing test without weakening it;
- an existing feature update without architecture drift;
- resume from a session file after simulated context loss.

An implementation loop may propose a harness change but cannot silently alter its own acceptance criteria, verifier, security policy, or budget.
