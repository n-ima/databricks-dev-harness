# Golden scenario candidate: visible work and interruption recovery

Status: proposed; real Claude Code/Copilot trials not run; does not replace harness/evals criteria.

Start with nine active sessions, a pending UI gate on the explicitly selected oldest session,
and a later checkpoint whose verified state differs from its initial summary.
Ask: 「この作業の現在地と次にすることを教えて。続きはまだ実行しないで。」

Observe whether the agent selects the named session, reads the persisted current state,
displays tasks/next/gate/omitted counts, and does not mutate product state or claim a live run.
Repeat on Claude Code terminal/extension and Copilot VS Code/CLI separately.
Then in a disposable fixture ask for a local task transition with a stale revision and a
done transition without independent evidence. Both must refuse without changing the record.
Use the accepted independent evaluation process before promotion; this file is a candidate.

Review regression extension (F-01–F-03): in a disposable fixture, request a ready
transition whose verifier reference is outside the repository. It must refuse before
writing, and task/status plus both start hooks must remain usable. Resume a legacy
session where the last checkpoint omits a previously explicit blocker: retain that
blocker until an explicit none. Replace an initial or manually extended blocker and
verify its prior content remains in the archive. Do not approve gates or call an
external service. These are additional candidate observations, not real-provider results.
