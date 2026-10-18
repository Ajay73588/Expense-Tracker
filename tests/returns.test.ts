import { describe, it, expect } from "vitest";
import { calculateCAGR, calculateXIRR } from "../src/lib/finance/returns";

describe("Portfolio Returns Engine — CAGR & XIRR (Master Architecture §10.6)", () => {
  describe("1. Master Architecture §10.6 Reference Vector", () => {
    // Reference from specification:
    // -100,000 on 2025-01-01, +115,000 on 2026-01-01 -> 15.00% (365-day year).
    it("converges to exactly 15.00% for 1-year 15% gain reference vector", () => {
      const result = calculateXIRR([
        { amount: -100000, date: "2025-01-01" },
        { amount: 115000, date: "2026-01-01" },
      ]);

      expect(result.converged).toBe(true);
      expect(result.ratePct).toBeCloseTo(15.0, 1);
      expect(result.absoluteReturnPct).toBe(15.0);
      expect(result.method).toBe("NEWTON_RAPHSON");
    });
  });

  describe("2. Multi-period Cash Flows (SIP Simulations)", () => {
    it("computes accurate XIRR for monthly investments and current valuation", () => {
      // 6 monthly investments of ₹10,000, final value ₹65,000 at month 6
      const flows = [
        { amount: -10000, date: "2025-01-01" },
        { amount: -10000, date: "2025-02-01" },
        { amount: -10000, date: "2025-03-01" },
        { amount: -10000, date: "2025-04-01" },
        { amount: -10000, date: "2025-05-01" },
        { amount: -10000, date: "2025-06-01" },
        { amount: 65000, date: "2025-07-01" }, // ₹5,000 gain on ₹60,000 invested
      ];

      const result = calculateXIRR(flows);
      expect(result.converged).toBe(true);
      expect(result.ratePct).toBeGreaterThan(15.0); // Annualized is higher because of staggered flows
      expect(result.absoluteReturnPct).toBeCloseTo(8.33, 1);
    });

    it("handles loss scenarios cleanly with negative XIRR", () => {
      const result = calculateXIRR([
        { amount: -100000, date: "2025-01-01" },
        { amount: 80000, date: "2026-01-01" }, // 20% loss
      ]);

      expect(result.converged).toBe(true);
      expect(result.ratePct).toBeCloseTo(-20.0, 1);
      expect(result.absoluteReturnPct).toBe(-20.0);
    });
  });

  describe("3. CAGR Calculations", () => {
    it("computes CAGR accurately across multi-year horizon", () => {
      // ₹100,000 grows to ₹200,000 in 5 years (rule of 72 ~ 14.87%)
      const res = calculateCAGR(100000, 200000, 5);
      expect(res).not.toBeNull();
      expect(res?.ratePct).toBeCloseTo(14.87, 1);
    });

    it("returns null for non-positive or zero-year inputs safely", () => {
      expect(calculateCAGR(0, 100, 2)).toBeNull();
      expect(calculateCAGR(100, 0, 2)).toBeNull();
      expect(calculateCAGR(100, 200, 0)).toBeNull();
      expect(calculateCAGR(-50, 100, 2)).toBeNull();
    });
  });

  describe("4. Edge Cases & Safe Failure Handling", () => {
    it("returns safe non-throwing error when all flows are negative (no redemptions/valuation)", () => {
      const result = calculateXIRR([
        { amount: -10000, date: "2025-01-01" },
        { amount: -20000, date: "2025-02-01" },
      ]);

      expect(result.converged).toBe(false);
      expect(result.rate).toBeNull();
      expect(result.error).toBeDefined();
    });

    it("returns safe non-throwing error when all flows are positive", () => {
      const result = calculateXIRR([
        { amount: 10000, date: "2025-01-01" },
        { amount: 20000, date: "2025-02-01" },
      ]);

      expect(result.converged).toBe(false);
      expect(result.rate).toBeNull();
    });

    it("handles empty or single-flow arrays without throwing", () => {
      expect(calculateXIRR([]).converged).toBe(false);
      expect(calculateXIRR([{ amount: -1000, date: "2025-01-01" }]).converged).toBe(false);
    });
  });
});
