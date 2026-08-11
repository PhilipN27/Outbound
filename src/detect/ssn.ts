import { makeFinding, type Finding } from "./finding.js";

// Dashed form only. A bare 9-digit run is indistinguishable from a phone
// number or an id, so it does not count (documented in corpus).
const SSN_RE = /(?<![\d-])(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?![\d-])/g;

export function detectSsn(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(SSN_RE)) {
    findings.push(
      makeFinding({
        category: "ssn",
        severity: "high",
        detector: "ssn",
        confidence: 0.85,
        text,
        start: m.index,
        end: m.index + m[0].length
      })
    );
  }
  return findings;
}
