import type { Exchange, ParseResult } from "./exchange.js";

// Top-level record types that carry no prompt text (event_msg duplicates the
// message records; world_state, turn_context, compacted are bookkeeping).
const KNOWN_NON_PROMPT_TYPES = new Set([
  "event_msg",
  "turn_context",
  "world_state",
  "compacted",
  "inter_agent_communication_metadata"
]);


interface CodexRecord {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    id?: string;
    cwd?: string;
    role?: string;
    content?: unknown;
    name?: string;
    arguments?: string;
    input?: string;
    call_id?: string;
    output?: unknown;
    author?: string;
  };
}

function messageText(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === "string" ? content : "";
  return content
    .map((b: { type?: string; text?: unknown }) =>
      (b?.type === "input_text" || b?.type === "output_text") && typeof b.text === "string"
        ? b.text
        : ""
    )
    .filter(Boolean)
    .join("\n");
}

function commandProvenance(name: string | undefined, args: string | undefined): string {
  if (args !== undefined) {
    try {
      const parsed = JSON.parse(args) as { command?: unknown };
      if (Array.isArray(parsed.command)) return parsed.command.join(" ");
      if (typeof parsed.command === "string") return parsed.command;
    } catch {
      // fall through to the tool name
    }
  }
  return name ?? "tool";
}

const SHELL_TOOL_RE = /shell|exec/i;

export function parseCodex(content: string): ParseResult {
  const exchanges: Exchange[] = [];
  const skipped = { malformedLines: 0, unknownRecords: 0 };
  let sessionId = "";
  let projectPath = "";
  const calls = new Map<string, { name: string; provenance: string }>();

  for (const line of content.split("\n")) {
    if (line.trim() === "") continue;
    let rec: CodexRecord;
    try {
      rec = JSON.parse(line) as CodexRecord;
    } catch {
      skipped.malformedLines++;
      continue;
    }
    const p = rec.payload ?? {};
    const base = { sessionId, timestamp: rec.timestamp ?? "", projectPath };

    if (rec.type === "session_meta") {
      sessionId = p.id ?? "";
      projectPath = p.cwd ?? "";
    } else if (rec.type === "response_item") {
      if (p.type === "message") {
        const role = p.role ?? "user";
        exchanges.push({
          ...base,
          channel: role === "assistant" ? "assistant-output" : "user-prompt",
          provenance: role === "assistant" ? "assistant" : role,
          text: messageText(p.content)
        });
      } else if (p.type === "function_call" || p.type === "custom_tool_call") {
        if (p.call_id !== undefined) {
          calls.set(p.call_id, {
            name: p.name ?? "tool",
            provenance: commandProvenance(p.name, p.arguments)
          });
        }
      } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
        const call = p.call_id !== undefined ? calls.get(p.call_id) : undefined;
        const isShell = call !== undefined && SHELL_TOOL_RE.test(call.name);
        exchanges.push({
          ...base,
          channel: isShell ? "command-output" : "tool-result",
          provenance: isShell ? call.provenance : (call?.name ?? "tool"),
          text: typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? "")
        });
      } else if (p.type === "agent_message") {
        exchanges.push({
          ...base,
          channel: "assistant-output",
          provenance: p.author ?? "agent",
          text: messageText(p.content)
        });
      } else if (p.type !== "reasoning") {
        // reasoning payloads are encrypted model-side artifacts; anything else
        // under response_item is a shape this adapter has never seen.
        skipped.unknownRecords++;
      }
    } else if (rec.type === undefined || !KNOWN_NON_PROMPT_TYPES.has(rec.type)) {
      skipped.unknownRecords++;
    }
  }

  return { exchanges, skipped };
}
