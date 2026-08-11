import { describe, expect, test } from "vitest";
import type { Exchange } from "../read/exchange.js";
import { attribute } from "./attribute.js";

const KEY = "AKIA2E74XY9QGZLK7F2Q";
const OTHER_KEY = "AKIA9Q2ZL7XYGE4TK0FV";

function ex(partial: Partial<Exchange>): Exchange {
  return {
    sessionId: "s1",
    timestamp: "2026-08-01T10:00:00.000Z",
    projectPath: "C:\\proj\\demo",
    channel: "user-prompt",
    text: "",
    provenance: "user",
    ...partial
  };
}

// The spec's core attribution fixture: the same secret arrives by three
// different routes and must become ONE grouped finding with three routes.
const THREE_ROUTES: Exchange[] = [
  ex({ channel: "user-prompt", provenance: "user", text: `here is the key ${KEY}` }),
  ex({
    channel: "file-read",
    provenance: "C:\\proj\\demo\\.env",
    text: `AWS_ACCESS_KEY_ID=${KEY}`,
    timestamp: "2026-08-01T11:00:00.000Z"
  }),
  ex({
    channel: "command-output",
    provenance: "printenv",
    text: `AWS_ACCESS_KEY_ID=${KEY}\n`,
    sessionId: "s2",
    timestamp: "2026-08-02T09:00:00.000Z"
  })
];

describe("attribute", () => {
  test("one secret via three routes groups to one finding with recurrence 3", () => {
    const grouped = attribute(THREE_ROUTES, "salt-a");
    expect(grouped).toHaveLength(1);
    const g = grouped[0]!;
    expect(g.category).toBe("aws-access-key-id");
    expect(g.recurrence).toBe(3);
    expect(g.routes.map((r) => ({ channel: r.channel, provenance: r.provenance }))).toEqual([
      { channel: "user-prompt", provenance: "user" },
      { channel: "file-read", provenance: "C:\\proj\\demo\\.env" },
      { channel: "command-output", provenance: "printenv" }
    ]);
    expect(g.firstSeen).toBe("2026-08-01T10:00:00.000Z");
    expect(g.lastSeen).toBe("2026-08-02T09:00:00.000Z");
  });

  test("distinct secrets stay distinct groups", () => {
    const grouped = attribute(
      [
        ex({ text: `first ${KEY}` }),
        ex({ text: `second ${OTHER_KEY}`, timestamp: "2026-08-01T12:00:00.000Z" })
      ],
      "salt-a"
    );
    expect(grouped).toHaveLength(2);
    expect(grouped.every((g) => g.recurrence === 1)).toBe(true);
    expect(grouped[0]!.valueHash).not.toBe(grouped[1]!.valueHash);
  });

  test("hashes are salted: same value, different salt, different hash", () => {
    const a = attribute([ex({ text: KEY })], "salt-a")[0]!;
    const b = attribute([ex({ text: KEY })], "salt-b")[0]!;
    expect(a.valueHash).not.toBe(b.valueHash);
    expect(a.valueHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("no grouped finding carries the raw value anywhere", () => {
    const grouped = attribute(THREE_ROUTES, "salt-a");
    expect(JSON.stringify(grouped)).not.toContain(KEY);
  });

  test("clean exchanges produce no findings", () => {
    expect(attribute([ex({ text: "nothing sensitive here" })], "salt-a")).toEqual([]);
  });
});
