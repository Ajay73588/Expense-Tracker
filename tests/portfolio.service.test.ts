import { describe, expect, it, vi, beforeEach } from "vitest";
import { PortfolioService } from "../src/services/portfolio.service";
import { AssetService } from "../src/services/asset.service";
import type { AssetType } from "../src/types";

// Mock the AssetService so we don't need a real DB or FxRateService for these tests
vi.mock("../src/services/asset.service", () => ({
  AssetService: {
    getPortfolioWithPL: vi.fn(),
  }
}));

describe("PortfolioService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getAllocation()", () => {
    it("returns an empty array for an empty portfolio", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([]);
      
      const alloc = await PortfolioService.getAllocation("u1");
      expect(alloc).toEqual([]);
    });

    it("calculates 100% allocation for a single asset type", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 1000, invested: 800 } as any
      ]);
      
      const alloc = await PortfolioService.getAllocation("u1");
      expect(alloc).toHaveLength(1);
      expect(alloc[0]).toMatchObject({
        assetType: "STOCK",
        value: 1000,
        percent: 100,
        count: 1
      });
    });

    it("calculates proper percentages for a multi-type portfolio", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 6000, invested: 5000 } as any,
        { id: "a2", type: "MUTUAL_FUND", currentValue: 4000, invested: 3000 } as any,
      ]);
      
      const alloc = await PortfolioService.getAllocation("u1");
      expect(alloc).toHaveLength(2);
      
      const stock = alloc.find(a => a.assetType === "STOCK")!;
      const mf = alloc.find(a => a.assetType === "MUTUAL_FUND")!;
      
      expect(stock.value).toBe(6000);
      expect(stock.percent).toBe(60);
      expect(stock.count).toBe(1);
      
      expect(mf.value).toBe(4000);
      expect(mf.percent).toBe(40);
      expect(mf.count).toBe(1);
    });

    it("handles FX_UNAVAILABLE assets (currentValue = 0) correctly by excluding from value but keeping in count", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 1000, invested: 800, valuationStatus: "OK" } as any,
        { id: "a2", type: "STOCK", currentValue: 0, invested: 0, valuationStatus: "FX_UNAVAILABLE", currentValueNative: 500 } as any,
      ]);
      
      const alloc = await PortfolioService.getAllocation("u1");
      expect(alloc).toHaveLength(1);
      expect(alloc[0]).toMatchObject({
        assetType: "STOCK",
        value: 1000,       // Only the OK asset's value is counted
        percent: 100,      // 100% of the valid INR value
        count: 2           // Both assets are counted
      });
    });
  });

  describe("getRiskScore()", () => {
    it("returns 0 for an empty portfolio", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([]);
      const score = await PortfolioService.getRiskScore("u1");
      expect(score).toBe(0);
    });

    it("calculates a weighted risk score (STOCK=7, MF=5, CRYPTO=10, REAL_ESTATE=4, CASH=0)", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([
        { id: "a1", type: "STOCK", currentValue: 5000, invested: 5000 } as any, // 50% * 7 = 3.5
        { id: "a2", type: "CASH", currentValue: 5000, invested: 5000 } as any,  // 50% * 0 = 0
      ]);
      
      const score = await PortfolioService.getRiskScore("u1");
      expect(score).toBe(3.5);
    });
  });

  describe("getPortfolioSummary()", () => {
    it("calculates total invested, current value, P&L, and finds top gainers/losers", async () => {
      vi.mocked(AssetService.getPortfolioWithPL).mockResolvedValue([
        { id: "a1", type: "STOCK", invested: 1000, currentValue: 2000, pnl: 1000, pnlPercent: 100 } as any, // Gainer 1
        { id: "a2", type: "STOCK", invested: 1000, currentValue: 1500, pnl: 500, pnlPercent: 50 } as any,   // Gainer 2
        { id: "a3", type: "STOCK", invested: 1000, currentValue: 500, pnl: -500, pnlPercent: -50 } as any,  // Loser 1
        { id: "a4", type: "STOCK", invested: 1000, currentValue: 200, pnl: -800, pnlPercent: -80 } as any,  // Loser 2
      ]);
      
      const summary = await PortfolioService.getPortfolioSummary("u1");
      
      expect(summary.invested).toBe(4000);
      expect(summary.currentValue).toBe(4200);
      expect(summary.pnl).toBe(200);
      expect(summary.pnlPercent).toBe(5);
      expect(summary.assetCount).toBe(4);
      
      expect(summary.topGainers).toHaveLength(3);
      expect(summary.topGainers[0].id).toBe("a1"); // 100%
      expect(summary.topGainers[1].id).toBe("a2"); // 50%
      
      expect(summary.topLosers).toHaveLength(3);
      expect(summary.topLosers[0].id).toBe("a4"); // -80%
      expect(summary.topLosers[1].id).toBe("a3"); // -50%

      expect(summary.returns).toBeDefined();
      expect(summary.returns.absoluteReturnPct).toBe(5);
    });
  });
});
