import { describe, expect, test } from "vitest";
import { detectProviderKeys } from "./provider-keys.js";

// All keys below are synthetic. None is or ever was a live credential.
const ANTHROPIC_KEY = "sk-ant-api03-Zk9TqW4mNxP2vRb7Yc1LhJ8dF3gK5sA0uEwHrM6nT4pQiO2xVjB1lD";
const OPENAI_KEY = "sk-proj-Xk29fLmQ7vNzR4tYw8cJb3hG6dK1pS5aU0eIoZrHnM2qT9x";
const GITHUB_PAT = "ghp_Wm8Kt2xQzR7vLc4bN9fJh3gY6dP1sA5uE0oI";

describe("detectProviderKeys", () => {
  test("finds a synthetic Anthropic key with range and redacted excerpt", () => {
    const text = `ANTHROPIC_API_KEY=${ANTHROPIC_KEY}\n`;
    const findings = detectProviderKeys(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("provider-api-key");
    expect(f.severity).toBe("critical");
    expect(f.start).toBe(text.indexOf("sk-ant-"));
    expect(f.end).toBe(f.start + ANTHROPIC_KEY.length);
    expect(f.excerpt).toMatch(/^sk-a\.\.\./);
    expect(f.excerpt).not.toContain(ANTHROPIC_KEY);
  });

  test("finds an OpenAI-style key and a GitHub PAT in the same text", () => {
    const text = `key one ${OPENAI_KEY} and token ${GITHUB_PAT} end`;
    const findings = detectProviderKeys(text);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.category)).toEqual(["provider-api-key", "provider-api-key"]);
  });

  test("an Anthropic key yields one finding, not one per matching prefix", () => {
    const findings = detectProviderKeys(ANTHROPIC_KEY);
    expect(findings).toHaveLength(1);
  });

  test("ignores placeholder and low-entropy lookalikes", () => {
    for (const negative of [
      "sk-example",
      "sk-XXXXXXXXXXXXXXXXXXXXXXXX",
      "sk-1234567890",
      "your key goes here: sk-...",
      "ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    ]) {
      expect(detectProviderKeys(negative), negative).toHaveLength(0);
    }
  });

  test("does not fire on sk- embedded inside a base64url blob", () => {
    const blob = `eyJhbGciOiJIUzI1NiJ9Qsk-ant-Zk9TqW4mNxP2vRb7Yc1LhJ8dF3gK5sA0uEwHrM`;
    expect(detectProviderKeys(blob)).toHaveLength(0);
  });
});
