import type { AssetType } from "../types";

/**
 * Portfolio import — adapter contracts.
 *
 *   uploaded file → sheet-reader (CSV/XLS/XLSX → Sheet[]) → ImportAdapter → CandidateRow[]
 *                 → Zod validation (ImportService) → NormalizedHolding[] → AssetService
 *
 * Adapters know ONE broker export layout each. They never touch the database, the network
 * or React. They return raw-but-typed candidates; validation lives in lib/validators/import.ts.
 */

export type Broker = "GROWW" | "INDMONEY";
export type ImportAssetClass = "IN_STOCK" | "US_STOCK" | "MUTUAL_FUND";
export type Currency = "INR" | "USD";

export const BROKER_LABEL: Record<Broker, string> = { GROWW: "Groww", INDMONEY: "INDmoney" };
export const ASSET_CLASS_LABEL: Record<ImportAssetClass, string> = {
  IN_STOCK: "Indian Stocks",
  US_STOCK: "US Stocks",
  MUTUAL_FUND: "Mutual Funds",
};

export type Cell = string | number | boolean | Date | null;
/** rows[i] is spreadsheet row i+1 (1-based row numbers are what we show to users). */
export interface Sheet {
  name: string;
  rows: Cell[][];
}

export type IssueSeverity = "error" | "warning";
export interface RowIssue {
  /** 1-based spreadsheet row, or null for file-level issues. */
  row: number | null;
  field?: string;
  message: string;
  severity: IssueSeverity;
}

/** Un-validated holding as read from a file (numbers already parsed, nulls where unreadable). */
export interface CandidateRow {
  row: number;
  name: string | null;
  symbol: string | null;
  isin: string | null;
  exchange: string | null;
  folio: string | null;
  quantity: number | null;
  averagePrice: number | null;
  investedValue: number | null;
  currency: Currency;
  /** Per-unit price implied by the file itself (closing price / NAV derived from statement). */
  statementPrice: number | null;
  /** Stable identity inside (broker, assetClass): ISIN+folio, ticker, … Used for idempotent re-import. */
  identity: string | null;
}

export interface AdapterResult {
  sheetName: string;
  rows: CandidateRow[];
  /** Fatal problems: wrong/missing columns etc. When non-empty nothing is importable. */
  fatal: RowIssue[];
  /** Non-fatal observations (footers ignored, totals mismatch, empty file…). */
  warnings: RowIssue[];
}

export interface AdapterContext {
  sourceFile: string;
}

export interface ImportAdapter {
  id: string; // e.g. "GROWW:MUTUAL_FUND"
  broker: Broker;
  assetClass: ImportAssetClass;
  /** Columns the adapter requires, for user-facing error messages. */
  expectedColumns: string[];
  /** True when any sheet contains this adapter's table header. Used for "wrong file" hints. */
  matches(sheets: Sheet[]): boolean;
  parse(sheets: Sheet[], ctx: AdapterContext): AdapterResult;
}

/** Fully validated, normalized holding — the only shape AssetService.importHoldings accepts. */
export interface NormalizedHolding {
  type: AssetType; // STOCK | MUTUAL_FUND  (existing domain enum)
  assetClass: ImportAssetClass;
  name: string;
  symbol: string | null;
  isin: string | null;
  exchange: string | null;
  folio: string | null;
  quantity: number;
  /** Per-unit cost, in `currency` (never converted). */
  averagePrice: number;
  /** quantity × averagePrice (or the file's own invested value), in `currency`. */
  investedValue: number;
  currency: Currency;
  /** Price implied by the file at statement date, if any. Not a live market price. */
  statementPrice: number | null;
  importKey: string;
  account: string;
  sourceBroker: string;
  sourceFile: string;
  sourceRow: number;
  importedAt: string;
}

/** Skeleton for rows that only the adapter-specific code knows how to fill. */
export function emptyCandidate(row: number, currency: Currency): CandidateRow {
  return {
    row, name: null, symbol: null, isin: null, exchange: null, folio: null,
    quantity: null, averagePrice: null, investedValue: null, currency,
    statementPrice: null, identity: null,
  };
}
