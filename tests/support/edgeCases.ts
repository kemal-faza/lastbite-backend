/**
 * Shared edge-case fixtures for all test modules.
 *
 * Centralised to avoid duplicating malicious / boundary inputs across 50 test files.
 * Each export is a simple read-only array of string or number values.
 */

// ── Strings ──────────────────────────────────────────────────────────

/** Empty / blank / too-short string inputs */
export const emptyStrings = ['', ' '];

/** Whitespace-only / invisible-char inputs (potential parsing bypasses) */
export const whitespaceStrings = ['  ', '\t', '\n', '\r\n'];

/** SQL injection payloads (value-level; assumes escaped queries) */
export const sqlInjection = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM users --",
  "1; DROP TABLE products CASCADE",
  "' OR 1=1 --",
];

/** XSS / HTML injection payloads */
export const xssPayloads = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  'javascript:alert(1)',
];

/** Unicode / emoji / mixed-script inputs (encoding issues) */
export const unicodeStrings = [
  '佐藤',           // CJK
  'أحمد',           // Arabic
  'émoji test ✓',   // accented + symbol
  '😀🔥🚀',         // pure emoji
  'הוֹי',           // RTL Hebrew
  "'",              // single quote (SQL edge)
  '"',              // double quote
  '\\',             // backslash
  '%',              // LIKE wildcard
  '_',              // LIKE wildcard
];

/** Very long string (e.g. 10k chars) to test field-length limits */
export function longString(length = 10_000): string {
  return 'x'.repeat(length);
}

/** Strings that look valid but are subtly wrong */
export const trickyStrings = [
  'a@b',            // top-level domain missing
  'a@b.c',          // TLD too short
  'test@example',   // no TLD
  'test@.com',      // empty domain
  '@example.com',   // no local part
];

// ── Emails ──────────────────────────────────────────────────────────

export const badEmails = [
  '',
  'not-an-email',
  'test@',
  '@domain.com',
  'a@b',
  'test@.com',
  'test@domain',
];

export const caseVariantsOfEmail = { lower: 'test@example.com', upper: 'Test@Example.Com' };

// ── UUIDs ───────────────────────────────────────────────────────────

export const badUuids = [
  '',
  'not-a-uuid',
  '00000000-0000-0000-0000-00000000000Z', // invalid char
  '00000000-0000-0000-0000',               // truncated
  'garbage',
];

// ── Phone numbers ───────────────────────────────────────────────────

export const badPhones = [
  '',
  '123',              // too short
  'not-a-phone',
  '+6281',            // too short
  '081',              // too short
  'a'.repeat(20),     // too long
];

// ── Prices / Numbers ────────────────────────────────────────────────

export const invalidPrices = [-1, 0, -10000, 1.999, NaN, Infinity];
export const invalidStock = [-1, -5, 1.5, NaN, Infinity];
export const zeroOrNegative = [-1, 0, -100];

// ── Categories ──────────────────────────────────────────────────────

export const invalidCategories = ['', 'non-existent-category', 'MEALS', ' Meals '];

// ── Coordinates ─────────────────────────────────────────────────────

export const invalidLats = [-91, 91, -200, 200, NaN, Infinity];
export const invalidLngs = [-181, 181, -500, 500, NaN, Infinity];
