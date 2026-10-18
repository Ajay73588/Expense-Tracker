import { defineTableAdapter } from "./table-adapter";
import { cleanFolio, cleanText, normHeader, normIdentity, toNumber, warn, MONEY_TOLERANCE_ABS } from "./parse-utils";
import { emptyCandidate, type CandidateRow, type Sheet, type RowIssue } from "./base.adapter";

/**
 * Groww "Holdings Statement" (Mutual Funds) — .xlsx, sheet "Holdings".
 *
 * Layout (from a real export):
 *   rows 3-6   Personal Details (name / mobile / PAN)  → NEVER read or stored
 *   rows 10-14 HOLDING SUMMARY (Total Investments | Current Portfolio Value | …) + one value row
 *   row  18    "HOLDINGS AS ON <date>"
 *   row  21    header: Scheme Name | AMC | Category | Sub-category | Folio No. | Source | Units |
 *              Invested Value | Current Value | Returns | XIRR
 *   row  22    blank, rows 23+ one row per (scheme, folio)
 * Numbers are text ("9625.79"), Units is a float. There is NO ISIN and NO average-price column:
 * average price is derived as Invested Value ÷ Units; NAV at statement date = Current Value ÷ Units.
 */
function readSummary(sheet: Sheet, label: string): number | null {
  for (let r = 0; r < sheet.rows.length; r++) {
    const c = sheet.rows[r].findIndex((x) => normHeader(x) === label);
    if (c < 0) continue;
    for (let n = r + 1; n < Math.min(r + 4, sheet.rows.length); n++) {
      const v = toNumber(sheet.rows[n][c] ?? null);
      if (v !== null) return v;
    }
  }
  return null;
}

export const GrowwMutualFundAdapter = defineTableAdapter({
  broker: "GROWW",
  assetClass: "MUTUAL_FUND",
  required: {
    name: ["scheme name"],
    folio: ["folio no", "folio no.", "folio number", "folio"],
    units: ["units"],
    invested: ["invested value"],
    current: ["current value"],
  },
  optional: { amc: ["amc"] },
  expectedColumns: ["Scheme Name", "Folio No.", "Units", "Invested Value", "Current Value"],
  labelColumnKey: "name",
  emptyMessage: "The file has a holdings table but no mutual-fund rows.",

  mapRow(cells, cols, row): CandidateRow {
    const c = emptyCandidate(row, "INR");
    const units = toNumber(cells[cols.units] ?? null);
    const invested = toNumber(cells[cols.invested] ?? null);
    const current = toNumber(cells[cols.current] ?? null);
    c.name = cleanText(cells[cols.name] ?? null);
    c.folio = cleanFolio(cells[cols.folio] ?? null);
    c.quantity = units;
    c.investedValue = invested;
    c.averagePrice = units !== null && units > 0 && invested !== null ? invested / units : null;
    c.statementPrice = units !== null && units > 0 && current !== null ? current / units : null;
    c.identity = c.name ? (c.folio ? `${normIdentity(c.name)}|${c.folio}` : normIdentity(c.name)) : null;
    return c;
  },

  reconcile(sheet, rows): RowIssue[] {
    const out: RowIssue[] = [];
    const total = readSummary(sheet, "total investments");
    if (total !== null) {
      const sum = rows.reduce((s, r) => s + (r.investedValue ?? 0), 0);
      if (Math.abs(sum - total) > MONEY_TOLERANCE_ABS) {
        out.push(warn(`Sum of Invested Value (${sum.toFixed(2)}) differs from the file's Total Investments (${total.toFixed(2)}).`));
      }
    }
    return out;
  },
});
