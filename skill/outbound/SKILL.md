---
name: outbound
description: Scans this project's Claude Code and Codex session transcripts for credentials and personal data that were sent to the model provider, then explains what leaked and how it got there. Use when the user asks "/outbound", "what has my agent leaked", "scan my transcripts", "did my session send any secrets", or after a session touched .env files, database dumps, or customer data. Read-only, local-only; wraps the outbound CLI and contains no detection logic.
---

# /outbound — what has this project's agent history sent to the provider?

This skill is a front door to the `outbound` CLI. All detection, redaction,
and storage happen in the CLI. Never re-implement detection here, and never
print anything the CLI did not already redact.

## Run the scan

Try, in order, from the project root:

1. `outbound scan --json`
2. `npx outbound-scan scan --json`

Both scan the current project's Claude Code (`~/.claude/projects/<slug>/`) and
Codex (`~/.codex/sessions/`) transcripts. Add `--all` only if the user asks
for their full history across every project. The scan is incremental —
already-scanned sessions are skipped by content hash — and makes no network
calls.

## Read the JSON

The output shape (version 1):

- `sessions` — `{ total, scanned, skippedUnchanged }`
- `exchanges` — text blocks examined this run
- `skipped` — `{ malformedLines, unknownRecords }`: transcript records the
  reader could not interpret. Nonzero means coverage degraded, not failure.
- `findings[]` — grouped by secret value:
  - `category`, `severity` (`critical | high | medium | low`), `confidence`
  - `excerpt` — already redacted (`AKIA...F2Q`); safe to show
  - `recurrence` — how many times this one value was sent
  - `routes[]` — how it reached the provider: `channel`
    (`user-prompt | file-read | command-output | tool-result | attachment`),
    `provenance` (file path, command, or tool), `sessionId`, `timestamp`

## Narrate the result

Lead with the verdict in one sentence, then detail:

1. **Empty result:** say what was scanned (sessions, exchanges, skip counts)
   so "nothing found" is credible, not vacuous.
2. **Findings:** cover every critical and high finding: what it is, the
   redacted excerpt, how it got there (routes), and how often (recurrence).
   Recurrence is the signal — a key sent in forty sessions is a systemic
   leak; once is an accident. Summarize low-severity findings as counts.
3. **Next steps, concrete:** rotate any credential that appears — treat it as
   compromised; move secrets out of files the agent reads (`.env` →
   a secret manager or agent-ignored files); for recurring routes, name the
   habit that keeps sending it (e.g. "`printenv` output is pasted every
   session").

Offer `--out report.html` if the user wants a self-contained report. Before it
is shared, warn that it contains local paths, command provenance, timestamps,
and other attribution metadata that should be reviewed.

## Boundaries

- Read-only: never edit, move, or delete a transcript.
- If the CLI is not installed and npx fails, say so and point at the repo —
  do not scan transcripts by hand.
- Raw secret values never appear in the JSON; do not try to recover them.
