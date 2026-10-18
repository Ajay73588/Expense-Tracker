import type { Cell, RowIssue, Sheet } from "./base.adapter";

/** Lower-case, strip punctuation: "Avg. Price ($)" → "avg price $". */
export function normHeader(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v).toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
}

export function cleanText(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/**
 * Strict number parser. Accepts numbers and strings like "1,234.50", "₹1,234", "$12", "(5.5)".
 * Returns null for blanks AND for anything that is not entirely numeric (no parseFloat leniency).
 */
export function toNumber(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[₹$,\s]/g, "");
  if (s === "" || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function isBlankRow(row: Cell[] | undefined): boolean {
  return !row || row.every((c) => c === null || c === undefined || String(c).trim() === "");
}

export interface HeaderMatch {
  rowIndex: number; // 0-based index into sheet.rows
  cols: Record<string, number>; // canonical key → column index
}

/**
 * Finds the table header row. `spec` maps canonical key → accepted normalized aliases.
 * `required` keys must all be present on the same row. Optional keys are mapped when found.
 */
export function findHeader(
  sheet: Sheet,
  required: Record<string, string[]>,
  optional: Record<string, string[]> = {}
): HeaderMatch | null {
  for (let r = 0; r < sheet.rows.length; r++) {
    const normed = sheet.rows[r].map(normHeader);
    const cols: Record<string, number> = {};
    let ok = true;
    for (const [key, aliases] of Object.entries(required)) {
      const idx = normed.findIndex((h) => aliases.includes(h));
      if (idx < 0) { ok = false; break; }
      cols[key] = idx;
    }
    if (!ok) continue;
    for (const [key, aliases] of Object.entries(optional)) {
      const idx = normed.findIndex((h) => aliases.includes(h));
      if (idx >= 0) cols[key] = idx;
    }
    return { rowIndex: r, cols };
  }
  return null;
}

export interface TableSlice {
  /** [1-based row number, cells] for every data row. */
  dataRows: Array<[number, Cell[]]>;
  /** Footer / total / disclaimer rows that were deliberately skipped. */
  skippedFooter: number;
  /** Non-blank rows after the table that do not look like a footer (reported as warnings). */
  stray: number[];
}

const FOOTER_RE = /^(total|grand total|disclaimer|note|\*)/i;

/**
 * Walks rows under the header. Blank rows BEFORE the first data row are skipped (Groww leaves one);
 * the first blank row AFTER data ends the table. Total/disclaimer rows are footers, not holdings.
 */
export function sliceTable(sheet: Sheet, headerIdx: number, firstCol: number): TableSlice {
  const out: TableSlice = { dataRows: [], skippedFooter: 0, stray: [] };
  let started = false;
  let ended = false;
  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    if (isBlankRow(row)) {
      if (started) ended = true;
      continue;
    }
    const first = cleanText(row[firstCol]) ?? cleanText(row[0]) ?? "";
    if (FOOTER_RE.test(first)) { out.skippedFooter++; ended = true; continue; }
    if (ended) { out.stray.push(r + 1); continue; }
    started = true;
    out.dataRows.push([r + 1, row]);
  }
  return out;
}

export function fatal(message: string): RowIssue {
  return { row: null, message, severity: "error" };
}
export function warn(message: string, row: number | null = null, field?: string): RowIssue {
  return { row, field, message, severity: "warning" };
}

export function normIdentity(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Normalizes folio numbers:
 * - strips trailing .0 if Excel parsed a number as a float (e.g. 12345.0)
 * - collapses whitespace around slashes (e.g. "123 / 45" -> "123/45")
 * - returns null for empty, "-", "N/A", "NA", etc.
 */
export function cleanFolio(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (s === "" || s === "-" || s === "--" || /^n\/?a$/i.test(s) || /^null$/i.test(s)) return null;
  if (/^\d+\.0$/.test(s)) {
    s = s.slice(0, -2);
  }
  s = s.replace(/\s*([/\-])\s*/g, "$1").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export const MONEY_TOLERANCE_ABS = 1; // ₹/$ — reconciliation tolerance for totals (rounding)
