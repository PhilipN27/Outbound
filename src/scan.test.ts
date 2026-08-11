import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { openStore } from "./store/store.js";
import { runScan } from "./scan.js";

const dir = mkdtempSync(join(tmpdir(), "outbound-scan-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const fixtures = fileURLToPath(new URL("../corpus/fixtures", import.meta.url));

// A fake home: the fixture project C:\proj\demo has one Claude Code session
// (with the planted AWS key read from .env) and one Codex rollout.
const claudeProjectsDir = join(dir, "claude", "projects");
const codexSessionsDir = join(dir, "codex", "sessions");
mkdirSync(join(claudeProjectsDir, "C--proj-demo"), { recursive: true });
mkdirSync(join(codexSessionsDir, "2026", "08", "02"), { recursive: true });
copyFileSync(
  join(fixtures, "claude-code", "normal-session.jsonl"),
  join(claudeProjectsDir, "C--proj-demo", "normal-session.jsonl")
);
copyFileSync(
  join(fixtures, "codex", "rollout-normal.jsonl"),
  join(codexSessionsDir, "2026", "08", "02", "rollout-normal.jsonl")
);

const io = { claudeProjectsDir, codexSessionsDir };

describe("runScan", () => {
  const store = openStore(join(dir, "store.sqlite"));
  afterAll(() => store.close());

  test("first scan reads both agents, finds the planted key, attributes the file read", () => {
    const report = runScan({ projectPath: "C:\\proj\\demo", io, store });
    expect(report.sessions).toEqual({ total: 2, scanned: 2, skippedUnchanged: 0 });
    expect(report.exchanges).toBeGreaterThan(5);
    expect(report.skipped).toEqual({ malformedLines: 0, unknownRecords: 0 });

    const aws = report.findings.find((f) => f.category === "aws-access-key-id");
    expect(aws).toBeDefined();
    expect(aws!.excerpt).toBe("AKIA...F2Q");
    // the same key arrived via the Claude Code file read, its command echo,
    // and the Codex cat output
    expect(aws!.routes.some((r) => r.channel === "file-read" && r.provenance.endsWith(".env"))).toBe(true);
    expect(aws!.routes.some((r) => r.channel === "command-output")).toBe(true);
    expect(aws!.recurrence).toBeGreaterThanOrEqual(3);
  });

  test("second scan skips unchanged sessions but still reports stored findings", () => {
    const report = runScan({ projectPath: "C:\\proj\\demo", io, store });
    expect(report.sessions).toEqual({ total: 2, scanned: 0, skippedUnchanged: 2 });
    expect(report.findings.some((f) => f.category === "aws-access-key-id")).toBe(true);
  });

  test("a different project sees none of those findings", () => {
    const report = runScan({ projectPath: "C:\\proj\\other", io, store });
    expect(report.sessions.total).toBe(0);
    expect(report.findings).toEqual([]);
  });

  test("skip counts from edge-case sessions surface in the report", () => {
    copyFileSync(
      join(fixtures, "claude-code", "edge-cases.jsonl"),
      join(claudeProjectsDir, "C--proj-demo", "edge-cases.jsonl")
    );
    const report = runScan({ projectPath: "C:\\proj\\demo", io, store });
    expect(report.sessions.scanned).toBe(1);
    expect(report.skipped).toEqual({ malformedLines: 1, unknownRecords: 1 });
  });
});
