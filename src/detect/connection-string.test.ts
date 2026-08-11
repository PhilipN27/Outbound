import { describe, expect, test } from "vitest";
import { detectConnectionString } from "./connection-string.js";

describe("detectConnectionString", () => {
  test("finds a postgres URL with an embedded password", () => {
    const text = "DATABASE_URL=postgres://app:h8Kw2xVb9Lk4Rt6Y@db.internal:5432/prod\n";
    const findings = detectConnectionString(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("connection-string");
    expect(f.severity).toBe("critical");
    expect(f.excerpt).toBe("postgres://app:[redacted]@db.internal:5432/prod");
    expect(f.excerpt).not.toContain("h8Kw2xVb9Lk4Rt6Y");
  });

  test("finds mysql and amqp variants", () => {
    const text =
      "mysql://root:Zx9v8Bq2Lw@10.0.0.5/app and amqp://svc:t7Yh3Jn1Mc@mq.local:5672";
    expect(detectConnectionString(text)).toHaveLength(2);
  });

  test("ignores URLs without credentials", () => {
    expect(detectConnectionString("postgres://localhost:5432/mydb")).toHaveLength(0);
    expect(detectConnectionString("https://example.com/path")).toHaveLength(0);
  });

  test("ignores documentation example hosts and trivial passwords", () => {
    // The exact shapes found in @types/node docs during the reality run.
    for (const negative of [
      "http://abc:xyz@example.com/path",
      "https://user:h8Kw2xVb9Lk4Rt6Y@example.com:8080/db",
      "https://a:b@somehost.io/x"
    ]) {
      expect(detectConnectionString(negative), negative).toHaveLength(0);
    }
  });

  test("ignores placeholder passwords", () => {
    for (const negative of [
      "postgres://user:${DB_PASSWORD}@host/db",
      "postgres://user:<password>@host/db",
      "mysql://user:password@localhost/db",
      "postgres://user:changeme@host/db",
      "postgres://USER:PASS@HOST:5432/DB"
    ]) {
      expect(detectConnectionString(negative), negative).toHaveLength(0);
    }
  });
});
