import { describe, expect, test } from "vitest";
import type { ScanReportData } from "../scan.js";
import { htmlReport } from "./html.js";
import { jsonReport } from "./json.js";
import { terminalReport } from "./terminal.js";

const emptyReport: ScanReportData = {
  scannedAt: "2026-08-10T21:00:00.000Z",
  projectPath: "C:\\proj\\demo",
  sessions: { total: 2, scanned: 1, skippedUnchanged: 1 },
  exchanges: 347,
  skipped: { malformedLines: 1, unknownRecords: 2 },
  findings: []
};

const withFindings: ScanReportData = {
  ...emptyReport,
  findings: [
    {
      valueHash: "ab".repeat(32),
      category: "aws-access-key-id",
      severity: "critical",
      detector: "aws",
      confidence: 0.95,
      excerpt: "AKIA...F2Q",
      recurrence: 3,
      routes: [
        {
          channel: "file-read",
          provenance: "C:\\proj\\demo\\.env",
          sessionId: "s1",
          timestamp: "2026-08-01T10:00:03.000Z",
          projectPath: "C:\\proj\\demo"
        },
        {
          channel: "command-output",
          provenance: "printenv <script>alert(1)</script>",
          sessionId: "s2",
          timestamp: "2026-08-02T09:00:00.000Z",
          projectPath: "C:\\proj\\demo"
        }
      ],
      firstSeen: "2026-08-01T10:00:03.000Z",
      lastSeen: "2026-08-02T09:00:00.000Z"
    },
    {
      valueHash: "cd".repeat(32),
      category: "email",
      severity: "low",
      detector: "email",
      confidence: 0.8,
      excerpt: "jane....uk",
      recurrence: 1,
      routes: [
        {
          channel: "user-prompt",
          provenance: "user",
          sessionId: "s1",
          timestamp: "2026-08-01T10:00:01.000Z",
          projectPath: "C:\\proj\\demo"
        }
      ],
      firstSeen: "2026-08-01T10:00:01.000Z",
      lastSeen: "2026-08-01T10:00:01.000Z"
    }
  ]
};

describe("terminalReport", () => {
  test("an empty result is legibly empty: it states what was scanned", () => {
    const out = terminalReport(emptyReport);
    expect(out).toContain("No sensitive data found");
    expect(out).toContain("2 sessions");
    expect(out).toContain("347 exchanges");
    expect(out).toContain("1 malformed");
    expect(out).toContain("2 unknown");
  });

  test("findings group by severity with redacted excerpt and attribution", () => {
    const out = terminalReport(withFindings);
    expect(out).toContain("CRITICAL");
    expect(out).toContain("AKIA...F2Q");
    expect(out).toContain("3\u00d7"); // recurrence count
    expect(out).toContain("file-read");
    expect(out).toContain(".env");
    expect(out.indexOf("CRITICAL")).toBeLessThan(out.indexOf("LOW"));
  });

  test("low severity findings are counted, not itemized", () => {
    const out = terminalReport(withFindings);
    expect(out).toContain("email");
    expect(out).not.toContain("jane....uk");
  });

  test("renders transcript-controlled terminal characters as inert text", () => {
    const hostile: ScanReportData = {
      ...withFindings,
      projectPath: "C:\\proj\\demo\u001b]0;forged title\u0007",
      findings: [
        {
          ...withFindings.findings[0]!,
          excerpt: "AKIA...F2Q\u202e",
          routes: [
            {
              ...withFindings.findings[0]!.routes[0]!,
              provenance: "\u001b]8;;https://attacker.invalid\u0007CLICK\u001b]8;;\u0007\nFORGED"
            }
          ]
        }
      ]
    };

    const out = terminalReport(hostile);
    expect(out).not.toMatch(
      // eslint-disable-next-line no-control-regex -- the oracle rejects raw terminal controls
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u
    );
    expect(out).not.toContain("\nFORGED");
    expect(out).toContain("\\u001b");
    expect(out).toContain("\\nFORGED");
  });
});

describe("jsonReport", () => {
  test("round-trips the full report as structured data", () => {
    const parsed = JSON.parse(jsonReport(withFindings)) as ScanReportData & { version: number };
    expect(parsed.version).toBe(1);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0]!.excerpt).toBe("AKIA...F2Q");
    expect(parsed.sessions.total).toBe(2);
  });
});

describe("htmlReport", () => {
  test("is a self-contained page carrying the findings", () => {
    const out = htmlReport(withFindings);
    expect(out).toMatch(/^<!doctype html>/i);
    expect(out).toContain("<style>");
    expect(out).toContain("AKIA...F2Q");
    expect(out).not.toContain("<script>alert(1)</script>"); // escaped, not executed
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain('http-equiv="Content-Security-Policy"');
  });

  test("an empty report still shows the scan summary", () => {
    const out = htmlReport(emptyReport);
    expect(out).toContain("347");
    expect(out).toContain("No sensitive data found");
  });
});
