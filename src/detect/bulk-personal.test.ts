import { describe, expect, test } from "vitest";
import { detectBulkPersonal } from "./bulk-personal.js";
import { runDetectors } from "./index.js";

const CSV = [
  "id,name,email,plan",
  "1,Ada Verne,ada.verne@corp.io,pro",
  "2,Ben Okafor,ben.okafor@corp.io,free",
  "3,Cai Lund,cai.lund@corp.io,pro",
  "4,Dot Marsh,dot.marsh@corp.io,team",
  "5,Eli Ncube,eli.ncube@corp.io,pro"
].join("\n");

describe("detectBulkPersonal", () => {
  test("a CSV with an email column is one finding with a row count", () => {
    const text = `query result:\n${CSV}\n5 rows returned`;
    const findings = detectBulkPersonal(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("bulk-personal-data");
    expect(f.severity).toBe("high");
    expect(f.excerpt).toContain("5 rows");
    expect(f.excerpt).toContain("email");
    expect(f.excerpt).not.toContain("ada.verne@corp.io");
  });

  test("a numeric table with no personal column does not fire", () => {
    const table = "day,requests,errors\n1,4210,3\n2,3980,1\n3,4400,0\n4,4102,2\n5,3877,1";
    expect(detectBulkPersonal(table)).toHaveLength(0);
  });

  test("fewer than five data rows does not fire as bulk", () => {
    const small = "id,email\n1,a.b@corp.io\n2,c.d@corp.io";
    expect(detectBulkPersonal(small)).toHaveLength(0);
  });
});

describe("runDetectors bulk suppression", () => {
  test("inside a bulk block, individual email findings are suppressed", () => {
    const findings = runDetectors(CSV);
    const categories = findings.map((f) => f.category);
    expect(categories).toContain("bulk-personal-data");
    expect(categories).not.toContain("email");
  });

  test("emails outside the block still fire individually", () => {
    const text = `contact zoe.quinn@corp.io\n\n${CSV}`;
    const findings = runDetectors(text);
    expect(findings.filter((f) => f.category === "email")).toHaveLength(1);
    expect(findings.filter((f) => f.category === "bulk-personal-data")).toHaveLength(1);
  });
});
