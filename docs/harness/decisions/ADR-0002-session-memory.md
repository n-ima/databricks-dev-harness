# ADR-0002: Summarized file memory, not raw transcripts

- Status: accepted
- Date: 2026-09-04

## Decision

Persist work-session state and verified knowledge as repository files. Do not automatically persist raw prompts, transcripts, or hidden reasoning.

## Rationale

Compact task state supports context loss and provider changes. Raw transcripts create privacy exposure, preserve rejected hypotheses, increase retrieval noise, and tie the project to one provider's format.

## Consequence

Agents must checkpoint before handoff or termination. Hooks remind and restore context but do not replace semantic checkpointing.
