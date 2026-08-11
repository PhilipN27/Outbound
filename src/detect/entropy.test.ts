import { describe, expect, test } from "vitest";
import { shannonEntropy } from "./entropy.js";

describe("shannonEntropy", () => {
  test("uniform single char is zero bits", () => {
    expect(shannonEntropy("XXXXXXXXXXXXXXXX")).toBe(0);
  });

  test("empty string is zero bits", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  test("two alternating chars is exactly one bit", () => {
    expect(shannonEntropy("abababab")).toBe(1);
  });

  test("a realistic random key body clears 3.5 bits", () => {
    expect(shannonEntropy("T3BlbkFJf82hKq0Zv1XmR9wYcD4N")).toBeGreaterThan(3.5);
  });

  test("the word 'example' does not clear 3.5 bits", () => {
    expect(shannonEntropy("example")).toBeLessThan(3.5);
  });
});
