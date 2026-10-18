import { describe, expect, it } from "vitest";
import { parseUpload } from "../src/services/import.service";
import {
  GROWW_MF_DATA, GROWW_STOCK_DATA, IND_MF_DATA, IND_US_DATA,
  growwMfRows, growwStockRows, indMfRows, indUsRows, makeWorkbook,
} from "./helpers/workbook";

const NOW = new Date("2026-10-07T00:00:00Z");
const errs = (o: ReturnType<typeof parseUpload>) => o.issues.filter((i) => i.severity === "error");
const parse = (broker: any, assetClass: any, fileName: string, bytes: Uint8Array) =>
  parseUpload({ broker, assetClass, fileName, bytes, now: NOW });

describe("A. Groww stocks", () => {
  it("parses header-offset layout, derives INR/ISIN identity, keeps statement price", () => {
    const o = parse("GROWW", "IN_STOCK", "stocks.xlsx", makeWorkbook({ Sheet1: growwStockRows(GROWW_STOCK_DATA) }));
    expect(errs(o)).toEqual([]);
    expect(o.holdings).toHaveLength(2);
    expect(o.holdings[0]).toMatchObject({
      type: "STOCK", assetClass: "IN_STOCK", isin: "INE000A01010", symbol: null, currency: "INR",
      quantity: 10, averagePrice: 2000, investedValue: 20000, statementPrice: 2100, importKey: "GROWW|IN_STOCK|Groww|INE000A01010",
      sourceRow: 12, sourceBroker: "Groww",
    });
  });
  it("an empty statement (real sample had no holdings) yields 0 rows + a warning, not an error", () => {
    const o = parse("GROWW", "IN_STOCK", "stocks.xlsx", makeWorkbook({ Sheet1: growwStockRows([]) }));
    expect(o.holdings).toHaveLength(0);
    expect(errs(o)).toEqual([]);
    expect(o.issues.some((i) => /no holdings/i.test(i.message))).toBe(true);
  });
  it("never reads personal metadata into holdings", () => {
    const o = parse("GROWW", "IN_STOCK", "s.xlsx", makeWorkbook({ Sheet1: growwStockRows(GROWW_STOCK_DATA) }));
    expect(JSON.stringify(o)).not.toMatch(/TEST USER|0000000000/);
  });
});

describe("B. Groww mutual funds", () => {
  const bytes = () => makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA, [17525, 18150.5]) });
  it("handles metadata, blank row after header, text numbers; derives avg price & statement NAV", () => {
    const o = parse("GROWW", "MUTUAL_FUND", "Holdings_Statement.xlsx", bytes());
    expect(errs(o)).toEqual([]);
    expect(o.holdings).toHaveLength(3);
    const h = o.holdings[0];
    expect(h).toMatchObject({ type: "MUTUAL_FUND", isin: null, folio: "1001", quantity: 100.5, currency: "INR", investedValue: 10000 });
    expect(h.averagePrice).toBeCloseTo(10000 / 100.5, 8);
    expect(h.statementPrice).toBeCloseTo(11050.5 / 100.5, 8);
  });
  it("same scheme in two folios stays two distinct holdings", () => {
    const keys = parse("GROWW", "MUTUAL_FUND", "h.xlsx", bytes()).holdings.map((h) => h.importKey);
    expect(new Set(keys).size).toBe(3);
  });
  it("warns when the sum of invested values disagrees with the file's own total", () => {
    const o = parse("GROWW", "MUTUAL_FUND", "h.xlsx", makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA, [99999, 1]) }));
    expect(o.issues.some((i) => i.severity === "warning" && /Total Investments/.test(i.message))).toBe(true);
  });
  it("no reconciliation warning when totals agree", () => {
    expect(parse("GROWW", "MUTUAL_FUND", "h.xlsx", bytes()).issues.filter((i) => /Total/.test(i.message))).toEqual([]);
  });
});

describe("C. INDmoney US stocks (.xls)", () => {
  const bytes = () => makeWorkbook({ HOLDINGS_BOOK: indUsRows(IND_US_DATA) }, "biff8");
  it("reads legacy .xls, stores USD, ignores disclaimer footer and account metadata", () => {
    const o = parse("INDMONEY", "US_STOCK", "IND-HOLDINGS_REPORT.xls", bytes());
    expect(errs(o)).toEqual([]);
    expect(o.fileKind).toBe("xls");
    expect(o.holdings.map((h) => h.symbol)).toEqual(["AAPL", "MSFT", "GOOG"]);
    expect(o.holdings[0]).toMatchObject({ currency: "USD", exchange: "US", quantity: 5, averagePrice: 180, investedValue: 900, importKey: "INDMONEY|US_STOCK|INDmoney|AAPL" });
    expect(JSON.stringify(o)).not.toMatch(/Disclaimer|Test Broker|000000/);
  });
  it("keeps fractional quantity precision and never treats Total Value as a market value", () => {
    const g = parse("INDMONEY", "US_STOCK", "r.xls", bytes()).holdings[2];
    expect(g.quantity).toBe(0.13631341);
    expect(g.statementPrice).toBeNull();
  });
  it("warns if 'Total Value ($)' is not quantity × avg price", () => {
    const rows = indUsRows([["AAPL", "x", 5, 180, 5000]]);
    const o = parse("INDMONEY", "US_STOCK", "r.xls", makeWorkbook({ HOLDINGS_BOOK: rows }, "biff8"));
    expect(o.issues.some((i) => i.severity === "warning" && i.row === 9)).toBe(true);
  });
  it("rejects a non-USD price column (no '($)' header)", () => {
    const rows = indUsRows(IND_US_DATA);
    rows[7][3] = "Avg. Price (₹)";
    const o = parse("INDMONEY", "US_STOCK", "r.xls", makeWorkbook({ HOLDINGS_BOOK: rows }, "biff8"));
    expect(o.holdings).toHaveLength(0);
    expect(errs(o)[0].message).toMatch(/Avg\. Price \(\$\)/);
  });
});

describe("D. INDmoney mutual funds", () => {
  const bytes = () => makeWorkbook({ Sheet1: indMfRows(IND_MF_DATA, [17525, 18150.5]) });
  it("parses ISIN + folio identity, text numbers, derived avg price", () => {
    const o = parse("INDMONEY", "MUTUAL_FUND", "e0e49d5a.xlsx", bytes());
    expect(errs(o)).toEqual([]);
    expect(o.holdings).toHaveLength(3);
    expect(o.holdings[1]).toMatchObject({ isin: "INF000B01011", folio: "2002", importKey: "INDMONEY|MUTUAL_FUND|INDmoney|INF000B01011|2002" });
    expect(o.holdings[1].averagePrice).toBeCloseTo(100, 8);
    expect(o.holdings[1].statementPrice).toBeCloseTo(90, 8);
  });
  it("rejects malformed ISIN", () => {
    const rows = indMfRows([["X Fund", "BAD", "1", "10", "10", "1"]]);
    const o = parse("INDMONEY", "MUTUAL_FUND", "f.xlsx", makeWorkbook({ Sheet1: rows }));
    expect(errs(o)).toEqual([expect.objectContaining({ row: 11, message: "Invalid ISIN" })]);
  });
});

describe("CSV support", () => {
  it("reads the same layout from CSV (Groww MF)", () => {
    const csv = [
      "Personal Details", "Name,TEST USER", "",
      "Scheme Name,AMC,Category,Sub-category,Folio No.,Source,Units,Invested Value,Current Value,Returns,XIRR",
      '"Alpha Fund, Direct Growth",Alpha MF,Equity,Flexi,1001,Groww,"1,000.5",10000,11000,1,1%',
    ].join("\n");
    const o = parse("GROWW", "MUTUAL_FUND", "h.csv", new TextEncoder().encode(csv));
    expect(errs(o)).toEqual([]);
    expect(o.holdings[0]).toMatchObject({ name: "Alpha Fund, Direct Growth", quantity: 1000.5 });
  });
});

describe("E. invalid files", () => {
  const xlsx = makeWorkbook({ Sheet1: growwStockRows(GROWW_STOCK_DATA) });
  it.each([
    ["unsupported extension", "a.pdf", new Uint8Array([1, 2, 3]), /Unsupported file type/],
    ["no extension", "holdings", new Uint8Array([1, 2, 3]), /Unsupported file type/],
    ["empty file", "a.csv", new Uint8Array(0), /empty/],
    ["xlsx name, wrong content", "a.xlsx", new TextEncoder().encode("hello,world"), /not a valid Excel/],
    ["xls name, xlsx content", "a.xls", xlsx, /not a valid legacy Excel/],
    ["csv name, binary content", "a.csv", xlsx, /plain text/],
    ["csv with NUL bytes", "a.csv", new Uint8Array([97, 44, 0, 98]), /plain text/],
    ["too large", "a.csv", new Uint8Array(5 * 1024 * 1024 + 1).fill(97), /too large/],
  ])("%s", (_n, name, bytes, re) => {
    expect(() => parse("GROWW", "IN_STOCK", name as string, bytes as Uint8Array)).toThrow(re as RegExp);
  });
  it("corrupt xlsx (valid zip magic, garbage body) → friendly error, not a crash", () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => parse("GROWW", "IN_STOCK", "a.xlsx", bad)).toThrow(/could not be read|corrupted/);
  });
  it("row cap", () => {
    const csv = "a\n" + "x\n".repeat(5001);
    expect(() => parse("GROWW", "IN_STOCK", "a.csv", new TextEncoder().encode(csv))).toThrow(/more than 5000 rows/);
  });
  it("path-like file names are sanitised", () => {
    const o = parse("GROWW", "IN_STOCK", "../../etc/passwd.xlsx", makeWorkbook({ Sheet1: growwStockRows(GROWW_STOCK_DATA) }));
    expect(o.fileName).toBe("passwd.xlsx");
  });
  it("unsupported combination (INDmoney Indian stocks) explains why", () => {
    expect(() => parse("INDMONEY", "IN_STOCK", "a.xlsx", xlsx)).toThrow(/PDF depository statement/);
  });
});

describe("F. missing required columns / wrong export", () => {
  it("lists the required columns", () => {
    const rows = growwMfRows(GROWW_MF_DATA);
    rows[20][6] = "Qty"; // rename 'Units'
    const o = parse("GROWW", "MUTUAL_FUND", "h.xlsx", makeWorkbook({ Holdings: rows }));
    expect(o.holdings).toHaveLength(0);
    expect(errs(o)[0]).toMatchObject({ row: null });
    expect(errs(o)[0].message).toMatch(/Required columns: Scheme Name, Folio No\., Units/);
  });
  it("hints when the file is another broker's export", () => {
    const o = parse("GROWW", "MUTUAL_FUND", "h.xlsx", makeWorkbook({ Sheet1: indMfRows(IND_MF_DATA) }));
    expect(o.hint).toMatch(/INDmoney Mutual Funds/);
  });
  it("finds the right sheet in a multi-sheet workbook", () => {
    const o = parse("INDMONEY", "MUTUAL_FUND", "m.xlsx", makeWorkbook({ Cover: [["nothing"]], Data: indMfRows(IND_MF_DATA) }));
    expect(o.sheetName).toBe("Data");
    expect(o.holdings).toHaveLength(3);
  });
});

describe("G. invalid rows (row-level errors, other rows still import)", () => {
  it("reports row numbers and reasons", () => {
    const data = [
      ["AAPL", "x", 5, 180, 900],
      ["MSFT", "x", 0, 400, 0],
      ["TSLA", "x", -1, 200, -200],
      ["NVDA", "x", "abc", 100, 0],
      ["", "x", 3, 10, 30],
      ["AMZN", "x", 1, "n/a", 0],
      ["BAD SYMBOL!", "x", 1, 10, 10],
    ];
    const o = parse("INDMONEY", "US_STOCK", "r.xls", makeWorkbook({ HOLDINGS_BOOK: indUsRows(data) }, "biff8"));
    expect(o.holdings.map((h) => h.symbol)).toEqual(["AAPL"]);
    const byRow = (r: number) => errs(o).filter((e) => e.row === r).map((e) => e.message).join("|");
    expect(byRow(10)).toMatch(/Invalid quantity/);
    expect(byRow(11)).toMatch(/Invalid quantity/);
    expect(byRow(12)).toMatch(/Invalid quantity/);
    expect(byRow(13)).toMatch(/Missing symbol/);
    expect(byRow(14)).toMatch(/Invalid average price|Missing average price/);
    expect(byRow(15)).toMatch(/Invalid ticker symbol/);
  });
});

describe("H. duplicate rows inside one file", () => {
  it("second occurrence is rejected, not merged or double-counted", () => {
    const data = [["AAPL", "x", 5, 180, 900], ["AAPL", "x", 1, 190, 190]];
    const o = parse("INDMONEY", "US_STOCK", "r.xls", makeWorkbook({ HOLDINGS_BOOK: indUsRows(data) }, "biff8"));
    expect(o.holdings).toHaveLength(1);
    expect(errs(o)).toEqual([expect.objectContaining({ row: 10, message: expect.stringMatching(/Duplicate of row 9/) })]);
  });
});
