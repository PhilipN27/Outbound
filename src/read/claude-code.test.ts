import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseClaudeCode } from "./claude-code.js";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../corpus/fixtures/claude-code/${name}`, import.meta.url)),
    "utf8"
  );
}

describe("parseClaudeCode on a normal session", () => {
  const { exchanges, skipped } = parseClaudeCode(fixture("normal-session.jsonl"));

  test("emits the exact exchange sequence", () => {
    expect(
      exchanges.map((e) => ({ channel: e.channel, provenance: e.provenance }))
    ).toEqual([
      { channel: "user-prompt", provenance: "user" },
      { channel: "assistant-output", provenance: "assistant" },
      { channel: "file-read", provenance: "C:\\proj\\demo\\.env" },
      { channel: "command-output", provenance: "shell" },
      { channel: "attachment", provenance: "SessionStart" },
      { channel: "assistant-output", provenance: "assistant" }
    ]);
  });

  test("carries text, session id, timestamp, and project path", () => {
    const first = exchanges[0]!;
    expect(first.text).toBe("Read the config file please");
    expect(first.sessionId).toBe("s1");
    expect(first.timestamp).toBe("2026-08-01T10:00:01.000Z");
    expect(first.projectPath).toBe("C:\\proj\\demo");
    expect(exchanges[2]!.text).toContain("AKIA2E74XY9QGZLK7F2Q");
    expect(exchanges[4]!.text).toBe("hook says hello");
  });

  test("counts nothing as skipped: every record type is known", () => {
    expect(skipped).toEqual({ malformedLines: 0, unknownRecords: 0 });
  });
});

describe("parseClaudeCode on edge cases", () => {
  const { exchanges, skipped } = parseClaudeCode(fixture("edge-cases.jsonl"));

  test("skips and counts the unknown record type and the malformed line", () => {
    expect(skipped).toEqual({ malformedLines: 1, unknownRecords: 1 });
  });

  test("still emits the surrounding exchanges, joining only text blocks", () => {
    expect(exchanges.map((e) => e.channel)).toEqual([
      "user-prompt",
      "command-output",
      "assistant-output"
    ]);
    // thinking + text blocks both belong to the assistant turn
    expect(exchanges[2]!.text).toBe("pondering the request\nsecond answer");
    // an image tool_result has no text
    expect(exchanges[1]!.text).toBe("");
  });
});

describe("parseClaudeCode on an empty file", () => {
  test("returns no exchanges and no skips without throwing", () => {
    const { exchanges, skipped } = parseClaudeCode(fixture("empty.jsonl"));
    expect(exchanges).toEqual([]);
    expect(skipped).toEqual({ malformedLines: 0, unknownRecords: 0 });
  });
});
