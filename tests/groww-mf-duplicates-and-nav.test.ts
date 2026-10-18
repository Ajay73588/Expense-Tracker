import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeWorkbook, growwMfRows } from "./helpers/workbook";
import { parseUpload, ImportService } from "../src/services/import.service";
import { PriceEngineService } from "../src/services/price-engine.service";
import { createMfApiProvider } from "../src/services/market/mfapi.provider";
import { AssetService, toPL } from "../src/services/asset.service";
import { cache } from "../src/lib/cache";

// ── In-memory Prisma asset delegate ──────────────────────────────────────────
type Row = Record<string, any>;
const db: { rows: Row[]; seq: number } = { rows: [], seq: 0 };
const match = (r: Row, w: Row = {}): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (k === "NOT") return !match(r, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Row;
      if ("in" in o) return o.in.includes(r[k]);
      if ("startsWith" in o) return typeof r[k] === "string" && r[k].startsWith(o.startsWith);
    }
    return r[k] === v;
  });

const asset = {
  findMany: async ({ where, select }: Row) => {
    const rows = db.rows.filter((r) => match(r, where)).map((r) => ({ ...r }));
    if (!select) return rows;
    return rows.map((r) => {
      const out: Row = {};
      for (const k of Object.keys(select)) if (select[k]) out[k] = r[k];
      return out;
    });
  },
  count: async ({ where }: Row) => db.rows.filter((r) => match(r, where)).length,
  createMany: async ({ data }: Row) => {
    for (const d of data) {
      db.rows.push({
        id: `a${++db.seq}`,
        deletedAt: null,
        priceUpdatedAt: null,
        exchange: null,
        symbol: null,
        isin: null,
        ...d,
      });
    }
    return { count: data.length };
  },
  update: async ({ where, data }: Row) => {
    const r = db.rows.find((x) => x.id === where.id)!;
    Object.assign(r, data);
    return r;
  },
  updateMany: async ({ where, data }: Row) => {
    const hit = db.rows.filter((r) => match(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  },
};

vi.mock("../src/lib/prisma", () => ({
  prisma: { asset, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) },
}));

const U = "user_groww_test";
const live = () => db.rows.filter((r) => r.deletedAt === null);

function makeGrowwFile(rows: any[], summary: [number, number] = [0, 0]) {
  return {
    broker: "GROWW" as const,
    assetClass: "MUTUAL_FUND" as const,
    fileName: "Holdings_Statement_2026-10-07(3).xlsx",
    bytes: makeWorkbook({ Holdings: growwMfRows(rows, summary) }),
  };
}

beforeEach(async () => {
  db.rows = [];
  db.seq = 0;
  await cache.clear();
  PriceEngineService.setProviders({
    stock: {
      name: "mock-stock",
      getUSStockQuotes: async () => new Map(),
      getIndianStockQuotes: async () => new Map(),
    },
    mf: {
      name: "mock-mf",
      getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "unconfigured" }),
    },
  });
});

describe("Task 1 — Holding Identity & Duplicate Handling", () => {
  it("does not identify holdings by scheme name alone: preserves separate holdings for same scheme under different folios", async () => {
    const rows = [
      ["Parag Parikh Flexi Cap Fund Direct Growth", "PPFAS", "Equity", "Flexi Cap", "12345/01", "Groww", 100, "5000.00", "6000.00", 1000, "20%"],
      ["Parag Parikh Flexi Cap Fund Direct Growth", "PPFAS", "Equity", "Flexi Cap", "98765/99", "Groww", 50, "2500.00", "3000.00", 500, "20%"],
    ];
    const file = makeGrowwFile(rows);
    const parsed = parseUpload(file);

    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0].importKey).not.toEqual(parsed.holdings[1].importKey);
    expect(parsed.holdings[0].folio).toBe("12345/01");
    expect(parsed.holdings[1].folio).toBe("98765/99");

    const report = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect(report.added).toBe(2);
    expect(live()).toHaveLength(2);
    expect(live().map((r) => r.folio)).toEqual(["12345/01", "98765/99"]);
  });

  it("reimporting the same statement updates existing holdings instead of creating duplicates", async () => {
    const rows = [
      ["Nippon India Small Cap Fund Direct Growth", "Nippon", "Equity", "Small Cap", "FOLIO101", "Groww", 200, "10000.00", "12000.00", 2000, "20%"],
      ["HDFC Top 100 Fund Direct Growth", "HDFC", "Equity", "Large Cap", "FOLIO202", "Groww", 100, "8000.00", "8500.00", 500, "6.25%"],
    ];
    const file = makeGrowwFile(rows);

    const r1 = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect([r1.added, r1.updated]).toEqual([2, 0]);
    expect(live()).toHaveLength(2);

    // Re-import identical statement
    const r2 = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect([r2.added, r2.updated, r2.removed]).toEqual([0, 2, 0]);
    expect(live()).toHaveLength(2);
    expect(live().find((h) => h.folio === "FOLIO101")!.quantity).toBe(200);
  });

  it("consolidates repeated rows under the same scheme and folio into one holding with total units and invested value", async () => {
    // Two tranches / purchases of the same scheme under the same folio in one statement
    const rows = [
      ["Quant Mid Cap Fund Direct Growth", "Quant", "Equity", "Mid Cap", "555123", "Groww", 100, "5000.00", "6000.00", 1000, "20%"],
      ["Quant Mid Cap Fund Direct Growth", "Quant", "Equity", "Mid Cap", "555123", "Groww", 50, "3000.00", "3000.00", 0, "0%"],
    ];
    const file = makeGrowwFile(rows);
    const parsed = parseUpload(file);

    // Consolidated into 1 holding with aggregated units and invested value
    expect(parsed.holdings).toHaveLength(1);
    const h = parsed.holdings[0];
    expect(h.quantity).toBe(150);
    expect(h.investedValue).toBe(8000);
    expect(h.averagePrice).toBeCloseTo(8000 / 150, 4);
    // Blended statement price: (6000 + 3000) / 150 = 60
    expect(h.statementPrice).toBeCloseTo(9000 / 150, 4);

    // Has a warning explaining consolidation
    expect(parsed.issues.some((i) => i.severity === "warning" && /Consolidated/i.test(i.message))).toBe(true);

    const report = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect(report.added).toBe(1);
    expect(live()).toHaveLength(1);
    expect(live()[0].quantity).toBe(150);
  });

  it("handles missing folio numbers safely and does NOT merge unrelated holdings that both lack a folio", async () => {
    const rows = [
      ["Scheme Alpha Direct Plan Growth", "AMC Alpha", "Equity", "Flexi Cap", "-", "Groww", 100, "5000.00", "6000.00", 1000, "20%"],
      ["Scheme Beta Direct Plan Growth", "AMC Beta", "Equity", "Large Cap", "", "Groww", 200, "10000.00", "11000.00", 1000, "10%"],
    ];
    const file = makeGrowwFile(rows);
    const parsed = parseUpload(file);

    expect(parsed.holdings).toHaveLength(2);
    expect(parsed.holdings[0].folio).toBeNull();
    expect(parsed.holdings[1].folio).toBeNull();
    expect(parsed.holdings[0].importKey).not.toEqual(parsed.holdings[1].importKey);

    const report = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect(report.added).toBe(2);
    expect(live()).toHaveLength(2);
  });

  it("preserves separate holdings for identical scheme names in different accounts", async () => {
    const rows = [
      ["SBI Bluechip Fund Direct Growth", "SBI", "Equity", "Large Cap", "111222", "Groww", 100, "5000.00", "5500.00", 500, "10%"],
    ];
    const f1 = { ...makeGrowwFile(rows), account: "Primary Account" };
    const f2 = { ...makeGrowwFile(rows), account: "Secondary Account" };

    const r1 = await ImportService.commit(U, { ...f1, replaceMissing: false });
    const r2 = await ImportService.commit(U, { ...f2, replaceMissing: false });

    expect(r1.added).toBe(1);
    expect(r2.added).toBe(1);
    expect(live()).toHaveLength(2);
    expect(live().map((r) => r.account)).toEqual(["Primary Account", "Secondary Account"]);
  });

  it("ensures preview counts match commit actions exactly", async () => {
    const rowsInitial = [
      ["Fund One Direct Growth", "AMC1", "Equity", "Flexi", "F1", "Groww", 100, "1000", "1100", 100, "10%"],
      ["Fund Two Direct Growth", "AMC2", "Equity", "Large", "F2", "Groww", 200, "2000", "2200", 200, "10%"],
    ];
    await ImportService.commit(U, { ...makeGrowwFile(rowsInitial), replaceMissing: false });

    // File with 1 existing (toUpdate), 1 new (toAdd), omitting Fund Two
    const rowsNext = [
      ["Fund One Direct Growth", "AMC1", "Equity", "Flexi", "F1", "Groww", 150, "1500", "1650", 150, "10%"],
      ["Fund Three Direct Growth", "AMC3", "Equity", "Mid", "F3", "Groww", 300, "3000", "3300", 300, "10%"],
    ];
    const nextFile = makeGrowwFile(rowsNext);

    // Preview with replaceMissing = true
    const pSnapshot = await ImportService.preview(U, { ...nextFile, replaceMissing: true });
    expect(pSnapshot.plan).toEqual({ toAdd: 1, toUpdate: 1, toRemove: 1 });
    expect(pSnapshot.holdingsToRemove).toHaveLength(1);
    expect(pSnapshot.holdingsToRemove[0].name).toBe("Fund Two Direct Growth");

    // Commit with replaceMissing = true
    const cSnapshot = await ImportService.commit(U, { ...nextFile, replaceMissing: true });
    expect({ toAdd: cSnapshot.added, toUpdate: cSnapshot.updated, toRemove: cSnapshot.removed }).toEqual(pSnapshot.plan);

    // Preview with replaceMissing = false
    const pNoRemove = await ImportService.preview(U, { ...nextFile, replaceMissing: false });
    expect(pNoRemove.plan).toEqual({ toAdd: 0, toUpdate: 2, toRemove: 0 }); // Fund One & Three exist now
  });
});

describe("Task 2 — Mutual Fund NAV Matching and Valuation", () => {
  it("normalizes scheme names with whitespace, midcap/mid cap, and matches live NAV", async () => {
    const fakeFetch = async (url: string) => {
      const u = String(url);
      if (u.includes("/mf/search")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [
            { schemeCode: "120503", schemeName: "Quant Mid Cap Fund - Direct Plan - Growth" },
          ],
        };
      }
      if (u.includes("/mf/120503/latest")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            meta: { scheme_code: 120503, scheme_name: "Quant Mid Cap Fund - Direct Plan - Growth" },
            data: [{ date: "10-10-2026", nav: "98.4520" }],
          }),
        };
      }
      return { ok: false, status: 404, headers: new Headers(), json: async () => ({}) };
    };

    const provider = createMfApiProvider({ fetchImpl: fakeFetch as any });
    // Requested name with "Midcap" instead of "Mid Cap"
    const res = await provider.getLatestNav({
      name: "Quant Midcap Fund - Direct Plan - Growth",
      isin: null,
      statementNav: 95.0, // market has drifted ~3.6% from statement date
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.schemeCode).toBe("120503");
      expect(res.nav).toBe(98.452);
    }
  });

  it("preserves statement current value and derives statement NAV when live lookup is unavailable", async () => {
    const rows = [
      ["Unknown Specialized Fund Direct Growth", "Special AMC", "Equity", "Sectoral", "FOLIO999", "Groww", 80, "4000.00", "4800.00", 800, "20%"],
    ];
    const file = makeGrowwFile(rows);

    // Mock MF provider returning NOT_FOUND
    PriceEngineService.setProviders({
      stock: { name: "mock", getUSStockQuotes: async () => new Map(), getIndianStockQuotes: async () => new Map() },
      mf: { name: "mock", getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "No match" }) },
    });

    const report = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect(report.added).toBe(1);

    const asset = live().find((r) => r.folio === "FOLIO999")!;
    expect(asset).toBeDefined();
    // Units = 80, Current Value = 4800 -> statementPrice = 4800 / 80 = 60
    expect(asset.currentPrice).toBe(60);
    expect(asset.priceSource).toBe("STATEMENT");
    // Cost basis: avgBuyPrice = 4000 / 80 = 50
    expect(asset.avgBuyPrice).toBe(50);

    // Valuation status check
    const pl = toPL(asset as any, 1);
    expect(pl.detailedValuationStatus).toBe("STATEMENT");
    expect(pl.currentValue).toBe(4800);
    expect(pl.invested).toBe(4000);
    expect(pl.pnl).toBe(800);
  });

  it("provider failure never erases a previously valid market price", async () => {
    const rows = [
      ["Mirae Asset Large Cap Fund Direct Growth", "Mirae", "Equity", "Large", "FOLIO777", "Groww", 100, "8000.00", "9000.00", 1000, "12.5%"],
    ];
    const file = makeGrowwFile(rows);

    // First import succeeds with MFAPI price
    PriceEngineService.setProviders({
      stock: { name: "mock", getUSStockQuotes: async () => new Map(), getIndianStockQuotes: async () => new Map() },
      mf: {
        name: "mock",
        getLatestNav: async () => ({
          ok: true,
          nav: 95.5,
          schemeCode: "100200",
          schemeName: "Mirae Asset Large Cap Fund Direct Growth",
          asOf: new Date("2026-10-10"),
        }),
      },
    });

    await ImportService.commit(U, { ...file, replaceMissing: false });
    const firstHolding = live().find((r) => r.folio === "FOLIO777")!;
    expect(firstHolding.currentPrice).toBe(95.5);
    expect(firstHolding.priceSource).toBe("MFAPI");

    // Second import when provider fails / is down
    PriceEngineService.setProviders({
      stock: { name: "mock", getUSStockQuotes: async () => new Map(), getIndianStockQuotes: async () => new Map() },
      mf: { name: "mock", getLatestNav: async () => ({ ok: false, reason: "TIMEOUT", message: "timed out" }) },
    });

    await ImportService.commit(U, { ...file, replaceMissing: false });
    const secondHolding = live().find((r) => r.folio === "FOLIO777")!;
    // Price and source remain intact!
    expect(secondHolding.currentPrice).toBe(95.5);
    expect(secondHolding.priceSource).toBe("MFAPI");
  });

  it("handles zero or invalid units safely without fabricating NAV or dividing by zero", () => {
    const rows = [
      ["Zero Units Fund", "AMC", "Equity", "Flexi", "F00", "Groww", 0, "1000.00", "1200.00", 200, "20%"],
    ];
    const parsed = parseUpload(makeGrowwFile(rows));
    // Schema rejects non-positive quantity
    expect(parsed.holdings).toHaveLength(0);
    expect(parsed.issues.some((i) => i.severity === "error" && /quantity/i.test(i.message))).toBe(true);
  });
});

describe("Task 3 — Full Snapshot Behavior", () => {
  it("never removes holdings from another account, broker, or asset category", async () => {
    // 1) Seed existing portfolio:
    // - INDmoney US Stock (AAPL)
    // - Groww IN Stock (TCS)
    // - Groww MF in Account B
    // - Groww MF in Account A (Fund to keep + Fund to remove)
    db.rows.push(
      { id: "a1", userId: U, type: "STOCK", name: "Apple", symbol: "AAPL", currentPrice: 150, avgBuyPrice: 140, quantity: 10, currency: "USD", account: "INDmoney", importSource: "INDmoney", importKey: "INDMONEY|US_STOCK|INDmoney|AAPL", deletedAt: null },
      { id: "a2", userId: U, type: "STOCK", name: "TCS", symbol: "TCS", currentPrice: 3500, avgBuyPrice: 3400, quantity: 5, currency: "INR", account: "Groww", importSource: "Groww", importKey: "GROWW|IN_STOCK|Groww|INE467B01029", deletedAt: null },
      { id: "a3", userId: U, type: "MUTUAL_FUND", name: "Fund in Account B", folio: "FB", currentPrice: 50, avgBuyPrice: 40, quantity: 100, currency: "INR", account: "Account B", importSource: "Groww", importKey: "GROWW|MUTUAL_FUND|Account B|FUND_B|FB", deletedAt: null },
      { id: "a4", userId: U, type: "MUTUAL_FUND", name: "Account A Old Sold Fund", folio: "F_OLD", currentPrice: 25, avgBuyPrice: 20, quantity: 200, currency: "INR", account: "Account A", importSource: "Groww", importKey: "GROWW|MUTUAL_FUND|Account A|OLD_FUND|F_OLD", deletedAt: null },
      { id: "a5", userId: U, type: "MUTUAL_FUND", name: "Account A Active Fund", folio: "F_ACT", currentPrice: 30, avgBuyPrice: 25, quantity: 100, currency: "INR", account: "Account A", importSource: "Groww", importKey: "GROWW|MUTUAL_FUND|Account A|ACTIVE_FUND|F_ACT", deletedAt: null },
    );

    // Full snapshot import for Groww MUTUAL_FUND under "Account A", containing ONLY "Account A Active Fund"
    const rows = [
      ["ACTIVE_FUND", "AMC", "Equity", "Flexi", "F_ACT", "Groww", 100, "2500.00", "3000.00", 500, "20%"],
    ];
    const file = { ...makeGrowwFile(rows), account: "Account A" };

    const report = await ImportService.commit(U, { ...file, replaceMissing: true });
    expect(report.removed).toBe(1);

    // Verify:
    // a1 (INDmoney US stock) is untouched
    expect(live().find((h) => h.id === "a1")).toBeDefined();
    // a2 (Groww IN stock) is untouched
    expect(live().find((h) => h.id === "a2")).toBeDefined();
    // a3 (Groww MF in Account B) is untouched
    expect(live().find((h) => h.id === "a3")).toBeDefined();
    // a5 (Account A Active Fund) is untouched/updated
    expect(live().find((h) => h.id === "a5")).toBeDefined();
    // a4 (Account A Old Sold Fund) is soft-deleted
    const a4 = db.rows.find((h) => h.id === "a4")!;
    expect(a4.deletedAt).not.toBeNull();
  });

  it("does not treat statement as full snapshot when replaceMissing is false", async () => {
    db.rows.push(
      { id: "h1", userId: U, type: "MUTUAL_FUND", name: "Existing Fund", folio: "F1", currentPrice: 50, avgBuyPrice: 40, quantity: 100, currency: "INR", account: "Groww", importSource: "Groww", importKey: "GROWW|MUTUAL_FUND|Groww|EXISTING_FUND|F1", deletedAt: null },
    );

    // Statement with a new fund, but replaceMissing = false
    const rows = [
      ["New Fund", "AMC", "Equity", "Flexi", "F2", "Groww", 50, "2000.00", "2500.00", 500, "25%"],
    ];
    const file = makeGrowwFile(rows);

    const report = await ImportService.commit(U, { ...file, replaceMissing: false });
    expect(report.removed).toBe(0);
    expect(live()).toHaveLength(2);
  });
});
