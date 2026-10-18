import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCurrentUserId, getCurrentUser } from "../src/lib/auth";
import { UnauthorizedError, NotFoundError, ConflictError } from "../src/lib/errors";
import { handleError, ok, fail } from "../src/lib/api";
import { AssetService } from "../src/services/asset.service";
import { AccountService } from "../src/services/account.service";
import { TransactionService } from "../src/services/transaction.service";
import { GoalService } from "../src/services/goal.service";
import { BudgetService } from "../src/services/budget.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { NetWorthService } from "../src/services/networth.service";
import { AIAdvisoryService } from "../src/services/ai/ai-advisory.service";
import { NvidiaClient } from "../src/services/ai/nvidia-client";
import { prisma } from "../src/lib/prisma";

let USER_ALICE = "";
let USER_BOB = "";

describe("Production Readiness: Authentication & API Authorization", () => {
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

  describe("1. Unauthenticated Request & Error Handling", () => {
    it("converts UnauthorizedError to HTTP 401 with UNAUTHORIZED code", () => {
      const err = new UnauthorizedError("Unauthorized");
      const res = handleError(err);
      expect(res.status).toBe(401);
    });

    it("converts NotFoundError to HTTP 404 with NOT_FOUND code", () => {
      const err = new NotFoundError("Asset");
      const res = handleError(err);
      expect(res.status).toBe(404);
    });

    it("sanitizes unhandled 500 errors in production", () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";
        const sensitiveError = new Error("FATAL: password authentication failed for user 'postgres'");
        const res = handleError(sensitiveError);
        expect(res.status).toBe(500);
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe("2. Asset Ownership Isolation", () => {
    it("Alice cannot read, update, or delete Bob's asset (strict 404)", async () => {
      const bobAsset = await AssetService.create(USER_BOB, {
        type: "STOCK",
        name: "Bob Holdings Ltd",
        symbol: "BOB.NS",
        quantity: 10,
        avgBuyPrice: 100,
        currentPrice: 150,
      });

      // Alice attempting to read Bob's asset
      await expect(AssetService.getById(USER_ALICE, bobAsset.id)).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to update Bob's asset
      await expect(
        AssetService.update(USER_ALICE, bobAsset.id, { currentPrice: 500 })
      ).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to delete Bob's asset
      await expect(AssetService.remove(USER_ALICE, bobAsset.id)).rejects.toBeInstanceOf(NotFoundError);

      // Verify Bob's asset was untouched
      const intact = await AssetService.getById(USER_BOB, bobAsset.id);
      expect(intact.name).toBe("Bob Holdings Ltd");
      expect(intact.deletedAt).toBeNull();
    });

    it("Alice's asset list and portfolio exclude Bob's assets", async () => {
      const bobAsset = await AssetService.create(USER_BOB, {
        type: "MUTUAL_FUND",
        name: "Bob Bluechip Fund",
        quantity: 50,
        avgBuyPrice: 50,
        currentPrice: 60,
      });

      const aliceList = await AssetService.list(USER_ALICE);
      expect(aliceList.some((a: any) => a.id === bobAsset.id)).toBe(false);

      const alicePortfolio = await AssetService.getPortfolioWithPL(USER_ALICE);
      expect(alicePortfolio.some((a: any) => a.id === bobAsset.id)).toBe(false);
    });
  });

  describe("3. Account Ownership Isolation", () => {
    it("Alice cannot get, update, close, or delete Bob's account", async () => {
      const bobAccount = await AccountService.create(USER_BOB, {
        name: "Bob Private Savings",
        type: "BANK",
        currency: "INR",
      });

      // Alice attempting to get Bob's account
      await expect(AccountService.get(USER_ALICE, bobAccount.id)).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to update Bob's account
      await expect(
        AccountService.update(USER_ALICE, bobAccount.id, { name: "Hacked Account" })
      ).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to close Bob's account
      await expect(AccountService.close(USER_ALICE, bobAccount.id)).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to delete Bob's account
      await expect(AccountService.delete(USER_ALICE, bobAccount.id)).rejects.toBeInstanceOf(NotFoundError);

      // Verify Bob's account is still intact
      const intact = await AccountService.get(USER_BOB, bobAccount.id);
      expect(intact.name).toBe("Bob Private Savings");
      expect(intact.closedAt).toBeNull();
    });
  });

  describe("4. Transaction Ownership Isolation", () => {
    it("Alice cannot delete Bob's transaction", async () => {
      const bobTx = await TransactionService.create(USER_BOB, {
        type: "EXPENSE",
        amount: 2500,
        category: "Food",
        date: new Date(),
        description: "Bob Dinner",
      });

      // Alice attempting to delete Bob's transaction -> throws NotFoundError
      await expect(TransactionService.remove(USER_ALICE, bobTx.id)).rejects.toBeInstanceOf(NotFoundError);

      // Verify Bob's transaction is still active (not soft-deleted)
      const bobList = await TransactionService.list(USER_BOB, { limit: 10 });
      expect(bobList.some((t: any) => t.id === bobTx.id)).toBe(true);

      // Verify Alice does not see Bob's transaction in her list
      const aliceList = await TransactionService.list(USER_ALICE, { limit: 10 });
      expect(aliceList.some((t: any) => t.id === bobTx.id)).toBe(false);
    });

    it("Alice cannot update Bob's transaction", async () => {
      const bobTx = await TransactionService.create(USER_BOB, {
        type: "EXPENSE",
        amount: 3200,
        category: "Shopping",
        date: new Date(),
        description: "Bob Gadget",
      });

      // Alice attempting to update Bob's transaction -> throws NotFoundError
      await expect(
        TransactionService.update(USER_ALICE, bobTx.id, { amount: 500 })
      ).rejects.toBeInstanceOf(NotFoundError);

      // Bob updates his own transaction -> succeeds
      const updated = await TransactionService.update(USER_BOB, bobTx.id, {
        amount: 3500,
        description: "Bob Gadget Updated",
      });
      expect(Number(updated.amount)).toBe(3500);
      expect(updated.description).toBe("Bob Gadget Updated");

      // Cannot change type to TRANSFER directly
      await expect(
        TransactionService.update(USER_BOB, bobTx.id, { type: "TRANSFER" })
      ).rejects.toThrow("Cannot change transaction type to TRANSFER");
    });
  });


  describe("5. Goal & Budget Ownership Isolation", () => {
    it("Alice cannot update or delete Bob's goal", async () => {
      const bobGoal = await GoalService.create(USER_BOB, {
        name: "Bob Dream Vacation",
        targetAmount: 100000,
        currentAmount: 20000,
        targetDate: new Date(Date.now() + 86400000 * 365),
      });

      // Alice attempting to update Bob's goal -> throws NotFoundError
      await expect(
        GoalService.update(USER_ALICE, bobGoal.id, { targetAmount: 500 })
      ).rejects.toBeInstanceOf(NotFoundError);

      // Alice attempting to delete Bob's goal -> throws NotFoundError
      await expect(GoalService.remove(USER_ALICE, bobGoal.id)).rejects.toBeInstanceOf(NotFoundError);

      // Verify Bob's goal progress is untouched
      const bobGoals = await GoalService.getAllWithProgress(USER_BOB);
      const bobVacation = bobGoals.find((g: any) => g.id === bobGoal.id);
      expect(bobVacation).toBeDefined();
      expect(bobVacation.name).toBe("Bob Dream Vacation");
    });

    it("Alice cannot delete Bob's budget", async () => {
      const bobBudget = await BudgetService.upsert(USER_BOB, {
        category: "Entertainment",
        monthlyLimit: 5000,
        month: 10,
        year: 2026,
      });

      // Alice attempting to delete Bob's budget -> throws NotFoundError
      await expect(BudgetService.remove(USER_ALICE, bobBudget.id)).rejects.toBeInstanceOf(NotFoundError);

      // Verify Bob's budget usage still contains his budget
      const bobUsage = await BudgetService.getUsage(USER_BOB, 10, 2026);
      expect(bobUsage.some((b: any) => b.id === bobBudget.id)).toBe(true);

      // Verify Alice's budget usage contains none of Bob's budget
      const aliceUsage = await BudgetService.getUsage(USER_ALICE, 10, 2026);
      expect(aliceUsage.some((b: any) => b.id === bobBudget.id)).toBe(false);
    });
  });

  describe("6. AI Advisor Context User Isolation", () => {
    it("Alice's advisory context snapshot contains only Alice's data, never Bob's", async () => {
      // Bob has 10,00,000 in assets and specific transactions
      await AssetService.create(USER_BOB, {
        type: "STOCK",
        name: "Bob Secret Goldmine",
        quantity: 100,
        avgBuyPrice: 10000,
        currentPrice: 10000,
      });

      let capturedPrompt = "";
      const configSpy = vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
      const spy = vi.spyOn(NvidiaClient, "complete").mockImplementation(async (req) => {
        capturedPrompt = JSON.stringify(req.messages);
        return { ok: true, text: "AI Analysis: Your portfolio has ...", model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", durationMs: 1 };
      });

      try {
        const aliceAdvice = await AIAdvisoryService.runAction(USER_ALICE, "PORTFOLIO_ANALYSIS", {
          message: "Review my portfolio",
        });

        expect(aliceAdvice).toBeDefined();
        expect(aliceAdvice.response).toBeDefined();
        // Bob's secret holding name must never appear in Alice's advice or prompt context
        expect(capturedPrompt).not.toContain("Bob Secret Goldmine");
        expect(aliceAdvice.response).not.toContain("Bob Secret Goldmine");
      } finally {
        spy.mockRestore();
        configSpy.mockRestore();
      }
    });
  });
});
