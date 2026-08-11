import { makeFinding, type Finding } from "./finding.js";

const URL_WITH_CREDENTIALS_RE =
  /([a-z][a-z0-9+.-]{1,29}):\/\/([A-Za-z0-9._%+-]+):([^\s@/"']+)@([^\s"']+)/g;

const PLACEHOLDER_PASSWORDS = new Set([
  "password",
  "pass",
  "pwd",
  "secret",
  "changeme",
  "change-me",
  "example",
  "yourpassword",
  "your-password",
  "your_password"
]);

const MIN_PASSWORD_LENGTH = 4; // abc/xyz/b in doc examples, never real
const EXAMPLE_HOST_RE = /^(?:[^/?#]*\.)?example\.(?:com|org|net)(?:[:/?#]|$)/i;

function isPlaceholder(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) return true;
  if (/[<>{}$[\]]/.test(password)) return true; // ${VAR}, <password>, [pass]
  if (/^[x*•]+$/i.test(password)) return true;
  return PLACEHOLDER_PASSWORDS.has(password.toLowerCase());
}

export function detectConnectionString(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(URL_WITH_CREDENTIALS_RE)) {
    const [, scheme, user, password, rest] = m as unknown as [string, string, string, string, string];
    if (isPlaceholder(password)) continue;
    if (EXAMPLE_HOST_RE.test(rest)) continue; // documentation URLs
    findings.push(
      makeFinding({
        category: "connection-string",
        severity: "critical",
        detector: "connection-string",
        confidence: 0.9,
        text,
        start: m.index,
        end: m.index + m[0].length,
        safeExcerpt: `${scheme}://${user}:[redacted]@${rest}`
      })
    );
  }
  return findings;
}
