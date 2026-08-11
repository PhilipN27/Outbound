# Outbound

> See what your coding agent has been sending to the model provider.

Coding agents read whatever they need — `.env` files, config with live
credentials, database dumps pasted for debugging, customer CSVs, command
output containing tokens. All of it is sent to Anthropic or OpenAI as part of
the conversation, and none of it is ever reviewed, because the record is
hundreds of megabytes of JSONL that no tool reads for this purpose.

Outbound reads it. It scans your Claude Code and Codex session transcripts on
disk, finds sensitive data that was sent, and reports what leaked, when, and —
the part that makes it actionable — **how it got there**: a file the agent
read, a command whose output was captured, a value you pasted.

```
$ outbound scan --all

Outbound — all projects
  scanned 1254 sessions (1254 new, 0 unchanged), 96210 exchanges this run
  skipped records: 0 malformed, 0 unknown

CRITICAL (61)
  connection-string      postgres://hermetic:[redacted]@127.0.0.1:5432/hermetic 10×
      via user-prompt user
      first 2026-08-10 · last 2026-08-10 · 10 session(s)
  ...
```

That is real output from the author's machine: 1.7 GB of transcripts across
1,254 sessions scanned in 90 seconds, surfacing (among other things) a
database password pasted into prompts in ten different sessions. Recurrence is
the signal — a credential sent once is an accident; sent in ten sessions, it
is a habit.

## Install

```
npm install -g outbound-scan     # binary is `outbound`
```

Or from a checkout: `pnpm install && pnpm build && npm install -g .`

## Use

```
outbound scan                    # this project's sessions (run in the project folder)
outbound scan --all              # full history, every project
outbound scan --json             # machine-readable, full detail
outbound scan --out report.html  # self-contained shareable report
```

Scans are incremental: sessions already examined are skipped by content hash,
so routine re-runs take seconds. When Outbound's detectors improve, the cache
invalidates itself and the next scan re-examines everything.

A `/outbound` skill (in `skill/`) wraps the CLI for conversational use inside
Claude Code. It contains no detection logic; the CLI is the tool.

## What it finds

Provider API keys (Anthropic, OpenAI-style, GitHub, GitLab, Slack, Stripe,
Google), AWS access and secret keys, private key blocks, JWTs, connection
strings with embedded passwords, credit cards (Luhn + issuer validated),
emails, phone numbers, US SSNs, `.env` file blocks, and bulk personal data
(a CSV with an email column is one finding with a row count, not fifty rows).

Measured, not claimed — the corpus eval gates CI on these numbers
([corpus/README.md](corpus/README.md) has the method and the misses):

```
category                planted  tp  fp  fn  precision  recall
aws-access-key-id       4        4   0   0   1.000      1.000
aws-secret-access-key   4        3   0   1   1.000      0.750
bulk-personal-data      1        1   0   0   1.000      1.000
connection-string       4        4   0   0   1.000      1.000
credit-card             4        4   0   0   1.000      1.000
email                   6        6   0   0   1.000      1.000
env-block               2        2   0   0   1.000      1.000
jwt                     3        3   0   0   1.000      1.000
phone                   6        5   0   1   1.000      0.833
private-key             3        3   0   0   1.000      1.000
provider-api-key        6        6   0   0   1.000      1.000
ssn                     4        3   0   1   1.000      0.750
```

The sub-1.0 recalls are deliberate: undashed SSNs, bare 10-digit phone
numbers, and context-free AWS secrets are shapes Outbound refuses to match
because they drown reports in false positives. They stay planted in the corpus
so the numbers cannot flatter.

Precision is treated as the product. During development the detectors were run
over 41 MB of node_modules and 1.7 GB of real transcripts; every false-positive
class found (documentation URLs, Luhn-passing digit tables, ML model floats
that checksum like credit cards) became a failing test before it became a fix.

## What it will never do

- **No network calls.** Outbound never opens a socket. Verifiable offline.
- **No raw secrets on disk.** Its SQLite store holds redacted excerpts
  (`AKIA...F2Q`) and per-install salted hashes only. A test reads the raw
  database bytes and searches for planted plaintext; it has been watched to
  fail when redaction was deliberately broken.
- **Read-only.** It never edits, moves, or deletes a transcript, and never
  writes into the project being scanned. Its own state lives in `~/.outbound`.
- **Degrade, never crash.** Unknown record types and malformed lines are
  skipped and counted, and the count appears in the report — transcript
  formats are undocumented and change without notice.

Not in v1, by design: a live proxy for arbitrary apps (the architecture leaves
room; it is not promised until it exists), Cursor/Copilot/Windsurf readers,
transcript redaction or rewriting, team aggregation, scheduled scanning,
alerting.

## Development

TypeScript, Node ≥ 22, zero runtime dependencies (`node:sqlite` is built in).

```
pnpm test     # unit suite (129 tests)
pnpm eval     # corpus precision/recall gate
pnpm check    # lint + build + test + eval
```

Everything in `corpus/` is synthetic. No real transcript and no real
credential enters this repository.

MIT © Philip Nora
