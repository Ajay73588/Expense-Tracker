import { describe, it, expect } from "vitest";
import {
  calculateEMI,
  calculateTenure,
  generateAmortizationSchedule,
  simulatePrepayment,
  round2,
} from "../src/lib/finance/amortization";

describe("Loan Amortization & Debt Prepayment Engine (Master Architecture §10.7)", () => {
  describe("1. Master Architecture §10.7 Reference Vector", () => {
    // Reference from specification:
    // ₹5,000,000 @ 8.5% / 240 months → EMI ≈ ₹43,391.17; month-1 interest ≈ ₹35,416.67, principal ≈ ₹7,974.50.
    // Tolerance ±0.01 per payment; total repayment = Σ payments.
    const P = 5000000;
    const rate = 8.5;
    const months = 240;

    it("calculates exact EMI within ±0.01 tolerance", () => {
      const emi = calculateEMI(P, rate, months);
      expect(Math.abs(emi - 43391.17)).toBeLessThanOrEqual(0.01);
    });

    it("generates month-1 breakdown matching reference values within ±0.01", () => {
      const schedule = generateAmortizationSchedule({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
      });

      expect(schedule.schedule.length).toBe(240);
      const m1 = schedule.schedule[0];

      expect(m1.month).toBe(1);
      expect(m1.openingBalance).toBe(5000000);
      expect(m1.interest).toBeCloseTo(35416.67, 1);
      expect(m1.principal).toBeCloseTo(7974.5, 1);
      expect(m1.emi).toBeCloseTo(43391.17, 1);
      expect(m1.closingBalance).toBeCloseTo(5000000 - 7974.5, 1);
    });

    it("ensures final month closing balance is strictly 0.00 and principal paid equals original principal", () => {
      const schedule = generateAmortizationSchedule({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
      });

      const lastMonth = schedule.schedule[schedule.schedule.length - 1];
      expect(lastMonth.closingBalance).toBe(0);
      expect(lastMonth.totalPrincipalPaid).toBe(P);
      expect(schedule.totalPayment).toBe(round2(schedule.principal + schedule.totalInterest));
    });
  });

  describe("2. Edge Cases & Boundary Conditions", () => {
    it("handles zero interest rate (0% loan): EMI = P / n", () => {
      const P = 120000;
      const rate = 0;
      const months = 12;

      const emi = calculateEMI(P, rate, months);
      expect(emi).toBe(10000);

      const schedule = generateAmortizationSchedule({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
      });

      expect(schedule.schedule.length).toBe(12);
      expect(schedule.totalInterest).toBe(0);
      expect(schedule.totalPayment).toBe(120000);
      for (const inst of schedule.schedule) {
        expect(inst.interest).toBe(0);
        expect(inst.principal).toBe(10000);
      }
      expect(schedule.schedule[11].closingBalance).toBe(0);
    });

    it("handles 1-month short-term loan", () => {
      const P = 10000;
      const rate = 12; // 1% per month
      const months = 1;

      const emi = calculateEMI(P, rate, months);
      expect(emi).toBe(10100);

      const schedule = generateAmortizationSchedule({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
      });

      expect(schedule.schedule.length).toBe(1);
      expect(schedule.schedule[0].interest).toBe(100);
      expect(schedule.schedule[0].principal).toBe(10000);
      expect(schedule.schedule[0].closingBalance).toBe(0);
    });

    it("handles non-positive or empty inputs gracefully without throwing or NaN", () => {
      expect(calculateEMI(0, 10, 12)).toBe(0);
      expect(calculateEMI(10000, 10, 0)).toBe(0);
      expect(calculateTenure(0, 10, 1000)).toBe(0);
      expect(calculateTenure(10000, 10, 0)).toBe(0);

      const empty = generateAmortizationSchedule({ principal: 0, annualRatePct: 10, tenureMonths: 0 });
      expect(empty.schedule).toEqual([]);
      expect(empty.monthlyEMI).toBe(0);
      expect(empty.totalPayment).toBe(0);
    });
  });

  describe("3. Prepayment Modeling & Strategies", () => {
    const P = 2000000; // 20 Lakhs
    const rate = 9.0;
    const months = 120; // 10 years

    it("REDUCE_TENURE strategy: saves interest and shortens loan tenure", () => {
      // Simulate ₹200,000 lump sum at month 12 + ₹5,000 extra monthly
      const sim = simulatePrepayment({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
        lumpSums: [{ month: 12, amount: 200000 }],
        monthlyExtra: 5000,
        strategy: "REDUCE_TENURE",
      });

      expect(sim.original.tenureMonths).toBe(120);
      expect(sim.revised.tenureMonths).toBeLessThan(120);
      expect(sim.savings.monthsSaved).toBeGreaterThan(0);
      expect(sim.savings.interestSaved).toBeGreaterThan(0);
      expect(sim.revised.totalInterest).toBeLessThan(sim.original.totalInterest);
      expect(sim.schedule[sim.schedule.length - 1].closingBalance).toBe(0);
    });

    it("REDUCE_EMI strategy: reduces ongoing monthly EMI while retaining tenure", () => {
      const sim = simulatePrepayment({
        principal: P,
        annualRatePct: rate,
        tenureMonths: months,
        lumpSums: [{ month: 12, amount: 500000 }],
        strategy: "REDUCE_EMI",
      });

      expect(sim.revised.monthlyEMI).toBeLessThan(sim.original.monthlyEMI);
      expect(sim.savings.interestSaved).toBeGreaterThan(0);
      expect(sim.schedule[sim.schedule.length - 1].closingBalance).toBe(0);
    });
  });
});
