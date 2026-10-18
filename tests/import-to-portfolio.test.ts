import { beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory stand-in for Prisma `asset` delegate ──────────────────────────
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
  findMany: async ({ where }: Row) =>
    db.rows.filter((r) => match(r, where)).map((r) => ({ ...r })),
  findFirst: async ({ where }: Row) => {
    const found = db.rows.find((r) => match(r, where));
    return found ? { ...found } : null;
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
        folio: null,
        ...d,
      });
    }
    return { count: data.length };
  },
  update: async ({ where, data }: Row) => {
    const r = db.rows.find((x) => x.id === where.id)!;
    if (!r) throw new Error("Record not found for update");
    Object.assign(r, data);
    return { ...r };
  },
  updateMany: async ({ where, data }: Row) => {
    const hit = db.rows.filter((r) => match(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  },
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    asset,
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { cache } from "../src/lib/cache";
import { ImportService } from "../src/services/import.service";
import { AssetService } from "../src/services/asset.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { PriceEngineService } from "../src/services/price-engine.service";
import { FxRateService } from "../src/services/fx-rate.service";
import { aggregatePortfolioAssets } from "../src/services/portfolio-aggregation.service";
import {
  GROWW_MF_DATA,
  GROWW_STOCK_DATA,
  IND_MF_DATA,
  IND_US_DATA,
  growwMfRows,
  growwStockRows,
  indMfRows,
  indUsRows,
  makeWorkbook,
} from "./helpers/workbook";

const USER_ID = "test-user-import";
const live = () => db.rows.filter((r) => r.deletedAt === null);

// Helper statement builders
const growwStockStmt = (rows = GROWW_STOCK_DATA) => ({
  broker: "GROWW" as const,
  assetClass: "IN_STOCK" as const,
  fileName: "Stocks_Holdings.xlsx",
  bytes: makeWorkbook({ Sheet1: growwStockRows(rows) }),
});

const growwMfStmt = (rows = GROWW_MF_DATA, account?: string) => ({
  broker: "GROWW" as const,
  assetClass: "MUTUAL_FUND" as const,
  fileName: "Groww_MF.xlsx",
  bytes: makeWorkbook({ Holdings: growwMfRows(rows) }),
  account,
});

const indUsStmt = (rows = IND_US_DATA, account?: string) => ({
  broker: "INDMONEY" as const,
  assetClass: "US_STOCK" as const,
  fileName: "IND_US.xls",
  bytes: makeWorkbook({ HOLDINGS_BOOK: indUsRows(rows) }, "biff8"),
  account,
});

const indMfStmt = (rows = IND_MF_DATA, account?: string) => ({
  broker: "INDMONEY" as const,
  assetClass: "MUTUAL_FUND" as const,
  fileName: "IND_MF.xlsx",
  bytes: makeWorkbook({ Sheet1: indMfRows(rows) }),
  account,
});

const downProviders = () =>
  PriceEngineService.setProviders({
    stock: {
      name: "down",
      getUSStockQuotes: async () => {
        throw new Error("stock provider down");
      },
      getIndianStockQuotes: async () => {
        throw new Error("stock provider down");
      },
    },
    mf: {
      name: "down",
      getLatestNav: async () => ({ ok: false, reason: "TIMEOUT", message: "timed out" }),
    },
  });

const fxDown = () =>
  FxRateService.setProvider({
    name: "down",
    getRate: async () => {
      throw new Error("fx down");
    },
  });

describe("Harden Complete Import-to-Portfolio Workflow", () => {
  beforeEach(async () => {
    db.rows = [];
    db.seq = 0;
    await cache.clear();
    downProviders();
    fxDown();
  });

  // ── 1. Groww Indian Stocks Import Flow ─────────────────────────────────────
  describe("1. Groww Indian Stocks Flow", () => {
    it("imports Indian stocks with statement closing price, re-importing is duplicate-safe, and aggregation groups correctly", async () => {
      // Step A: Import Groww stock statement
      const r1 = await ImportService.commit(USER_ID, {
        ...growwStockStmt(),
        replaceMissing: true,
      });

      expect(r1.added).toBe(2);
      expect(r1.updated).toBe(0);
      expect(live()).toHaveLength(2);

      const alpha = live().find((r) => r.isin === "INE000A01010")!;
      expect(alpha).toMatchObject({
        type: "STOCK",
        name: "Alpha Industries",
        isin: "INE000A01010",
        quantity: 10,
        avgBuyPrice: 2000,
        currentPrice: 2100, // statement closing price
        priceSource: "STATEMENT",
        currency: "INR",
        account: "Groww",
        importSource: "Groww",
      });

      // Step B: Re-importing same statement does NOT create duplicates
      const r2 = await ImportService.commit(USER_ID, {
        ...growwStockStmt(),
        replaceMissing: true,
      });
      expect(r2.added).toBe(0);
      expect(r2.updated).toBe(2);
      expect(live()).toHaveLength(2);

      // Step C: Portfolio aggregation groups cleanly by ISIN
      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const aggregated = aggregatePortfolioAssets(portfolio);

      expect(aggregated).toHaveLength(2);
      const alphaAgg = aggregated.find((g) => g.isin === "INE000A01010")!;
      expect(alphaAgg.quantity).toBe(10);
      expect(alphaAgg.invested).toBe(20000);
      expect(alphaAgg.currentValue).toBe(21000);
      expect(alphaAgg.pnl).toBe(1000);
      expect(alphaAgg.detailedValuationStatus).toBe("STATEMENT");
    });

    it("enriches Indian stock prices via Yahoo and labels them LIVE without losing identity", async () => {
      PriceEngineService.setProviders({
        stock: {
          name: "mock-yahoo",
          getUSStockQuotes: async () => new Map(),
          getIndianStockQuotes: async (reqs) =>
            new Map(
              reqs.map((r) => [
                r.key,
                {
                  ok: true as const,
                  quote: {
                    price: 2250,
                    currency: "INR",
                    symbol: "ALPHA",
                    exchange: "NSE",
                    asOf: new Date(),
                  },
                },
              ])
            ),
        },
      });

      await ImportService.commit(USER_ID, {
        ...growwStockStmt(),
        replaceMissing: true,
      });

      const alpha = live().find((r) => r.isin === "INE000A01010")!;
      expect(alpha.currentPrice).toBe(2250);
      expect(alpha.symbol).toBe("ALPHA");
      expect(alpha.exchange).toBe("NSE");
      expect(alpha.priceSource).toBe("YAHOO");

      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const alphaPL = portfolio.find((a) => a.isin === "INE000A01010")!;
      expect(alphaPL.detailedValuationStatus).toBe("LIVE");
    });
  });

  // ── 2. Groww Mutual Funds with Multiple Folios ─────────────────────────────
  describe("2. Groww Mutual Funds Multi-Folio Flow", () => {
    it("preserves separate folios as distinct DB records while presenting 1 aggregated scheme row with expandable folios", async () => {
      // GROWW_MF_DATA has:
      // - Alpha Flexi Cap (folio 1001, units 100.5)
      // - Beta Large Cap (folio 2002, units 50)
      // - Beta Large Cap (folio 3003, units 25.25) [same scheme, different folio]
      const r1 = await ImportService.commit(USER_ID, {
        ...growwMfStmt(),
        replaceMissing: true,
      });
      expect(r1.added).toBe(3);
      expect(live()).toHaveLength(3);

      const betaFolios = live().filter((r) => r.name.includes("Beta Large Cap"));
      expect(betaFolios).toHaveLength(2);
      expect(betaFolios.map((f) => f.folio).sort()).toEqual(["2002", "3003"]);

      // Re-import does not duplicate folios
      const r2 = await ImportService.commit(USER_ID, {
        ...growwMfStmt(),
        replaceMissing: true,
      });
      expect(r2.added).toBe(0);
      expect(r2.updated).toBe(3);
      expect(live()).toHaveLength(3);

      // Aggregated portfolio unifies Beta Large Cap into 1 row
      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const aggregated = aggregatePortfolioAssets(portfolio);

      // 3 holdings aggregate into 2 unique schemes
      expect(aggregated).toHaveLength(2);
      const betaAgg = aggregated.find((g) => g.name.includes("Beta Large Cap"))!;
      expect(betaAgg.quantity).toBeCloseTo(75.25, 4);
      expect(betaAgg.holdingsCount).toBe(2);
      expect(betaAgg.uniqueFoliosCount).toBe(2);
      expect(betaAgg.folios.sort()).toEqual(["2002", "3003"]);
      expect(betaAgg.holdings).toHaveLength(2);

      // Independent Edit: User modifies folio 2002
      const folio2002 = betaFolios.find((f) => f.folio === "2002")!;
      await AssetService.update(USER_ID, folio2002.id, { quantity: 60 });

      // Verify folio 3003 remains unchanged in DB
      const folio3003 = live().find((f) => f.folio === "3003")!;
      expect(folio3003.quantity).toBe(25.25);

      // Re-aggregation reflects updated units dynamically
      const updatedPortfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const updatedAgg = aggregatePortfolioAssets(updatedPortfolio);
      const updatedBeta = updatedAgg.find((g) => g.name.includes("Beta Large Cap"))!;
      expect(updatedBeta.quantity).toBeCloseTo(85.25, 4);

      // Independent Delete: User soft-deletes folio 3003
      await AssetService.delete(USER_ID, folio3003.id);
      expect(live()).toHaveLength(2);

      const afterDeletePortfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const afterDeleteAgg = aggregatePortfolioAssets(afterDeletePortfolio);
      const afterDeleteBeta = afterDeleteAgg.find((g) => g.name.includes("Beta Large Cap"))!;
      expect(afterDeleteBeta.quantity).toBe(60);
      expect(afterDeleteBeta.holdingsCount).toBe(1);
      expect(afterDeleteBeta.uniqueFoliosCount).toBe(1);
      expect(afterDeleteBeta.folios).toEqual(["2002"]);
    });
  });

  // ── 3. INDmoney US Stocks & Foreign Currency Conversion ────────────────────
  describe("3. INDmoney US Stocks & FX Conversion", () => {
    it("imports US stocks in USD, applies live quotes and FX conversion, and handles missing FX gracefully", async () => {
      PriceEngineService.setProviders({
        stock: {
          name: "mock-us",
          getIndianStockQuotes: async () => new Map(),
          getUSStockQuotes: async (reqs) =>
            new Map(
              reqs.map((r) => [
                r.key,
                {
                  ok: true as const,
                  quote: {
                    price: 200,
                    currency: "USD",
                    symbol: r.symbol!,
                    exchange: "US",
                    asOf: new Date(),
                  },
                },
              ])
            ),
        },
      });
      FxRateService.setProvider({
        name: "mock-fx",
        getRate: async () => ({ rate: 85, asOf: "2026-10-11", source: "mock", stale: false }),
      });

      // Import US stocks
      await ImportService.commit(USER_ID, {
        ...indUsStmt(),
        replaceMissing: true,
      });

      const aapl = live().find((r) => r.symbol === "AAPL")!;
      expect(aapl).toMatchObject({
        type: "STOCK",
        currency: "USD",
        quantity: 5,
        avgBuyPrice: 180,
        currentPrice: 200,
        priceSource: "YAHOO",
      });

      // Portfolio PL conversion
      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const aaplPL = portfolio.find((a) => a.symbol === "AAPL")!;

      expect(aaplPL.investedNative).toBe(900); // 5 * 180 USD
      expect(aaplPL.currentValueNative).toBe(1000); // 5 * 200 USD
      expect(aaplPL.invested).toBe(900 * 85); // 76500 INR
      expect(aaplPL.currentValue).toBe(1000 * 85); // 85000 INR
      expect(aaplPL.valuationStatus).toBe("OK");
      expect(aaplPL.detailedValuationStatus).toBe("LIVE");

      // Now test FX Down scenario:
      fxDown();
      await cache.clear();

      const portfolioNoFx = await AssetService.getPortfolioWithPL(USER_ID);
      const aaplNoFx = portfolioNoFx.find((a) => a.symbol === "AAPL")!;

      // Native numbers must NOT be lost, INR values set to 0, status flagged FX_UNAVAILABLE
      expect(aaplNoFx.investedNative).toBe(900);
      expect(aaplNoFx.currentValueNative).toBe(1000);
      expect(aaplNoFx.invested).toBe(0);
      expect(aaplNoFx.currentValue).toBe(0);
      expect(aaplNoFx.valuationStatus).toBe("FX_UNAVAILABLE");
      expect(aaplNoFx.detailedValuationStatus).toBe("FX_UNAVAILABLE");
    });

    it("preserves last-known-good price after subsequent provider failure", async () => {
      // First import with live price
      PriceEngineService.setProviders({
        stock: {
          name: "live",
          getIndianStockQuotes: async () => new Map(),
          getUSStockQuotes: async (reqs) =>
            new Map(
              reqs.map((r) => [
                r.key,
                {
                  ok: true as const,
                  quote: {
                    price: 220,
                    currency: "USD",
                    symbol: r.symbol!,
                    exchange: "US",
                    asOf: new Date(),
                  },
                },
              ])
            ),
        },
      });

      await ImportService.commit(USER_ID, {
        ...indUsStmt(),
        replaceMissing: true,
      });

      expect(live().find((r) => r.symbol === "AAPL")!.currentPrice).toBe(220);

      // Now provider fails
      downProviders();
      await cache.clear();

      // Refreshing prices must preserve 220 and NOT overwrite with 0 or fallback
      const assets = live();
      const targets = assets.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        symbol: a.symbol,
        isin: a.isin,
        exchange: a.exchange,
        currency: a.currency,
      }));
      const refreshResult = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices(USER_ID, assets as any, refreshResult);

      expect(live().find((r) => r.symbol === "AAPL")!.currentPrice).toBe(220);
      expect(live().find((r) => r.symbol === "AAPL")!.priceSource).toBe("YAHOO");
    });
  });

  // ── 4. Cross-Account and Cross-Broker Isolation ─────────────────────────────
  describe("4. Cross-Account and Cross-Broker Isolation", () => {
    it("keeps identical schemes across different accounts distinguishable in DB and combined in aggregation", async () => {
      // User imports same scheme into Account A and Account B
      await ImportService.commit(USER_ID, {
        ...growwMfStmt(GROWW_MF_DATA.slice(0, 1), "Demat-A"),
        replaceMissing: true,
      });
      await ImportService.commit(USER_ID, {
        ...growwMfStmt(GROWW_MF_DATA.slice(0, 1), "Demat-B"),
        replaceMissing: true,
      });

      // In database, both records exist independently with their respective account names
      expect(live()).toHaveLength(2);
      expect(live().map((r) => r.account).sort()).toEqual(["Demat-A", "Demat-B"]);

      // Aggregation displays 1 combined scheme row showing both accounts
      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const agg = aggregatePortfolioAssets(portfolio);

      expect(agg).toHaveLength(1);
      expect(agg[0].quantity).toBe(100.5 * 2);
      expect(agg[0].uniqueAccountsCount).toBe(2);
      expect(agg[0].accounts.sort()).toEqual(["Demat-A", "Demat-B"]);

      // A full snapshot of Demat-A with a different fund plans removal of Demat-A's previous holding
      const newDematAStmt = growwMfStmt(GROWW_MF_DATA.slice(1, 2), "Demat-A");
      const preview = await ImportService.preview(USER_ID, { ...newDematAStmt, replaceMissing: true });
      expect(preview.plan.toRemove).toBe(1);
      expect(preview.holdingsToRemove[0].account).toBe("Demat-A");
      expect(preview.holdingsToRemove[0].name).toContain("Alpha Flexi Cap");

      // On commit, Demat-A's Alpha Flexi Cap is removed, but Demat-B's Alpha Flexi Cap remains intact
      await ImportService.commit(USER_ID, { ...newDematAStmt, replaceMissing: true });
      const dematBAlpha = live().find((r) => r.account === "Demat-B" && r.name.includes("Alpha Flexi Cap"));
      expect(dematBAlpha).toBeDefined();
    });
  });

  // ── 5. Changed Statement Updates Existing Holdings ─────────────────────────
  describe("5. Changed Statement Updates", () => {
    it("updates existing holdings when statement values change without doubling", async () => {
      await ImportService.commit(USER_ID, {
        ...growwMfStmt(),
        replaceMissing: true,
      });
      expect(live().find((r) => r.folio === "1001")!.quantity).toBe(100.5);

      // Later statement has increased units (e.g. 150 units @ 15000 invested)
      const updatedData = GROWW_MF_DATA.map((row, idx) =>
        idx === 0 ? [row[0], row[1], row[2], row[3], row[4], row[5], 150, "15000.00", "16500.00", 1500, "10%"] : row
      );

      const r = await ImportService.commit(USER_ID, {
        ...growwMfStmt(updatedData as any),
        replaceMissing: true,
      });
      expect(r.added).toBe(0);
      expect(r.updated).toBe(3);
      expect(live()).toHaveLength(3);
      expect(live().find((r) => r.folio === "1001")!.quantity).toBe(150);
      expect(live().find((r) => r.folio === "1001")!.avgBuyPrice).toBe(100);
    });
  });

  // ── 6. Partial vs Full-Snapshot Removal Scoping ────────────────────────────
  describe("6. Partial vs Full-Snapshot Removals", () => {
    it("partial import (replaceMissing=false) preserves omitted holdings", async () => {
      // First import 3 holdings
      await ImportService.commit(USER_ID, {
        ...growwMfStmt(),
        replaceMissing: true,
      });
      expect(live()).toHaveLength(3);

      // Second import with only 1 holding, replaceMissing: false
      const r = await ImportService.commit(USER_ID, {
        ...growwMfStmt(GROWW_MF_DATA.slice(0, 1)),
        replaceMissing: false,
      });
      expect(r.removed).toBe(0);
      expect(live()).toHaveLength(3); // All 3 remain intact
    });

    it("full snapshot (replaceMissing=true) removes only missing holdings after preview confirmation", async () => {
      await ImportService.commit(USER_ID, {
        ...growwMfStmt(),
        replaceMissing: true,
      });

      // Preview 1 holding with replaceMissing: true
      const partialStmt = growwMfStmt(GROWW_MF_DATA.slice(0, 1));
      const preview = await ImportService.preview(USER_ID, {
        ...partialStmt,
        replaceMissing: true,
      });

      expect(preview.plan).toEqual({ toAdd: 0, toUpdate: 1, toRemove: 2 });
      expect(preview.holdingsToRemove).toHaveLength(2);
      expect(db.rows.filter((r) => r.deletedAt !== null)).toHaveLength(0); // Nothing deleted during preview!

      // Commit removes the 2 missing holdings
      const commitReport = await ImportService.commit(USER_ID, {
        ...partialStmt,
        replaceMissing: true,
      });
      expect(commitReport.removed).toBe(2);
      expect(live()).toHaveLength(1);
      expect(db.rows.filter((r) => r.deletedAt !== null)).toHaveLength(2); // Soft deleted
    });
  });

  // ── 7. INDmoney Mutual Funds Flow ──────────────────────────────────────────
  describe("7. INDmoney Mutual Funds Flow", () => {
    it("imports INDmoney mutual funds with ISIN, derives statement NAV, and aggregates accurately", async () => {
      const r = await ImportService.commit(USER_ID, {
        ...indMfStmt(),
        replaceMissing: true,
      });
      expect(r.added).toBe(3);
      expect(live()).toHaveLength(3);

      const alpha = live().find((r) => r.isin === "INF000A01010")!;
      expect(alpha).toMatchObject({
        type: "MUTUAL_FUND",
        isin: "INF000A01010",
        folio: "1001",
        quantity: 100.5,
        priceSource: "STATEMENT",
        importSource: "INDmoney",
      });

      const portfolio = await AssetService.getPortfolioWithPL(USER_ID);
      const agg = aggregatePortfolioAssets(portfolio);

      // IND_MF_DATA has Beta Large Cap across folios 2002 & 3003
      expect(agg).toHaveLength(2);
      const betaAgg = agg.find((g) => g.isin === "INF000B01011")!;
      expect(betaAgg.quantity).toBeCloseTo(75.25, 4);
      expect(betaAgg.uniqueFoliosCount).toBe(2);
    });
  });

  // ── 8. Portfolio Totals and Summary Without Double-Counting ────────────────
  describe("8. Portfolio Totals & No Double-Counting", () => {
    it("verifies portfolio summary, allocation, and aggregated rows match underlying DB totals exactly", async () => {
      // Import both Groww MFs and INDmoney US stocks
      await ImportService.commit(USER_ID, { ...growwMfStmt(), replaceMissing: true });
      await ImportService.commit(USER_ID, { ...indUsStmt(), replaceMissing: true });

      FxRateService.setProvider({
        name: "test-fx",
        getRate: async () => ({ rate: 84, asOf: "2026-10-11", source: "fx", stale: false }),
      });

      const summary = await PortfolioService.getPortfolioSummary(USER_ID);
      const underlyingAssets = await AssetService.getPortfolioWithPL(USER_ID);
      const aggregated = aggregatePortfolioAssets(underlyingAssets);

      // Sum of underlying
      const sumInvested = underlyingAssets.reduce((s, a) => s + a.invested, 0);
      const sumCurrent = underlyingAssets.reduce((s, a) => s + a.currentValue, 0);
      const sumPnl = underlyingAssets.reduce((s, a) => s + a.pnl, 0);

      // Summary totals
      expect(summary.invested).toBeCloseTo(sumInvested, 2);
      expect(summary.currentValue).toBeCloseTo(sumCurrent, 2);
      expect(summary.pnl).toBeCloseTo(sumPnl, 2);
      expect(summary.assetCount).toBe(underlyingAssets.length);
      expect(summary.investmentCount).toBe(aggregated.length);

      // Aggregated totals
      const aggInvested = aggregated.reduce((s, g) => s + g.invested, 0);
      const aggCurrent = aggregated.reduce((s, g) => s + g.currentValue, 0);
      const aggPnl = aggregated.reduce((s, g) => s + g.pnl, 0);

      expect(aggInvested).toBeCloseTo(sumInvested, 2);
      expect(aggCurrent).toBeCloseTo(sumCurrent, 2);
      expect(aggPnl).toBeCloseTo(sumPnl, 2);

      // Allocation sums to 100% and total value equals summary.currentValue
      const allocation = await PortfolioService.getAllocation(USER_ID);
      const totalAllocValue = allocation.reduce((s, a) => s + a.value, 0);
      const totalAllocPct = allocation.reduce((s, a) => s + a.percent, 0);

      expect(totalAllocValue).toBeCloseTo(sumCurrent, 2);
      expect(totalAllocPct).toBeCloseTo(100, 1);
    });
  });
});
