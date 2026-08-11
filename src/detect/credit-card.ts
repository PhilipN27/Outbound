import { makeFinding, type Finding } from "./finding.js";

// The leading lookbehind excludes '.' so digit runs inside decimal fractions
// (0.4111111111111111 in ML model dumps) never become candidates; the
// trailing one keeps '.' legal so sentence-final cards still match.
const CANDIDATE_RE = /(?<![\d.-])(?:\d[ -]?){12,18}\d(?![\d-])/g;

// Issuer prefix -> allowed lengths. A Luhn check alone still passes 1 in 10
// random digit runs; requiring a known issuer range kills timestamps and ids.
const ISSUERS: Array<{ re: RegExp; lengths: number[] }> = [
  { re: /^4/, lengths: [13, 16] },
  { re: /^5[1-5]/, lengths: [16] },
  { re: /^2(2[2-9]\d|[3-6]\d\d|7[01]\d|720)/, lengths: [16] },
  { re: /^3[47]/, lengths: [15] },
  { re: /^(6011|65)/, lengths: [16] },
  { re: /^35/, lengths: [16] }
];

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectCreditCard(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(CANDIDATE_RE)) {
    // Real cards group as 4-4-4-4 or 4-6-5; a run of single spaced digits is
    // a lookup table, whatever Luhn says.
    if (m[0].split(/[ -]/).some((group) => group.length > 0 && group.length < 4)) continue;
    const digits = m[0].replace(/[ -]/g, "");
    const issuer = ISSUERS.find((i) => i.re.test(digits));
    if (!issuer || !issuer.lengths.includes(digits.length)) continue;
    if (!luhnValid(digits)) continue;
    findings.push(
      makeFinding({
        category: "credit-card",
        severity: "high",
        detector: "credit-card",
        confidence: 0.85,
        text,
        start: m.index,
        end: m.index + m[0].length
      })
    );
  }
  return findings;
}
