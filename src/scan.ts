import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { attribute, type GroupedFinding } from "./attribute/attribute.js";
import { parseClaudeCode } from "./read/claude-code.js";
import { parseCodex } from "./read/codex.js";
import { findClaudeCodeSessions, findCodexSessions } from "./read/discover.js";
import type { ParseResult, SkipCounts } from "./read/exchange.js";
import type { Store } from "./store/store.js";

export interface ScanIO {
  claudeProjectsDir: string;
  codexSessionsDir: string;
}

export interface ScanOptions {
  /** null scans the full history across all projects. */
  projectPath: string | null;
  io: ScanIO;
  store: Store;
}

export interface ScanReportData {
  scannedAt: string;
  projectPath: string | null;
  sessions: { total: number; scanned: number; skippedUnchanged: number };
  exchanges: number;
  skipped: SkipCounts;
  findings: GroupedFinding[];
}

interface SessionSource {
  agent: "claude-code" | "codex";
  path: string;
  parse: (content: string) => ParseResult;
}

export function runScan(opts: ScanOptions): ScanReportData {
  const { projectPath, io, store } = opts;
  const scannedAt = new Date().toISOString();

  const sources: SessionSource[] = [
    ...findClaudeCodeSessions(projectPath, io.claudeProjectsDir).map(
      (path): SessionSource => ({ agent: "claude-code", path, parse: parseClaudeCode })
    ),
    ...findCodexSessions(projectPath, io.codexSessionsDir).map(
      (path): SessionSource => ({ agent: "codex", path, parse: parseCodex })
    )
  ];

  let scanned = 0;
  let skippedUnchanged = 0;
  let exchanges = 0;
  const skipped: SkipCounts = { malformedLines: 0, unknownRecords: 0 };

  for (const source of sources) {
    let content: string;
    try {
      content = readFileSync(source.path, "utf8");
    } catch {
      continue; // unreadable session: degrade, never crash
    }
    const contentHash = createHash("sha256").update(content).digest("hex");
    if (store.isSessionScanned(source.path, contentHash)) {
      skippedUnchanged++;
      continue;
    }
    const result = source.parse(content);
    exchanges += result.exchanges.length;
    skipped.malformedLines += result.skipped.malformedLines;
    skipped.unknownRecords += result.skipped.unknownRecords;
    store.upsertFindings(attribute(result.exchanges, store.salt));
    store.markSessionScanned(source.path, source.agent, contentHash);
    scanned++;
  }

  store.recordScan({
    startedAt: scannedAt,
    projectPath: projectPath ?? "all",
    sessionCount: scanned,
    exchangeCount: exchanges,
    malformedLines: skipped.malformedLines,
    unknownRecords: skipped.unknownRecords
  });

  const all = store.loadFindings();
  const findings =
    projectPath === null
      ? all
      : all.filter((f) => f.routes.some((r) => r.projectPath === projectPath));

  return {
    scannedAt,
    projectPath,
    sessions: { total: sources.length, scanned, skippedUnchanged },
    exchanges,
    skipped,
    findings
  };
}
