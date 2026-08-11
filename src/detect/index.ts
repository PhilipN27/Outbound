import type { Detector, Finding } from "./finding.js";
import { detectAws } from "./aws.js";
import { detectBulkPersonal } from "./bulk-personal.js";
import { detectConnectionString } from "./connection-string.js";
import { detectEnvBlock } from "./env-block.js";
import { detectCreditCard } from "./credit-card.js";
import { detectEmail } from "./email.js";
import { detectJwt } from "./jwt.js";
import { detectPhone } from "./phone.js";
import { detectPrivateKey } from "./private-key.js";
import { detectProviderKeys } from "./provider-keys.js";
import { detectSsn } from "./ssn.js";

export type { Category, Detector, Finding, Severity } from "./finding.js";
export { makeFinding, redactValue } from "./finding.js";

export const allDetectors: Record<string, Detector> = {
  "provider-keys": detectProviderKeys,
  aws: detectAws,
  "private-key": detectPrivateKey,
  jwt: detectJwt,
  "connection-string": detectConnectionString,
  email: detectEmail,
  phone: detectPhone,
  ssn: detectSsn,
  "credit-card": detectCreditCard,
  "env-block": detectEnvBlock,
  "bulk-personal": detectBulkPersonal
};

// One bulk finding beats fifty row-level ones, and user:pass@host is not an
// email address: email/phone matches contained in a bulk or connection-string
// finding are dropped here, not in each detector.
const CONTAINER_CATEGORIES = new Set(["bulk-personal-data", "connection-string"]);

export function runDetectors(text: string): Finding[] {
  const all = Object.values(allDetectors).flatMap((detector) => detector(text));
  const containers = all.filter((f) => CONTAINER_CATEGORIES.has(f.category));
  return all
    .filter(
      (f) =>
        !(
          (f.category === "email" || f.category === "phone") &&
          containers.some((c) => f.start >= c.start && f.end <= c.end)
        )
    )
    .sort((a, b) => a.start - b.start);
}
