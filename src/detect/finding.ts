export type Category =
  | "provider-api-key"
  | "aws-access-key-id"
  | "aws-secret-access-key"
  | "private-key"
  | "jwt"
  | "connection-string"
  | "email"
  | "phone"
  | "ssn"
  | "credit-card"
  | "env-block"
  | "bulk-personal-data";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Finding {
  category: Category;
  severity: Severity;
  /** Character offsets into the scanned text. The raw value lives only there. */
  start: number;
  end: number;
  /** Redacted at construction — safe to print and to persist. */
  excerpt: string;
  detector: string;
  confidence: number;
}

export type Detector = (text: string) => Finding[];

const KEEP_START = 4;
const KEEP_END = 3;
const MIN_REDACTABLE = 12;

export function redactValue(value: string): string {
  if (value.length < MIN_REDACTABLE) return "[redacted]";
  return `${value.slice(0, KEEP_START)}...${value.slice(-KEEP_END)}`;
}

export function makeFinding(args: {
  category: Category;
  severity: Severity;
  detector: string;
  confidence: number;
  text: string;
  start: number;
  end: number;
  /** For block findings whose header is non-sensitive. Must never contain secret material. */
  safeExcerpt?: string;
}): Finding {
  return {
    category: args.category,
    severity: args.severity,
    start: args.start,
    end: args.end,
    excerpt: args.safeExcerpt ?? redactValue(args.text.slice(args.start, args.end)),
    detector: args.detector,
    confidence: args.confidence
  };
}
