import type { GroupedFinding } from "../attribute/attribute.js";
import type { Severity } from "../detect/index.js";
import type { ScanReportData } from "../scan.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

// Low-severity findings (emails, phones) are counted per category rather than
// itemized — fifteen-second readability beats completeness here; --json has
// every detail.
const ITEMIZED = new Set<Severity>(["critical", "high", "medium"]);

// Transcript metadata is attacker-controlled. Render terminal controls and
// bidirectional overrides visibly so they cannot alter the surrounding report.
const TERMINAL_UNSAFE_RE =
  // eslint-disable-next-line no-control-regex -- matching terminal controls is the security boundary
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu;

function terminalSafe(value: string): string {
  return value.replace(TERMINAL_UNSAFE_RE, (character) => {
    if (character === "\n") return "\\n";
    if (character === "\r") return "\\r";
    if (character === "\t") return "\\t";
    const codePoint = character.codePointAt(0)!;
    return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  });
}

function day(iso: string): string {
  return terminalSafe(iso.slice(0, 10));
}

function describeRoutes(f: GroupedFinding): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const r of f.routes) {
    const key = `${r.channel} ${r.provenance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`${terminalSafe(r.channel)} ${terminalSafe(r.provenance)}`);
  }
  const shown = parts.slice(0, 3).join("  ·  ");
  const more = parts.length > 3 ? `  (+${parts.length - 3} more routes)` : "";
  return shown + more;
}

export function terminalReport(report: ScanReportData): string {
  const lines: string[] = [];
  const scope = terminalSafe(report.projectPath ?? "all projects");
  lines.push(`Outbound — ${scope}`);
  lines.push(
    `  scanned ${report.sessions.total} sessions ` +
      `(${report.sessions.scanned} new, ${report.sessions.skippedUnchanged} unchanged), ` +
      `${report.exchanges} exchanges this run`
  );
  lines.push(
    `  skipped records: ${report.skipped.malformedLines} malformed, ${report.skipped.unknownRecords} unknown`
  );
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("No sensitive data found.");
    return lines.join("\n");
  }

  for (const severity of SEVERITY_ORDER) {
    const group = report.findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    lines.push(`${severity.toUpperCase()} (${group.length})`);
    if (ITEMIZED.has(severity)) {
      for (const f of group) {
        lines.push(
          `  ${terminalSafe(f.category).padEnd(22)} ${terminalSafe(f.excerpt).padEnd(18)} ${f.recurrence}×`
        );
        lines.push(`      via ${describeRoutes(f)}`);
        lines.push(
          `      first ${day(f.firstSeen)} · last ${day(f.lastSeen)} · ` +
            `${new Set(f.routes.map((r) => r.sessionId)).size} session(s)`
        );
      }
    } else {
      const byCategory = new Map<string, number>();
      for (const f of group) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
      lines.push(
        "  " +
          [...byCategory.entries()].map(([c, n]) => `${terminalSafe(c)} ×${n}`).join(", ") +
          "   (details with --json)"
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
