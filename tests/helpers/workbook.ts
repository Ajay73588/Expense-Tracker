import * as XLSX from "@e965/xlsx";

type Row = (string | number | null)[];

/**
 * Builds an in-memory workbook whose LAYOUT mirrors the real broker exports (metadata block, header
 * row at the same position, blank rows, footer). Values are synthetic — the real sample files contain
 * personal data (name, PAN, phone, account numbers) and are deliberately NOT committed.
 */
export function makeWorkbook(sheets: Record<string, Row[]>, bookType: "xlsx" | "biff8" = "xlsx"): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType }));
}

const pad = (n: number): Row[] => Array.from({ length: n }, () => []);

/** Groww MF "Holdings Statement": header on row 21, blank row 22, data from row 23. */
export function growwMfRows(data: Row[], summary: [number, number] = [0, 0]): Row[] {
  return [
    [], [],
    ["Personal Details"], ["Name", "TEST USER"], ["Mobile Number", "0000000000"], ["PAN", "AAAAA0000A"],
    [], [], [],
    ["HOLDING SUMMARY"], [], [],
    ["Total Investments", "Current Portfolio Value", "Profit/Loss", "Profit/Loss %", "XIRR"],
    [String(summary[0]), String(summary[1]), "0", "0%", "0%"],
    [], [], [],
    ["HOLDINGS AS ON 2026-10-07"], [], [],
    ["Scheme Name", "AMC", "Category", "Sub-category", "Folio No.", "Source", "Units", "Invested Value", "Current Value", "Returns", "XIRR"],
    [],
    ...data,
  ];
}

export const GROWW_MF_DATA: Row[] = [
  ["Alpha Flexi Cap Fund Direct Growth", "Alpha MF", "Equity", "Flexi Cap", "1001", "Groww", 100.5, "10000.00", "11050.50", 1050.5, "10%"],
  ["Beta Large Cap Fund Direct Growth", "Beta MF", "Equity", "Large Cap", "2002", "Groww", 50, "5000.00", "4500.00", -500, "-10%"],
  ["Beta Large Cap Fund Direct Growth", "Beta MF", "Equity", "Large Cap", "3003", "Groww", 25.25, "2525.00", "2600.00", 75, "3%"], // same scheme, other folio
];

/** INDmoney MF "Holdings report": header on row 10. */
export function indMfRows(data: Row[], totals: [number, number] = [0, 0]): Row[] {
  return [
    ["Holdings report as on 07-10-2026"], [],
    ["Name", "TEST USER"], ["PAN", "AAAAA0000A"], [],
    ["Summary"],
    ["Total Invested value", String(totals[0])],
    ["Total Current value", String(totals[1])],
    [],
    ["Fund Name", "ISIN", "Total Units", "Invested Value", "Current Value", "Folio Number"],
    ...data,
  ];
}
export const IND_MF_DATA: Row[] = [
  ["Alpha Flexi Cap Fund", "INF000A01010", "100.5", "10000.00", "11050.50", "1001"],
  ["Beta Large Cap Fund", "INF000B01011", "50", "5000.00", "4500.00", "2002"],
  ["Beta Large Cap Fund", "INF000B01011", "25.25", "2525.00", "2600.00", "3003"],
];

/** INDmoney US "HOLDINGS_BOOK" (.xls): header on row 8, blank rows, disclaimer footer. */
export function indUsRows(data: Row[]): Row[] {
  return [
    ["Account Details"], ["Broker Name", "Test Broker"], ["Broker Account", "000000"], ["Holdings as on", "2026-10-07"],
    [], [], [],
    ["Stock Symbol", "Holding Since", "Quantity", "Avg. Price ($)", "Total Value ($)"],
    ...data,
    [], [], [], [],
    ["Disclaimer:-"], ["* This Profit and Loss report is for informational purposes only."],
  ];
}
export const IND_US_DATA: Row[] = [
  ["AAPL", "26 Mar 2025, 09:31 PM", 5, 180, 900],
  ["MSFT", "26 Mar 2025, 09:26 PM", 2, 400, 800],
  ["GOOG", "26 Mar 2025, 09:28 PM", 0.13631341, 175.5513195656979, 23.929999],
];

/** Groww stocks statement: header on row 11. */
export function growwStockRows(data: Row[]): Row[] {
  return [
    ["Name", "TEST USER"], ["Unique Client Code", "0000000000"], [],
    ["Holdings statement for stocks as on 06-10-2026"], [],
    ["Summary"], ["Invested Value", 0], ["Closing Value", 0], ["Unrealised P&L", 0], [],
    ["Stock Name", "ISIN", "Quantity", "Average buy price", "Buy value", "Closing price", "Closing value", "Unrealised P&L"],
    ...data,
  ];
}
// SYNTHETIC rows: the only real Groww stocks sample had zero holdings, so row values are assumptions.
export const GROWW_STOCK_DATA: Row[] = [
  ["Alpha Industries", "INE000A01010", 10, 2000, 20000, 2100, 21000, 1000],
  ["Beta Bank", "INE000B01011", 5, 1500.5, 7502.5, 1400, 7000, -502.5],
];
export { pad };
