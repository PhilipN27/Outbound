import { shannonEntropy } from "./entropy.js";
import { makeFinding, type Finding } from "./finding.js";

const ACCESS_KEY_RE = /(?<![A-Za-z0-9])(AKIA|ASIA)[A-Z0-9]{16}(?![A-Za-z0-9])/g;

// Secret keys are 40 base64 chars with no distinguishing prefix, so a bare
// pattern would fire on every git SHA and content hash in the world. Only a
// candidate introduced by a secret-key keyword counts.
const SECRET_KEY_RE =
  /(secret[_-]?access[_-]?key|secretaccesskey)["']?\s*[:=]?\s*["']?([A-Za-z0-9/+]{40})(?![A-Za-z0-9/+=])/dgi;

const PURE_HEX_RE = /^[0-9a-f]+$/i;
const MIN_ENTROPY_BITS = 3.5;

export function detectAws(text: string): Finding[] {
  const findings: Finding[] = [];

  for (const m of text.matchAll(ACCESS_KEY_RE)) {
    if (m[0].includes("EXAMPLE")) continue;
    findings.push(
      makeFinding({
        category: "aws-access-key-id",
        severity: "critical",
        detector: "aws",
        confidence: 0.95,
        text,
        start: m.index,
        end: m.index + m[0].length
      })
    );
  }

  for (const m of text.matchAll(SECRET_KEY_RE)) {
    const value = m[2]!;
    if (value.includes("EXAMPLE")) continue;
    if (PURE_HEX_RE.test(value)) continue; // 40 hex chars is a SHA, not an AWS secret
    if (shannonEntropy(value) < MIN_ENTROPY_BITS) continue;
    const [start, end] = m.indices![2]!;
    findings.push(
      makeFinding({
        category: "aws-secret-access-key",
        severity: "critical",
        detector: "aws",
        confidence: 0.9,
        text,
        start,
        end
      })
    );
  }

  return findings.sort((a, b) => a.start - b.start);
}
