import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type { GroupedFinding, Route } from "../attribute/attribute.js";
import type { Category, Severity } from "../detect/index.js";
import type { Channel } from "../read/exchange.js";

// Loaded at evaluation time, not ESM link time: a static value import of
// node:sqlite fires its ExperimentalWarning before any user module (including
// the CLI's suppressor) gets to run.
const { DatabaseSync: SqliteDatabase } = createRequire(import.meta.url)(
  "node:sqlite"
) as typeof import("node:sqlite");

export interface ScanSummary {
  startedAt: string;
  projectPath: string;
  sessionCount: number;
  exchangeCount: number;
  malformedLines: number;
  unknownRecords: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startedAt TEXT NOT NULL,
  projectPath TEXT NOT NULL,
  sessionCount INTEGER NOT NULL,
  exchangeCount INTEGER NOT NULL,
  malformedLines INTEGER NOT NULL,
  unknownRecords INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  path TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  contentHash TEXT NOT NULL,
  scannedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  valueHash TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  detector TEXT NOT NULL,
  confidence REAL NOT NULL,
  excerpt TEXT NOT NULL,
  recurrence INTEGER NOT NULL,
  firstSeen TEXT NOT NULL,
  lastSeen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  valueHash TEXT NOT NULL REFERENCES findings(valueHash),
  channel TEXT NOT NULL,
  provenance TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  projectPath TEXT NOT NULL
);
`;

export class Store {
  readonly salt: string;
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new SqliteDatabase(dbPath);
    this.db.exec(SCHEMA);
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'salt'").get() as
      | { value: string }
      | undefined;
    if (row !== undefined) {
      this.salt = row.value;
    } else {
      this.salt = randomBytes(32).toString("hex");
      this.db.prepare("INSERT INTO meta (key, value) VALUES ('salt', ?)").run(this.salt);
    }
  }

  upsertFindings(grouped: GroupedFinding[]): void {
    const upsert = this.db.prepare(`
      INSERT INTO findings (valueHash, category, severity, detector, confidence, excerpt, recurrence, firstSeen, lastSeen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(valueHash) DO UPDATE SET
        recurrence = recurrence + excluded.recurrence,
        firstSeen = MIN(firstSeen, excluded.firstSeen),
        lastSeen = MAX(lastSeen, excluded.lastSeen)
    `);
    const addRoute = this.db.prepare(
      "INSERT INTO occurrences (valueHash, channel, provenance, sessionId, timestamp, projectPath) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const g of grouped) {
      upsert.run(
        g.valueHash,
        g.category,
        g.severity,
        g.detector,
        g.confidence,
        g.excerpt,
        g.recurrence,
        g.firstSeen,
        g.lastSeen
      );
      for (const r of g.routes) {
        addRoute.run(g.valueHash, r.channel, r.provenance, r.sessionId, r.timestamp, r.projectPath);
      }
    }
  }

  loadFindings(): GroupedFinding[] {
    const findings = this.db
      .prepare("SELECT * FROM findings ORDER BY lastSeen DESC, valueHash")
      .all() as Array<{
      valueHash: string;
      category: Category;
      severity: Severity;
      detector: string;
      confidence: number;
      excerpt: string;
      recurrence: number;
      firstSeen: string;
      lastSeen: string;
    }>;
    const routeStmt = this.db.prepare(
      "SELECT channel, provenance, sessionId, timestamp, projectPath FROM occurrences WHERE valueHash = ? ORDER BY timestamp, id"
    );
    return findings.map((f) => ({
      ...f,
      routes: routeStmt.all(f.valueHash) as unknown as Route[] as Array<
        Route & { channel: Channel }
      >
    }));
  }

  isSessionScanned(path: string, contentHash: string): boolean {
    const row = this.db.prepare("SELECT contentHash FROM sessions WHERE path = ?").get(path) as
      | { contentHash: string }
      | undefined;
    return row !== undefined && row.contentHash === contentHash;
  }

  markSessionScanned(path: string, agent: string, contentHash: string): void {
    this.db
      .prepare(
        `INSERT INTO sessions (path, agent, contentHash, scannedAt) VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET contentHash = excluded.contentHash, scannedAt = excluded.scannedAt`
      )
      .run(path, agent, contentHash, new Date().toISOString());
  }

  recordScan(summary: ScanSummary): void {
    this.db
      .prepare(
        `INSERT INTO scans (startedAt, projectPath, sessionCount, exchangeCount, malformedLines, unknownRecords)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        summary.startedAt,
        summary.projectPath,
        summary.sessionCount,
        summary.exchangeCount,
        summary.malformedLines,
        summary.unknownRecords
      );
  }

  close(): void {
    this.db.close();
  }
}

export function openStore(dbPath: string): Store {
  return new Store(dbPath);
}
