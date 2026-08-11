import { makeFinding, type Finding } from "./finding.js";

const HEADER_RE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g;

// A transcript often carries a key truncated mid-block (context limits, tool
// output caps). The header alone is already the finding.
export function detectPrivateKey(text: string): Finding[] {
  const findings: Finding[] = [];
  HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADER_RE.exec(text)) !== null) {
    const header = m[0];
    const start = m.index;
    const endMarker = header.replace("BEGIN", "END");
    const endIdx = text.indexOf(endMarker, start + header.length);
    let end: number;
    if (endIdx !== -1) {
      end = endIdx + endMarker.length;
    } else {
      const nextHeader = text.indexOf("-----BEGIN", start + header.length);
      end = nextHeader === -1 ? text.length : nextHeader;
    }
    findings.push(
      makeFinding({
        category: "private-key",
        severity: "critical",
        detector: "private-key",
        confidence: 1,
        text,
        start,
        end,
        safeExcerpt: header
      })
    );
    HEADER_RE.lastIndex = end;
  }
  return findings;
}
