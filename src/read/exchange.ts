export type Channel =
  | "user-prompt"
  | "file-read"
  | "command-output"
  | "tool-result"
  | "assistant-output"
  | "attachment";

export interface Exchange {
  sessionId: string;
  timestamp: string;
  projectPath: string;
  channel: Channel;
  text: string;
  /** File path, command line, or tool name — how this text arrived. */
  provenance: string;
}

export interface SkipCounts {
  malformedLines: number;
  unknownRecords: number;
}

export interface ParseResult {
  exchanges: Exchange[];
  skipped: SkipCounts;
}
