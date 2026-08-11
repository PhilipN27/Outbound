// Regenerates the labelled synthetic corpus. Deterministic: run any time,
// commit the outputs. Every credential below is invented; none is live.
//   node corpus/generate.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "labelled");
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- plants
// Each plant: [category, value, channelHint]. Values are unique so grouped
// findings count 1:1. "hard" plants are shapes Outbound knowingly does not
// detect; they stay in the corpus so the published recall is honest.
// Provider-key plants are assembled from prefix + body at generation time so
// no contiguous token-shaped literal exists in committed source — realistic
// synthetic tokens trip GitHub push protection (verified: it blocked the
// glpat plant). The generated transcripts are gitignored for the same reason.
const join2 = (prefix, body) => prefix + body;
const plants = [
  ["provider-api-key", join2("sk-ant-", "api03-Qw8ZrT2xVb9Lk4Mn6Yh1Jc3Pf5Gd7Sa0uEiOrHlXz"), "paste"],
  ["provider-api-key", join2("sk-proj-", "Vb9Lk4Rt6Yh8Jn1Mc3Pf5Gd0SaQw2Zx7uEiOr"), "file"],
  ["provider-api-key", join2("sk-", "Zx7Cq1Wt4Rb8Nm2Kf6Jh0Vd3Ps9Ga5uYe"), "command"],
  ["provider-api-key", join2("ghp_", "Tk4Rt6Yh8Jn1Mc3Pf5Gd0SaQw2Zx7uEiOrHlVb9L"), "paste"],
  ["provider-api-key", join2("xoxb-", "Fh3Jn1Mc8Zx9v8Bq2Lw4Rt6Yh8Jn1Mc3P"), "file"],
  ["provider-api-key", join2("glpat-", "Xk29fLmQ7vNzR4tYw8cJ"), "command"],
  ["aws-access-key-id", "AKIA7G2XQ9LZTV4WM8RD", "paste"],
  ["aws-access-key-id", "AKIA3XN5B8KQJ2W9TR6C", "file"],
  ["aws-access-key-id", "ASIA5PW2VX8LQ4ZK7MB3", "command"],
  ["aws-access-key-id", "AKIA9RT4YU6IK1LP3ZXQ", "file"],
  ["aws-secret-access-key", "aws_secret_access_key = mV3xQ9pL7dR2wN8bK4jH6fT1sG5aZ0cY/EuOiXrn", "file"],
  ["aws-secret-access-key", "AWS_SECRET_ACCESS_KEY=zB8nM2kL5xW9qP3vR7tY1uJ4hG6fD0sA/ceoIrEx", "command"],
  ["aws-secret-access-key", 'SecretAccessKey": "pQ4wE8rT2yU6iO0aS3dF7gH1jK5lZ9xC/vbNmuYe', "paste"],
  ["private-key", ["-----BEGIN RSA PRIVATE KEY-----", "MIIEpAIBAAKCAQEAxT9kWm2Lq8Rf4Zb7Yc1nJ3dG6hK5sP0uOiEwArMv", "-----END RSA PRIVATE KEY-----"].join("\\n"), "file"],
  ["private-key", ["-----BEGIN OPENSSH PRIVATE KEY-----", "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMw", "-----END OPENSSH PRIVATE KEY-----"].join("\\n"), "command"],
  ["private-key", ["-----BEGIN EC PRIVATE KEY-----", "MHcCAQEEIIrs0eKzTzpQf8Xn2Wv5Yb9Lc4Rd7Gh1Jk6Mp3Sa0uZ"].join("\\n"), "paste"],
  ["jwt", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvdXQtMSIsImlhdCI6MTcyMzMwMDAwMH0.Rw8yT2qL5xV9nB3mK7jF4hD6gS1aP0uZcEirOxYe", "paste"],
  ["jwt", "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvdXQtMiIsImlhdCI6MTcyMzMwMDAwMX0.aB3cD5eF7gH9iJ1kL2mN4oP6qR8sT0uVwXyZbdfh", "file"],
  ["jwt", "eyJhbGciOiJFUzI1NiIsImtpZCI6ImstMyJ9.eyJzdWIiOiJvdXQtMyIsImlhdCI6MTcyMzMwMDAwMn0.mN4oP6qR8sT0uVaB3cD5eF7gH9iJ1kL2wXyZfhbd", "command"],
  ["connection-string", "postgres://svc_report:Vq7xN2mB9kL4wR8t@pg.internal.corp:5432/reports", "file"],
  ["connection-string", "mysql://etl:Jh6fT1sG5aZ0cYm3@10.20.0.7:3306/warehouse", "command"],
  ["connection-string", "amqp://worker:Xr4vB8nM2kL5qP9w@queue.internal:5672/jobs", "paste"],
  ["connection-string", "mongodb://ingest:Ty1uJ4hG6fD0sA8e@mongo.internal:27017/events", "file"],
  ["email", "priya.raman@lumenanalytics.io", "paste"],
  ["email", "tom.eriksen@nordicfreight.no", "file"],
  ["email", "a.okonkwo@lagosfintech.ng", "command"],
  ["email", "mei.chen.dev@pearlriver.cn", "paste"],
  ["email", "lucas.ferreira@saopaulotech.br", "file"],
  ["email", "k.svoboda@praguesoft.cz", "command"],
  ["phone", "+1 (628) 555-0147", "paste"],
  ["phone", "628-555-0193", "file"],
  ["phone", "+442071838750", "command"],
  ["phone", "+61 2 5550 4321", "paste"],
  ["phone", "(415) 555-0184", "file"],
  ["ssn", "219-09-9999", "paste"],
  ["ssn", "457-55-5462", "file"],
  ["ssn", "123-45-6789", "command"],
  ["credit-card", "4111111111111111", "paste"],
  ["credit-card", "378282246310005", "file"],
  ["credit-card", "5555 5555 5555 4444", "command"],
  ["credit-card", "6011111111111117", "file"],
  ["env-block", ["APP_ENV=production", "API_TOKEN=fR7tY1uJ4hG6fD0sA3xQ9pL7dR2wN8bK", "DB_PASSWORD=kW9qP3vR7tY1uJ4hG6fD0sA8eZ5xC2vB", "REGION=eu-west-1"].join("\\n"), "file"],
  ["env-block", ["SERVICE_NAME=billing", "SIGNING_SECRET=aZ0cYm3V3xQ9pL7dR2wN8bK4jH6fT1sG", "RETRIES=3"].join("\\n"), "command"],
  ["bulk-personal-data", ["id,name,email,plan", "1,Ana Silva,ana.silva@voltaictech.pt,pro", "2,Ori Levi,ori.levi@negevcloud.il,free", "3,Jon Marsh,jon.marsh@tundradata.ca,pro", "4,Su Park,su.park@hanriversoft.kr,team", "5,Ivo Kral,ivo.kral@vltavalabs.cz,pro"].join("\\n"), "file"]
];

// Shapes Outbound deliberately does not detect. They are planted, counted
// against recall, and expected to be missed — the honest part of the table.
const hardMisses = [
  ["ssn", "078051120", "paste"],
  ["phone", "6285550109", "file"],
  ["aws-secret-access-key", "bare40: nV3xQ9pL7dR2wN8bK4jH6fT1sG5aZ0cY7EuOiXrq", "command"]
];

// ---------------------------------------------------- transcript builders
function ccLine(obj) {
  return JSON.stringify(obj);
}

function buildClaudeCode(sessionId, items) {
  const lines = [];
  let t = 0;
  const ts = () => `2026-08-05T10:${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t++ % 60).padStart(2, "0")}.000Z`;
  const base = { cwd: "C:\\corpus\\demo", sessionId, version: "2.0.0" };
  for (const [i, { value, channel }] of items.entries()) {
    const text = value.replaceAll("\\n", "\n");
    if (channel === "paste") {
      lines.push(ccLine({ ...base, type: "user", uuid: `u${i}`, timestamp: ts(), message: { role: "user", content: `while debugging I saw this: ${text} — is that a problem?` } }));
    } else if (channel === "file") {
      lines.push(ccLine({ ...base, type: "user", uuid: `u${i}`, timestamp: ts(), toolUseResult: { type: "text", file: { filePath: `C:\\corpus\\demo\\cfg-${i}.txt` } }, message: { role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: [{ type: "text", text }] }] } }));
    } else {
      lines.push(ccLine({ ...base, type: "user", uuid: `u${i}`, timestamp: ts(), toolUseResult: { stdout: text, stderr: "", interrupted: false, isImage: false }, message: { role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: text }] } }));
    }
  }
  lines.push(ccLine({ ...base, type: "assistant", uuid: "a-end", timestamp: ts(), message: { role: "assistant", content: [{ type: "text", text: "Reviewed the material above." }] } }));
  return lines.join("\n") + "\n";
}

function buildCodex(sessionId, items) {
  const lines = [];
  let t = 0;
  const ts = () => `2026-08-06T14:${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t++ % 60).padStart(2, "0")}.000Z`;
  lines.push(JSON.stringify({ timestamp: ts(), type: "session_meta", payload: { id: sessionId, timestamp: "2026-08-06T14:00:00.000Z", cwd: "C:\\corpus\\demo" } }));
  for (const [i, { value, channel }] of items.entries()) {
    const text = value.replaceAll("\\n", "\n");
    if (channel === "paste") {
      lines.push(JSON.stringify({ timestamp: ts(), type: "response_item", payload: { type: "message", id: `m${i}`, role: "user", content: [{ type: "input_text", text: `please review: ${text}` }] } }));
    } else {
      // codex reads files through the shell, so "file" and "command" both
      // arrive as function_call_output
      lines.push(JSON.stringify({ timestamp: ts(), type: "response_item", payload: { type: "function_call", id: `f${i}`, name: "shell", arguments: JSON.stringify({ command: ["cat", `cfg-${i}.txt`] }), call_id: `c${i}` } }));
      lines.push(JSON.stringify({ timestamp: ts(), type: "response_item", payload: { type: "function_call_output", id: `o${i}`, call_id: `c${i}`, output: text } }));
    }
  }
  return lines.join("\n") + "\n";
}

// ------------------------------------------------------------- assemble
// Split plants between the two formats so both readers are exercised.
const all = [...plants, ...hardMisses].map(([category, value, channel]) => ({ category, value, channel }));
const ccItems = all.filter((_, i) => i % 2 === 0);
const cxItems = all.filter((_, i) => i % 2 === 1);

const files = [];

writeFileSync(join(outDir, "planted-claude-code.jsonl"), buildClaudeCode("corpus-cc-1", ccItems));
files.push({ name: "planted-claude-code.jsonl", format: "claude-code", planted: ccItems.map(({ category, value }) => ({ category, value })) });

writeFileSync(join(outDir, "planted-codex.jsonl"), buildCodex("corpus-cx-1", cxItems));
files.push({ name: "planted-codex.jsonl", format: "codex", planted: cxItems.map(({ category, value }) => ({ category, value })) });

// Clean transcripts: ordinary chatter plus the entire hard-negative corpus
// arriving as a file read. Expected findings: zero.
const hardNegatives = readFileSync(join(here, "fixtures", "hard-negatives.txt"), "utf8");
const cleanItems = [
  { value: "How do I paginate this API without loading everything into memory?", channel: "paste" },
  { value: hardNegatives.replaceAll("\n", "\\n"), channel: "file" },
  { value: "npm warn deprecated glob@7.2.3\\nadded 212 packages in 4s", channel: "command" }
];
writeFileSync(join(outDir, "clean-claude-code.jsonl"), buildClaudeCode("corpus-cc-clean", cleanItems));
files.push({ name: "clean-claude-code.jsonl", format: "claude-code", planted: [] });
writeFileSync(join(outDir, "clean-codex.jsonl"), buildCodex("corpus-cx-clean", cleanItems));
files.push({ name: "clean-codex.jsonl", format: "codex", planted: [] });

writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ files }, null, 2) + "\n");
console.log(`wrote ${files.length} transcripts + manifest to corpus/labelled/`);
console.log(`plants: ${plants.length} detectable + ${hardMisses.length} deliberate hard misses`);
