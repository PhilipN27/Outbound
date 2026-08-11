import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { cliMain } from "./cli-main.js";

const dir = mkdtempSync(join(tmpdir(), "outbound-cli-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const fixtures = fileURLToPath(new URL("../corpus/fixtures", import.meta.url));
const claudeProjectsDir = join(dir, "claude-projects");
const codexSessionsDir = join(dir, "codex-sessions");
const stateDir = join(dir, "state");
mkdirSync(join(claudeProjectsDir, "C--proj-demo"), { recursive: true });
mkdirSync(codexSessionsDir, { recursive: true });
copyFileSync(
  join(fixtures, "claude-code", "normal-session.jsonl"),
  join(claudeProjectsDir, "C--proj-demo", "session.jsonl")
);

const env = {
  OUTBOUND_CLAUDE_PROJECTS: claudeProjectsDir,
  OUTBOUND_CODEX_SESSIONS: codexSessionsDir,
  OUTBOUND_STATE_DIR: stateDir
};

describe("cliMain scan", () => {
  test("default terminal output reports the planted key, redacted, with its file-read route", () => {
    const { exitCode, output } = cliMain(["scan", "--project", "C:\\proj\\demo"], env);
    expect(exitCode).toBe(0);
    expect(output).toContain("AKIA...F2Q");
    expect(output).toContain("file-read");
    expect(output).not.toContain("AKIA2E74XY9QGZLK7F2Q");
  });

  test("--json emits machine-readable findings", () => {
    const { exitCode, output } = cliMain(["scan", "--project", "C:\\proj\\demo", "--json"], env);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output) as { version: number; findings: Array<{ category: string }> };
    expect(parsed.version).toBe(1);
    expect(parsed.findings.some((f) => f.category === "aws-access-key-id")).toBe(true);
  });

  test("--out writes a self-contained html file", () => {
    const out = join(dir, "report.html");
    const { exitCode } = cliMain(["scan", "--project", "C:\\proj\\demo", "--out", out], env);
    expect(exitCode).toBe(0);
    expect(existsSync(out)).toBe(true);
    const html = readFileSync(out, "utf8");
    expect(html).toContain("AKIA...F2Q");
    expect(html).not.toContain("AKIA2E74XY9QGZLK7F2Q");
  });

  test("an unknown command explains usage and exits nonzero", () => {
    const { exitCode, output } = cliMain(["frobnicate"], env);
    expect(exitCode).toBe(1);
    expect(output).toContain("Usage");
  });
});
