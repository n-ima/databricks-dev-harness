# Harness evaluation

The executable manifest is `harness/evals/golden-tasks.json`.

Deterministic conformance and hook/setup tests run on every PR. Before a harness release, each golden task is run at least three times with Claude Code and GitHub Copilot in isolated worktrees using the same fixture and acceptance criteria. A fresh verifier grades the repository artifacts, not the agent's narrative.

Record per run:

- provider/model/tool versions and harness commit;
- accepted or rejected outcome;
- human interventions and reasons;
- escaped defects and verifier findings;
- wall time and estimated cost;
- architecture drift;
- whether a fresh session resumed correctly.

A harness candidate is promoted only when the target metrics improve or remain within an explicit tolerance and no security or completion gate regresses. A model upgrade is evaluated like a code dependency upgrade.
