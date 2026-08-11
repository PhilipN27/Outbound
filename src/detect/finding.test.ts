import { describe, expect, test } from "vitest";
import { makeFinding, redactValue } from "./finding.js";

describe("redactValue", () => {
  test("keeps first 4 and last 3 chars of a long value", () => {
    expect(redactValue("AKIA2E74XY9QGZLK7F2Q")).toBe("AKIA...F2Q");
  });

  test("fully masks values shorter than 12 chars", () => {
    expect(redactValue("hunter2")).toBe("[redacted]");
    expect(redactValue("")).toBe("[redacted]");
  });

  test("12-char value is the shortest that keeps ends", () => {
    expect(redactValue("abcdefghijkl")).toBe("abcd...jkl");
    expect(redactValue("abcdefghijk")).toBe("[redacted]");
  });

  test("never echoes the hidden middle", () => {
    const value = "sk-ant-api03-SECRETMIDDLEPART-tail";
    expect(redactValue(value)).not.toContain("SECRETMIDDLEPART");
  });
});

describe("makeFinding", () => {
  const text = "before AKIA2E74XY9QGZLK7F2Q after";
  const start = text.indexOf("AKIA");
  const end = start + "AKIA2E74XY9QGZLK7F2Q".length;

  test("produces a redacted excerpt at construction", () => {
    const f = makeFinding({
      category: "aws-access-key-id",
      severity: "critical",
      detector: "aws",
      confidence: 0.9,
      text,
      start,
      end
    });
    expect(f.excerpt).toBe("AKIA...F2Q");
    expect(f.start).toBe(start);
    expect(f.end).toBe(end);
  });

  test("the finding carries no raw value under any key", () => {
    const raw = "AKIA2E74XY9QGZLK7F2Q";
    const f = makeFinding({
      category: "aws-access-key-id",
      severity: "critical",
      detector: "aws",
      confidence: 0.9,
      text,
      start,
      end
    });
    for (const v of Object.values(f)) {
      expect(String(v)).not.toContain(raw);
    }
  });

  test("accepts a safe excerpt override for block findings", () => {
    const block = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD\n-----END RSA PRIVATE KEY-----";
    const f = makeFinding({
      category: "private-key",
      severity: "critical",
      detector: "private-key",
      confidence: 1,
      text: block,
      start: 0,
      end: block.length,
      safeExcerpt: "-----BEGIN RSA PRIVATE KEY-----"
    });
    expect(f.excerpt).toBe("-----BEGIN RSA PRIVATE KEY-----");
    expect(f.excerpt).not.toContain("MIIBOg");
  });
});
