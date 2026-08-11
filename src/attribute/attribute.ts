import { createHmac } from "node:crypto";
import { runDetectors } from "../detect/index.js";
import type { Category, Severity } from "../detect/index.js";
import type { Channel, Exchange } from "../read/exchange.js";

export interface Route {
  channel: Channel;
  provenance: string;
  sessionId: string;
  timestamp: string;
}

export interface GroupedFinding {
  /** HMAC-SHA256 of the raw value with the per-install salt. Never reversible to the value. */
  valueHash: string;
  category: Category;
  severity: Severity;
  detector: string;
  confidence: number;
  excerpt: string;
  recurrence: number;
  routes: Route[];
  firstSeen: string;
  lastSeen: string;
}

// The raw value exists only inside this function, to compute the salted
// hash. It is never a field of anything returned.
export function attribute(exchanges: Exchange[], salt: string): GroupedFinding[] {
  const groups = new Map<string, GroupedFinding>();

  for (const exchange of exchanges) {
    for (const finding of runDetectors(exchange.text)) {
      const raw = exchange.text.slice(finding.start, finding.end);
      const valueHash = createHmac("sha256", salt).update(raw).digest("hex");
      const route: Route = {
        channel: exchange.channel,
        provenance: exchange.provenance,
        sessionId: exchange.sessionId,
        timestamp: exchange.timestamp
      };
      const existing = groups.get(valueHash);
      if (existing === undefined) {
        groups.set(valueHash, {
          valueHash,
          category: finding.category,
          severity: finding.severity,
          detector: finding.detector,
          confidence: finding.confidence,
          excerpt: finding.excerpt,
          recurrence: 1,
          routes: [route],
          firstSeen: exchange.timestamp,
          lastSeen: exchange.timestamp
        });
      } else {
        existing.recurrence++;
        existing.routes.push(route);
        if (exchange.timestamp < existing.firstSeen) existing.firstSeen = exchange.timestamp;
        if (exchange.timestamp > existing.lastSeen) existing.lastSeen = exchange.timestamp;
      }
    }
  }

  return [...groups.values()];
}
