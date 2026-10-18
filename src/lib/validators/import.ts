import { z } from "zod";
import type { CandidateRow, ImportAssetClass, NormalizedHolding, RowIssue, Broker } from "../../adapters/base.adapter";
import { BROKER_LABEL } from "../../adapters/base.adapter";

export const importRequestSchema = z.object({
  broker: z.enum(["GROWW", "INDMONEY"], { errorMap: () => ({ message: "Unsupported broker" }) }),
  assetClass: z.enum(["IN_STOCK", "US_STOCK", "MUTUAL_FUND"], {
    errorMap: () => ({ message: "Unsupported asset type" }),
  }),
  /** false → preview only (no writes). true → re-parse, re-validate and persist. */
  confirm: z.boolean().default(false),
  /** Soft-delete holdings of the same broker+account+asset type that are absent from this file. */
  replaceMissing: z.boolean().default(false),
  /** The account to import into. If omitted, defaults to the broker name. */
  account: z.string().trim().max(50).optional(),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const US_TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

const num = (label: string) =>
  z.number({ required_error: `Missing ${label}`, invalid_type_error: `Invalid ${label}` }).finite(`Invalid ${label}`);

const baseShape = {
  name: z.string({ required_error: "Missing name", invalid_type_error: "Missing name" }).min(1, "Missing name").max(200),
  quantity: num("quantity").positive("Invalid quantity (must be greater than 0)"),
  averagePrice: num("average price").nonnegative("Invalid average price (cannot be negative)"),
  investedValue: num("invested value").nonnegative("Invalid invested value (cannot be negative)"),
  currency: z.enum(["INR", "USD"], { errorMap: () => ({ message: "Unsupported currency" }) }),
};

const inStockSchema = z.object({
  ...baseShape,
  currency: z.literal("INR", { errorMap: () => ({ message: "Unsupported currency (expected INR)" }) }),
  isin: z.string({ required_error: "Missing ISIN", invalid_type_error: "Missing ISIN" }).regex(ISIN_RE, "Invalid ISIN"),
});
const usStockSchema = z.object({
  ...baseShape,
  currency: z.literal("USD", { errorMap: () => ({ message: "Unsupported currency (expected USD)" }) }),
  symbol: z.string({ required_error: "Missing symbol", invalid_type_error: "Missing symbol" }).regex(US_TICKER_RE, "Invalid ticker symbol"),
});
const mfSchema = z.object({
  ...baseShape,
  currency: z.literal("INR", { errorMap: () => ({ message: "Unsupported currency (expected INR)" }) }),
  folio: z.string().trim().min(1).nullable().optional(),
  isin: z.string().regex(ISIN_RE, "Invalid ISIN").nullable().optional(), // present for INDmoney, absent for Groww
});

const SCHEMAS: Record<ImportAssetClass, z.ZodTypeAny> = {
  IN_STOCK: inStockSchema,
  US_STOCK: usStockSchema,
  MUTUAL_FUND: mfSchema,
};

export interface ValidationContext {
  broker: Broker;
  assetClass: ImportAssetClass;
  sourceFile: string;
  importedAt: string;
  account?: string | null;
}

/**
 * Validates adapter output row-by-row. Never throws; every bad row becomes a RowIssue.
 * Duplicate identities inside one file are aggregated for mutual funds (e.g. multiple SIP tranches/folios),
 * or rejected for other asset classes.
 */
export function validateCandidates(
  candidates: CandidateRow[],
  ctx: ValidationContext
): { holdings: NormalizedHolding[]; issues: RowIssue[] } {
  const schema = SCHEMAS[ctx.assetClass];
  const holdings: NormalizedHolding[] = [];
  const issues: RowIssue[] = [];
  const seenRow = new Map<string, number>();
  const seenIndex = new Map<string, number>();

  for (const c of candidates) {
    const parsed = schema.safeParse(c);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        issues.push({ row: c.row, field: String(i.path[0] ?? ""), message: i.message, severity: "error" });
      }
      continue;
    }
    if (!c.identity) {
      issues.push({ row: c.row, message: "Missing identifier", severity: "error" });
      continue;
    }
    const importKey = `${ctx.broker}|${ctx.assetClass}|${ctx.account ?? BROKER_LABEL[ctx.broker]}|${c.identity}`;
    const dupIndex = seenIndex.get(importKey);
    if (dupIndex !== undefined) {
      if (ctx.assetClass === "MUTUAL_FUND") {
        const existing = holdings[dupIndex];
        const addedQty = c.quantity as number;
        const addedInvested = c.investedValue as number;
        const prevQty = existing.quantity;
        const prevInvested = existing.investedValue;
        const newQty = prevQty + addedQty;
        const newInvested = prevInvested + addedInvested;

        let newStatementPrice: number | null = null;
        if (existing.statementPrice !== null && c.statementPrice !== null) {
          const prevVal = existing.statementPrice * prevQty;
          const newVal = (c.statementPrice as number) * addedQty;
          newStatementPrice = newQty > 0 ? (prevVal + newVal) / newQty : null;
        } else {
          newStatementPrice = existing.statementPrice ?? (c.statementPrice !== null && c.statementPrice > 0 ? c.statementPrice : null);
        }

        existing.quantity = newQty;
        existing.investedValue = newInvested;
        existing.averagePrice = newQty > 0 ? newInvested / newQty : existing.averagePrice;
        existing.statementPrice = newStatementPrice;

        issues.push({
          row: c.row,
          message: `Consolidated with row ${seenRow.get(importKey)} (same scheme and folio). Units and invested value aggregated.`,
          severity: "warning",
        });
        continue;
      }

      issues.push({
        row: c.row,
        message: `Duplicate of row ${seenRow.get(importKey)} (same security); row skipped`,
        severity: "error",
      });
      continue;
    }
    seenRow.set(importKey, c.row);
    seenIndex.set(importKey, holdings.length);

    holdings.push({
      type: ctx.assetClass === "MUTUAL_FUND" ? "MUTUAL_FUND" : "STOCK",
      assetClass: ctx.assetClass,
      name: c.name as string,
      symbol: c.symbol,
      isin: c.isin,
      exchange: c.exchange,
      folio: c.folio,
      quantity: c.quantity as number,
      averagePrice: c.averagePrice as number,
      investedValue: c.investedValue as number,
      currency: c.currency,
      statementPrice: c.statementPrice !== null && c.statementPrice > 0 ? c.statementPrice : null,
      importKey,
      account: ctx.account ?? BROKER_LABEL[ctx.broker],
      sourceBroker: BROKER_LABEL[ctx.broker],
      sourceFile: ctx.sourceFile,
      sourceRow: c.row,
      importedAt: ctx.importedAt,
    });
  }
  return { holdings, issues };
}
