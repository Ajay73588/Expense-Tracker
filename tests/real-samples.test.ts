import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseUpload } from "../src/services/import.service";

/**
 * Runs the adapters against the REAL broker exports (they contain personal data, so they are not
 * committed). Run with:  SAMPLE_DIR=/path/to/exports npm test
 */
const dir = process.env.SAMPLE_DIR;
const F = {
  growwMf: "Holdings_Statement_2026-10-07.xlsx",
  growwStock: "Stocks_Holdings_Statement_2738449139_2026-10-06.xlsx",
  indUs: "IND-HOLDINGS_REPORTXX217657384-2026-10-07-V04.xls",
  indMf: "e0e49d5a-36a1-4b13-8c3d-7d7d4fb8c298.xlsx",
};
const load = (f: string) => new Uint8Array(readFileSync(path.join(dir!, f)));
const run = (broker: any, assetClass: any, f: string) => parseUpload({ broker, assetClass, fileName: f, bytes: load(f) });
const errors = (o: ReturnType<typeof run>) => o.issues.filter((i) => i.severity === "error");

describe.skipIf(!dir || !existsSync(path.join(dir ?? "", F.growwMf)))("real sample files", () => {
  it("Groww mutual funds: 18 holdings, totals reconcile with the file's own summary, no PII", () => {
    const o = run("GROWW", "MUTUAL_FUND", F.growwMf);
    expect(errors(o)).toEqual([]);
    expect(o.holdings).toHaveLength(18);
    expect(o.issues.filter((i) => /Total/.test(i.message))).toEqual([]);
    expect(o.sheetName).toBe("Holdings");
    expect(o.holdings.every((h) => h.currency === "INR" && h.folio && h.statementPrice)).toBe(true);
    expect(new Set(o.holdings.map((h) => h.importKey)).size).toBe(18);
    expect(JSON.stringify(o)).not.toMatch(/NUTPK|7358824719/);
  });
  it("INDmoney mutual funds: 18 holdings with ISIN + folio, totals reconcile", () => {
    const o = run("INDMONEY", "MUTUAL_FUND", F.indMf);
    expect(errors(o)).toEqual([]);
    expect(o.holdings).toHaveLength(18);
    expect(o.holdings.every((h) => /^INF/.test(h.isin ?? ""))).toBe(true);
    expect(o.issues.filter((i) => /Total/.test(i.message))).toEqual([]);
  });
  it("INDmoney US stocks (.xls): 15 USD holdings, disclaimer ignored, Total Value == qty×avg", () => {
    const o = run("INDMONEY", "US_STOCK", F.indUs);
    expect(errors(o)).toEqual([]);
    expect(o.fileKind).toBe("xls");
    expect(o.holdings).toHaveLength(15);
    expect(o.holdings.every((h) => h.currency === "USD" && h.exchange === "US")).toBe(true);
    expect(o.holdings.map((h) => h.symbol)).toContain("AAPL");
    expect(o.issues).toEqual([]); // no consistency warnings
  });
  it("Groww stocks: header recognised, zero holdings → warning, nothing to import", () => {
    const o = run("GROWW", "IN_STOCK", F.growwStock);
    expect(errors(o)).toEqual([]);
    expect(o.holdings).toHaveLength(0);
    expect(o.issues.some((i) => /no holdings/i.test(i.message))).toBe(true);
  });
  it("cross-selection hints (Groww MF file uploaded as INDmoney MF)", () => {
    const o = run("INDMONEY", "MUTUAL_FUND", F.growwMf);
    expect(o.holdings).toHaveLength(0);
    expect(o.hint).toMatch(/Groww Mutual Funds/);
  });
});
