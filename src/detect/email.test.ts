import { describe, expect, test } from "vitest";
import { detectEmail } from "./email.js";

describe("detectEmail", () => {
  test("finds an email in prose with range and redacted excerpt", () => {
    const text = "customer record: jane.doe1984@fastmail.co.uk, plan pro\n";
    const findings = detectEmail(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("email");
    expect(f.severity).toBe("low");
    expect(f.start).toBe(text.indexOf("jane"));
    expect(f.end).toBe(f.start + "jane.doe1984@fastmail.co.uk".length);
    expect(f.excerpt).not.toContain("jane.doe1984@fastmail.co.uk");
  });

  test("a sentence-final email still matches without the period", () => {
    const text = "write to sam.hart@proton.me.";
    const findings = detectEmail(text);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.end).toBe(text.indexOf(".me.") + ".me".length);
  });

  test("finds two distinct emails as two findings", () => {
    const text = "cc alice.k@corp.io and bob.m@corp.io";
    expect(detectEmail(text)).toHaveLength(2);
  });

  test("ignores git remotes, package specs, handles, and placeholders", () => {
    for (const negative of [
      "git clone git@github.com:PhilipN27/Outbound.git",
      "npm install prettier@3.4.2",
      "ping @teamhandle about it",
      "docs use user@example.com everywhere",
      "admin@localhost is not routable",
      "Co-Authored-By: Claude <noreply@anthropic.com>",
      "from no-reply@github.com on Tue",
      "sender donotreply@service.io bounced"
    ]) {
      expect(detectEmail(negative), negative).toHaveLength(0);
    }
  });
});
