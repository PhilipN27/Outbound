# Outbound — design spec

**Date:** 2026-08-10
**Status:** approved (design), not yet implemented

> See what your prompts are giving away, before they leave the machine.

---

## 1. Problem

Every call an app makes to a frontier model ships a payload to somebody else's
server. Nobody looks at those payloads. In practice they carry customer names,
email addresses, internal identifiers, salary figures, health details, API keys
pasted into a debugging prompt, and whole rows of production data swept in by a
"here's the context" template.

Existing tooling does not cover this. Secret scanners (gitleaks, trufflehog)
read *source code at rest* and look for credentials. DLP products watch email
and file shares. Neither inspects the live request body going to
`api.openai.com`. The gap is specific: **outbound LLM traffic is unexamined**.

The audience feels it as a vague unease ("we probably shouldn't be sending
that") with no number attached. Outbound attaches the number.

## 2. What it is

A local proxy that sits between an app and its LLM provider. The user changes
one environment variable. Every prompt passes through, is inspected for
sensitive data, and appears on a local dashboard with a category, a severity,
and a running exposure count.

### Success criteria

1. Point an existing app at Outbound by changing one env var; the app behaves
   identically — same responses, streaming intact, no user-visible latency.
2. Send a prompt containing a planted email address, card number, and API key;
   all three appear on the dashboard within a second, categorized.
3. Send a hundred clean prompts; the dashboard stays quiet (measured false
   positive rate, not a vibe).
4. The corpus eval reports precision and recall per category, and CI fails if
   recall regresses.
5. Nothing Outbound handles is transmitted anywhere. Verifiable by running the
   whole thing with the network disabled except the upstream provider call.

## 3. Architecture

Five units, each independently testable.

### 3.1 Proxy (`src/proxy/`)

An HTTP server exposing OpenAI- and Anthropic-compatible routes. Responsibilities:

- Forward the request upstream unchanged and relay the response byte-identically,
  including SSE streaming.
- Emit the captured request body to the inspection pipeline **off the request
  path** (fire-and-forget), so inspection latency can never reach the caller.
- Pass upstream errors through untouched. Outbound must never turn a working app
  into a broken one.

**Hard constraint:** the proxy is a dumb pipe by default. All intelligence lives
downstream of the response.

Dependencies: none beyond the HTTP layer. Knows nothing about detectors.

### 3.2 Detectors (`src/detect/`)

Pure functions: `(text: string) => Finding[]`. No I/O, no state. Two layers.

**Deterministic detectors** — for data with a shape. API keys (provider-specific
prefixes plus Shannon entropy), emails, phone numbers, credit card numbers
(Luhn-validated, not just 16 digits), JWTs, AWS access keys, IBANs, US SSNs.
These are high precision and carry the demo.

**Contextual detector** — a local model via Ollama, prompted to flag spans that
regex cannot catch: person names, health information, compensation figures,
customer identifiers, internal project codenames. Returns spans with a
confidence. Degrades cleanly: if Ollama is absent, Outbound runs deterministic
detectors only and says so in the UI rather than silently under-reporting.

A `Finding` carries: category, severity, byte range, a **redacted** excerpt, the
detector that fired, and a confidence.

### 3.3 Store (`src/store/`)

SQLite, one file, created on first run.

**Invariant: raw sensitive values are never written to disk.** The store holds
redacted excerpts (`sk-ab...9f`) and a salted hash of the raw value for dedup
and recurrence counting. A leak scanner that accumulates a database of everyone's
leaked secrets is a worse product than no scanner.

Schema: `requests` (timestamp, provider, model, route, byte size, latency) and
`findings` (request id, category, severity, redacted excerpt, value hash,
detector, confidence).

### 3.4 Dashboard (`src/web/`)

A local React page served by the proxy process. Shows:

- Live feed of requests as they happen, findings attached.
- Exposure score — a single headline number, defined in §6.
- Breakdown by category and by provider.
- Recurrence: which values leak repeatedly, by hash, so a systemic leak is
  distinguishable from a one-off.

No auth, no accounts, localhost only. This is a single-machine developer tool.

### 3.5 Redaction mode (`--redact`, off by default)

Replaces detected values with stable placeholders (`<EMAIL_1>`) before
forwarding upstream. This is what converts Outbound from a report into a
control.

It ships **opt-in** because it is the one feature that can break a working app:
if the model genuinely needs the real value, redacting it changes the answer.
Default-off keeps the "changing one env var is safe" promise intact.

When enabled it moves inspection onto the request path, and the latency budget
in §7 applies.

## 4. Data flow

```
app --> proxy --> upstream provider
          |
          +--> (async) detectors --> findings --> SQLite --> dashboard (SSE)
```

With `--redact`, detection moves inline between proxy and upstream.

## 5. Testing strategy

**Detectors** are pure, so they are unit-tested directly with no proxy running.
TDD applies: a detector's test is written before it exists.

**Proxy** gets contract tests against a stub upstream: streamed responses arrive
byte-identical, chunk boundaries preserved, upstream 4xx/5xx pass through
unchanged, upstream timeouts do not hang the client.

**Store** is tested on the invariant that matters: no raw value from a finding
appears anywhere in the database file. This test reads the file bytes and
searches for the plaintext. It fails loudly if the invariant breaks.

**The corpus eval** is the headline gate — see §6.

## 6. The corpus, and the number

`corpus/` holds a few hundred synthetic prompts, each labelled with the
sensitive spans planted in it, plus a set of clean prompts that must produce
zero findings. All synthetic — no real personal data enters this repo.

The eval runs every detector over the corpus and reports **precision and recall
per category**, plus a confusion matrix. It runs in CI as its own job. A change
that drops recall below the committed baseline fails the build.

The **exposure score** shown in the dashboard is defined here so it cannot drift
into meaninglessness: a weighted count of findings per hundred requests,
weighted by severity. It is a relative trend indicator, not a risk rating, and
the UI says so.

Publishing where detection is weak — names are genuinely hard — is part of the
deliverable, not an embarrassment to hide.

## 7. Non-functional constraints

- **Latency:** in default (async) mode, added latency is bounded by proxying
  overhead only, target under 10ms. In `--redact` mode, detection is inline;
  target under 150ms added, measured and reported.
- **Locality:** no outbound network calls except the upstream provider request
  the app already intended to make. The Ollama call is localhost.
- **Failure mode:** every Outbound failure degrades to plain proxying. A crashed
  detector, a missing Ollama, or a full disk must never break the user's app.

## 8. Stack

TypeScript throughout. Node 22, Fastify for the proxy, `better-sqlite3`, React
plus Vite for the dashboard, Vitest for tests, Ollama for the contextual
detector. Single package, no monorepo — the repo is small enough that a
workspace would be ceremony.

## 9. Scope

**In v1:** OpenAI- and Anthropic-compatible routes, the two detector layers,
SQLite store, dashboard, opt-in redaction, the corpus and its CI gate.

**Explicitly not in v1:** multi-user or team dashboards, authentication, cloud
hosting, CI/CD integration for other people's pipelines, a browser extension,
providers beyond OpenAI/Anthropic shapes, policy configuration languages,
alerting or webhooks, historical retention policies.

## 10. Risks

| Risk | Handling |
|---|---|
| False positives make it annoying and it gets uninstalled | Measured, not guessed — corpus reports precision per category; low-precision detectors ship off by default |
| Person-name detection is weak | Expected; published as a number rather than hidden. Names are the honest hard case |
| Streaming subtly breaks and nobody notices until a real app misbehaves | Byte-identical contract tests on the proxy, with chunk-boundary assertions |
| The store itself becomes the leak | Tested invariant: plaintext search over the raw database file |
| Ollama absent on a reviewer's machine | Deterministic detectors run standalone; the UI states which layers are active |
| Scope creep into a "platform" | §9 non-goals are normative |
