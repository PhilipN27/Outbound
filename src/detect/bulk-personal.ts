import { makeFinding, type Finding } from "./finding.js";

const DELIMITERS = [",", "\t", ";"] as const;
const MIN_BLOCK_LINES = 6; // header + five data rows
const MIN_MATCHING_ROWS = 5;
const MIN_COLUMN_RATIO = 0.8;

const EMAIL_FIELD_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_FIELD_RE = /^\+?[\d\s().-]{7,20}$/;

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

function fieldKind(field: string): "email" | "phone" | null {
  const v = field.trim();
  if (EMAIL_FIELD_RE.test(v)) return "email";
  if (PHONE_FIELD_RE.test(v) && (v.match(/\d/g) ?? []).length >= 7) return "phone";
  return null;
}

// Fifty emails in a CSV dump are one leak event, not fifty. The block is
// reported once with its row count; individual matches inside it are
// suppressed by runDetectors.
export function detectBulkPersonal(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = splitWithOffsets(text);

  for (const delim of DELIMITERS) {
    let i = 0;
    while (i < lines.length) {
      const width = lines[i]!.text.split(delim).length;
      if (width < 2) {
        i++;
        continue;
      }
      let j = i;
      while (j < lines.length && lines[j]!.text.split(delim).length === width) j++;
      const blockLen = j - i;
      if (blockLen >= MIN_BLOCK_LINES) {
        const rows = lines.slice(i, j).map((l) => l.text.split(delim));
        const dataRows = rows.slice(1); // first line is usually a header
        for (let col = 0; col < width; col++) {
          const kinds = dataRows.map((r) => fieldKind(r[col] ?? ""));
          const emails = kinds.filter((k) => k === "email").length;
          const phones = kinds.filter((k) => k === "phone").length;
          const best = emails >= phones ? ("email" as const) : ("phone" as const);
          const count = Math.max(emails, phones);
          if (count >= MIN_MATCHING_ROWS && count >= dataRows.length * MIN_COLUMN_RATIO) {
            const start = lines[i]!.start;
            const endLine = lines[j - 1]!;
            findings.push(
              makeFinding({
                category: "bulk-personal-data",
                severity: "high",
                detector: "bulk-personal",
                confidence: 0.8,
                text,
                start,
                end: endLine.start + endLine.text.length,
                safeExcerpt: `delimited block: ${count} rows with ${best} column`
              })
            );
            break; // one finding per block, even with several personal columns
          }
        }
      }
      i = j;
    }
  }
  return findings.sort((a, b) => a.start - b.start);
}
