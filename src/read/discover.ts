import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";

// The slug Claude Code uses for ~/.claude/projects/<slug>: every character
// outside [a-zA-Z0-9] becomes a dash.
export function projectSlug(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, "-");
}

function jsonlFilesIn(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/** Sessions for one project (or all with projectPath null) under <projectsDir>/<slug>/. */
export function findClaudeCodeSessions(projectPath: string | null, projectsDir: string): string[] {
  if (projectPath !== null) {
    return jsonlFilesIn(join(projectsDir, projectSlug(projectPath)));
  }
  let slugs: string[];
  try {
    slugs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(projectsDir, e.name));
  } catch {
    return [];
  }
  return slugs.flatMap(jsonlFilesIn);
}

// session_meta is always the first line, but it can be tens of KB (it embeds
// base_instructions) — read a bounded chunk, never the whole rollout.
const META_CHUNK_BYTES = 256 * 1024;

function readSessionMetaCwd(file: string): string | null {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(META_CHUNK_BYTES);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const chunk = buf.toString("utf8", 0, n);
    const firstLine = chunk.slice(0, chunk.indexOf("\n") === -1 ? undefined : chunk.indexOf("\n"));
    const rec = JSON.parse(firstLine) as { type?: string; payload?: { cwd?: string } };
    if (rec.type !== "session_meta") return null;
    return rec.payload?.cwd ?? null;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

function walkJsonl(dir: string, out: string[]): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkJsonl(p, out);
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

/** Codex rollouts under <sessionsDir>/**, filtered by session_meta cwd. */
export function findCodexSessions(projectPath: string | null, sessionsDir: string): string[] {
  const result: string[] = [];
  for (const file of walkJsonl(sessionsDir, []).sort()) {
    const cwd = readSessionMetaCwd(file);
    if (cwd === null) continue;
    if (projectPath === null || cwd === projectPath) result.push(file);
  }
  return result;
}
