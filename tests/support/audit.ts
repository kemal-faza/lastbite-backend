/**
 * Shared test helpers for edge-case audit.
 *
 * Keeps assertion logic consistent across all ~50 test files.
 */

import type { Response } from 'supertest';

/** Findings accumulator — populated by `registerFinding`, finalised in the audit report. */
export interface Finding {
  module: string;
  case: string;
  verdict: 'PASS' | 'GAP-correct' | 'BUG-fixed' | 'ACCEPTABLE' | 'SKIP';
  notes?: string;
}

const findings: Finding[] = [];
let currentModule = '';

/** Set the module label for subsequent findings. */
export function setAuditModule(label: string): void {
  currentModule = label;
}

/** Register a finding for the current module. */
export function registerFinding(
  testCase: string,
  verdict: Finding['verdict'],
  notes?: string,
): void {
  findings.push({ module: currentModule, case: testCase, verdict, notes });
}

/** Dump all findings as a markdown table fragment. */
export function dumpFindings(): string {
  const header = '| Modul | Edge Case | Verdict | Catatan |\n|-------|-----------|---------|---------|\n';
  const rows = findings
    .map((f) => `| ${f.module} | ${f.case} | ${f.verdict} | ${f.notes ?? ''} |`)
    .join('\n');
  return `\n### Findings (${findings.length} total)\n\n${header}${rows}\n`;
}

/** Reset findings (call between modules). */
export function resetFindings(): void {
  findings.length = 0;
}

// ── Assertion helpers ───────────────────────────────────────────────

/**
 * Assert the response has the expected error shape.
 *
 * @param res - supertest Response
 * @param expectedStatus - HTTP status code
 * @param expectedCode - optional error code string (e.g. "VALIDATION_ERROR")
 */
export function expectErrorShape(
  res: Response,
  expectedStatus: number,
  expectedCode?: string,
): void {
  expect(res.status).toBe(expectedStatus);
  expect(res.body).toHaveProperty('error');
  if (expectedCode) {
    expect(res.body.code).toBe(expectedCode);
  }
}
