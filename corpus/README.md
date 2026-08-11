# The corpus, and the number

Synthetic labelled transcripts in both vendor formats plus clean transcripts
that must produce zero findings. `pnpm eval` runs every detector over them and
gates CI on the committed baselines in `baselines.json`. Regenerate the
transcripts with `node corpus/generate.mjs`. **Everything here is synthetic —
no real transcript and no real credential.**

## Current numbers (2026-08-10)

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

The three recall misses are deliberate plants of shapes Outbound knowingly
does not detect (below). They stay in the corpus so the number cannot flatter.

## Where Outbound is deliberately narrower

Each of these is a decision, not an accident. The corpus contains a planted
example of every one, counted against recall.

- **Undashed SSNs** (`078051120`): a bare 9-digit run is indistinguishable
  from phone numbers, zip+4 fragments, and ids. Dashed form only.
- **Bare 10-digit phone numbers** (`6285550109`): matching these fires on
  timestamps and ids constantly. Formatted and E.164 shapes only.
- **Context-free AWS secret keys**: 40 base64 chars with no distinguishing
  prefix would fire on every git SHA and content hash. A candidate counts only
  next to a `secret_access_key`-style keyword.

Compared with published rule sets:

- **gitleaks** ships 150+ provider-specific rules (Stripe, Twilio, SendGrid,
  npm, PyPI, …) plus a generic high-entropy rule. Outbound v1 carries a
  curated prefix table (Anthropic, OpenAI-style `sk-`, Stripe `sk_live_`,
  GitHub, GitLab, Slack, Google `AIza`) and **no generic entropy rule** —
  transcripts are far noisier than source code, and the generic rule is where
  secret scanners drown. Missing providers are added by extending the table,
  with a corpus plant per prefix.
- **trufflehog** verifies candidate credentials by calling the provider.
  Outbound never will: no network calls is invariant #1.

## Hard negatives

`fixtures/hard-negatives.txt` is the block of strings that look like secrets
and are not: UUIDs, git SHAs, content hashes, package-lock integrity strings,
base64 image data, vendor-doc placeholder credentials (`sk-example`,
`AKIAIOSFODNN7EXAMPLE`, …), public key material, credential-free connection
strings, dates/IPs/versions, and email lookalikes (`git@github.com`,
`user@example.com`, `noreply@`). It is enforced twice: every detector runs
over it in the unit suite, and it arrives as a file-read inside the clean
transcripts here.

## Scoring

Count-based per (file, category): planted n, found m ⇒ tp=min(n,m), with the
difference counted as fn or fp. A finding of the right category at a slightly
different span still counts — the eval measures detection, not offsets.
