import type { ScanReportData } from "../scan.js";

export function jsonReport(report: ScanReportData): string {
  return JSON.stringify({ version: 1, ...report }, null, 2);
}
