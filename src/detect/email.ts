import { makeFinding, type Finding } from "./finding.js";

const EMAIL_RE =
  /(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![A-Za-z0-9-])/g;

// git@github.com-style remotes are the single most common email lookalike in
// a coding transcript. example.* domains are documentation placeholders.
const EXCLUDED_LOCAL_PARTS = new Set(["git", "noreply", "no-reply", "donotreply", "do-not-reply"]);
const EXCLUDED_DOMAIN_RE = /(^|\.)example\.(com|org|net)$|(^|\.)invalid$|(^|\.)test$/i;

export function detectEmail(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(EMAIL_RE)) {
    const [, local, domain] = m as unknown as [string, string, string];
    if (EXCLUDED_LOCAL_PARTS.has(local.toLowerCase())) continue;
    if (EXCLUDED_DOMAIN_RE.test(domain)) continue;
    findings.push(
      makeFinding({
        category: "email",
        severity: "low",
        detector: "email",
        confidence: 0.8,
        text,
        start: m.index,
        end: m.index + m[0].length
      })
    );
  }
  return findings;
}
