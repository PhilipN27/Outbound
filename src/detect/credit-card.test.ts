import { describe, expect, test } from "vitest";
import { detectCreditCard } from "./credit-card.js";

// Standard industry test numbers — publicly documented, chargeable nowhere.
describe("detectCreditCard", () => {
  test("finds a spaced Visa test number with range and redacted excerpt", () => {
    const text = "card on file: 4111 1111 1111 1111 exp 12/28";
    const findings = detectCreditCard(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("credit-card");
    expect(f.severity).toBe("high");
    expect(f.start).toBe(text.indexOf("4111"));
    expect(f.end).toBe(f.start + "4111 1111 1111 1111".length);
    expect(f.excerpt).not.toContain("1111 1111");
  });

  test("finds an unseparated Amex number", () => {
    expect(detectCreditCard("amex 378282246310005 ok")).toHaveLength(1);
  });

  test("finds a dashed Mastercard number", () => {
    expect(detectCreditCard("mc 5555-5555-5555-4444")).toHaveLength(1);
  });

  test("rejects Luhn-invalid and unknown-prefix numbers", () => {
    for (const negative of [
      "4111111111111112",
      "1234567812345678",
      "order 20260810123456 shipped",
      "9411111111111111"
    ]) {
      expect(detectCreditCard(negative), negative).toHaveLength(0);
    }
  });

  test("rejects single-spaced digit tables even when they pass Luhn", () => {
    // Shape found in regexpp lookup tables during the reality run.
    expect(detectCreditCard("table: 5 5 0 0 0 0 0 0 0 0 0 0 0 0 0 4 end")).toHaveLength(0);
  });

  test("rejects card-length digit runs inside decimal fractions", () => {
    // Shape found in a real ML calibration JSON during the real-history run.
    expect(detectCreditCard('"probability": 0.4111111111111111,')).toHaveLength(0);
    expect(detectCreditCard("score=0.5555555555554444")).toHaveLength(0);
  });

  test("still fires after ordinary punctuation boundaries", () => {
    expect(detectCreditCard("(4111111111111111)")).toHaveLength(1);
    expect(detectCreditCard("card 4111111111111111.")).toHaveLength(1);
  });

  test("rejects digits embedded in a longer run", () => {
    expect(detectCreditCard("id 94111111111111111119")).toHaveLength(0);
  });
});
