import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { attribute } from "../attribute/attribute.js";
import type { Exchange } from "../read/exchange.js";
import { openStore } from "./store.js";

const dir = mkdtempSync(join(tmpdir(), "outbound-store-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const KEY = "AKIA2E74XY9QGZLK7F2Q";
const PROVIDER_KEY = "sk-ant-api03-Zk9TqW4mNxP2vRb7Yc1LhJ8dF3gK5sA0uEwHrM6nT4pQiO2xVjB1lD";
const DB_PASSWORD = "h8Kw2xVb9Lk4Rt6Y";

function ex(text: string, channel: Exchange["channel"] = "file-read"): Exchange {
  return {
    sessionId: "s1",
    timestamp: "2026-08-01T10:00:00.000Z",
    projectPath: "C:\\proj\\demo",
    channel,
    text,
    provenance: "C:\\proj\\demo\\.env"
  };
}

describe("openStore", () => {
  test("generates a salt on first open and keeps it across reopen", () => {
    const path = join(dir, "salt-test.sqlite");
    const a = openStore(path);
    const salt = a.salt;
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    a.close();
    const b = openStore(path);
    expect(b.salt).toBe(salt);
    b.close();
  });

  test("two installs get different salts", () => {
    const a = openStore(join(dir, "install-a.sqlite"));
    const b = openStore(join(dir, "install-b.sqlite"));
    expect(a.salt).not.toBe(b.salt);
    a.close();
    b.close();
  });
});

describe("findings roundtrip", () => {
  test("upsert then load preserves the grouped finding", () => {
    const store = openStore(join(dir, "roundtrip.sqlite"));
    const grouped = attribute([ex(`AWS_ACCESS_KEY_ID=${KEY}`)], store.salt);
    store.upsertFindings(grouped);
    const loaded = store.loadFindings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(grouped[0]);
    store.close();
  });

  test("upserting the same value again merges recurrence and routes", () => {
    const store = openStore(join(dir, "merge.sqlite"));
    const first = attribute([ex(`AWS_ACCESS_KEY_ID=${KEY}`)], store.salt);
    const second = attribute(
      [{ ...ex(`printed: ${KEY}`, "command-output"), timestamp: "2026-08-02T10:00:00.000Z" }],
      store.salt
    );
    store.upsertFindings(first);
    store.upsertFindings(second);
    const loaded = store.loadFindings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.recurrence).toBe(2);
    expect(loaded[0]!.routes).toHaveLength(2);
    expect(loaded[0]!.lastSeen).toBe("2026-08-02T10:00:00.000Z");
    store.close();
  });
});

describe("incremental session tracking", () => {
  test("a session is unscanned until marked, and hash changes invalidate it", () => {
    const store = openStore(join(dir, "sessions.sqlite"));
    expect(store.isSessionScanned("C:\\t\\a.jsonl", "hash1")).toBe(false);
    store.markSessionScanned("C:\\t\\a.jsonl", "claude-code", "hash1");
    expect(store.isSessionScanned("C:\\t\\a.jsonl", "hash1")).toBe(true);
    expect(store.isSessionScanned("C:\\t\\a.jsonl", "hash2")).toBe(false);
    store.close();
  });
});

describe("INVARIANT: no raw secret in the database file", () => {
  // CI's windows runner has slow disk; locally this takes ~300ms.
  test("raw values planted through the full pipeline never reach disk", { timeout: 30_000 }, () => {
    const path = join(dir, "invariant.sqlite");
    const store = openStore(path);
    const grouped = attribute(
      [
        ex(`AWS_ACCESS_KEY_ID=${KEY}`),
        ex(`ANTHROPIC_API_KEY=${PROVIDER_KEY}`),
        ex(`DATABASE_URL=postgres://app:${DB_PASSWORD}@db.internal:5432/prod`)
      ],
      store.salt
    );
    expect(grouped.length).toBeGreaterThanOrEqual(3);
    store.upsertFindings(grouped);
    store.recordScan({
      startedAt: "2026-08-01T10:00:00.000Z",
      projectPath: "C:\\proj\\demo",
      sessionCount: 1,
      exchangeCount: 3,
      malformedLines: 0,
      unknownRecords: 0
    });
    store.close();

    const bytes = readFileSync(path);
    for (const secret of [KEY, PROVIDER_KEY, DB_PASSWORD]) {
      expect(bytes.includes(Buffer.from(secret, "utf8")), `plaintext ${secret.slice(0, 6)}... found in db`).toBe(false);
      expect(bytes.includes(Buffer.from(secret, "utf16le")), "utf16 variant found").toBe(false);
    }
  });
});
