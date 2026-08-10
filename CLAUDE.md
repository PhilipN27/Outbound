# Outbound — project context

Read `docs/superpowers/specs/2026-08-10-outbound-design.md` before writing code.
It is the normative design; this file is the working agreement.

## What this is

A CLI that reads Claude Code and Codex session transcripts from disk and reports
credentials and personal data that were sent to the model provider. A
`/outbound` skill wraps it as a front door. No proxy, no network, no config.

## Invariants — enforced by tests, never relaxed for convenience

1. **No network calls.** Outbound never opens a socket. If a dependency wants
   one, it is the wrong dependency.
2. **No raw secrets on disk.** The store holds redacted excerpts and salted
   hashes only. There is a test that reads the raw SQLite file and searches for
   plaintext; it must stay passing.
3. **Read-only.** Never edit, move, or delete a transcript. Never write into the
   project being scanned. Outbound's own state lives in its own directory.
4. **Redaction at the boundary.** Values are redacted where they leave the
   detector, not where they are displayed, so no code path can print a raw
   secret.
5. **Degrade, never crash.** Unknown or malformed transcript records are skipped
   and counted, and the count appears in the report. Transcript formats are
   undocumented and will change.

## How to work here

- **TDD.** Detectors and readers are pure or near-pure — write the failing test
  first. A test that has not failed against the broken state has not been
  verified.
- **Evidence over assertion.** "It works" means a command was run and its output
  shown. A green build proves it builds.
- **Fixtures, never real transcripts.** No real session file and no real
  credential enters this repo. The corpus is synthetic.
- **Scope.** §9 of the spec is normative. The live proxy is phase 2 and stays
  there. Do not add a feature because it seems small.

## Layout

```
src/read/       transcript adapters (claude-code, codex) -> Exchange stream
src/detect/     pure detectors: (text) => Finding[]
src/attribute/  join findings back to how they reached the provider
src/store/      SQLite; redacted excerpts + salted hashes only
src/report/     terminal, HTML, JSON reporters
skill/          the /outbound skill (thin wrapper over the CLI)
corpus/         synthetic labelled transcripts + the precision/recall eval
```

## Commands

```
pnpm test     unit tests
pnpm eval     corpus precision/recall gate
pnpm check    lint + build + test + eval
```
