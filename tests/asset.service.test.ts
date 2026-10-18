import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AssetService, toPL } from "../src/services/asset.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { NetWorthService } from "../src/services/networth.service";
import { aggregatePortfolioAssets } from "../src/services/portfolio-aggregation.service";
import { PriceEngineService } from "../src/services/price-engine.service";
import { NotFoundError } from "../src/lib/errors";
import { assetSchema, assetUpdateSchema } from "../src/lib/validators";
import { cache } from "../src/lib/cache";

// ── In-memory asset database delegate ────────────────────────────────────────
type Row = Record<string, any>;
let assetDb: Row[] = [];
let seq = 0;
const makeId = () => `asset_${++seq}`;

const asset = {
  findMany: async ({ where, orderBy }: Row = {}) => {
    let rows = assetDb.filter((r) => {
      if (where?.userId && r.userId !== where.userId) return false;
      if (where?.deletedAt === null && r.deletedAt !== null) return false;
      if (where?.importKey?.in && !where.importKey.in.includes(r.importKey)) return false;
      return true;
    });
    if (orderBy?.updatedAt === "desc") {
      rows = [...rows].sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
    }
    if (orderBy?.type === "asc") {
      rows = [...rows].sort((a, b) => a.type.localeCompare(b.type));
    }
    return rows;
  },
  findFirst: async ({ where }: Row) =>
    assetDb.find((r) =>
      Object.entries(where).every(([k, v]) => {
        if (v === null) return r[k] === null || r[k] === undefined;
        return r[k] === v;
      })
    ) ?? null,
  create: async ({ data }: Row) => {
    const row = {
      id: makeId(),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    assetDb.push(row);
    return row;
  },
  update: async ({ where, data }: Row) => {
    const r = assetDb.find((x) => x.id === where.id);
    if (!r) throw new Error("not found");
    Object.assign(r, data, { updatedAt: new Date() });
    return r;
  },
  updateMany: async ({ where, data }: Row) => {
    const hits = assetDb.filter((r) =>
      Object.entries(where).every(([k, v]) => {
        if (v === null) return r[k] === null || r[k] === undefined;
        return r[k] === v;
      })
    );
    hits.forEach((r) => Object.assign(r, data, { updatedAt: new Date() }));
    return { count: hits.length };
  },
  count: async ({ where }: Row = {}) =>
    assetDb.filter((r) =>
      Object.entries(where).every(([k, v]) => {
        if (v === null) return r[k] === null || r[k] === undefined;
        return r[k] === v;
      })
    ).length,
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    asset,
    account: {
      findFirst: async ({ where }: Row = {}) =>
        where?.id === "invalid_acc" ? null : { id: where?.id ?? "acc_1", userId: where?.userId ?? "user_alpha", name: "HDFC Bank" },
    },
    liability: {
      findMany: async () => [],
    },
    snapshot: {
      findMany: async () => [],
      upsert: async ({ create }: Row) => ({ id: "snap_1", ...create }),
    },
    allocationTarget: {
      findMany: async () => [],
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  },
}));

beforeEach(async () => {
  assetDb = [];
  seq = 0;
  await cache.clear();
});

describe("Phase 2: Asset CRUD and Manual Management", () => {
  const USER_A = "user_alpha";
  const USER_B = "user_beta";

  it("1. creates assets across all supported categories with correct defaults", async () => {
    // 1.1 Fixed Deposit (non-unit, quantity defaults to 1, priceSource is MANUAL)
    const fd = await AssetService.create(USER_A, {
      type: "FIXED_DEPOSIT",
      name: "HDFC 1-Year FD",
      avgBuyPrice: 100000,
      currentPrice: 107500,
      currency: "INR",
      account: "HDFC Bank",
    });
    expect(fd.id).toBeDefined();
    expect(new Prisma.Decimal(fd.quantity).toNumber()).toBe(1);
    expect(new Prisma.Decimal(fd.avgBuyPrice).toNumber()).toBe(100000);
    expect(new Prisma.Decimal(fd.currentPrice).toNumber()).toBe(107500);
    expect(fd.priceSource).toBe("MANUAL");
    expect(fd.priceUpdatedAt).toBeInstanceOf(Date);

    // 1.2 EPF / PPF
    const epf = await AssetService.create(USER_A, {
      type: "EPF_PPF",
      name: "Public Provident Fund",
      avgBuyPrice: 250000,
      currentPrice: 280000,
      currency: "INR",
      account: "SBI",
    });
    expect(epf.type).toBe("EPF_PPF");
    expect(epf.priceSource).toBe("MANUAL");

    // 1.3 Real Estate
    const re = await AssetService.create(USER_A, {
      type: "REAL_ESTATE",
      name: "Bengaluru 2BHK Apartment",
      avgBuyPrice: 6500000,
      currentPrice: 7200000,
      currency: "INR",
    });
    expect(re.type).toBe("REAL_ESTATE");
    expect(re.priceSource).toBe("MANUAL");

    // 1.4 Gold
    const gold = await AssetService.create(USER_A, {
      type: "GOLD",
      name: "Sovereign Gold Bond 2026",
      avgBuyPrice: 50000,
      currentPrice: 68000,
      currency: "INR",
    });
    expect(gold.type).toBe("GOLD");
    expect(gold.priceSource).toBe("MANUAL");

    // 1.5 Stock without live provider price (falls back to COST_BASIS)
    const stock = await AssetService.create(USER_A, {
      type: "STOCK",
      name: "Tata Motors",
      symbol: "TATAMOTORS.NS",
      quantity: 50,
      avgBuyPrice: 850,
      currency: "INR",
    });
    expect(stock.type).toBe("STOCK");
    expect(new Prisma.Decimal(stock.quantity).toNumber()).toBe(50);
    expect(stock.priceSource).toBe("COST_BASIS");

    // 1.6 Mutual fund with manual valuation
    const mf = await AssetService.create(USER_A, {
      type: "MUTUAL_FUND",
      name: "Parag Parikh Flexi Cap Fund",
      quantity: 120.5,
      avgBuyPrice: 65.25,
      currentPrice: 78.4,
      currency: "INR",
      priceSource: "MANUAL",
    });
    expect(mf.priceSource).toBe("MANUAL");
  });

  it("2. enforces user ownership and authorization isolation (404 on unowned/cross-user access)", async () => {
    const assetA = await AssetService.create(USER_A, {
      type: "STOCK",
      name: "Infosys",
      symbol: "INFY.NS",
      quantity: 10,
      avgBuyPrice: 1400,
      currency: "INR",
    });

    // User A can read their own asset
    const readByOwner = await AssetService.getById(USER_A, assetA.id);
    expect(readByOwner.id).toBe(assetA.id);

    // User B cannot read User A's asset -> throws NotFoundError (status 404)
    await expect(AssetService.getById(USER_B, assetA.id)).rejects.toBeInstanceOf(NotFoundError);

    // User B cannot update User A's asset -> throws NotFoundError
    await expect(
      AssetService.update(USER_B, assetA.id, { currentPrice: 2000 })
    ).rejects.toBeInstanceOf(NotFoundError);

    // Verify User A's asset remains unmutated
    const intact = await AssetService.getById(USER_A, assetA.id);
    expect(new Prisma.Decimal(intact.currentPrice).toNumber()).toBe(1400);

    // User B cannot delete User A's asset -> throws NotFoundError
    await expect(AssetService.remove(USER_B, assetA.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(intact.deletedAt).toBeNull();
  });

  it("3. soft deletes asset and excludes from portfolio and list", async () => {
    const asset = await AssetService.create(USER_A, {
      type: "GOLD",
      name: "Gold ETF",
      quantity: 10,
      avgBuyPrice: 5000,
      currentPrice: 5500,
      currency: "INR",
    });

    // Pre-delete: list and portfolio contain the asset
    const listBefore = await AssetService.list(USER_A);
    expect(listBefore.some((a: any) => a.id === asset.id)).toBe(true);

    const portfolioBefore = await AssetService.getPortfolioWithPL(USER_A);
    expect(portfolioBefore.some((a: any) => a.id === asset.id)).toBe(true);

    // Soft delete
    const result = await AssetService.remove(USER_A, asset.id);
    expect(result).toEqual({ deleted: true });

    // Post-delete: excluded from list
    const listAfter = await AssetService.list(USER_A);
    expect(listAfter.some((a: any) => a.id === asset.id)).toBe(false);

    // Post-delete: excluded from portfolio with P&L
    const portfolioAfter = await AssetService.getPortfolioWithPL(USER_A);
    expect(portfolioAfter.some((a: any) => a.id === asset.id)).toBe(false);

    // getById throws NotFoundError for soft-deleted asset
    await expect(AssetService.getById(USER_A, asset.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("4. validates inputs and rejects unsupported asset categories and invalid numbers", () => {
    // Unsupported category
    const invalidCategory = assetSchema.safeParse({
      type: "COMMODITY",
      name: "Crude Oil",
      avgBuyPrice: 5000,
    });
    expect(invalidCategory.success).toBe(false);

    // Negative quantity
    const negativeQty = assetSchema.safeParse({
      type: "STOCK",
      name: "Reliance",
      quantity: -5,
      avgBuyPrice: 2000,
    });
    expect(negativeQty.success).toBe(false);

    // Negative purchase price
    const negativePrice = assetSchema.safeParse({
      type: "STOCK",
      name: "Reliance",
      quantity: 10,
      avgBuyPrice: -100,
    });
    expect(negativePrice.success).toBe(false);

    // Empty name
    const emptyName = assetSchema.safeParse({
      type: "STOCK",
      name: "",
      avgBuyPrice: 500,
    });
    expect(emptyName.success).toBe(false);

    // Valid inputs for new categories pass schema validation
    const validFd = assetSchema.safeParse({
      type: "FIXED_DEPOSIT",
      name: "SBI Term Deposit",
      avgBuyPrice: 50000,
    });
    expect(validFd.success).toBe(true);
    expect(validFd.data?.quantity).toBe(1);

    const validUpdate = assetUpdateSchema.safeParse({
      currentPrice: 55000,
    });
    expect(validUpdate.success).toBe(true);
  });

  it("5. correctly updates manual valuations and switches provenance to MANUAL", async () => {
    const stock = await AssetService.create(USER_A, {
      type: "STOCK",
      name: "ITC Ltd",
      quantity: 100,
      avgBuyPrice: 400,
      currency: "INR",
    });
    expect(stock.priceSource).toBe("COST_BASIS");

    // Update current price manually
    const updated = await AssetService.update(USER_A, stock.id, {
      currentPrice: 480,
    });
    expect(new Prisma.Decimal(updated.currentPrice).toNumber()).toBe(480);
    expect(updated.priceSource).toBe("MANUAL");
    expect(updated.priceUpdatedAt).toBeInstanceOf(Date);
  });
});

describe("Phase 2: Valuation Correctness & Detailed Status Rules (§10.1 - §10.3)", () => {
  const USER_A = "user_alpha";
  const base = { id: "a1", name: "Apple", symbol: "AAPL", account: null };

  it("distinguishes LIVE, STATEMENT, MANUAL, COST_BASIS, STALE, and FX_UNAVAILABLE", () => {
    const now = new Date();

    // 1. LIVE (provider price fresh < 3 days)
    const liveStock = toPL(
      {
        ...base,
        type: "STOCK",
        quantity: 10,
        avgBuyPrice: 150,
        currentPrice: 180,
        currency: "INR",
        priceSource: "YAHOO",
        priceUpdatedAt: now,
      },
      1
    );
    expect(liveStock.valuationStatus).toBe("OK");
    expect(liveStock.detailedValuationStatus).toBe("LIVE");

    // 2. STALE (provider price older than 3 days)
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
    const staleStock = toPL(
      {
        ...base,
        type: "STOCK",
        quantity: 10,
        avgBuyPrice: 150,
        currentPrice: 180,
        currency: "INR",
        priceSource: "YAHOO",
        priceUpdatedAt: fiveDaysAgo,
      },
      1
    );
    expect(staleStock.valuationStatus).toBe("OK");
    expect(staleStock.detailedValuationStatus).toBe("STALE");

    // 3. MANUAL
    const manualAsset = toPL(
      {
        ...base,
        type: "REAL_ESTATE",
        quantity: 1,
        avgBuyPrice: 5000000,
        currentPrice: 6000000,
        currency: "INR",
        priceSource: "MANUAL",
        priceUpdatedAt: now,
      },
      1
    );
    expect(manualAsset.valuationStatus).toBe("OK");
    expect(manualAsset.detailedValuationStatus).toBe("MANUAL");

    // 4. STATEMENT
    const statementMf = toPL(
      {
        ...base,
        type: "MUTUAL_FUND",
        quantity: 100,
        avgBuyPrice: 50,
        currentPrice: 60,
        currency: "INR",
        priceSource: "STATEMENT",
        priceUpdatedAt: now,
      },
      1
    );
    expect(statementMf.valuationStatus).toBe("OK");
    expect(statementMf.detailedValuationStatus).toBe("STATEMENT");

    // 5. COST_BASIS (fallback to purchase cost, explicitly labelled)
    const costBasisAsset = toPL(
      {
        ...base,
        type: "STOCK",
        quantity: 10,
        avgBuyPrice: 100,
        currentPrice: 100,
        currency: "INR",
        priceSource: "COST_BASIS",
        priceUpdatedAt: null,
      },
      1
    );
    expect(costBasisAsset.valuationStatus).toBe("NO_MARKET_PRICE");
    expect(costBasisAsset.detailedValuationStatus).toBe("COST_BASIS");

    // 6. FX_UNAVAILABLE (USD asset with missing exchange rate)
    const fxUnavailableAsset = toPL(
      {
        ...base,
        type: "STOCK",
        quantity: 5,
        avgBuyPrice: 200,
        currentPrice: 220,
        currency: "USD",
        priceSource: "YAHOO",
        priceUpdatedAt: now,
      },
      null
    );
    expect(fxUnavailableAsset.valuationStatus).toBe("FX_UNAVAILABLE");
    expect(fxUnavailableAsset.detailedValuationStatus).toBe("FX_UNAVAILABLE");
    expect(fxUnavailableAsset.currentValue).toBe(0);
    expect(fxUnavailableAsset.invested).toBe(0);
    expect(fxUnavailableAsset.currentValueNative).toBe(1100);
  });

  it("computes portfolio summaries and allocations across new and manual asset classes", async () => {
    const userId = "portfolio_user";

    // Add FD: ₹200,000 invested, ₹210,000 current
    await AssetService.create(userId, {
      type: "FIXED_DEPOSIT",
      name: "Axis Bank FD",
      avgBuyPrice: 200000,
      currentPrice: 210000,
      currency: "INR",
    });

    // Add Gold: ₹100,000 invested, ₹120,000 current
    await AssetService.create(userId, {
      type: "GOLD",
      name: "Gold Sovereign",
      avgBuyPrice: 100000,
      currentPrice: 120000,
      currency: "INR",
    });

    // Add Stock: 10 shares @ ₹1,000, current ₹1,500 = ₹10,000 invested, ₹15,000 current
    await AssetService.create(userId, {
      type: "STOCK",
      name: "TCS",
      quantity: 10,
      avgBuyPrice: 1000,
      currentPrice: 1500,
      currency: "INR",
      priceSource: "MANUAL",
    });

    const summary = await PortfolioService.getPortfolioSummary(userId);
    // Total invested: 200,000 + 100,000 + 10,000 = 310,000
    // Total current value: 210,000 + 120,000 + 15,000 = 345,000
    // Total P&L: 35,000
    expect(summary.invested).toBe(310000);
    expect(summary.currentValue).toBe(345000);
    expect(summary.pnl).toBe(35000);
    expect(summary.pnlPercent).toBeCloseTo((35000 / 310000) * 100, 4);
    expect(summary.assetCount).toBe(3);

    const allocation = await PortfolioService.getAllocation(userId);
    expect(allocation.length).toBe(3);
    const fdAlloc = allocation.find((a) => a.assetType === "FIXED_DEPOSIT");
    const goldAlloc = allocation.find((a) => a.assetType === "GOLD");
    const stockAlloc = allocation.find((a) => a.assetType === "STOCK");

    expect(fdAlloc?.value).toBe(210000);
    expect(goldAlloc?.value).toBe(120000);
    expect(stockAlloc?.value).toBe(15000);
    expect(fdAlloc!.percent + goldAlloc!.percent + stockAlloc!.percent).toBeCloseTo(100, 2);

    const riskScore = await PortfolioService.getRiskScore(userId);
    expect(riskScore).toBeGreaterThan(0);
  });

  it("6. updates quantity and recalculates invested and currentValue, while non-price updates preserve priceSource", async () => {
    const stock = await AssetService.create(USER_A, {
      type: "STOCK",
      name: "HDFC Bank",
      symbol: "HDFCBANK.NS",
      quantity: 10,
      avgBuyPrice: 1500,
      currentPrice: 1650,
      priceSource: "YAHOO",
      currency: "INR",
    });

    // Update only quantity
    const updatedQty = await AssetService.update(USER_A, stock.id, {
      quantity: 25,
    });
    expect(new Prisma.Decimal(updatedQty.quantity).toNumber()).toBe(25);
    // priceSource should remain YAHOO because price wasn't modified
    expect(updatedQty.priceSource).toBe("YAHOO");

    // Portfolio valuation check
    const portfolio = await AssetService.getPortfolioWithPL(USER_A);
    const item = portfolio.find((a) => a.id === stock.id)!;
    expect(item.quantity).toBe(25);
    expect(item.invested).toBe(25 * 1500); // 37,500
    expect(item.currentValue).toBe(25 * 1650); // 41,250
    expect(item.pnl).toBe(41250 - 37500); // 3,750
    expect(item.pnlPercent).toBeCloseTo(10, 2);
  });

  it("7. synchronizes currentPrice when updating avgBuyPrice on COST_BASIS assets without explicit currentPrice", async () => {
    const asset = await AssetService.create(USER_A, {
      type: "STOCK",
      name: "Unlisted Startup Equity",
      quantity: 100,
      avgBuyPrice: 50,
      currency: "INR",
    });
    expect(asset.priceSource).toBe("COST_BASIS");
    expect(new Prisma.Decimal(asset.currentPrice).toNumber()).toBe(50);

    // Update purchase cost basis
    const updated = await AssetService.update(USER_A, asset.id, {
      avgBuyPrice: 75,
    });
    expect(new Prisma.Decimal(updated.avgBuyPrice).toNumber()).toBe(75);
    expect(new Prisma.Decimal(updated.currentPrice).toNumber()).toBe(75);
    expect(updated.priceSource).toBe("COST_BASIS");
  });

  it("8. rejects whitespace-only names and zero or negative quantities", () => {
    // Whitespace only name
    const wsName = assetSchema.safeParse({
      type: "STOCK",
      name: "   ",
      avgBuyPrice: 100,
      quantity: 1,
    });
    expect(wsName.success).toBe(false);

    // Zero quantity
    const zeroQty = assetSchema.safeParse({
      type: "STOCK",
      name: "Apple",
      avgBuyPrice: 100,
      quantity: 0,
    });
    expect(zeroQty.success).toBe(false);

    // Whitespace name in update
    const wsUpdate = assetUpdateSchema.safeParse({
      name: "   ",
    });
    expect(wsUpdate.success).toBe(false);
  });

  it("9. distinguishes a valid zero valuation from missing valuation", () => {
    const baseAsset = { id: "z1", name: "Liquidated Token", symbol: "LQD", account: null, currency: "INR" };

    // Valid zero valuation entered manually
    const validZero = toPL(
      {
        ...baseAsset,
        type: "CRYPTO",
        quantity: 1000,
        avgBuyPrice: 10,
        currentPrice: 0,
        priceSource: "MANUAL",
        priceUpdatedAt: new Date(),
      },
      1
    );
    expect(validZero.currentPrice).toBe(0);
    expect(validZero.currentValue).toBe(0);
    expect(validZero.invested).toBe(10000);
    expect(validZero.pnl).toBe(-10000);
    expect(validZero.pnlPercent).toBe(-100);
    expect(validZero.valuationStatus).toBe("OK");
    expect(validZero.detailedValuationStatus).toBe("MANUAL");

    // Missing valuation (null/undefined currentPrice) falls back to cost basis with NO_MARKET_PRICE
    const missingValuation = toPL(
      {
        ...baseAsset,
        type: "STOCK",
        quantity: 10,
        avgBuyPrice: 150,
        currentPrice: null as any,
        priceSource: null,
      },
      1
    );
    expect(missingValuation.currentPrice).toBe(150);
    expect(missingValuation.valuationStatus).toBe("NO_MARKET_PRICE");
    expect(missingValuation.detailedValuationStatus).toBe("COST_BASIS");
  });

  it("10. propagates asset mutations into portfolio totals, allocation, and net worth", async () => {
    const userId = "propagation_user";

    // 1. Initial State: Net Worth and Portfolio are 0
    let nw = await NetWorthService.getCurrent(userId);
    expect(nw.totalAssets).toBe(0);
    expect(nw.netWorth).toBe(0);

    // 2. Create Asset: Real estate ₹5,000,000 invested and ₹5,000,000 current
    const property = await AssetService.create(userId, {
      type: "REAL_ESTATE",
      name: "Whitefield Villa",
      avgBuyPrice: 5000000,
      currentPrice: 5000000,
      currency: "INR",
    });

    let portfolioSummary = await PortfolioService.getPortfolioSummary(userId);
    expect(portfolioSummary.invested).toBe(5000000);
    expect(portfolioSummary.currentValue).toBe(5000000);
    expect(portfolioSummary.pnl).toBe(0);

    nw = await NetWorthService.getCurrent(userId);
    expect(nw.totalAssets).toBe(5000000);
    expect(nw.netWorth).toBe(5000000);
    expect(nw.breakdown["REAL_ESTATE"]).toBe(5000000);

    // 3. Update Valuation: Appreciated to ₹6,200,000
    await AssetService.update(userId, property.id, {
      currentPrice: 6200000,
    });

    portfolioSummary = await PortfolioService.getPortfolioSummary(userId);
    expect(portfolioSummary.invested).toBe(5000000);
    expect(portfolioSummary.currentValue).toBe(6200000);
    expect(portfolioSummary.pnl).toBe(1200000);
    expect(portfolioSummary.pnlPercent).toBeCloseTo(24, 2);

    nw = await NetWorthService.getCurrent(userId);
    expect(nw.totalAssets).toBe(6200000);
    expect(nw.netWorth).toBe(6200000);
    expect(nw.breakdown["REAL_ESTATE"]).toBe(6200000);

    const alloc = await PortfolioService.getAllocation(userId);
    expect(alloc).toHaveLength(1);
    expect(alloc[0].assetType).toBe("REAL_ESTATE");
    expect(alloc[0].value).toBe(6200000);
    expect(alloc[0].percent).toBe(100);

    // 4. Soft Delete Asset
    await AssetService.remove(userId, property.id);

    portfolioSummary = await PortfolioService.getPortfolioSummary(userId);
    expect(portfolioSummary.invested).toBe(0);
    expect(portfolioSummary.currentValue).toBe(0);
    expect(portfolioSummary.assetCount).toBe(0);

    nw = await NetWorthService.getCurrent(userId);
    expect(nw.totalAssets).toBe(0);
    expect(nw.netWorth).toBe(0);

    const allocAfter = await PortfolioService.getAllocation(userId);
    expect(allocAfter).toHaveLength(0);
  });

  it("11. avoids double counting when aggregating multi-tranche holdings", () => {
    const tranches = [
      toPL(
        {
          id: "t1",
          type: "STOCK",
          name: "Reliance Industries",
          symbol: "RELIANCE",
          isin: "INE002A01018",
          exchange: "NSE",
          account: "Zerodha",
          quantity: 20,
          avgBuyPrice: 2400,
          currentPrice: 2900,
          currency: "INR",
          priceSource: "YAHOO",
          priceUpdatedAt: new Date(),
        },
        1
      ),
      toPL(
        {
          id: "t2",
          type: "STOCK",
          name: "Reliance Industries Ltd",
          symbol: "RELIANCE",
          isin: "INE002A01018",
          exchange: "NSE",
          account: "Groww",
          quantity: 30,
          avgBuyPrice: 2500,
          currentPrice: 2900,
          currency: "INR",
          priceSource: "YAHOO",
          priceUpdatedAt: new Date(),
        },
        1
      ),
    ];

    const aggregated = aggregatePortfolioAssets(tranches);
    expect(aggregated).toHaveLength(1);
    const rel = aggregated[0];
    expect(rel.quantity).toBe(50);
    expect(rel.invested).toBe(20 * 2400 + 30 * 2500); // 48,000 + 75,000 = 123,000
    expect(rel.currentValue).toBe(50 * 2900); // 145,000
    expect(rel.pnl).toBe(145000 - 123000); // 22,000
    expect(rel.holdingsCount).toBe(2);

    // Sum of aggregated matches sum of underlying tranches exactly
    const tranchesTotalVal = tranches.reduce((s, t) => s + t.currentValue, 0);
    const aggTotalVal = aggregated.reduce((s, g) => s + g.currentValue, 0);
    expect(aggTotalVal).toBe(tranchesTotalVal);
  });

  it("12. preserves last-known valid values when market-data provider fails", async () => {
    const userId = "resilience_user";

    const stock = await AssetService.create(userId, {
      type: "STOCK",
      name: "Infosys",
      symbol: "INFY.NS",
      quantity: 10,
      avgBuyPrice: 1400,
      currentPrice: 1550,
      priceSource: "YAHOO",
      currency: "INR",
    });
    expect(new Prisma.Decimal(stock.currentPrice).toNumber()).toBe(1550);

    // Provider failure: updates Map is empty for this asset
    const failedResult = {
      updates: new Map(),
      failures: new Map([[stock.id, { reason: "TIMEOUT", message: "Gateway timeout" }]]),
    };

    const applied = await AssetService.applyPrices(userId, [stock], failedResult);
    expect(applied).toBe(0);

    // Verify last-known price was NOT cleared or overwritten with 0/null
    const preserved = await AssetService.getById(userId, stock.id);
    expect(new Prisma.Decimal(preserved.currentPrice).toNumber()).toBe(1550);
    expect(preserved.priceSource).toBe("YAHOO");
  });
});
