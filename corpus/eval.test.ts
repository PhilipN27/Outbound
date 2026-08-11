import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { attribute } from "../src/attribute/attribute.js";
import { parseClaudeCode } from "../src/read/claude-code.js";
import { parseCodex } from "../src/read/codex.js";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

interface ManifestFile {
  name: string;
  format: "claude-code" | "codex";
  planted: Array<{ category: string; value: string }>;
}

const manifest = JSON.parse(readFileSync(here("labelled/manifest.json"), "utf8")) as {
  files: ManifestFile[];
};

const SALT = "corpus-eval-fixed-salt";

interface Tally {
  planted: number;
  found: number;
  tp: number;
  fp: number;
  fn: number;
}

const tallies = new Map<string, Tally>();
const confusions: string[] = [];

function tally(category: string): Tally {
  let t = tallies.get(category);
  if (t === undefined) {
    t = { planted: 0, found: 0, tp: 0, fp: 0, fn: 0 };
    tallies.set(category, t);
  }
  return t;
}

for (const file of manifest.files) {
  const content = readFileSync(here(`labelled/${file.name}`), "utf8");
  const parse = file.format === "claude-code" ? parseClaudeCode : parseCodex;
  const findings = attribute(parse(content).exchanges, SALT);

  const expected = new Map<string, number>();
  for (const p of file.planted) expected.set(p.category, (expected.get(p.category) ?? 0) + 1);
  const got = new Map<string, number>();
  for (const f of findings) got.set(f.category, (got.get(f.category) ?? 0) + 1);

  for (const category of new Set([...expected.keys(), ...got.keys()])) {
    const e = expected.get(category) ?? 0;
    const g = got.get(category) ?? 0;
    const t = tally(category);
    t.planted += e;
    t.found += g;
    t.tp += Math.min(e, g);
    if (g > e) {
      t.fp += g - e;
      confusions.push(`${file.name}: ${category} found ${g}, planted ${e}`);
    }
    if (e > g) {
      t.fn += e - g;
      confusions.push(`${file.name}: ${category} missed ${e - g} of ${e}`);
    }
  }
}

function ratio(num: number, den: number): number {
  return den === 0 ? 1 : Math.round((num / den) * 1000) / 1000;
}

const table = [...tallies.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, t]) => ({
    category,
    planted: t.planted,
    tp: t.tp,
    fp: t.fp,
    fn: t.fn,
    precision: ratio(t.tp, t.tp + t.fp),
    recall: ratio(t.tp, t.tp + t.fn)
  }));

describe("corpus eval — precision and recall per category", () => {
  test("prints the table", () => {
    const pad = (s: unknown, n: number) => String(s).padEnd(n);
    let out = `\n${pad("category", 24)}${pad("planted", 9)}${pad("tp", 4)}${pad("fp", 4)}${pad("fn", 4)}${pad("precision", 11)}recall\n`;
    for (const row of table) {
      out += `${pad(row.category, 24)}${pad(row.planted, 9)}${pad(row.tp, 4)}${pad(row.fp, 4)}${pad(row.fn, 4)}${pad(row.precision.toFixed(3), 11)}${row.recall.toFixed(3)}\n`;
    }
    if (confusions.length > 0) out += `\nnotes:\n  ${confusions.join("\n  ")}\n`;
    console.log(out);
    expect(table.length).toBeGreaterThan(0);
  });

  test("clean transcripts produce zero findings", () => {
    for (const file of manifest.files.filter((f) => f.planted.length === 0)) {
      const content = readFileSync(here(`labelled/${file.name}`), "utf8");
      const parse = file.format === "claude-code" ? parseClaudeCode : parseCodex;
      const findings = attribute(parse(content).exchanges, SALT);
      expect(findings, `${file.name}: ${JSON.stringify(findings.map((f) => f.category))}`).toEqual([]);
    }
  });

  test("no category regresses below the committed baseline", () => {
    expect(
      existsSync(here("baselines.json")),
      "corpus/baselines.json missing — commit the achieved numbers as the baseline"
    ).toBe(true);
    const baselines = JSON.parse(readFileSync(here("baselines.json"), "utf8")) as Record<
      string,
      { precision: number; recall: number }
    >;
    for (const row of table) {
      const base = baselines[row.category];
      expect(base, `no baseline for ${row.category}`).toBeDefined();
      expect(row.recall, `${row.category} recall regressed`).toBeGreaterThanOrEqual(base!.recall);
      expect(row.precision, `${row.category} precision regressed`).toBeGreaterThanOrEqual(
        base!.precision
      );
    }
  });
});
