import { describe, expect, test } from "vitest";
import { detectSsn } from "./ssn.js";

describe("detectSsn", () => {
  test("finds a dashed SSN with range and redacted excerpt", () => {
    const text = "applicant ssn 123-45-6789 on file";
    const findings = detectSsn(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("ssn");
    expect(f.severity).toBe("high");
    expect(f.start).toBe(text.indexOf("123-"));
    expect(f.end).toBe(f.start + "123-45-6789".length);
    expect(f.excerpt).toBe("[redacted]");
  });

  test("ignores structurally invalid SSNs", () => {
    for (const negative of [
      "000-12-3456",
      "666-12-3456",
      "900-12-3456",
      "123-00-4567",
      "123-45-0000"
    ]) {
      expect(detectSsn(negative), negative).toHaveLength(0);
    }
  });

  test("ignores phone numbers and dates", () => {
    expect(detectSsn("415-555-2671")).toHaveLength(0);
    expect(detectSsn("2026-08-10")).toHaveLength(0);
    expect(detectSsn("550e8400-e29b-41d4-a716-446655440000")).toHaveLength(0);
  });
});
