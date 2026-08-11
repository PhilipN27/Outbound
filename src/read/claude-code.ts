import type { Channel, Exchange, ParseResult } from "./exchange.js";

// Record types observed at spec time that carry no prompt text. Ignored
// deliberately — only genuinely unknown types count as skipped, so a format
// bump is visible in the report.
const KNOWN_NON_PROMPT_TYPES = new Set([
  "system",
  "file-history-snapshot",
  "file-history-delta",
  "mode",
  "queue-operation",
  "last-prompt",
  "ai-title",
  "summary",
  "compact-boundary"
]);

interface ClaudeRecord {
  type?: string;
  message?: { role?: string; content?: unknown };
  toolUseResult?: unknown;
  attachment?: { type?: string; hookName?: string; content?: unknown; stdout?: unknown; stderr?: unknown };
  uuid?: string;
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
}

function blockText(block: unknown): string {
  if (typeof block !== "object" || block === null) return "";
  const b = block as { type?: string; text?: unknown; thinking?: unknown; content?: unknown };
  if (b.type === "text" && typeof b.text === "string") return b.text;
  if (b.type === "thinking" && typeof b.thinking === "string") return b.thinking;
  return "";
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(blockText).filter(Boolean).join("\n");
  return "";
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(blockText).filter(Boolean).join("\n");
  return "";
}

function toolResultChannel(toolUseResult: unknown): { channel: Channel; provenance: string } {
  if (typeof toolUseResult === "object" && toolUseResult !== null) {
    const r = toolUseResult as {
      file?: { filePath?: string };
      filePath?: string;
      stdout?: unknown;
      commandName?: unknown;
    };
    if (typeof r.file?.filePath === "string") {
      return { channel: "file-read", provenance: r.file.filePath };
    }
    if (typeof r.filePath === "string") {
      return { channel: "file-read", provenance: r.filePath };
    }
    if (typeof r.stdout === "string") {
      return {
        channel: "command-output",
        provenance: typeof r.commandName === "string" ? r.commandName : "shell"
      };
    }
  }
  return { channel: "tool-result", provenance: "tool" };
}

export function parseClaudeCode(content: string): ParseResult {
  const exchanges: Exchange[] = [];
  const skipped = { malformedLines: 0, unknownRecords: 0 };

  for (const line of content.split("\n")) {
    if (line.trim() === "") continue;
    let rec: ClaudeRecord;
    try {
      rec = JSON.parse(line) as ClaudeRecord;
    } catch {
      skipped.malformedLines++;
      continue;
    }
    const base = {
      sessionId: rec.sessionId ?? "",
      timestamp: rec.timestamp ?? "",
      projectPath: rec.cwd ?? ""
    };

    if (rec.type === "user") {
      const c = rec.message?.content;
      if (Array.isArray(c) && c.some((b: { type?: string }) => b?.type === "tool_result")) {
        for (const block of c as Array<{ type?: string; content?: unknown }>) {
          if (block?.type !== "tool_result") continue;
          const { channel, provenance } = toolResultChannel(rec.toolUseResult);
          exchanges.push({ ...base, channel, provenance, text: toolResultText(block.content) });
        }
      } else {
        exchanges.push({ ...base, channel: "user-prompt", provenance: "user", text: contentText(c) });
      }
    } else if (rec.type === "assistant") {
      exchanges.push({
        ...base,
        channel: "assistant-output",
        provenance: "assistant",
        text: contentText(rec.message?.content)
      });
    } else if (rec.type === "attachment") {
      const a = rec.attachment ?? {};
      const text = [a.content, a.stdout, a.stderr]
        .filter((v): v is string => typeof v === "string" && v !== "")
        .join("\n");
      exchanges.push({
        ...base,
        channel: "attachment",
        provenance: typeof a.hookName === "string" ? a.hookName : (a.type ?? "attachment"),
        text
      });
    } else if (rec.type === undefined || !KNOWN_NON_PROMPT_TYPES.has(rec.type)) {
      skipped.unknownRecords++;
    }
  }

  return { exchanges, skipped };
}
