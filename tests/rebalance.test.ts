import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateRebalancePlan } from "../src/lib/finance/rebalance";
import { PortfolioService } from "../src/services/portfolio.service";
import { AssetService } from "../src/services/asset.service";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("test-user-123"),
}));

import { GET, POST } from "../app/api/portfolio/rebalance/route";

describe("Phase 6: Deterministic Portfolio Rebalancing Engine (REBAL-001..003 & §13.9)", () => {
  describe("1. Target Allocation Validation (REBAL-001)", () => {
    it("returns error TARGETS_INVALID if targets do not sum to 100% ±0.01%", () => {
      const holdings = [
        { type: "STOCK" as const, currentValue: 100000 },
      ];
      const invalidTargets = [
        { assetType: "STOCK" as const, targetPercent: 60 },
        { assetType: "MUTUAL_FUND" as const, targetPercent: 30 }, // Sum = 90%
      ];

      const result = calculateRebalancePlan(holdings, invalidTargets);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("TARGETS_INVALID");
      expect(result.message).toContain("100% ±0.01%");
      expect(result.items).toHaveLength(0);
    });

    it("succeeds when targets sum to exactly 100.00%", () => {
      const holdings = [
        { type: "STOCK" as const, currentValue: 50000 },
        { type: "MUTUAL_FUND" as const, currentValue: 50000 },
      ];
      const targets = [
        { assetType: "STOCK" as const, targetPercent: 50 },
        { assetType: "MUTUAL_FUND" as const, targetPercent: 50 },
      ];

      const result = calculateRebalancePlan(holdings, targets);
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("handles empty targets with safe informational response", () => {
      const result = calculateRebalancePlan([], []);
      expect(result.ok).toBe(true);
      expect(result.items).toHaveLength(0);
      expect(result.warnings[0]).toContain("No allocation targets set");
    });
  });

  describe("2. CASH_ONLY Mode Rebalancing (Default, Master Architecture §13.9)", () => {
    // 70% Stock (₹70,000), 30% Mutual Fund (₹30,000). Total = ₹100,000.
    // Target: 50% Stock, 50% Mutual Fund.
    // Stock is overweight (+20%), Mutual Fund is underweight (-20%).
    const holdings = [
      { type: "STOCK" as const, currentValue: 70000 },
      { type: "MUTUAL_FUND" as const, currentValue: 30000 },
    ];
    const targets = [
      { assetType: "STOCK" as const, targetPercent: 50 },
      { assetType: "MUTUAL_FUND" as const, targetPercent: 50 },
    ];

    it("never sells in CASH_ONLY mode; overweight classes are strictly HOLD", () => {
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "CASH_ONLY",
        newCash: 40000,
        driftThreshold: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("CASH_ONLY");

      const stock = result.items.find((i) => i.assetType === "STOCK")!;
      const mf = result.items.find((i) => i.assetType === "MUTUAL_FUND")!;

      expect(stock.action).toBe("HOLD");
      expect(stock.suggestedAmount).toBe(0);
      expect(stock.driftPct).toBe(20);

      expect(mf.action).toBe("BUY");
      expect(mf.suggestedAmount).toBeGreaterThan(0);
      expect(mf.driftPct).toBe(-20);
    });

    it("does not recommend buys when newCash is zero (pure cash-inflow rebalancing)", () => {
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "CASH_ONLY",
        newCash: 0,
        driftThreshold: 5,
      });

      expect(result.ok).toBe(true);
      const stock = result.items.find((i) => i.assetType === "STOCK")!;
      const mf = result.items.find((i) => i.assetType === "MUTUAL_FUND")!;

      expect(stock.action).toBe("HOLD");
      expect(stock.suggestedAmount).toBe(0);
      expect(mf.action).toBe("HOLD");
      expect(mf.suggestedAmount).toBe(0);
      expect(result.residualCash).toBe(0);
    });

    it("scales cash allocation proportionally when new cash is less than required delta", () => {
      // Total value = ₹100,000 + ₹20,000 cash = ₹120,000
      // Target MF = 50% of 120,000 = ₹60,000. Current MF = ₹30,000. Delta = ₹30,000.
      // Available cash = ₹15,000 (< ₹30,000 needed).
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "CASH_ONLY",
        newCash: 15000,
        driftThreshold: 5,
      });

      const mf = result.items.find((i) => i.assetType === "MUTUAL_FUND")!;
      expect(mf.action).toBe("BUY");
      // All ₹15,000 cash is allocated to underweight class
      expect(mf.suggestedAmount).toBe(15000);
      expect(result.residualCash).toBe(0);
    });

    it("reports unspent residual cash when available cash exceeds total underweight requirements", () => {
      // Total value = ₹100,000 + ₹50,000 cash = ₹150,000
      // Target MF = 50% of 150,000 = ₹75,000. Current = ₹30,000. Delta = ₹45,000.
      // Available cash = ₹50,000.
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "CASH_ONLY",
        newCash: 50000,
        driftThreshold: 5,
      });

      const mf = result.items.find((i) => i.assetType === "MUTUAL_FUND")!;
      expect(mf.action).toBe("BUY");
      expect(mf.suggestedAmount).toBe(45000);
      expect(result.residualCash).toBe(5000); // ₹5,000 unspent
    });
  });

  describe("3. ALLOW_SELLS Mode Rebalancing (Master Architecture §13.9)", () => {
    // Current: 80% Stock (₹80,000), 20% Gold (₹20,000). Total = ₹100,000.
    // Target: 50% Stock, 50% Gold.
    const holdings = [
      { type: "STOCK" as const, currentValue: 80000 },
      { type: "GOLD" as const, currentValue: 20000 },
    ];
    const targets = [
      { assetType: "STOCK" as const, targetPercent: 50 },
      { assetType: "GOLD" as const, targetPercent: 50 },
    ];

    it("emits both SELL for overweight and BUY for underweight beyond drift band", () => {
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "ALLOW_SELLS",
        driftThreshold: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("ALLOW_SELLS");

      const stock = result.items.find((i) => i.assetType === "STOCK")!;
      const gold = result.items.find((i) => i.assetType === "GOLD")!;

      // Stock is 80% vs 50% (drift +30 pp) -> SELL ₹30,000
      expect(stock.action).toBe("SELL");
      expect(stock.suggestedAmount).toBe(30000);
      expect(stock.driftPct).toBe(30);

      // Gold is 20% vs 50% (drift -30 pp) -> BUY ₹30,000
      expect(gold.action).toBe("BUY");
      expect(gold.suggestedAmount).toBe(30000);
      expect(gold.driftPct).toBe(-30);
    });

    it("holds classes within the drift threshold band", () => {
      // 52% Stock, 48% Gold. Drift is +2% and -2%. Drift threshold is 5%.
      const balancedHoldings = [
        { type: "STOCK" as const, currentValue: 52000 },
        { type: "GOLD" as const, currentValue: 48000 },
      ];

      const result = calculateRebalancePlan(balancedHoldings, targets, {
        mode: "ALLOW_SELLS",
        driftThreshold: 5,
      });

      for (const item of result.items) {
        expect(item.action).toBe("HOLD");
        expect(item.suggestedAmount).toBe(0);
      }
    });

    it("suppresses trades smaller than minTradeSize", () => {
      const result = calculateRebalancePlan(holdings, targets, {
        mode: "ALLOW_SELLS",
        driftThreshold: 5,
        minTradeSize: 50000, // Trade size threshold higher than ₹30,000 delta
      });

      const stock = result.items.find((i) => i.assetType === "STOCK")!;
      const gold = result.items.find((i) => i.assetType === "GOLD")!;

      expect(stock.action).toBe("HOLD");
      expect(stock.suggestedAmount).toBe(0);
      expect(gold.action).toBe("HOLD");
      expect(gold.suggestedAmount).toBe(0);
    });
  });

  describe("4. Valuation Status, Exclusions, and Confidence Flags (§13.9)", () => {
    it("excludes FX_UNAVAILABLE holdings from eligible value and issues warning", () => {
      const holdings = [
        { id: "h1", type: "STOCK" as const, name: "TCS", currentValue: 50000, valuationStatus: "OK" },
        { id: "h2", type: "STOCK" as const, name: "Apple US", currentValue: 50000, valuationStatus: "FX_UNAVAILABLE" },
        { id: "h3", type: "MUTUAL_FUND" as const, name: "Nifty Index", currentValue: 50000, valuationStatus: "OK" },
      ];
      const targets = [
        { assetType: "STOCK" as const, targetPercent: 50 },
        { assetType: "MUTUAL_FUND" as const, targetPercent: 50 },
      ];

      const result = calculateRebalancePlan(holdings, targets);

      // Only ₹100,000 is eligible (h1 + h3); h2 is excluded
      expect(result.totalEligibleValue).toBe(100000);
      expect(result.warnings.some((w) => w.includes("Apple US") && w.includes("foreign exchange rate unavailable"))).toBe(true);
      expect(result.confidence).toBe("MEDIUM");
    });

    it("reduces confidence to MEDIUM or LOW when assets are valued at cost basis or stale price", () => {
      const holdings = [
        { id: "h1", type: "REAL_ESTATE" as const, currentValue: 80000, detailedValuationStatus: "COST_BASIS" },
        { id: "h2", type: "MUTUAL_FUND" as const, currentValue: 20000, detailedValuationStatus: "LIVE" },
      ];
      const targets = [
        { assetType: "REAL_ESTATE" as const, targetPercent: 50 },
        { assetType: "MUTUAL_FUND" as const, targetPercent: 50 },
      ];

      const result = calculateRebalancePlan(holdings, targets);

      // 80% is cost basis -> confidence should be LOW
      expect(result.confidence).toBe("LOW");
      expect(result.warnings.some((w) => w.includes("cost basis or stale price"))).toBe(true);
    });

    it("honors excludedAssetIds and excludedAssetTypes", () => {
      const holdings = [
        { id: "h1", type: "STOCK" as const, currentValue: 60000 },
        { id: "h2", type: "STOCK" as const, currentValue: 20000 },
        { id: "h3", type: "MUTUAL_FUND" as const, currentValue: 20000 },
      ];
      const targets = [
        { assetType: "STOCK" as const, targetPercent: 50 },
        { assetType: "MUTUAL_FUND" as const, targetPercent: 50 },
      ];

      const result = calculateRebalancePlan(holdings, targets, {
        excludedAssetIds: ["h2"], // Exclude ₹20,000 of stock
      });

      // Total eligible: 60,000 + 20,000 = 80,000
      expect(result.totalEligibleValue).toBe(80000);
      const stock = result.items.find((i) => i.assetType === "STOCK")!;
      expect(stock.currentValue).toBe(60000);
    });

    it("always includes mandated disclaimer assumptions (taxes, fees, lot constraints not modeled)", () => {
      const targets = [
        { assetType: "STOCK" as const, targetPercent: 100 },
      ];
      const result = calculateRebalancePlan([], targets);
      expect(result.assumptions.length).toBeGreaterThanOrEqual(3);
      expect(result.assumptions.some((a) => a.includes("Taxes (STCG/LTCG)"))).toBe(true);
      expect(result.assumptions.some((a) => a.includes("Lot constraints"))).toBe(true);
    });
  });

  describe("5. Service Integration (REBAL-002)", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("PortfolioService.getComprehensiveRebalancePlan computes plan end-to-end", async () => {
      vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 60000, valuationStatus: "OK" } as any,
        { id: "a2", type: "MUTUAL_FUND", currentValue: 40000, valuationStatus: "OK" } as any,
      ]);
      vi.spyOn(PortfolioService, "getAllocationTargets").mockResolvedValue([
        { assetType: "STOCK", targetPercent: 50 },
        { assetType: "MUTUAL_FUND", targetPercent: 50 },
      ]);

      const plan = await PortfolioService.getComprehensiveRebalancePlan("u1", {
        mode: "ALLOW_SELLS",
        driftThreshold: 5,
      });

      expect(plan.ok).toBe(true);
      expect(plan.totalEligibleValue).toBe(100000);
      expect(plan.items).toHaveLength(2);
      expect(plan.items.find((i) => i.assetType === "STOCK")?.action).toBe("SELL");
      expect(plan.items.find((i) => i.assetType === "MUTUAL_FUND")?.action).toBe("BUY");
    });
  });

  describe("6. API Route Handlers (REBAL-002)", () => {
    it("POST /api/portfolio/rebalance returns 422 if targets are invalid", async () => {
      vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([]);
      vi.spyOn(PortfolioService, "getAllocationTargets").mockResolvedValue([
        { assetType: "STOCK", targetPercent: 30 }, // Missing 70%
      ]);

      const req = new NextRequest("http://localhost:3000/api/portfolio/rebalance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "CASH_ONLY" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe("TARGETS_INVALID");
    });

    it("POST /api/portfolio/rebalance returns 200 with rebalance plan on valid request", async () => {
      vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 100000, valuationStatus: "OK" } as any,
      ]);
      vi.spyOn(PortfolioService, "getAllocationTargets").mockResolvedValue([
        { assetType: "STOCK", targetPercent: 100 },
      ]);

      const req = new NextRequest("http://localhost:3000/api/portfolio/rebalance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "CASH_ONLY", newCash: 10000 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.data.newCash).toBe(10000);
      expect(data.data.items).toHaveLength(1);
    });

    it("GET /api/portfolio/rebalance parses query params and returns plan", async () => {
      vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 100000, valuationStatus: "OK" } as any,
      ]);
      vi.spyOn(PortfolioService, "getAllocationTargets").mockResolvedValue([
        { assetType: "STOCK", targetPercent: 100 },
      ]);

      const req = new NextRequest("http://localhost:3000/api/portfolio/rebalance?mode=ALLOW_SELLS&driftThreshold=3", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.data.mode).toBe("ALLOW_SELLS");
      expect(data.data.driftThreshold).toBe(3);
    });
  });
});
