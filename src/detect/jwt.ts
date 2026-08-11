import { makeFinding, type Finding } from "./finding.js";

// Three base64url segments; the first must decode to a JSON header carrying
// "alg". That gate is what separates a JWT from dotted file names and hashes.
const JWT_RE =
  /(?<![A-Za-z0-9_-])ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?![A-Za-z0-9_-])/g;

function headerHasAlg(token: string): boolean {
  const header = token.slice(0, token.indexOf("."));
  try {
    const decoded: unknown = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    return typeof decoded === "object" && decoded !== null && "alg" in decoded;
  } catch {
    return false;
  }
}

export function detectJwt(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(JWT_RE)) {
    if (!headerHasAlg(m[0])) continue;
    findings.push(
      makeFinding({
        category: "jwt",
        severity: "high",
        detector: "jwt",
        confidence: 0.9,
        text,
        start: m.index,
        end: m.index + m[0].length
      })
    );
  }
  return findings;
}
