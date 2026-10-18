import { defineTableAdapter } from "./table-adapter";
import { cleanFolio, cleanText, normHeader, normIdentity, toNumber, warn, MONEY_TOLERANCE_ABS } from "./parse-utils";
import { emptyCandidate, type CandidateRow, type RowIssue, type Sheet } from "./base.adapter";

/**
 * INDmoney "Holdings report" (Mutual Funds) — .xlsx, sheet "Sheet1".
 *
 * Layout (from a real export):
 *   rows 1-4  title, Name, PAN  → NEVER read or stored
 *   rows 6-8  Summary: "Total Invested value" | value, "Total Current value" | value
 *   row  10   header: Fund Name | ISIN | Total Units | Invested Value | Current Value | Folio Number
 *   rows 11+  one row per (scheme ISIN, folio); all numbers are text.
 * Has ISIN (good for NAV lookup) but no average-price column: derived as Invested Value ÷ Units.
 */
function readLabelValue(sheet: Sheet, label: string): number | null {
  for (const row of sheet.rows) {
    if (normHeader(row[0] ?? null) === label) return toNumber(row[1] ?? null);
  }
  return null;
}

export const INDmoneyMutualFundAdapter = defineTableAdapter({
  broker: "INDMONEY",
  assetClass: "MUTUAL_FUND",
  required: {
    name: ["fund name"],
    isin: ["isin"],
    units: ["total units"],
    invested: ["invested value"],
    current: ["current value"],
    folio: ["folio number", "folio no", "folio"],
  },
  expectedColumns: ["Fund Name", "ISIN", "Total Units", "Invested Value", "Current Value", "Folio Number"],
  labelColumnKey: "name",
  emptyMessage: "The file has a holdings table but no mutual-fund rows.",

  mapRow(cells, cols, row): CandidateRow {
    const c = emptyCandidate(row, "INR");
    const units = toNumber(cells[cols.units] ?? null);
    const invested = toNumber(cells[cols.invested] ?? null);
    const current = toNumber(cells[cols.current] ?? null);
    c.name = cleanText(cells[cols.name] ?? null);
    const isin = cleanText(cells[cols.isin] ?? null);
    c.isin = isin ? isin.toUpperCase() : null;
    c.folio = cleanFolio(cells[cols.folio] ?? null);
    c.quantity = units;
    c.investedValue = invested;
    c.averagePrice = units !== null && units > 0 && invested !== null ? invested / units : null;
    c.statementPrice = units !== null && units > 0 && current !== null ? current / units : null;
    const baseId = c.isin ?? (c.name ? normIdentity(c.name) : null);
    c.identity = baseId ? (c.folio ? normIdentity(`${baseId}|${c.folio}`) : normIdentity(baseId)) : null;
    return c;
  },

  reconcile(sheet, rows): RowIssue[] {
    const total = readLabelValue(sheet, "total invested value");
    if (total === null) return [];
    const sum = rows.reduce((s, r) => s + (r.investedValue ?? 0), 0);
    return Math.abs(sum - total) > MONEY_TOLERANCE_ABS
      ? [warn(`Sum of Invested Value (${sum.toFixed(2)}) differs from the file's Total Invested value (${total.toFixed(2)}).`)]
      : [];
  },
});
