# Outbound v1 — implementation plan

Spec: `docs/superpowers/specs/2026-08-10-outbound-design.md` (normative).
Working agreement: `CLAUDE.md`.

Phases are sequential; each ends with a real command run and its output shown.
No phase is "done" on inspection.

---

## Phase 0 — scaffold runs

Install dependencies and confirm the empty harness is green before any feature
work. This exists so that the first red test in Phase 1 is unambiguously about
the code and not about the setup.

**Oracle:** `pnpm check` exits 0 with zero tests.

---

## Phase 1 — detectors (pure, TDD)

The core value and the easiest thing to get wrong. Build these first because
they need no transcripts, no store, and no CLI.

Each detector is `(text: string) => Finding[]`, in its own file with its own
colocated test. Write the failing test first, in this order:

1. Provider API keys — `sk-`, `sk-ant-`, and similar prefixes, gated on Shannon
   entropy so `sk-example` and `sk-XXXXXXXX` do not fire.
2. AWS access key IDs (`AKIA`/`ASIA` + 16 chars) and secret access keys.
3. Private key blocks (`-----BEGIN ... PRIVATE KEY-----`).
4. JWTs — three base64url segments, with a decodable header.
5. Connection strings with embedded passwords (`postgres://user:pass@host`).
6. Emails, phone numbers, US SSNs.
7. Credit cards — **Luhn-validated**, not merely sixteen digits.

Then the heuristic layer:

8. `.env` file content — a run of `KEY=value` lines. Reports **one** finding for
   the block, not one per line.
9. Bulk personal data — a delimited block with an email or phone column reports
   one finding with a row count.

**Redaction is part of the Finding**, produced at construction. There is no
code path that yields a Finding carrying its raw value.

**Oracle per detector:** its unit test fails before the implementation exists and
passes after. **Phase oracle:** `pnpm test` green, and a hand-run of the detector
over a fixture string prints redacted findings.

**Watch for:** the classic secret-scanner failure is firing on every UUID and
base64 blob in the world. Precision is measured in Phase 5; if a detector cannot
clear a sensible bar there, it ships disabled by default rather than being
quietly loosened.

---

## Phase 2 — readers

One adapter per agent behind a shared interface, emitting the `Exchange` shape
from spec §3.1.

- **Claude Code** — `~/.claude/projects/<slug>/*.jsonl`, slug = project path with
  separators replaced by dashes (`C:\Users\dev\foo` → `C--Users-dev-foo`).
  Observed record types at spec time: `user`, `assistant`, `attachment`,
  `file-history-snapshot`, plus session metadata lines. Text lives under
  `message.content`, which is sometimes a string and sometimes an array of
  content blocks — handle both.
- **Codex** — `~/.codex/sessions/**/*.jsonl`.

Commit small fixture transcripts covering: a normal session, an unknown record
type, a malformed JSON line, an empty file, and a content array with tool
results.

**Oracle:** fixture tests assert the exact `Exchange` sequence, and assert that
the malformed and unknown records are *skipped and counted* rather than throwing.
Then run the reader against one real local session and print the exchange count —
real data, not just fixtures.

**Watch for:** the slug derivation is the piece most likely to be wrong on
Windows vs POSIX. Test both path shapes explicitly.

---

## Phase 3 — attribution and store

**Attribution** joins each Finding back to the Exchange that carried it and
records how the text arrived: a file read (with path), command output (with the
command), a pasted user prompt, a tool result. Findings group by a keyed
fingerprint of the raw value, carrying a recurrence count and the set of
distinct routes.

**Store** is SQLite: `scans`, `sessions`, `findings`, `occurrences`. A
fingerprint key is generated per install and stored outside SQLite.

**Oracle:** a fixture where the same secret arrives by three different routes
produces one grouped finding with three attributions and a recurrence count of
three. Plus the invariant test: write findings for a known secret, then read the
raw `.sqlite` file as bytes and assert the plaintext does not appear. That test
must fail if the invariant is deliberately broken — verify by breaking it once.

---

## Phase 4 — CLI and reporters

`outbound scan` — scans the current project by default; `--all` for full history;
`--json` and `--out report.html` for the other reporters.

The terminal report is the product surface. It must state what was scanned
(sessions, exchanges, records skipped) even when it finds nothing, so an empty
result is legibly empty.

Incremental by default: sessions already scanned are skipped by content hash.

**Oracle:** run `outbound scan` against a temp project containing a planted fake
AWS key that a fixture session "read" from a file. The report shows the key,
redacted, attributed to that file read. Then run it against the author's real
history and show the output — that run is the first real finding and belongs in
the README.

---

## Phase 5 — the corpus and the number

Synthetic labelled transcripts in both vendor formats, plus clean transcripts
that must produce zero findings. The eval computes precision and recall per
category and writes a confusion matrix. Baselines are committed; CI fails on
regression below them.

**Oracle:** `pnpm eval` prints the per-category table. The numbers go in the
README verbatim, including the categories that do badly.

---

## Phase 6 — the skill

`skill/outbound/SKILL.md` runs `outbound scan --json` and narrates the results.
It contains no detection logic. Someone who has never used a skill must get the
identical result from the CLI.

**Oracle:** invoke `/outbound` in a project with planted findings and confirm the
narration matches the CLI's JSON.

---

## Phase 7 — release

README rewritten with real output and real numbers. `npm publish` as
`outbound-scan` (the name `outbound` is taken; the binary is still `outbound`).
Tag v0.1.0.

**Do not start this phase until Phase 4's real-history run has actually been
looked at** — if scanning a year of real sessions surfaces nothing, that is the
finding, and the project's framing changes rather than shipping a tool that
reports nothing.

---

## Sequencing notes

- Phase 1 is independent of everything and is where the risk lives. Do not rush
  it to reach a demo.
- Phases 2 and 3 can overlap only after the `Exchange` shape is frozen.
- Phase 5 can begin as soon as Phase 1 lands; the corpus is what tells you
  whether the detectors are actually any good, so earlier is better.

## Verification, in place of a second model

No cross-model review is available for this build, and a second Claude reviewing
the first would carry no independent signal. The substitutes are empirical, and
they are stronger than an opinion anyway:

**Hard negatives are the real reviewer.** The corpus (§5) must contain a large
block of strings that look like secrets and are not: UUIDs, git SHAs, base64
image data, content hashes, lorem ipsum, `sk-example` / `AKIAIOSFODNN7EXAMPLE`
and the other placeholder credentials from vendor documentation, long random
identifiers from real package-lock files. Every one of these must produce zero
findings. Build this block *while* writing each detector, not after — a detector
written against only positive cases is always too loose.

**Cross-check against published rule sets.** gitleaks and trufflehog publish
their detection patterns. Compare coverage per category and note in the corpus
README where Outbound is narrower. Deliberately narrower is a decision;
accidentally narrower is a bug.

**Break the invariant test once, on purpose.** For the no-plaintext-on-disk test:
write a raw value to the store, confirm the test fails, then restore. A test that
has never failed has never been verified.

**Run against reality early.** After Phase 1, run the detectors over a large body
of ordinary text — `node_modules`, the repo's own source, a real transcript — and
count the findings. Anything above a trickle is a precision problem to fix before
building further on top of it.
