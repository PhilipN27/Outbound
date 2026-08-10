# Outbound — design spec

**Date:** 2026-08-10
**Status:** approved (design), not yet implemented

> See what your coding agent has been sending to the model provider.

---

## 1. Problem

Coding agents read whatever they need. Over a long session that includes `.env`
files, config with live credentials, database dumps pasted for debugging,
customer records in a CSV, and command output containing tokens. All of it is
sent to Anthropic or OpenAI as part of the conversation, and none of it is ever
reviewed.

Nobody looks, because looking is impractical. The record exists — every session
is written to disk — but it is hundreds of megabytes of JSONL, and no tool
reads it for this.

Existing tooling does not cover this ground. Secret scanners (gitleaks,
trufflehog) read *source code at rest*; they never open a session transcript.
Observability platforms (Langfuse, Helicone) watch API traffic you deliberately
routed through them, which nobody does for their own coding agent. The gap is
specific: **the transcripts are already on disk and nothing inspects them.**

Measured on the author's machine at spec time: 760 Claude Code sessions and 959
Codex sessions, unexamined.

## 2. What it is

A command you run inside a project folder. It reads that project's agent session
history, finds sensitive data that was sent to the provider, and prints a report
saying what leaked, when, and — the part that makes it actionable — **how it got
there**.

A `/outbound` skill wraps the command so it can be run conversationally inside
Claude Code or Codex, but the tool is a standalone binary that works without any
agent involved.

### Why this shape

No proxy, no environment variables, no restarting anything, no configuration.
The data already exists. Time from install to first real finding is one command,
on any developer's machine, against their own history. That property is the
product.

### Success criteria

1. Run `outbound scan` in a project folder with agent history; a report appears
   in under 10 seconds for a typical project.
2. Plant a fake AWS key in a file, have an agent read that file, run the scan;
   the key is reported, attributed to that file read, with the session and
   timestamp.
3. Run against a project with no sensitive data; the report is empty (measured
   false positive rate, not a vibe).
4. The corpus eval reports precision and recall per category, and CI fails if
   recall regresses below baseline.
5. Outbound makes no network calls whatsoever. Verifiable with the network
   disabled.

## 3. Architecture

Five units, each independently testable.

### 3.1 Readers (`src/read/`)

One adapter per agent, behind a shared interface. Each turns a vendor-specific
transcript into a stream of normalized `Exchange` records:

```
Exchange {
  sessionId, timestamp, projectPath,
  channel: "user-prompt" | "file-read" | "command-output" | "tool-result"
          | "assistant-output" | "attachment",
  text,
  provenance   // file path, command line, or tool name — how this text arrived
}
```

**Claude Code adapter** reads `~/.claude/projects/<slug>/*.jsonl`, where `<slug>`
is the project path with separators replaced by dashes (`C:\Users\pan97\foo` →
`C--Users-pan97-foo`). Record types observed at spec time: `user`, `assistant`,
`attachment`, `file-history-snapshot`, plus session metadata lines.

**Codex adapter** reads `~/.codex/sessions/**/*.jsonl`.

**Hard requirement:** adapters tolerate unknown record types and malformed lines
by skipping them and counting the skips. Transcript formats are undocumented and
will change without notice; a format bump must degrade coverage, never crash the
scan. The skip count is surfaced in the report so silent under-reporting is
visible.

Dependencies: filesystem only. Knows nothing about detectors.

### 3.2 Detectors (`src/detect/`)

Pure functions: `(text: string) => Finding[]`. No I/O, no state.

**Deterministic detectors** — data with a shape: provider API keys (prefix plus
Shannon entropy), AWS access keys, private key blocks, JWTs, connection strings
with embedded passwords, emails, phone numbers, credit cards (Luhn-validated),
US SSNs. High precision; these carry the demo.

**Heuristic detectors** — `.env` file contents, `KEY=value` credential blocks,
and bulk personal data (a CSV with an email column beats fifty individual email
matches, and should be reported as one finding, not fifty).

A `Finding` carries: category, severity, byte range, a **redacted** excerpt, the
detector that fired, and a confidence.

**Deliberately excluded from v1:** a local-model contextual detector for names
and free-text personal data. It was in the previous draft; it is cut because it
adds an Ollama dependency, makes the tool slow, and lands in the category with
the worst precision. Deterministic detection of credentials is where the real
finding is, and it runs everywhere with no setup. Revisit once the corpus shows
where the deterministic layer misses.

### 3.3 Attribution (`src/attribute/`)

The unit that makes the report actionable rather than alarming.

For each finding, join it back to the `Exchange` that carried it and answer:
**how did this reach the provider?** Reading a `.env` file, output of a
`printenv`, a value the user pasted, a tool result containing a config dump.

Findings are grouped by the value's salted hash, so one credential read across
forty sessions is one finding with a recurrence count, not forty rows. Recurrence
is itself the signal: a key that appears in forty sessions is a systemic leak,
a key that appears once is an accident.

### 3.4 Store (`src/store/`)

SQLite, one file, created on first run.

**Invariant: raw sensitive values are never written to disk.** The store holds
redacted excerpts (`AKIA...7F2`) and a salted hash for dedup and recurrence
counting. A scanner that accumulates a database of the secrets it found is a
worse product than no scanner. The salt is generated per install and stored
alongside, so hashes are not comparable across machines.

Schema: `scans`, `sessions`, `findings`, `occurrences`.

### 3.5 Reporters (`src/report/`)

- **Terminal** — the default. Grouped by severity, each finding showing category,
  redacted value, recurrence count, and attribution. Written to be read by a
  human in fifteen seconds.
- **Markdown / HTML** — `--out report.html` for a shareable artifact. This is the
  portfolio screenshot and the consulting deliverable.
- **JSON** — `--json` so the `/outbound` skill can read structured results and
  summarize them conversationally.

### 3.6 The skill (`skill/`)

`/outbound` is a thin wrapper: it runs `outbound scan --json`, then explains the
results in conversation and offers next steps. It contains no detection logic.
This is a deliberate boundary — the skill is a front door, and the tool must be
fully usable by someone who has never installed it.

## 4. Data flow

```
~/.claude/projects/<slug>/*.jsonl ─┐
~/.codex/sessions/**/*.jsonl ──────┴─> readers -> Exchange stream
      -> detectors -> findings -> attribution -> SQLite -> reporters
```

## 5. Testing strategy

**Detectors** are pure, so they are unit-tested directly with no transcripts
involved. TDD applies: a detector's test is written before it exists.

**Readers** are tested against committed fixture transcripts, including
deliberately malformed and unknown-type records, asserting the skip-and-count
behavior rather than a crash.

**Attribution** is tested on a fixture where the same secret arrives by three
different routes, asserting three distinct attributions and one grouped finding.

**Store** is tested on the invariant that matters: no raw value from a finding
appears anywhere in the database file. The test reads the file bytes and searches
for the plaintext. It fails loudly if the invariant breaks.

**Network isolation** is asserted in CI: the test suite fails if any outbound
socket is opened.

**The corpus eval** is the headline gate — see §6.

## 6. The corpus, and the number

`corpus/` holds synthetic transcripts in both vendor formats, each labelled with
the sensitive values planted in it, plus clean transcripts that must produce zero
findings. All synthetic — no real transcript and no real credential enters this
repo.

The eval runs every detector over the corpus and reports **precision and recall
per category**, plus a confusion matrix. It runs in CI as its own job. A change
that drops recall below the committed baseline fails the build.

Publishing where detection is weak is part of the deliverable. Anyone can claim
a scanner works; publishing its confusion matrix is the part that reads as
senior.

## 7. Non-functional constraints

- **Speed:** a single project scan completes in under 10 seconds; a full-history
  scan of ~1700 sessions in under two minutes. Incremental by default — sessions
  already scanned are skipped by content hash.
- **Locality:** zero network calls, enforced by test.
- **Safety:** Outbound only ever reads. It never edits, moves, or deletes a
  transcript, and it never writes into the scanned project.
- **Failure mode:** an unreadable or malformed session is skipped and counted,
  never fatal.

## 8. Stack

TypeScript, Node 22. `better-sqlite3` for the store, Vitest for tests, no
runtime framework — this is a CLI that reads files. The HTML report is a single
self-contained file with inlined CSS, no build step.

Distributed as an npm package with a `bin`, runnable via `npx outbound`.

## 9. Scope

**In v1:** Claude Code and Codex readers, deterministic and heuristic detectors,
attribution with recurrence grouping, SQLite store, terminal + HTML + JSON
reports, the `/outbound` skill, the corpus and its CI gate.

**Explicitly not in v1:** the live proxy for arbitrary apps (§10), the
local-model contextual detector, Cursor/Copilot/Windsurf readers, redaction or
rewriting of transcripts, team or multi-machine aggregation, cloud hosting,
scheduled or background scanning, policy configuration languages, alerting.

## 10. Phase 2 (documented so the architecture leaves room)

A live proxy that sits between an arbitrary app and its provider, emitting the
same `Exchange` records into the same detector and reporting pipeline. The
reader interface in §3.1 exists partly to make this a new source rather than a
rewrite. Not built in v1, and not promised in the README until it is.

## 11. Risks

| Risk | Handling |
|---|---|
| Transcript formats are undocumented and will change | Adapters skip unknown records and count them; the count is reported. Fixture tests pin the formats observed at spec time |
| False positives make the report noise and it gets ignored | Measured, not guessed — corpus reports precision per category; low-precision detectors ship off by default |
| The store becomes the leak | Tested invariant: plaintext search over the raw database file |
| A user runs it and finds nothing, concluding it is broken | Report always states what was scanned: session count, exchange count, skipped records. An empty result must be legibly empty |
| Reporting on real transcripts risks displaying live secrets on screen | Everything is redacted at the reporter boundary, never at the display layer, so no code path can print a raw value |
| Scope creep into a platform | §9 non-goals are normative; the proxy is §10 and stays there |
