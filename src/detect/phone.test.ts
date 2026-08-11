import { describe, expect, test } from "vitest";
import { detectPhone } from "./phone.js";

describe("detectPhone", () => {
  test("finds an international number with country code", () => {
    const text = "call me at +1 (415) 555-2671 tomorrow";
    const findings = detectPhone(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("phone");
    expect(f.severity).toBe("low");
    expect(f.excerpt).not.toContain("555-2671");
  });

  test("finds a compact E.164 number", () => {
    expect(detectPhone("support: +442071838750")).toHaveLength(1);
  });

  test("finds a dashed US number", () => {
    expect(detectPhone("fax 415-555-2671 ok")).toHaveLength(1);
  });

  test("ignores dates, versions, IPs, ports, and timezone offsets", () => {
    for (const negative of [
      "released 2026-08-10",
      "version 10.200.3001",
      "listening on 192.168.100.200:8080",
      "deployed 2026-08-10T12:34:56+02:00",
      "uuid 550e8400-e29b-41d4-a716-446655440000",
      "build 20260810123456"
    ]) {
      expect(detectPhone(negative), negative).toHaveLength(0);
    }
  });
});
