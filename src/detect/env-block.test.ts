import { describe, expect, test } from "vitest";
import { detectEnvBlock } from "./env-block.js";

const ENV_FILE = [
  "# production settings",
  "NODE_ENV=production",
  "DATABASE_URL=postgres://app:h8Kw2xVb9Lk4Rt6Y@db.internal:5432/prod",
  "AWS_SECRET_ACCESS_KEY=q7Zw2xVb9Lk4Rt6Yh8Jn1Mc3Pf5Gd0Sa",
  "SESSION_SECRET=Zk9TqW4mNxP2vRb7Yc1LhJ8dF3gK5sA0",
  "PORT=3000"
].join("\n");

describe("detectEnvBlock", () => {
  test("a .env block yields one finding, not one per line", () => {
    const text = `the agent read .env:\n${ENV_FILE}\nthen continued`;
    const findings = detectEnvBlock(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("env-block");
    expect(f.severity).toBe("high");
    expect(f.start).toBe(text.indexOf("NODE_ENV"));
    expect(f.excerpt).toContain("AWS_SECRET_ACCESS_KEY");
    expect(f.excerpt).not.toContain("q7Zw2xVb9Lk4Rt6Y");
    expect(f.excerpt).not.toContain("h8Kw2xVb9Lk4Rt6Y");
  });

  test("comments inside the block do not split it", () => {
    const text = [
      "API_TOKEN=Xk29fLmQ7vNzR4tYw8cJb3hG6dK1pS5a",
      "# database",
      "DB_PASSWORD=t7Yh3Jn1Mc8Zx9v8Bq2Lw4Rt6Yh8Jn1M",
      "DB_HOST=db.internal"
    ].join("\n");
    expect(detectEnvBlock(text)).toHaveLength(1);
  });

  test("fewer than three assignment lines is not a block", () => {
    const text = "A_SECRET=Zk9TqW4mNxP2vRb7Yc1LhJ8dF3gK5sA0\nB_KEY=Xk29fLmQ7vNzR4tYw8cJb3hG6dK1pS5a";
    expect(detectEnvBlock(text)).toHaveLength(0);
  });

  test("boring config with no secret-like value does not fire", () => {
    const text = "NODE_ENV=production\nPORT=3000\nLOG_LEVEL=debug\nRETRIES=5";
    expect(detectEnvBlock(text)).toHaveLength(0);
  });

  test("placeholder values do not fire", () => {
    const text = [
      "API_KEY=${API_KEY}",
      "SECRET_TOKEN=your-token-here",
      "DB_PASSWORD=changeme",
      "AUTH_SECRET=<insert-secret>"
    ].join("\n");
    expect(detectEnvBlock(text)).toHaveLength(0);
  });
});
