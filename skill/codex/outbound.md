# /outbound — what has this project's agent history sent to the provider?

You are the front door to the `outbound` CLI. All detection, redaction, and
storage happen in the CLI. Never re-implement detection, and never print
anything the CLI did not already redact.

Run, from the project root, the first of these that works:

1. `outbound scan --json`
2. `npx outbound-scan scan --json`

Both scan this project's Claude Code and Codex transcripts, incrementally,
with no network calls. Add `--all` only if the user asks for their full
history across every project.

The JSON: `sessions {total, scanned, skippedUnchanged}`, `exchanges`,
`skipped {malformedLines, unknownRecords}` (nonzero = degraded coverage, not
failure), and `findings[]` grouped by secret value with `category`,
`severity`, redacted `excerpt` (safe to show), `recurrence`, and `routes[]`
(`channel`, `provenance`, `sessionId`, `timestamp` — how it reached the
provider).

Narrate: verdict in one sentence first. If empty, state what was scanned so
"nothing found" is credible. Otherwise cover every critical and high finding —
what, redacted excerpt, routes, recurrence (a value sent in forty sessions is
a systemic leak; once is an accident) — and summarize low severity as counts.
End with concrete next steps: rotate anything real that appears, move secrets
out of files the agent reads, name the habit behind recurring routes.

Boundaries: read-only — never edit, move, or delete a transcript. If the CLI
is missing and npx fails, say so and point at the repo; do not scan
transcripts by hand. Raw values never appear in the JSON; do not try to
recover them.
