# Session and knowledge design

## Why repository files are the memory

Provider sessions end, context is compacted, and another model may continue later. Chat history cannot be the only project memory. Conversely, saving every transcript creates a noisy, sensitive, contradictory knowledge base.

The harness therefore stores compact state transitions, not chain-of-thought or raw transcripts.

## Work session contract

Each non-trivial changing task owns `work/sessions/<timestamp>-<slug>.md`.

Required fields:

- stable id, title, status, intent, provider, timestamps;
- requirement and plan links when assigned;
- observable objective;
- verified current state, separated from hypotheses;
- decisions with alternatives and consequences;
- progress and evidence paths;
- exact next actions;
- blockers and human gates;
- handoff sufficient for a fresh agent.

Status is one of `active`, `completed`, `blocked`, or `superseded`. A chat ending does not imply a completed work session.

## Lifecycle

```text
session start -> inspect -> checkpoint after meaningful state change
              -> checkpoint before compaction/handoff/end
              -> close only after completion rule
              -> or blocked with exact missing authority
```

Provider lifecycle hooks inject active-session paths but do not write raw prompts. The agent creates and summarizes the durable record because it can distinguish intent, evidence, and discarded hypotheses.

Task identity and user-visible progress are separate from a session lifecycle. See [Task visibility](TASK_VISIBILITY.md) for the shared CLI/hook projection, explicit focus, truncation, and revision-checked writes. Checkpoints refresh the current-state and next-action sections while retaining initial state and prior checkpoints. `active` or a task's `running` is stored state, not an observed live process.

## Knowledge promotion

A session statement moves to knowledge only when it is reusable and supported by a source or reproducible evidence.

| Destination | Use for | Do not use for |
|---|---|---|
| `docs/product/knowledge/` | domain definitions, source behavior, operational facts | current TODOs, generic harness rules |
| `docs/product/decisions/` | consequential target-specific choices | unchosen alternatives |
| `docs/harness/knowledge/` | cross-project agent/tool facts and patterns | one product's business rule |
| `docs/harness/decisions/` | harness-wide policy and architecture | transient tool failures |

Every knowledge record includes source, confidence, verification date, scope/exception, and review date when it can become stale. Conflicts are resolved explicitly; do not keep two active contradictory records.

## Privacy and security

Never store tokens, credentials, customer row data, raw production outputs, or sensitive prompt text in sessions, evidence, screenshots, benchmarks, or knowledge. Store resource identifiers only when the repository's classification policy permits it; otherwise record a discoverable alias.

## Recovery

After context loss or a provider switch:

1. Run `npm run harness:context`.
2. Read matching active session(s).
3. Verify the recorded branch, files, tests, and external state.
4. Resume from next actions; do not trust an unverified “done” claim.
5. Add a checkpoint noting the new provider and any drift found.
