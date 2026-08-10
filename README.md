# Outbound

> See what your coding agent has been sending to the model provider.

Coding agents read whatever they need — `.env` files, config with live
credentials, database dumps pasted for debugging, command output containing
tokens. All of it is sent to Anthropic or OpenAI as part of the conversation,
and nobody ever reviews it.

The record already exists. Every Claude Code and Codex session is written to
disk as JSONL. Nothing reads it for this.

Outbound does. Run it in a project folder and it reports what leaked, how often,
and how it got there.

```
npx outbound-scan scan
```

No proxy. No environment variables. No restarting anything. It reads history you
already have.

## Status

**Pre-implementation.** The design is specified and agreed; the code is not
written yet. See
[`docs/superpowers/specs/2026-08-10-outbound-design.md`](docs/superpowers/specs/2026-08-10-outbound-design.md)
for the full design and
[`docs/superpowers/plans/`](docs/superpowers/plans/) for the build plan.

This README describes the intended v1 and will be replaced with real usage and
real numbers once it runs.

## What it will do

- **Read** Claude Code (`~/.claude/projects/`) and Codex (`~/.codex/sessions/`)
  transcripts for the current project.
- **Detect** credentials and personal data: provider API keys, AWS keys, private
  key blocks, JWTs, connection strings, `.env` contents, emails, phone numbers,
  Luhn-valid card numbers.
- **Attribute** each finding to how it reached the provider — which file was
  read, which command produced it, or whether it was pasted.
- **Group** by recurrence, so one credential seen across forty sessions is one
  finding with a count. Recurrence is the signal: forty means systemic, one means
  accident.
- **Report** to the terminal, or to a shareable HTML file.

## Design commitments

These are enforced by tests, not by intention.

- **No network calls, ever.** CI fails if the test suite opens a socket.
- **Raw secrets are never written to disk.** The store keeps redacted excerpts
  and salted hashes. A test reads the raw database file and fails if any
  plaintext secret appears in it.
- **Read-only.** Outbound never edits, moves, or deletes a transcript, and never
  writes into the project it scans.
- **Legibly empty.** A scan that finds nothing reports what it scanned — session
  count, exchange count, records skipped — so "nothing found" is distinguishable
  from "nothing worked".
- **Honest accuracy.** A synthetic corpus measures precision and recall per
  category, published including the categories that do badly.

## Not in v1

A live proxy for arbitrary apps, contextual detection of names via a local
model, readers for Cursor/Copilot/Windsurf, transcript redaction, team
aggregation, scheduled scanning. See §9 of the spec.

## License

MIT
