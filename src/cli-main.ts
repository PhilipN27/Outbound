import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DETECTORS_VERSION } from "./detect/index.js";
import { htmlReport } from "./report/html.js";
import { jsonReport } from "./report/json.js";
import { terminalReport } from "./report/terminal.js";
import { runScan } from "./scan.js";
import { openStore } from "./store/store.js";

const USAGE = `outbound — see what your coding agent has been sending to the model provider

Usage:
  outbound scan [options]      scan this project's agent sessions

Options:
  --project <path>   project to scan (default: current directory)
  --all              scan the full history across all projects
  --json             print the report as JSON
  --out <file>       also write a self-contained HTML report
`;

export interface CliResult {
  exitCode: number;
  output: string;
}

type Env = Record<string, string | undefined>;

export function cliMain(argv: string[], env: Env = process.env): CliResult {
  const [command, ...rest] = argv;
  if (command !== "scan") {
    return { exitCode: 1, output: USAGE };
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        project: { type: "string" },
        all: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        out: { type: "string" }
      }
    }));
  } catch (err) {
    return { exitCode: 1, output: `${(err as Error).message}\n\n${USAGE}` };
  }

  const home = homedir();
  const io = {
    claudeProjectsDir: env.OUTBOUND_CLAUDE_PROJECTS ?? join(home, ".claude", "projects"),
    codexSessionsDir: env.OUTBOUND_CODEX_SESSIONS ?? join(home, ".codex", "sessions")
  };
  const stateDir = env.OUTBOUND_STATE_DIR ?? join(home, ".outbound");
  const stateDirExisted = existsSync(stateDir);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32" && (!stateDirExisted || env.OUTBOUND_STATE_DIR === undefined)) {
    chmodSync(stateDir, 0o700);
  }

  const projectPath = values.all ? null : (values.project ?? process.cwd());

  const store = openStore(join(stateDir, "outbound.sqlite"), DETECTORS_VERSION);
  try {
    const report = runScan({ projectPath, io, store });
    if (values.out !== undefined) {
      writeFileSync(values.out, htmlReport(report), { encoding: "utf8", mode: 0o600 });
      if (process.platform !== "win32") chmodSync(values.out, 0o600);
    }
    const output = values.json ? jsonReport(report) : terminalReport(report);
    return { exitCode: 0, output };
  } finally {
    store.close();
  }
}
