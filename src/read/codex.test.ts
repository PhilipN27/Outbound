import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parseCodex } from "./codex.js";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../corpus/fixtures/codex/${name}`, import.meta.url)),
    "utf8"
  );
}

describe("parseCodex on a normal rollout", () => {
  const { exchanges, skipped } = parseCodex(fixture("rollout-normal.jsonl"));

  test("emits the exact exchange sequence", () => {
    expect(
      exchanges.map((e) => ({ channel: e.channel, provenance: e.provenance }))
    ).toEqual([
      { channel: "user-prompt", provenance: "user" },
      { channel: "command-output", provenance: "cat .env" },
      { channel: "tool-result", provenance: "apply_patch" },
      { channel: "assistant-output", provenance: "assistant" }
    ]);
  });

  test("carries session id and cwd from session_meta, per-record timestamps", () => {
    const cmd = exchanges[1]!;
    expect(cmd.sessionId).toBe("c1");
    expect(cmd.projectPath).toBe("C:\\proj\\demo");
    expect(cmd.timestamp).toBe("2026-08-02T09:00:04.000Z");
    expect(cmd.text).toBe("AWS_ACCESS_KEY_ID=AKIA2E74XY9QGZLK7F2Q");
  });

  test("counts nothing as skipped", () => {
    expect(skipped).toEqual({ malformedLines: 0, unknownRecords: 0 });
  });
});

describe("parseCodex on edge cases", () => {
  const { exchanges, skipped } = parseCodex(fixture("rollout-edge.jsonl"));

  test("counts the malformed line and the two unknown record shapes", () => {
    expect(skipped).toEqual({ malformedLines: 1, unknownRecords: 2 });
  });

  test("an orphan tool output and a developer message still come through", () => {
    expect(
      exchanges.map((e) => ({ channel: e.channel, provenance: e.provenance }))
    ).toEqual([
      { channel: "tool-result", provenance: "tool" },
      { channel: "user-prompt", provenance: "developer" }
    ]);
  });
});
