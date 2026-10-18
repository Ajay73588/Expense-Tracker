import { describe, it, expect } from "vitest";
import {
  calculateSIP,
  calculateStepUpSIP,
  calculateLumpsum,
  calculateFIRE,
  calculateEMI,
  calculateFD,
  calculateCAGR,
  calculateXIRRCalculator,
} from "../src/lib/finance/calculators";

describe("Financial Planning Calculators Suite (F-15 / CALC-001..003 & Release Complete)", () => {
  describe("1. SIP Calculator", () => {
    it("computes standard 10-year 12% SIP matching reference values", () => {
      // ₹10,000/month, 12% per annum, 10 years
      const res = calculateSIP({
        monthlyInvestment: 10000,
        annualReturnPct: 12,
        durationYears: 10,
      });

      expect(res.totalInvested).toBe(1200000); // 10,000 * 120
      // Expected formula value ~2,323,391 (Annuity due)
      expect(res.finalCorpus).toBeCloseTo(2323390.76, 0);
      expect(res.estimatedReturns).toBeCloseTo(1123390.76, 0);
      expect(res.breakdown).toHaveLength(10);
      expect(res.breakdown[0].invested).toBe(120000);
      expect(res.breakdown[9].invested).toBe(1200000);
    });

    it("handles zero return rate (0% return): corpus equals principal invested", () => {
      const res = calculateSIP({
        monthlyInvestment: 5000,
        annualReturnPct: 0,
        durationYears: 5,
      });

      expect(res.totalInvested).toBe(300000);
      expect(res.estimatedReturns).toBe(0);
      expect(res.finalCorpus).toBe(300000);
      expect(res.breakdown).toHaveLength(5);
    });

    it("handles edge cases (zero principal, zero years, negative inputs) safely", () => {
      expect(calculateSIP({ monthlyInvestment: 0, annualReturnPct: 12, durationYears: 10 }).finalCorpus).toBe(0);
      expect(calculateSIP({ monthlyInvestment: 5000, annualReturnPct: 12, durationYears: 0 }).finalCorpus).toBe(0);
      expect(calculateSIP({ monthlyInvestment: -1000, annualReturnPct: 10, durationYears: 5 }).finalCorpus).toBe(0);
    });

    it("caps excessive duration to 60 years safely", () => {
      const res = calculateSIP({ monthlyInvestment: 1000, annualReturnPct: 8, durationYears: 100 });
      expect(res.breakdown).toHaveLength(60);
    });
  });

  describe("2. Step-Up SIP Calculator", () => {
    it("applies annual increase at the start of each year (Months 13, 25, etc.)", () => {
      // ₹10,000 initial SIP, 10% annual step-up, 12% return, 5 years
      const res = calculateStepUpSIP({
        initialMonthlySIP: 10000,
        annualStepUpPct: 10,
        annualReturnPct: 12,
        durationYears: 5,
      });

      expect(res.breakdown).toHaveLength(5);
      // Year 1: ₹10,000 * 12 = 120,000
      expect(res.breakdown[0].monthlyContribution).toBe(10000);
      expect(res.breakdown[0].annualContribution).toBe(120000);
      expect(res.breakdown[0].invested).toBe(120000);

      // Year 2: ₹11,000 * 12 = 132,000 (cumulative 252,000)
      expect(res.breakdown[1].monthlyContribution).toBe(11000);
      expect(res.breakdown[1].annualContribution).toBe(132000);
      expect(res.breakdown[1].invested).toBe(252000);

      // Year 3: ₹12,100 * 12 = 145,200 (cumulative 397,200)
      expect(res.breakdown[2].monthlyContribution).toBe(12100);

      // Total invested over 5 years = 120,000 + 132,000 + 145,200 + 159,720 + 175,692 = 732,612
      expect(res.totalInvested).toBe(732612);
      expect(res.finalCorpus).toBeGreaterThan(res.totalInvested);
    });

    it("matches standard SIP when step-up percentage is 0%", () => {
      const stepUp = calculateStepUpSIP({
        initialMonthlySIP: 10000,
        annualStepUpPct: 0,
        annualReturnPct: 12,
        durationYears: 5,
      });

      const standard = calculateSIP({
        monthlyInvestment: 10000,
        annualReturnPct: 12,
        durationYears: 5,
      });

      expect(stepUp.totalInvested).toBe(standard.totalInvested);
      expect(stepUp.finalCorpus).toBeCloseTo(standard.finalCorpus, 0);
    });

    it("handles zero values and edge cases gracefully", () => {
      expect(calculateStepUpSIP({ initialMonthlySIP: 0, annualStepUpPct: 10, annualReturnPct: 10, durationYears: 5 }).finalCorpus).toBe(0);
      expect(calculateStepUpSIP({ initialMonthlySIP: 5000, annualStepUpPct: 10, annualReturnPct: 10, durationYears: 0 }).finalCorpus).toBe(0);
    });
  });

  describe("3. Lumpsum Calculator", () => {
    it("computes compound growth for multi-year lumpsum investment", () => {
      // ₹100,000 at 10% for 5 years: 100,000 * (1.10)^5 = 161,051
      const res = calculateLumpsum({
        initialInvestment: 100000,
        annualReturnPct: 10,
        durationYears: 5,
      });

      expect(res.investedPrincipal).toBe(100000);
      expect(res.finalValue).toBeCloseTo(161051, 0);
      expect(res.estimatedGains).toBeCloseTo(61051, 0);
      expect(res.breakdown).toHaveLength(5);
    });

    it("handles zero return rate (0% return)", () => {
      const res = calculateLumpsum({
        initialInvestment: 500000,
        annualReturnPct: 0,
        durationYears: 10,
      });

      expect(res.investedPrincipal).toBe(500000);
      expect(res.finalValue).toBe(500000);
      expect(res.estimatedGains).toBe(0);
    });

    it("handles zero principal or zero duration gracefully", () => {
      expect(calculateLumpsum({ initialInvestment: 0, annualReturnPct: 12, durationYears: 10 }).finalValue).toBe(0);
      expect(calculateLumpsum({ initialInvestment: 100000, annualReturnPct: 12, durationYears: 0 }).breakdown).toHaveLength(0);
    });
  });

  describe("4. FIRE Calculator", () => {
    it("calculates inflation-adjusted retirement corpus and required SIP", () => {
      // Monthly expenses: ₹50,000 (Annual: ₹600,000)
      // 15 years to retirement, 6% inflation, 4% SWR (25x multiplier)
      // Existing savings: ₹1,000,000, 12% expected pre-retirement return
      const res = calculateFIRE({
        currentMonthlyExpenses: 50000,
        expectedInflationPct: 6,
        safeWithdrawalRatePct: 4,
        yearsToRetirement: 15,
        currentSavings: 1000000,
        expectedPreRetirementReturnPct: 12,
      });

      expect(res.currentAnnualExpenses).toBe(600000);
      // Future annual expenses: 600,000 * (1.06)^15 ≈ 1,437,935
      expect(res.futureAnnualExpenses).toBeCloseTo(1437934.91, 0);
      expect(res.corpusMultiplier).toBe(25); // 100 / 4
      // Target corpus = 1,437,935 * 25 ≈ 35,948,373
      expect(res.targetCorpus).toBeCloseTo(35948372.75, 0);
      // Existing savings in 15 yrs: 1,000,000 * (1.12)^15 ≈ 5,473,566
      expect(res.projectedExistingSavings).toBeCloseTo(5473565.76, 0);
      expect(res.savingsGap).toBeGreaterThan(0);
      expect(res.monthlyInvestmentRequired).toBeGreaterThan(0);
      expect(res.isAlreadyIndependent).toBe(false);
      expect(res.yearsOfExpensesCovered).toBeCloseTo(1.67, 1);
    });

    it("correctly identifies already independent user (savings exceed target corpus)", () => {
      const res = calculateFIRE({
        currentMonthlyExpenses: 30000,
        expectedInflationPct: 5,
        safeWithdrawalRatePct: 4,
        yearsToRetirement: 5,
        currentSavings: 50000000, // 5 Crore already saved
        expectedPreRetirementReturnPct: 10,
      });

      expect(res.isAlreadyIndependent).toBe(true);
      expect(res.savingsGap).toBe(0);
      expect(res.monthlyInvestmentRequired).toBe(0);
    });

    it("computes Lean FIRE (75%) and Fat FIRE (125%) targets", () => {
      const res = calculateFIRE({
        currentMonthlyExpenses: 40000,
        yearsToRetirement: 10,
      });

      expect(res.leanFIRECorpus).toBeCloseTo(res.targetCorpus * 0.75, 0);
      expect(res.fatFIRECorpus).toBeCloseTo(res.targetCorpus * 1.25, 0);
    });

    it("handles zero expenses gracefully", () => {
      const res = calculateFIRE({
        currentMonthlyExpenses: 0,
        yearsToRetirement: 20,
      });

      expect(res.targetCorpus).toBe(0);
      expect(res.monthlyInvestmentRequired).toBe(0);
      expect(res.savingsGap).toBe(0);
    });
  });

  describe("5. Loan EMI Calculator", () => {
    it("computes reference home loan EMI accurately (₹50 Lakhs @ 8.5% for 20 years)", () => {
      const res = calculateEMI({
        principalAmount: 5000000,
        annualInterestRatePct: 8.5,
        tenureYears: 20,
      });

      // Reference EMI = ₹43,391.17
      expect(res.monthlyEMI).toBeCloseTo(43391.17, 1);
      expect(res.principalAmount).toBe(5000000);
      // Total payment over 240 months: 43391.16 * 240 = 10,413,878.40
      expect(res.totalPayment).toBeCloseTo(10413878.4, 0);
      // Total interest: 10,413,878.40 - 5,000,000 = 5,413,878.40
      expect(res.totalInterestPayable).toBeCloseTo(5413878.4, 0);
      expect(res.breakdown).toHaveLength(20);
      expect(res.breakdown[0].openingBalance).toBe(5000000);
      expect(res.breakdown[19].closingBalance).toBeLessThanOrEqual(5.0);
    });

    it("handles zero interest rate (0%): EMI is pure principal divided by months", () => {
      const res = calculateEMI({
        principalAmount: 1200000,
        annualInterestRatePct: 0,
        tenureYears: 10,
      });

      expect(res.monthlyEMI).toBe(10000);
      expect(res.totalInterestPayable).toBe(0);
      expect(res.totalPayment).toBe(1200000);
    });

    it("handles zero principal gracefully", () => {
      const res = calculateEMI({
        principalAmount: 0,
        annualInterestRatePct: 9.0,
        tenureYears: 15,
      });

      expect(res.monthlyEMI).toBe(0);
      expect(res.totalPayment).toBe(0);
    });
  });

  describe("6. Fixed Deposit (FD) Calculator", () => {
    it("computes quarterly compounded FD matching Indian banking convention", () => {
      // ₹100,000 at 7.0% for 5 years, quarterly compounding:
      // A = 100,000 * (1 + 0.07 / 4)^20 ≈ 141,477.82
      const res = calculateFD({
        depositAmount: 100000,
        annualInterestRatePct: 7.0,
        durationYears: 5,
        compoundingFrequency: "QUARTERLY",
      });

      expect(res.investedDeposit).toBe(100000);
      expect(res.maturityValue).toBeCloseTo(141477.82, 0);
      expect(res.totalInterestEarned).toBeCloseTo(41477.82, 0);
      expect(res.breakdown).toHaveLength(5);
    });

    it("computes simple interest FD when selected", () => {
      // ₹100,000 at 7% for 5 years simple interest:
      // A = 100,000 * (1 + 0.35) = 135,000
      const res = calculateFD({
        depositAmount: 100000,
        annualInterestRatePct: 7.0,
        durationYears: 5,
        compoundingFrequency: "SIMPLE",
      });

      expect(res.maturityValue).toBe(135000);
      expect(res.totalInterestEarned).toBe(35000);
    });

    it("handles zero deposit and zero duration safely", () => {
      expect(calculateFD({ depositAmount: 0, annualInterestRatePct: 6, durationYears: 5 }).maturityValue).toBe(0);
      expect(calculateFD({ depositAmount: 50000, annualInterestRatePct: 6, durationYears: 0 }).totalInterestEarned).toBe(0);
    });
  });

  describe("7. Compound Annual Growth Rate (CAGR) Calculator", () => {
    it("computes correct CAGR for investment doubling in 5 years", () => {
      // ₹100,000 to ₹200,000 in 5 years -> (2)^(0.2) - 1 ≈ 14.87%
      const res = calculateCAGR({
        initialInvestment: 100000,
        finalInvestment: 200000,
        durationYears: 5,
      });

      expect(res.cagrPct).toBeCloseTo(14.87, 2);
      expect(res.totalGain).toBe(100000);
      expect(res.absoluteReturnPct).toBe(100);
      expect(res.breakdown).toHaveLength(5);
      expect(res.breakdown[4].totalValue).toBeCloseTo(200000, 0);
    });

    it("handles zero initial investment safely", () => {
      const res = calculateCAGR({
        initialInvestment: 0,
        finalInvestment: 50000,
        durationYears: 3,
      });

      expect(res.cagrPct).toBe(0);
      expect(res.totalGain).toBe(50000);
    });
  });

  describe("8. Extended Internal Rate of Return (XIRR) Calculator", () => {
    it("computes exact XIRR for reference single-year cash flow", () => {
      // Outflow -100,000 on 2025-01-01, inflow +115,000 on 2026-01-01 -> 15.00%
      const res = calculateXIRRCalculator({
        cashflows: [
          { date: "2025-01-01", amount: -100000 },
          { date: "2026-01-01", amount: 115000 },
        ],
      });

      expect(res.isValid).toBe(true);
      expect(res.xirrPct).toBeCloseTo(15.0, 1);
      expect(res.totalInvested).toBe(100000);
      expect(res.totalWithdrawnOrCurrent).toBe(115000);
      expect(res.netProfit).toBe(15000);
      expect(res.absoluteReturnPct).toBe(15);
    });

    it("computes XIRR for multi-installment SIP cash flows", () => {
      const res = calculateXIRRCalculator({
        cashflows: [
          { date: "2025-01-01", amount: -10000 },
          { date: "2025-04-01", amount: -10000 },
          { date: "2025-07-01", amount: -10000 },
          { date: "2025-10-01", amount: -10000 },
          { date: "2026-01-01", amount: 45000 },
        ],
      });

      expect(res.isValid).toBe(true);
      expect(res.xirrPct).toBeGreaterThan(10);
      expect(res.totalInvested).toBe(40000);
      expect(res.totalWithdrawnOrCurrent).toBe(45000);
    });

    it("safely rejects invalid cash flows lacking both positive and negative entries", () => {
      const res = calculateXIRRCalculator({
        cashflows: [
          { date: "2025-01-01", amount: -10000 },
          { date: "2025-06-01", amount: -20000 },
        ],
      });

      expect(res.isValid).toBe(false);
      expect(res.xirrPct).toBeNull();
      expect(res.errorMessage).toBeDefined();
    });
  });
});
