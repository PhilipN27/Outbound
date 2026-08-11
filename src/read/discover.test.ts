import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { findClaudeCodeSessions, findCodexSessions, projectSlug } from "./discover.js";

describe("projectSlug", () => {
  test("Windows path shape", () => {
    expect(projectSlug("C:\\Users\\pan97\\Outbound")).toBe("C--Users-pan97-Outbound");
  });

  test("POSIX path shape", () => {
    expect(projectSlug("/home/philip/foo")).toBe("-home-philip-foo");
  });

  test("dots and other non-alphanumerics become dashes", () => {
    expect(projectSlug("C:\\dev\\my.app_v2")).toBe("C--dev-my-app-v2");
  });
});

describe("session discovery", () => {
  const home = mkdtempSync(join(tmpdir(), "outbound-discover-"));
  afterAll(() => rmSync(home, { recursive: true, force: true }));

  // Claude Code layout: <home>/projects/<slug>/*.jsonl
  const ccProjects = join(home, "projects");
  mkdirSync(join(ccProjects, "C--proj-demo"), { recursive: true });
  mkdirSync(join(ccProjects, "C--proj-other"), { recursive: true });
  writeFileSync(join(ccProjects, "C--proj-demo", "aaa.jsonl"), "{}\n");
  writeFileSync(join(ccProjects, "C--proj-demo", "bbb.jsonl"), "{}\n");
  writeFileSync(join(ccProjects, "C--proj-demo", "notes.txt"), "not a session\n");
  writeFileSync(join(ccProjects, "C--proj-other", "ccc.jsonl"), "{}\n");

  // Codex layout: <home>/sessions/YYYY/MM/DD/rollout-*.jsonl, project known
  // only from the session_meta first line.
  const cxSessions = join(home, "sessions", "2026", "08", "03");
  mkdirSync(cxSessions, { recursive: true });
  const meta = (cwd: string) =>
    JSON.stringify({ type: "session_meta", payload: { id: "x", cwd } }) + "\n";
  writeFileSync(join(cxSessions, "rollout-a.jsonl"), meta("C:\\proj\\demo"));
  writeFileSync(join(cxSessions, "rollout-b.jsonl"), meta("C:\\proj\\other"));
  writeFileSync(join(cxSessions, "rollout-c.jsonl"), "broken first line\n");

  test("claude-code sessions for one project", () => {
    const found = findClaudeCodeSessions("C:\\proj\\demo", ccProjects);
    expect(found.map((f) => basename(f))).toEqual(["aaa.jsonl", "bbb.jsonl"]);
  });

  test("claude-code sessions across all projects", () => {
    const found = findClaudeCodeSessions(null, ccProjects);
    expect(found.map((f) => basename(f)).sort()).toEqual(["aaa.jsonl", "bbb.jsonl", "ccc.jsonl"]);
  });

  test("codex sessions filtered by cwd, unreadable meta skipped", () => {
    const found = findCodexSessions("C:\\proj\\demo", join(home, "sessions"));
    expect(found.map((f) => basename(f))).toEqual(["rollout-a.jsonl"]);
  });

  test("codex sessions across all projects still skip broken meta", () => {
    const found = findCodexSessions(null, join(home, "sessions"));
    expect(found.map((f) => basename(f)).sort()).toEqual(["rollout-a.jsonl", "rollout-b.jsonl"]);
  });

  test("a missing directory yields an empty list, not a throw", () => {
    expect(findClaudeCodeSessions("C:\\proj\\demo", join(home, "nope"))).toEqual([]);
    expect(findCodexSessions(null, join(home, "nope"))).toEqual([]);
  });
});
