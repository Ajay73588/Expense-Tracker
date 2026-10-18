import { defineTableAdapter } from "./table-adapter";
import { cleanText, toNumber, warn } from "./parse-utils";
import { emptyCandidate, type CandidateRow } from "./base.adapter";

/**
 * INDmoney US Stocks "HOLDINGS_REPORT" — legacy .xls, sheet "HOLDINGS_BOOK".
 *
 * Layout (from a real export):
 *   rows 1-4  Account Details (Broker Name / Broker Account / Holdings as on) → NEVER stored
 *   row  8    header: Stock Symbol | Holding Since | Quantity | Avg. Price ($) | Total Value ($)
 *   rows 9+   one row per ticker (fractional quantities, up to 9 dp), then blank rows, then a
 *             "Disclaimer:-" block (ignored).
 *
 * IMPORTANT (verified on every row of the sample): "Total Value ($)" == Quantity × Avg. Price ($),
 * i.e. it is the COST BASIS, not the current value. We therefore never use it as a market value;
 * it is only used as a consistency check. Currency comes from the "($)" in the header → USD.
 */
export const INDmoneyUSStockAdapter = defineTableAdapter({
  broker: "INDMONEY",
  assetClass: "US_STOCK",
  required: {
    symbol: ["stock symbol"],
    qty: ["quantity"],
    avg: ["avg price $"],
  },
  optional: { total: ["total value $"], since: ["holding since"] },
  expectedColumns: ["Stock Symbol", "Quantity", "Avg. Price ($)"],
  labelColumnKey: "symbol",
  emptyMessage: "The file has a holdings table but no US stock rows.",

  mapRow(cells, cols, row): CandidateRow {
    const c = emptyCandidate(row, "USD");
    const sym = cleanText(cells[cols.symbol] ?? null);
    c.symbol = sym ? sym.toUpperCase() : null;
    c.name = c.symbol; // the export has no company name; ticker is the display name
    c.exchange = "US";
    c.quantity = toNumber(cells[cols.qty] ?? null);
    c.averagePrice = toNumber(cells[cols.avg] ?? null);
    c.investedValue =
      c.quantity !== null && c.averagePrice !== null ? c.quantity * c.averagePrice : null;
    c.identity = c.symbol;
    return c;
  },

  rowWarnings(cand, cells, cols) {
    if (cols.total === undefined || cand.investedValue === null) return [];
    const total = toNumber(cells[cols.total] ?? null);
    if (total === null) return [];
    const diff = Math.abs(cand.investedValue - total);
    if (diff > Math.max(0.05, total * 0.02)) {
      return [
        warn(
          `Total Value ($${total}) does not equal Quantity × Avg. Price ($${cand.investedValue.toFixed(2)}); using Quantity × Avg. Price as invested value.`,
          cand.row,
          "Total Value ($)"
        ),
      ];
    }
    return [];
  },
});
