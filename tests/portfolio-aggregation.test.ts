import { describe, expect, it } from "vitest";
import {
  aggregatePortfolioAssets,
  getAssetGroupKey,
  normalizeSchemeKey,
  normalizeTicker,
} from "../src/services/portfolio-aggregation.service";
import type { AssetWithPL } from "../src/types";

function createMockAsset(overrides: Partial<AssetWithPL> = {}): AssetWithPL {
  const quantity = overrides.quantity ?? 10;
  const avgBuyPrice = overrides.avgBuyPrice ?? 100;
  const currentPrice = overrides.currentPrice ?? 120;
  const currency = overrides.currency ?? "INR";
  const fxRateToInr = currency === "INR" ? 1 : overrides.fxRateToInr ?? 84;
  const investedNative = overrides.investedNative ?? quantity * avgBuyPrice;
  const currentValueNative = overrides.currentValueNative ?? quantity * currentPrice;
  const invested = overrides.invested ?? investedNative * (fxRateToInr ?? 1);
  const currentValue = overrides.currentValue ?? currentValueNative * (fxRateToInr ?? 1);
  const pnl = overrides.pnl ?? currentValue - invested;
  const pnlPercent = overrides.pnlPercent ?? (invested > 0 ? (pnl / invested) * 100 : 0);

  return {
    id: overrides.id ?? `asset-${Math.random().toString(36).substring(2, 9)}`,
    name: overrides.name ?? "Test Asset",
    type: overrides.type ?? "STOCK",
    symbol: overrides.symbol ?? null,
    isin: overrides.isin ?? null,
    exchange: overrides.exchange ?? "NSE",
    currency,
    quantity,
    avgBuyPrice,
    currentPrice,
    invested,
    currentValue,
    pnl,
    pnlPercent,
    investedNative,
    currentValueNative,
    pnlNative: currentValueNative - investedNative,
    fxRateToInr,
    valuationStatus: overrides.valuationStatus ?? "OK",
    detailedValuationStatus: overrides.detailedValuationStatus ?? "LIVE",
    priceSource: overrides.priceSource ?? "YAHOO",
    priceUpdatedAt: overrides.priceUpdatedAt ?? "2026-10-10T10:00:00Z",
    account: overrides.account ?? "Zerodha",
    folio: overrides.folio ?? null,
    importSource: overrides.importSource ?? "MANUAL",
    accountId: overrides.accountId ?? null,
  };
}

describe("Unified Portfolio Aggregation Across All Asset Categories", () => {
  // 1. Duplicate-looking Indian stock rows
  it("1. aggregates duplicate-looking Indian stock rows into a single combined row while preserving child tranches", () => {
    const tranche1 = createMockAsset({
      id: "rel-1",
      name: "Reliance Industries Ltd",
      symbol: "RELIANCE",
      exchange: "NSE",
      account: "Zerodha",
      quantity: 10,
      avgBuyPrice: 2400,
      currentPrice: 2800,
    });
    const tranche2 = createMockAsset({
      id: "rel-2",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      exchange: "NSE",
      account: "Groww",
      quantity: 15,
      avgBuyPrice: 2500,
      currentPrice: 2800,
    });

    const aggregated = aggregatePortfolioAssets([tranche1, tranche2]);

    expect(aggregated).toHaveLength(1);
    const rel = aggregated[0];
    expect(rel.symbol).toBe("RELIANCE");
    expect(rel.quantity).toBe(25);
    expect(rel.holdingsCount).toBe(2);
    expect(rel.uniqueAccountsCount).toBe(2);
    expect(rel.accounts).toContain("Zerodha");
    expect(rel.accounts).toContain("Groww");
    expect(rel.holdings).toHaveLength(2);
    expect(rel.holdings[0].id).toBe("rel-1");
    expect(rel.holdings[1].id).toBe("rel-2");
  });

  // 2. The same US stock imported from repeated statements
  it("2. aggregates the same US stock from repeated statements with foreign currency and weighted metrics", () => {
    const lot1 = createMockAsset({
      id: "us-1",
      name: "Apple Inc.",
      symbol: "AAPL",
      exchange: "NASDAQ",
      currency: "USD",
      fxRateToInr: 85,
      account: "INDmoney",
      quantity: 5,
      avgBuyPrice: 150,
      currentPrice: 200,
      investedNative: 750,
      currentValueNative: 1000,
      invested: 750 * 85,
      currentValue: 1000 * 85,
    });
    const lot2 = createMockAsset({
      id: "us-2",
      name: "Apple Inc",
      symbol: "AAPL",
      exchange: "NASDAQ",
      currency: "USD",
      fxRateToInr: 85,
      account: "Vested",
      quantity: 15,
      avgBuyPrice: 170,
      currentPrice: 200,
      investedNative: 2550,
      currentValueNative: 3000,
      invested: 2550 * 85,
      currentValue: 3000 * 85,
    });

    const aggregated = aggregatePortfolioAssets([lot1, lot2]);

    expect(aggregated).toHaveLength(1);
    const apple = aggregated[0];
    expect(apple.symbol).toBe("AAPL");
    expect(apple.currency).toBe("USD");
    expect(apple.quantity).toBe(20);
    // Weighted avg buy price: (750 + 2550) / 20 = 3300 / 20 = 165 USD
    expect(apple.avgBuyPrice).toBe(165);
    expect(apple.currentPrice).toBe(200);
    expect(apple.investedNative).toBe(3300);
    expect(apple.currentValueNative).toBe(4000);
    expect(apple.invested).toBe(3300 * 85);
    expect(apple.currentValue).toBe(4000 * 85);
    expect(apple.holdingsCount).toBe(2);
  });

  // 3. Identical tickers on different exchanges
  it("3. keeps identical tickers on different exchanges and currencies strictly separate", () => {
    const infyNse = createMockAsset({
      id: "infy-inr",
      name: "Infosys Ltd",
      symbol: "INFY",
      exchange: "NSE",
      currency: "INR",
      quantity: 100,
      avgBuyPrice: 1400,
      currentPrice: 1500,
    });
    const infyNyse = createMockAsset({
      id: "infy-usd",
      name: "Infosys ADR",
      symbol: "INFY",
      exchange: "NYSE",
      currency: "USD",
      fxRateToInr: 85,
      quantity: 50,
      avgBuyPrice: 18,
      currentPrice: 20,
    });

    const aggregated = aggregatePortfolioAssets([infyNse, infyNyse]);

    expect(aggregated).toHaveLength(2);
    const nseGroup = aggregated.find((g) => g.exchange === "NSE");
    const nyseGroup = aggregated.find((g) => g.exchange === "NYSE");

    expect(nseGroup).toBeDefined();
    expect(nseGroup?.currency).toBe("INR");
    expect(nseGroup?.quantity).toBe(100);

    expect(nyseGroup).toBeDefined();
    expect(nyseGroup?.currency).toBe("USD");
    expect(nyseGroup?.quantity).toBe(50);
  });

  // 4. Multiple mutual fund folios belonging to the same scheme
  it("4. combines multiple mutual fund folios of the same scheme into one row displaying folio counts and preserving folio IDs", () => {
    const folioA = createMockAsset({
      id: "ppfas-1",
      name: "Parag Parikh Flexi Cap Fund Direct Growth",
      type: "MUTUAL_FUND",
      folio: "12345/01",
      quantity: 120.5,
      avgBuyPrice: 65,
      currentPrice: 78.5,
      account: "Groww",
    });
    const folioB = createMockAsset({
      id: "ppfas-2",
      name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
      type: "MUTUAL_FUND",
      folio: "67890/99",
      quantity: 80.5,
      avgBuyPrice: 70,
      currentPrice: 78.5,
      account: "Groww",
    });

    const aggregated = aggregatePortfolioAssets([folioA, folioB]);

    expect(aggregated).toHaveLength(1);
    const fund = aggregated[0];
    expect(fund.type).toBe("MUTUAL_FUND");
    expect(fund.quantity).toBeCloseTo(201.0, 4);
    expect(fund.uniqueFoliosCount).toBe(2);
    expect(fund.folios).toContain("12345/01");
    expect(fund.folios).toContain("67890/99");
    expect(fund.holdingsCount).toBe(2);
    expect(fund.holdings[0].folio).toBe("12345/01");
    expect(fund.holdings[1].folio).toBe("67890/99");
  });

  // 5. The same scheme across different accounts and brokers
  it("5. aggregates the same mutual fund scheme across different brokers and accounts without losing account metadata", () => {
    const growwHoldings = createMockAsset({
      id: "mirae-groww",
      name: "Mirae Asset Large Cap Fund Direct Growth",
      type: "MUTUAL_FUND",
      account: "Groww",
      importSource: "GROWW",
      folio: "FOL-GROWW-1",
      quantity: 50,
      avgBuyPrice: 90,
      currentPrice: 110,
    });
    const indHoldings = createMockAsset({
      id: "mirae-ind",
      name: "Mirae Asset Large Cap Fund Direct Growth",
      type: "MUTUAL_FUND",
      account: "INDmoney",
      importSource: "INDMONEY",
      folio: "FOL-IND-2",
      quantity: 75,
      avgBuyPrice: 95,
      currentPrice: 110,
    });

    const aggregated = aggregatePortfolioAssets([growwHoldings, indHoldings]);

    expect(aggregated).toHaveLength(1);
    const mirae = aggregated[0];
    expect(mirae.quantity).toBe(125);
    expect(mirae.uniqueAccountsCount).toBe(2);
    expect(mirae.accounts).toEqual(expect.arrayContaining(["Groww", "INDmoney"]));
    expect(mirae.brokers).toEqual(expect.arrayContaining(["GROWW", "INDMONEY"]));
  });

  // 6. Different securities with similar names
  it("6. keeps different securities with similar names separate", () => {
    const tataMotors = createMockAsset({
      id: "tm-ord",
      name: "Tata Motors Limited",
      symbol: "TATAMOTORS",
      exchange: "NSE",
    });
    const tataMotorsDvr = createMockAsset({
      id: "tm-dvr",
      name: "Tata Motors Limited DVR",
      symbol: "TATAMTRDVR",
      exchange: "NSE",
    });
    const mfDirect = createMockAsset({
      id: "mf-dir",
      name: "HDFC Top 100 Fund Direct Growth",
      type: "MUTUAL_FUND",
    });
    const mfRegular = createMockAsset({
      id: "mf-reg",
      name: "HDFC Top 100 Fund Regular Growth",
      type: "MUTUAL_FUND",
    });
    const mfIdcw = createMockAsset({
      id: "mf-idcw",
      name: "HDFC Top 100 Fund Direct IDCW",
      type: "MUTUAL_FUND",
    });

    const aggregated = aggregatePortfolioAssets([tataMotors, tataMotorsDvr, mfDirect, mfRegular, mfIdcw]);

    expect(aggregated).toHaveLength(5);
    const keys = aggregated.map((a) => a.groupKey);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(5);
  });

  // 7. Cryptocurrency and other unit-based holdings with incompatible identities
  it("7. keeps cryptocurrency holdings separate when network, exchange, or currency differs", () => {
    const btcUsdBinance = createMockAsset({
      id: "btc-bin",
      name: "Bitcoin",
      symbol: "BTC",
      type: "CRYPTO",
      exchange: "BINANCE",
      currency: "USD",
    });
    const btcInrWazirx = createMockAsset({
      id: "btc-waz",
      name: "Bitcoin",
      symbol: "BTC",
      type: "CRYPTO",
      exchange: "WAZIRX",
      currency: "INR",
    });
    const wbtc = createMockAsset({
      id: "wbtc-coin",
      name: "Wrapped BTC",
      symbol: "WBTC",
      type: "CRYPTO",
      exchange: "BINANCE",
      currency: "USD",
    });

    const aggregated = aggregatePortfolioAssets([btcUsdBinance, btcInrWazirx, wbtc]);

    expect(aggregated).toHaveLength(3);
  });

  // 8. Non-unit assets that must remain separate
  it("8. preserves non-unit and fixed-value assets (FDs, real estate, EPF/PPF) as distinct individual records", () => {
    const fd1 = createMockAsset({
      id: "fd-101",
      name: "HDFC Fixed Deposit",
      type: "FIXED_DEPOSIT",
      quantity: 1,
      avgBuyPrice: 100000,
      currentPrice: 106000,
    });
    const fd2 = createMockAsset({
      id: "fd-102",
      name: "HDFC Fixed Deposit",
      type: "FIXED_DEPOSIT",
      quantity: 1,
      avgBuyPrice: 200000,
      currentPrice: 214000,
    });
    const prop1 = createMockAsset({
      id: "prop-1",
      name: "Residential Apartment",
      type: "REAL_ESTATE",
      quantity: 1,
      avgBuyPrice: 5000000,
      currentPrice: 6500000,
    });
    const prop2 = createMockAsset({
      id: "prop-2",
      name: "Residential Apartment",
      type: "REAL_ESTATE",
      quantity: 1,
      avgBuyPrice: 8000000,
      currentPrice: 9500000,
    });

    const aggregated = aggregatePortfolioAssets([fd1, fd2, prop1, prop2]);

    expect(aggregated).toHaveLength(4);
    expect(aggregated.every((g) => g.holdingsCount === 1)).toBe(true);
  });

  // 9. Weighted average cost and aggregate P&L percentage
  it("9. accurately computes weighted average cost and aggregate P&L percentage instead of simple averages", () => {
    // Tranche 1: 10 units @ 100 = 1,000 invested; CMP 150 = 1,500 value (+500 P&L, +50%)
    const lot1 = createMockAsset({
      id: "lot-1",
      quantity: 10,
      avgBuyPrice: 100,
      currentPrice: 150,
      investedNative: 1000,
      currentValueNative: 1500,
      invested: 1000,
      currentValue: 1500,
      pnl: 500,
      pnlPercent: 50,
      symbol: "TEST",
    });
    // Tranche 2: 30 units @ 200 = 6,000 invested; CMP 150 = 4,500 value (-1,500 P&L, -25%)
    const lot2 = createMockAsset({
      id: "lot-2",
      quantity: 30,
      avgBuyPrice: 200,
      currentPrice: 150,
      investedNative: 6000,
      currentValueNative: 4500,
      invested: 6000,
      currentValue: 4500,
      pnl: -1500,
      pnlPercent: -25,
      symbol: "TEST",
    });

    const aggregated = aggregatePortfolioAssets([lot1, lot2]);

    expect(aggregated).toHaveLength(1);
    const pos = aggregated[0];

    expect(pos.quantity).toBe(40);
    expect(pos.invested).toBe(7000);
    expect(pos.currentValue).toBe(6000);
    expect(pos.pnl).toBe(-1000);

    // Weighted avg cost: (1000 + 6000) / 40 = 175 (simple avg would have been 150)
    expect(pos.avgBuyPrice).toBe(175);
    expect(pos.currentPrice).toBe(150);

    // Aggregate P&L %: (-1000 / 7000) * 100 = -14.2857% (simple avg would have been +12.5%)
    expect(pos.pnlPercent).toBeCloseTo(-14.2857, 3);
  });

  // 10. Foreign-currency conversion and missing-FX behavior
  it("10. handles missing FX rates by rolling up FX_UNAVAILABLE status without corrupting native totals", () => {
    const validUsStock = createMockAsset({
      id: "us-ok",
      name: "Microsoft Corp",
      symbol: "MSFT",
      currency: "USD",
      exchange: "NASDAQ",
      quantity: 10,
      avgBuyPrice: 300,
      currentPrice: 400,
      investedNative: 3000,
      currentValueNative: 4000,
      invested: 3000 * 85,
      currentValue: 4000 * 85,
      valuationStatus: "OK",
    });
    const brokenFxStock = createMockAsset({
      id: "us-nofx",
      name: "Microsoft Corp",
      symbol: "MSFT",
      currency: "USD",
      exchange: "NASDAQ",
      quantity: 5,
      avgBuyPrice: 310,
      currentPrice: 400,
      investedNative: 1550,
      currentValueNative: 2000,
      invested: 0,
      currentValue: 0,
      fxRateToInr: null,
      valuationStatus: "FX_UNAVAILABLE",
      detailedValuationStatus: "FX_UNAVAILABLE",
    });

    const aggregated = aggregatePortfolioAssets([validUsStock, brokenFxStock]);

    expect(aggregated).toHaveLength(1);
    const msft = aggregated[0];
    expect(msft.valuationStatus).toBe("FX_UNAVAILABLE");
    expect(msft.detailedValuationStatus).toBe("FX_UNAVAILABLE");
    expect(msft.quantity).toBe(15);
    expect(msft.investedNative).toBe(4550);
    expect(msft.currentValueNative).toBe(6000);
  });

  // 11. Missing/stale price handling
  it("11. rolls up STALE and COST_BASIS valuation statuses accurately without fabricating live quotes", () => {
    const staleAsset1 = createMockAsset({
      id: "stale-1",
      symbol: "OLDSTOCK",
      detailedValuationStatus: "STALE",
      priceUpdatedAt: "2026-10-01T10:00:00Z",
    });
    const staleAsset2 = createMockAsset({
      id: "stale-2",
      symbol: "OLDSTOCK",
      detailedValuationStatus: "LIVE",
      priceUpdatedAt: "2026-10-10T10:00:00Z",
    });

    const aggStale = aggregatePortfolioAssets([staleAsset1, staleAsset2]);
    expect(aggStale[0].detailedValuationStatus).toBe("STALE");

    const unlisted1 = createMockAsset({
      id: "unlisted-1",
      symbol: "STARTUP",
      detailedValuationStatus: "COST_BASIS",
      valuationStatus: "NO_MARKET_PRICE",
    });
    const unlisted2 = createMockAsset({
      id: "unlisted-2",
      symbol: "STARTUP",
      detailedValuationStatus: "COST_BASIS",
      valuationStatus: "NO_MARKET_PRICE",
    });

    const aggUnlisted = aggregatePortfolioAssets([unlisted1, unlisted2]);
    expect(aggUnlisted[0].valuationStatus).toBe("NO_MARKET_PRICE");
    expect(aggUnlisted[0].detailedValuationStatus).toBe("COST_BASIS");
  });

  // 12. Search, filtering, and portfolio totals without double-counting
  it("12. verifies portfolio totals match underlying records without double-counting", () => {
    const asset1 = createMockAsset({ id: "a1", symbol: "TCS", invested: 50000, currentValue: 60000 });
    const asset2 = createMockAsset({ id: "a2", symbol: "TCS", invested: 30000, currentValue: 35000 });
    const asset3 = createMockAsset({ id: "a3", symbol: "INFY", invested: 20000, currentValue: 18000 });
    const allAssets = [asset1, asset2, asset3];

    const aggregated = aggregatePortfolioAssets(allAssets);

    const totalUnderlyingInvested = allAssets.reduce((s, a) => s + a.invested, 0);
    const totalUnderlyingCurrent = allAssets.reduce((s, a) => s + a.currentValue, 0);
    const totalUnderlyingPnl = allAssets.reduce((s, a) => s + a.pnl, 0);

    const totalAggregatedInvested = aggregated.reduce((s, g) => s + g.invested, 0);
    const totalAggregatedCurrent = aggregated.reduce((s, g) => s + g.currentValue, 0);
    const totalAggregatedPnl = aggregated.reduce((s, g) => s + g.pnl, 0);

    expect(totalAggregatedInvested).toBe(totalUnderlyingInvested);
    expect(totalAggregatedCurrent).toBe(totalUnderlyingCurrent);
    expect(totalAggregatedPnl).toBe(totalUnderlyingPnl);

    // Summing aggregated + children together would be 2x double counting
    expect(totalAggregatedInvested).not.toBe(totalUnderlyingInvested * 2);
  });

  // 13. Editing or deleting one underlying holding without affecting the others
  it("13. allows targeting a specific child holding for edit or delete while keeping other tranches intact", () => {
    let mockDatabase = [
      createMockAsset({ id: "tranche-a", symbol: "HDFCBANK", quantity: 50, avgBuyPrice: 1500, invested: 75000, currentValue: 80000 }),
      createMockAsset({ id: "tranche-b", symbol: "HDFCBANK", quantity: 30, avgBuyPrice: 1600, invested: 48000, currentValue: 48000 }),
    ];

    // Initial aggregation has 2 tranches
    let agg = aggregatePortfolioAssets(mockDatabase);
    expect(agg[0].quantity).toBe(80);
    expect(agg[0].holdingsCount).toBe(2);

    // Delete tranche-a specifically
    mockDatabase = mockDatabase.filter((a) => a.id !== "tranche-a");

    // Re-aggregation reflects only tranche-b
    agg = aggregatePortfolioAssets(mockDatabase);
    expect(agg).toHaveLength(1);
    expect(agg[0].quantity).toBe(30);
    expect(agg[0].holdingsCount).toBe(1);
    expect(agg[0].holdings[0].id).toBe("tranche-b");
    expect(agg[0].invested).toBe(48000);
  });

  // 14. Repeated imports and price refreshes without creating duplicate records
  it("14. simulates repeated imports and price refresh without duplicate positions", () => {
    const initialLot = createMockAsset({
      id: "mf-folio-1",
      name: "Quant Small Cap Fund Direct Growth",
      type: "MUTUAL_FUND",
      folio: "FOLIO-101",
      quantity: 100,
      avgBuyPrice: 150,
      currentPrice: 200,
      invested: 15000,
      currentValue: 20000,
      priceUpdatedAt: "2026-10-09T00:00:00Z",
    });

    let portfolio = [initialLot];
    let agg = aggregatePortfolioAssets(portfolio);
    expect(agg).toHaveLength(1);
    expect(agg[0].currentPrice).toBe(200);

    // Simulated price refresh: updates currentPrice and currentValue on existing record
    portfolio = portfolio.map((a) => ({
      ...a,
      currentPrice: 220,
      currentValue: a.quantity * 220,
      currentValueNative: a.quantity * 220,
      pnl: a.quantity * 220 - a.invested,
      pnlNative: a.quantity * 220 - a.investedNative,
      priceUpdatedAt: "2026-10-11T12:00:00Z",
    }));

    agg = aggregatePortfolioAssets(portfolio);
    expect(agg).toHaveLength(1);
    expect(agg[0].currentPrice).toBe(220);
    expect(agg[0].currentValue).toBe(22000);
    expect(agg[0].priceUpdatedAt).toBe("2026-10-11T12:00:00Z");
  });
});
