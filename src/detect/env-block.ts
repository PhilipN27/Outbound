import { shannonEntropy } from "./entropy.js";
import { makeFinding, type Finding } from "./finding.js";

const ASSIGNMENT_RE = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]{1,63})\s*=\s*(.*)$/;
const COMMENT_RE = /^\s*#/;
const SECRET_KEY_NAME_RE = /(SECRET|TOKEN|KEY|PASS|PWD|CREDENTIAL|AUTH)/;

const MIN_ASSIGNMENTS = 3;
const MIN_VALUE_LENGTH = 12;
const MIN_ENTROPY_BITS = 3;
const MAX_KEYS_IN_EXCERPT = 8;

const PLACEHOLDER_VALUE_RE = /[<>{}$]|your[-_]?|changeme|change-me|example|xxxx|\.\.\./i;

function isSecretEvidence(key: string, rawValue: string): boolean {
  if (!SECRET_KEY_NAME_RE.test(key)) return false;
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (value.length < MIN_VALUE_LENGTH) return false;
  if (PLACEHOLDER_VALUE_RE.test(value)) return false;
  return shannonEntropy(value) >= MIN_ENTROPY_BITS;
}

interface Line {
  text: string;
  start: number;
}

function splitWithOffsets(text: string): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    lines.push({ text: line, start: offset });
    offset += line.length + 1;
  }
  return lines;
}

// A run of KEY=value lines is one finding for the block — reading a .env file
// is one event, not one event per variable.
export function detectEnvBlock(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = splitWithOffsets(text);

  let i = 0;
  while (i < lines.length) {
    const first = ASSIGNMENT_RE.exec(lines[i]!.text);
    if (!first) {
      i++;
      continue;
    }
    const keys: string[] = [];
    let hasEvidence = false;
    let lastAssignment = i;
    let j = i;
    while (j < lines.length) {
      const m = ASSIGNMENT_RE.exec(lines[j]!.text);
      if (m) {
        keys.push(m[1]!);
        if (isSecretEvidence(m[1]!, m[2]!)) hasEvidence = true;
        lastAssignment = j;
        j++;
      } else if (COMMENT_RE.test(lines[j]!.text)) {
        j++;
      } else {
        break;
      }
    }
    if (keys.length >= MIN_ASSIGNMENTS && hasEvidence) {
      const start = lines[i]!.start + lines[i]!.text.indexOf(first[1]!);
      const endLine = lines[lastAssignment]!;
      const end = endLine.start + endLine.text.length;
      const shown = keys.slice(0, MAX_KEYS_IN_EXCERPT).join(", ");
      findings.push(
        makeFinding({
          category: "env-block",
          severity: "high",
          detector: "env-block",
          confidence: 0.7,
          text,
          start,
          end,
          safeExcerpt: `env block, ${keys.length} keys: ${shown}`
        })
      );
    }
    i = j > i ? j : i + 1;
  }
  return findings;
}
