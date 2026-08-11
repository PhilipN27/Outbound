import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { allDetectors } from "./index.js";

const fixture = readFileSync(
  fileURLToPath(new URL("../../corpus/fixtures/hard-negatives.txt", import.meta.url)),
  "utf8"
);

describe("hard negatives", () => {
  test("the corpus has a detector registry to run against", () => {
    expect(Object.keys(allDetectors).length).toBeGreaterThan(0);
  });

  test.each(Object.keys(allDetectors))("%s produces zero findings", (name) => {
    const detector = allDetectors[name]!;
    const findings = detector(fixture);
    expect(findings, JSON.stringify(findings, null, 2)).toHaveLength(0);
  });
});
