import { describe, expect, test } from "vitest";
import { detectJwt } from "./jwt.js";

// The well-known jwt.io demo token shape, synthetic signature.
const HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const PAYLOAD = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
const SIGNATURE = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c";
const JWT = `${HEADER}.${PAYLOAD}.${SIGNATURE}`;

describe("detectJwt", () => {
  test("finds a JWT with a decodable header", () => {
    const text = `Authorization: Bearer ${JWT}\n`;
    const findings = detectJwt(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("jwt");
    expect(f.severity).toBe("high");
    expect(f.start).toBe(text.indexOf("eyJ"));
    expect(f.end).toBe(f.start + JWT.length);
    expect(f.excerpt).not.toContain(SIGNATURE);
  });

  test("ignores three dotted segments whose header is not JSON", () => {
    expect(detectJwt("abcdefghijklm.nopqrstuvwxyz.0123456789abc")).toHaveLength(0);
  });

  test("ignores a header that decodes but has no alg", () => {
    // {"hello":"world"} in base64url
    const bogus = `eyJoZWxsbyI6IndvcmxkIn0.${PAYLOAD}.${SIGNATURE}`;
    expect(detectJwt(bogus)).toHaveLength(0);
  });

  test("ignores dotted file names and versions", () => {
    expect(detectJwt("app.bundle.min.js v10.2.31")).toHaveLength(0);
  });
});
