import { defineTableAdapter } from "./table-adapter";
import { cleanText, toNumber } from "./parse-utils";
import { emptyCandidate, type CandidateRow } from "./base.adapter";

/**
 * Groww "Stocks Holdings Statement" — .xlsx, sheet "Sheet1".
 *
 * Layout (from a real export):
 *   rows 1-2  Name / Unique Client Code → NEVER stored
 *   row  4    "Holdings statement for stocks as on <date>"
 *   rows 6-9  Summary: Invested Value, Closing Value, Unrealised P&L
 *   row  11   header: Stock Name | ISIN | Quantity | Average buy price | Buy value |
 *             Closing price | Closing value | Unrealised P&L
 *   rows 12+  holdings
 *
 * CAVEAT: the only real sample supplied for this report had a header but ZERO holdings rows, so the
 * row layout below is inferred from the header names, not from observed data. The export carries an
 * ISIN but no ticker; the ticker/exchange is resolved later by the market-data provider.
 */
export const GrowwStockAdapter = defineTableAdapter({
  broker: "GROWW",
  assetClass: "IN_STOCK",
  required: {
    name: ["stock name"],
    isin: ["isin"],
    qty: ["quantity"],
    avg: ["average buy price"],
  },
  optional: { buyValue: ["buy value"], closing: ["closing price"] },
  expectedColumns: ["Stock Name", "ISIN", "Quantity", "Average buy price"],
  labelColumnKey: "name",
  emptyMessage:
    "This Groww stocks statement contains no holdings (the table is empty). Nothing to import.",

  mapRow(cells, cols, row): CandidateRow {
    const c = emptyCandidate(row, "INR");
    c.name = cleanText(cells[cols.name] ?? null);
    const isin = cleanText(cells[cols.isin] ?? null);
    c.isin = isin ? isin.toUpperCase() : null;
    c.quantity = toNumber(cells[cols.qty] ?? null);
    c.averagePrice = toNumber(cells[cols.avg] ?? null);
    const buy = cols.buyValue !== undefined ? toNumber(cells[cols.buyValue] ?? null) : null;
    c.investedValue =
      buy ?? (c.quantity !== null && c.averagePrice !== null ? c.quantity * c.averagePrice : null);
    c.statementPrice = cols.closing !== undefined ? toNumber(cells[cols.closing] ?? null) : null;
    c.identity = c.isin;
    return c;
  },
});
