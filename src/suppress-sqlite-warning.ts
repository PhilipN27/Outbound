// node:sqlite emits an ExperimentalWarning on first use. This module is
// imported before anything that touches sqlite (ESM evaluates imports in
// order), so the CLI stays quiet without silencing other warnings.
const original = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning.message;
  if (text.includes("SQLite")) return;
  (original as (w: string | Error, ...rest: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;
