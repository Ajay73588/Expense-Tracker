import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { LiabilityService } from "../src/services/liability.service";
import { NetWorthService } from "../src/services/networth.service";
import { AssetService } from "../src/services/asset.service";
import { NotFoundError, ValidationError } from "../src/lib/errors";

let USER_ALICE = "";
let USER_BOB = "";

describe("Liability & Debt Management Service (F-04, F-14, DEBT-001..007)", () => {
  beforeEach(async () => {
    const timestamp = Date.now() + "_" + Math.random().toString(36).substring(7);
    const alice = await prisma.user.create({
      data: { clerkId: `clerk_alice_${timestamp}`, email: `alice_${timestamp}@example.com`, name: "Alice" },
    });
    const bob = await prisma.user.create({
      data: { clerkId: `clerk_bob_${timestamp}`, email: `bob_${timestamp}@example.com`, name: "Bob" },
    });
    USER_ALICE = alice.id;
    USER_BOB = bob.id;
  });

  describe("1. Liability CRUD & Deterministic Calculation", () => {
    it("creates a liability with auto-calculated EMI when tenure is provided", async () => {
      // 50 Lakhs @ 8.5% for 240 months
      const liability = await LiabilityService.create(USER_ALICE, {
        name: "HDFC Home Loan",
        type: "HOME_LOAN",
        principalAmount: 5000000,
        outstandingAmount: 5000000,
        interestRate: 8.5,
        tenureMonths: 240,
      });

      expect(liability.id).toBeDefined();
      expect(liability.name).toBe("HDFC Home Loan");
      expect(liability.type).toBe("HOME_LOAN");
      expect(liability.principalAmount).toBe(5000000);
      expect(liability.outstandingAmount).toBe(5000000);
      expect(liability.interestRate).toBe(8.5);
      // Auto-calculated EMI matching reference vector
      expect(liability.monthlyEMI).toBeCloseTo(43391.17, 1);
      expect(liability.progressPct).toBe(0);
      expect(liability.estimatedRemainingMonths).toBe(240);
    });

    it("creates a liability with explicit EMI and computes progress percentage", async () => {
      const liability = await LiabilityService.create(USER_ALICE, {
        name: "ICICI Car Loan",
        type: "CAR_LOAN",
        principalAmount: 1000000,
        outstandingAmount: 600000, // 40% paid off
        interestRate: 9.0,
        monthlyEMI: 20000,
      });

      expect(liability.principalAmount).toBe(1000000);
      expect(liability.outstandingAmount).toBe(600000);
      expect(liability.progressPct).toBe(40);
      expect(liability.estimatedRemainingMonths).toBeGreaterThan(0);
    });

    it("rejects invalid inputs with ValidationError", async () => {
      await expect(
        LiabilityService.create(USER_ALICE, {
          name: "Invalid Loan",
          type: "PERSONAL_LOAN",
          principalAmount: -1000,
          outstandingAmount: 0,
          interestRate: 10,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        LiabilityService.create(USER_ALICE, {
          name: "Invalid Loan",
          type: "PERSONAL_LOAN",
          principalAmount: 10000,
          outstandingAmount: -50,
          interestRate: 10,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("updates liability fields accurately", async () => {
      const created = await LiabilityService.create(USER_ALICE, {
        name: "Credit Card Debt",
        type: "CREDIT_CARD",
        principalAmount: 150000,
        outstandingAmount: 150000,
        interestRate: 36.0,
      });

      const updated = await LiabilityService.update(USER_ALICE, created.id, {
        outstandingAmount: 100000,
        monthlyEMI: 15000,
      });

      expect(updated.outstandingAmount).toBe(100000);
      expect(updated.monthlyEMI).toBe(15000);
      expect(updated.progressPct).toBeCloseTo(33.33, 1);
    });

    it("deletes a liability cleanly", async () => {
      const created = await LiabilityService.create(USER_ALICE, {
        name: "Personal Loan",
        type: "PERSONAL_LOAN",
        principalAmount: 200000,
        outstandingAmount: 200000,
        interestRate: 12.0,
      });

      const res = await LiabilityService.remove(USER_ALICE, created.id);
      expect(res.success).toBe(true);

      const all = await LiabilityService.getAll(USER_ALICE);
      expect(all.some((l) => l.id === created.id)).toBe(false);
    });
  });

  describe("2. User Isolation & Security (Cross-User Access Prevention)", () => {
    it("Alice cannot read Bob's liability (throws NotFoundError 404)", async () => {
      const bobLiability = await LiabilityService.create(USER_BOB, {
        name: "Bob Confidential Loan",
        type: "PERSONAL_LOAN",
        principalAmount: 300000,
        outstandingAmount: 300000,
        interestRate: 11.5,
      });

      await expect(LiabilityService.getById(USER_ALICE, bobLiability.id)).rejects.toThrow(NotFoundError);
      await expect(LiabilityService.getSchedule(USER_ALICE, bobLiability.id)).rejects.toThrow(NotFoundError);
      await expect(
        LiabilityService.simulatePrepayment(USER_ALICE, bobLiability.id, { monthlyExtra: 1000 })
      ).rejects.toThrow(NotFoundError);
    });

    it("Alice cannot update or delete Bob's liability (throws NotFoundError 404)", async () => {
      const bobLiability = await LiabilityService.create(USER_BOB, {
        name: "Bob Car Loan",
        type: "CAR_LOAN",
        principalAmount: 500000,
        outstandingAmount: 500000,
        interestRate: 8.5,
      });

      await expect(
        LiabilityService.update(USER_ALICE, bobLiability.id, { outstandingAmount: 0 })
      ).rejects.toThrow(NotFoundError);

      await expect(LiabilityService.remove(USER_ALICE, bobLiability.id)).rejects.toThrow(NotFoundError);

      // Verify Bob's loan remains untouched
      const bobLoans = await LiabilityService.getAll(USER_BOB);
      expect(bobLoans.length).toBe(1);
      expect(bobLoans[0].outstandingAmount).toBe(500000);
    });

    it("Alice's summary excludes Bob's liabilities", async () => {
      await LiabilityService.create(USER_ALICE, {
        name: "Alice Loan",
        type: "EDUCATION_LOAN",
        principalAmount: 400000,
        outstandingAmount: 400000,
        interestRate: 8.0,
        monthlyEMI: 10000,
      });

      await LiabilityService.create(USER_BOB, {
        name: "Bob Huge Loan",
        type: "HOME_LOAN",
        principalAmount: 9000000,
        outstandingAmount: 9000000,
        interestRate: 9.5,
        monthlyEMI: 80000,
      });

      const aliceSummary = await LiabilityService.getSummary(USER_ALICE);
      expect(aliceSummary.liabilitiesCount).toBe(1);
      expect(aliceSummary.totalOutstanding).toBe(400000);
      expect(aliceSummary.totalMonthlyEMI).toBe(10000);
      expect(aliceSummary.weightedInterestRate).toBe(8.0);
    });
  });

  describe("3. Net Worth Integration", () => {
    it("subtracts liabilities from assets in NetWorthService accurately", async () => {
      // 1. Create asset for Alice: 1,000,000 INR
      await AssetService.create(USER_ALICE, {
        name: "Reliance Industries",
        type: "STOCK",
        symbol: "RELIANCE.NS",
        quantity: 400,
        avgBuyPrice: 2500, // 400 * 2500 = 1,000,000
        currentPrice: 2500,
      });

      // Net worth before liability: 1,000,000
      const nwBefore = await NetWorthService.getCurrent(USER_ALICE);
      expect(nwBefore.totalAssets).toBe(1000000);
      expect(nwBefore.totalLiabilities).toBe(0);
      expect(nwBefore.netWorth).toBe(1000000);

      // 2. Add liability: 300,000 INR
      await LiabilityService.create(USER_ALICE, {
        name: "Personal Loan",
        type: "PERSONAL_LOAN",
        principalAmount: 300000,
        outstandingAmount: 300000,
        interestRate: 10.0,
      });

      // Net worth after liability: 1,000,000 - 300,000 = 700,000
      const nwAfter = await NetWorthService.getCurrent(USER_ALICE);
      expect(nwAfter.totalAssets).toBe(1000000);
      expect(nwAfter.totalLiabilities).toBe(300000);
      expect(nwAfter.netWorth).toBe(700000);
      expect(nwAfter.breakdown.PERSONAL_LOAN).toBe(-300000);
    });
  });

  describe("4. Amortization Schedule & Prepayment Simulation via Service", () => {
    it("returns full schedule for a liability", async () => {
      const liability = await LiabilityService.create(USER_ALICE, {
        name: "Home Loan",
        type: "HOME_LOAN",
        principalAmount: 2400000,
        outstandingAmount: 2400000,
        interestRate: 8.0,
        tenureMonths: 120,
      });

      const { schedule } = await LiabilityService.getById(USER_ALICE, liability.id);
      expect(schedule.schedule.length).toBe(120);
      expect(schedule.principal).toBe(2400000);
      expect(schedule.totalInterest).toBeGreaterThan(0);
      expect(schedule.schedule[schedule.schedule.length - 1].closingBalance).toBe(0);
    });

    it("simulates prepayment and computes interest savings", async () => {
      const liability = await LiabilityService.create(USER_ALICE, {
        name: "Home Loan",
        type: "HOME_LOAN",
        principalAmount: 3000000,
        outstandingAmount: 3000000,
        interestRate: 8.5,
        tenureMonths: 180,
      });

      const sim = await LiabilityService.simulatePrepayment(USER_ALICE, liability.id, {
        tenureMonths: 180,
        monthlyExtra: 10000,
        strategy: "REDUCE_TENURE",
      });

      expect(sim.savings.interestSaved).toBeGreaterThan(0);
      expect(sim.savings.monthsSaved).toBeGreaterThan(0);
      expect(sim.revised.tenureMonths).toBeLessThan(180);
    });
  });
});
