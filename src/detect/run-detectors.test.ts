import { describe, expect, test } from "vitest";
import { runDetectors } from "./index.js";

describe("runDetectors overlap suppression", () => {
  test("no email finding inside a connection-string finding", () => {
    const text = "DATABASE_URL=postgres://app:h8Kw2xVb9Lk4Rt6Y@db.internal:5432/prod";
    const categories = runDetectors(text).map((f) => f.category);
    expect(categories).toContain("connection-string");
    expect(categories).not.toContain("email");
  });

  test("an email outside the connection string still fires", () => {
    const text =
      "mail sam.hart@proton.me about postgres://app:h8Kw2xVb9Lk4Rt6Y@db.internal/prod";
    const emails = runDetectors(text).filter((f) => f.category === "email");
    expect(emails).toHaveLength(1);
  });
});
