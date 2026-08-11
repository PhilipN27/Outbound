import { describe, expect, test } from "vitest";
import { detectAws } from "./aws.js";

// Synthetic keys only. AKIA2E74XY9QGZLK7F2Q was invented for this test.
const ACCESS_KEY = "AKIA2E74XY9QGZLK7F2Q";
const SECRET_KEY = "q7Zw2xVb9Lk4Rt6Yh8Jn1Mc3Pf5Gd0Sa/uEiOrHl";

describe("detectAws access key ids", () => {
  test("finds a synthetic AKIA key with range and redacted excerpt", () => {
    const text = `aws_access_key_id = ${ACCESS_KEY}\n`;
    const findings = detectAws(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("aws-access-key-id");
    expect(f.severity).toBe("critical");
    expect(f.start).toBe(text.indexOf("AKIA"));
    expect(f.end).toBe(f.start + ACCESS_KEY.length);
    expect(f.excerpt).toBe("AKIA...F2Q");
  });

  test("finds ASIA temporary keys too", () => {
    const findings = detectAws("token ASIA2E74XY9QGZLK7F2Q here");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.category).toBe("aws-access-key-id");
  });

  test("ignores AWS documentation placeholder keys", () => {
    expect(detectAws("AKIAIOSFODNN7EXAMPLE")).toHaveLength(0);
    expect(detectAws("AKIAI44QH8DHBEXAMPLE")).toHaveLength(0);
  });

  test("ignores AKIA embedded in a longer uppercase identifier", () => {
    expect(detectAws("XAKIA2E74XY9QGZLK7F2Q")).toHaveLength(0);
    expect(detectAws("AKIA2E74XY9QGZLK7F2QZ")).toHaveLength(0);
  });
});

describe("detectAws secret access keys", () => {
  test("finds a secret key next to a context keyword", () => {
    const text = `aws_secret_access_key = ${SECRET_KEY}\n`;
    const findings = detectAws(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("aws-secret-access-key");
    expect(f.excerpt).not.toContain(SECRET_KEY);
  });

  test("finds a secret key in JSON SecretAccessKey form", () => {
    const text = `"SecretAccessKey": "${SECRET_KEY}"`;
    const findings = detectAws(text);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.category).toBe("aws-secret-access-key");
  });

  test("the same 40-char string bare in prose does not fire", () => {
    expect(detectAws(`random blob ${SECRET_KEY} in text`)).toHaveLength(0);
  });

  test("a 40-char hex git SHA does not fire even next to the keyword", () => {
    const sha = "356a192b7913b04c54574d18c28d46e6395428ab";
    expect(detectAws(`aws_secret_access_key = ${sha}`)).toHaveLength(0);
  });

  test("the AWS docs placeholder secret does not fire", () => {
    const text = "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    expect(detectAws(text)).toHaveLength(0);
  });
});
