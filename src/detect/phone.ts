import { makeFinding, type Finding } from "./finding.js";

// Two deliberate shapes only. Bare 10-digit runs are not matched — the false
// positive rate on ordinary logs makes them worthless (documented in corpus).
const INTL_RE = /(?<!\d)\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)/g;
const US_RE = /(?<![\d.-])(?:\(\d{3}\)[\s.-]?|\d{3}[-.])\d{3}[-.]\d{4}(?![\d-])/g;

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export function detectPhone(text: string): Finding[] {
  const findings: Finding[] = [];
  const claimed: Array<[number, number]> = [];
  for (const re of [INTL_RE, US_RE]) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      const digits = digitCount(m[0]);
      if (digits < MIN_DIGITS || digits > MAX_DIGITS) continue;
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      claimed.push([start, end]);
      findings.push(
        makeFinding({
          category: "phone",
          severity: "low",
          detector: "phone",
          confidence: 0.6,
          text,
          start,
          end
        })
      );
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}
