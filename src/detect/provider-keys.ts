import { shannonEntropy } from "./entropy.js";
import { makeFinding, type Finding } from "./finding.js";

// Known provider key prefixes. minBody is the minimum length of the random
// part after the prefix; anything shorter is documentation, not a credential.
interface PrefixRule {
  prefix: string;
  minBody: number;
  confidence: number;
}

const RULES: PrefixRule[] = [
  { prefix: "github_pat_", minBody: 22, confidence: 0.95 },
  { prefix: "sk-ant-", minBody: 24, confidence: 0.95 },
  { prefix: "sk_live_", minBody: 20, confidence: 0.95 },
  { prefix: "sk_test_", minBody: 20, confidence: 0.8 },
  { prefix: "glpat-", minBody: 20, confidence: 0.9 },
  { prefix: "xoxb-", minBody: 20, confidence: 0.9 },
  { prefix: "xoxp-", minBody: 20, confidence: 0.9 },
  { prefix: "xoxa-", minBody: 20, confidence: 0.9 },
  { prefix: "xoxs-", minBody: 20, confidence: 0.9 },
  { prefix: "ghp_", minBody: 36, confidence: 0.95 },
  { prefix: "gho_", minBody: 36, confidence: 0.9 },
  { prefix: "ghu_", minBody: 36, confidence: 0.9 },
  { prefix: "ghs_", minBody: 36, confidence: 0.9 },
  { prefix: "ghr_", minBody: 36, confidence: 0.9 },
  { prefix: "AIza", minBody: 35, confidence: 0.9 },
  { prefix: "sk-", minBody: 20, confidence: 0.85 }
];

const MIN_ENTROPY_BITS = 3.5;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectProviderKeys(text: string): Finding[] {
  const findings: Finding[] = [];
  const claimed: Array<[number, number]> = [];
  const rules = [...RULES].sort((a, b) => b.prefix.length - a.prefix.length);

  for (const rule of rules) {
    const re = new RegExp(
      `(?<![A-Za-z0-9_-])${escapeRegExp(rule.prefix)}([A-Za-z0-9_-]{${rule.minBody},})`,
      "g"
    );
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      if (shannonEntropy(m[1]!) < MIN_ENTROPY_BITS) continue;
      claimed.push([start, end]);
      findings.push(
        makeFinding({
          category: "provider-api-key",
          severity: "critical",
          detector: "provider-keys",
          confidence: rule.confidence,
          text,
          start,
          end
        })
      );
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}
