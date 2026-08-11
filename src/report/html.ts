import type { GroupedFinding } from "../attribute/attribute.js";
import type { Severity } from "../detect/index.js";
import type { ScanReportData } from "../scan.js";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findingRow(f: GroupedFinding): string {
  const routes = f.routes
    .map((r) => `${esc(r.channel)} · ${esc(r.provenance)} · ${esc(r.timestamp.slice(0, 10))}`)
    .join("<br>");
  return `<tr class="sev-${f.severity}">
    <td class="sev">${f.severity}</td>
    <td>${esc(f.category)}</td>
    <td><code>${esc(f.excerpt)}</code></td>
    <td class="num">${f.recurrence}&times;</td>
    <td class="routes">${routes}</td>
  </tr>`;
}

const STYLE = `
  :root { color-scheme: light dark; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
  body { max-width: 64rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.2rem; letter-spacing: 0.02em; }
  .summary { color: color-mix(in srgb, currentColor 65%, transparent); margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); vertical-align: top; }
  td.num { text-align: right; }
  td.sev { text-transform: uppercase; font-weight: 700; font-size: 0.75rem; }
  tr.sev-critical td.sev { color: #c0392b; }
  tr.sev-high td.sev { color: #d35400; }
  tr.sev-medium td.sev { color: #b7950b; }
  tr.sev-low td.sev { color: color-mix(in srgb, currentColor 55%, transparent); }
  .empty { padding: 2rem 0; font-size: 1rem; }
  code { word-break: break-all; }
  .routes { color: color-mix(in srgb, currentColor 75%, transparent); }
`;

export function htmlReport(report: ScanReportData): string {
  const ordered = SEVERITY_ORDER.flatMap((sev) => report.findings.filter((f) => f.severity === sev));
  const body =
    ordered.length === 0
      ? `<p class="empty">No sensitive data found.</p>`
      : `<table>
          <thead><tr><th>severity</th><th>category</th><th>redacted value</th><th>seen</th><th>how it reached the provider</th></tr></thead>
          <tbody>${ordered.map(findingRow).join("\n")}</tbody>
        </table>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outbound report — ${esc(report.projectPath ?? "all projects")}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Outbound — ${esc(report.projectPath ?? "all projects")}</h1>
<p class="summary">
  ${esc(report.scannedAt)} —
  ${report.sessions.total} sessions (${report.sessions.scanned} new, ${report.sessions.skippedUnchanged} unchanged),
  ${report.exchanges} exchanges this run,
  skipped records: ${report.skipped.malformedLines} malformed, ${report.skipped.unknownRecords} unknown.
</p>
${body}
</body>
</html>
`;
}
