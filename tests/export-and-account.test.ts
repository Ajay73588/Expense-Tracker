import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DataExportService } from "@/services/data-export.service";
import { AccountLifecycleService } from "@/services/account-lifecycle.service";
import * as authModule from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import * as exportRoute from "../app/api/export/route";
import * as accountRoute from "../app/api/account/route";

describe("F-22: Privacy, Data Export and Account Lifecycle", () => {
  let aliceId = "";
  let bobId = "";
  let aliceClerkId = "";
  let bobClerkId = "";

  beforeEach(async () => {
    const ts = Date.now() + "_" + Math.random().toString(36).substring(7);
    aliceClerkId = `clerk_alice_${ts}`;
    bobClerkId = `clerk_bob_${ts}`;

    const alice = await prisma.user.create({
      data: {
        clerkId: aliceClerkId,
        email: `alice_${ts}@example.com`,
        name: "Alice Investor",
        currency: "INR",
        privacyMode: false,
      },
    });
    aliceId = alice.id;

    const bob = await prisma.user.create({
      data: {
        clerkId: bobClerkId,
        email: `bob_${ts}@example.com`,
        name: "Bob Trader",
        currency: "INR",
      },
    });
    bobId = bob.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("A. User Data Export (DataExportService & GET /api/export)", () => {
    it("exports complete data structure across all entity types for authenticated user", async () => {
      // 1. Seed Alice with all entity types
      const acc = await prisma.account.create({
        data: { userId: aliceId, name: "Alice HDFC", type: "BANK", currency: "INR" },
      });

      await prisma.asset.create({
        data: {
          userId: aliceId,
          type: "STOCK",
          name: "Reliance Industries",
          symbol: "RELIANCE.NS",
          quantity: 25.5,
          avgBuyPrice: 2450.75,
          currentPrice: 2900.0,
          currency: "INR",
          accountId: acc.id,
          isin: "INE002A01018",
          exchange: "NSE",
        },
      });

      await prisma.transaction.create({
        data: {
          userId: aliceId,
          type: "EXPENSE",
          amount: 1450.25,
          category: "Utilities",
          description: "Electricity bill",
          date: new Date("2026-05-10"),
          accountId: acc.id,
          tags: JSON.stringify(["home", "essential"]),
        },
      });

      await prisma.liability.create({
        data: {
          userId: aliceId,
          type: "HOME_LOAN",
          name: "SBI Home Loan",
          principalAmount: 4500000,
          outstandingAmount: 4200000,
          interestRate: 8.4,
          monthlyEMI: 38700,
        },
      });

      await prisma.budget.create({
        data: {
          userId: aliceId,
          category: "Groceries",
          monthlyLimit: 15000,
          month: 10,
          year: 2026,
        },
      });

      await prisma.goal.create({
        data: {
          userId: aliceId,
          name: "Emergency Reserve",
          targetAmount: 300000,
          currentAmount: 180000,
          targetDate: new Date("2027-03-31"),
          monthlyRequired: 20000,
          status: "ACTIVE",
        },
      });

      await prisma.snapshot.create({
        data: {
          userId: aliceId,
          date: new Date("2026-10-01"),
          totalAssets: 1000000,
          totalLiabilities: 4200000,
          netWorth: -3200000,
          breakdown: JSON.stringify({ stock: 1000000 }),
        },
      });

      await prisma.allocationTarget.create({
        data: {
          userId: aliceId,
          assetType: "STOCK",
          targetPercent: 60.0,
        },
      });

      await prisma.aIConversation.create({
        data: {
          userId: aliceId,
          action: "PORTFOLIO_ANALYSIS",
          messages: JSON.stringify([{ role: "user", content: "Review portfolio" }]),
          contextSnapshot: JSON.stringify({ totalAssets: 1000000 }),
        },
      });

      // 2. Perform export
      const exportData = await DataExportService.exportUserData(aliceId);

      // 3. Verify metadata and counts
      expect(exportData.exportMetadata.version).toBe("1.0.0");
      expect(exportData.exportMetadata.exportId).toMatch(/^exp_/);
      expect(typeof exportData.exportMetadata.exportedAt).toBe("string");
      expect(exportData.exportMetadata.entityCounts).toEqual({
        accounts: 1,
        assets: 1,
        transactions: 1,
        liabilities: 1,
        budgets: 1,
        goals: 1,
        snapshots: 1,
        allocationTargets: 1,
        conversations: 1,
      });

      // 4. Verify user profile without secrets
      expect(exportData.user.id).toBe(aliceId);
      expect(exportData.user.email).toContain("alice_");
      expect(exportData.user.name).toBe("Alice Investor");
      expect(exportData.user.currency).toBe("INR");

      // 5. Verify decimal precision and relationships
      expect(exportData.assets[0].name).toBe("Reliance Industries");
      expect(exportData.assets[0].accountId).toBe(acc.id);
      expect(exportData.assets[0].isin).toBe("INE002A01018");
      expect(parseFloat(exportData.assets[0].quantity)).toBeCloseTo(25.5, 4);
      expect(parseFloat(exportData.assets[0].avgBuyPrice)).toBeCloseTo(2450.75, 2);

      expect(exportData.transactions[0].category).toBe("Utilities");
      expect(exportData.transactions[0].tags).toEqual(["home", "essential"]);
      expect(parseFloat(exportData.transactions[0].amount)).toBeCloseTo(1450.25, 2);

      expect(exportData.liabilities[0].name).toBe("SBI Home Loan");
      expect(parseFloat(exportData.liabilities[0].principalAmount)).toBe(4500000);

      expect(exportData.budgets[0].category).toBe("Groceries");
      expect(exportData.goals[0].name).toBe("Emergency Reserve");
      expect(exportData.snapshots[0].netWorth).toBe("-3200000");
      expect(exportData.conversations[0].action).toBe("PORTFOLIO_ANALYSIS");
    });

    it("handles empty export gracefully for a new user with zero records", async () => {
      const exportData = await DataExportService.exportUserData(bobId);

      expect(exportData.exportMetadata.version).toBe("1.0.0");
      expect(exportData.exportMetadata.entityCounts).toEqual({
        accounts: 0,
        assets: 0,
        transactions: 0,
        liabilities: 0,
        budgets: 0,
        goals: 0,
        snapshots: 0,
        allocationTargets: 0,
        conversations: 0,
      });
      expect(exportData.accounts).toEqual([]);
      expect(exportData.assets).toEqual([]);
      expect(exportData.transactions).toEqual([]);
      expect(exportData.liabilities).toEqual([]);
      expect(exportData.budgets).toEqual([]);
      expect(exportData.goals).toEqual([]);
      expect(exportData.snapshots).toEqual([]);
      expect(exportData.allocationTargets).toEqual([]);
      expect(exportData.conversations).toEqual([]);
    });

    it("enforces strict cross-user data isolation during export", async () => {
      // Create Bob's private asset and transaction
      await prisma.asset.create({
        data: {
          userId: bobId,
          type: "STOCK",
          name: "Bob Secret Asset",
          quantity: 100,
          avgBuyPrice: 50,
          currentPrice: 60,
          currency: "INR",
        },
      });
      await prisma.transaction.create({
        data: {
          userId: bobId,
          type: "INCOME",
          amount: 50000,
          category: "Salary",
          date: new Date(),
        },
      });

      // Export Alice's data
      const aliceExport = await DataExportService.exportUserData(aliceId);

      // Verify none of Bob's records are present in Alice's export
      expect(aliceExport.assets).toHaveLength(0);
      expect(aliceExport.transactions).toHaveLength(0);
      expect(JSON.stringify(aliceExport)).not.toContain("Bob Secret Asset");
    });

    it("GET /api/export returns 401 when request is unauthenticated", async () => {
      vi.spyOn(authModule, "getCurrentUserId").mockRejectedValue(new UnauthorizedError("Unauthorized"));
      const res = await exportRoute.GET(new NextRequest("http://localhost:3000/api/export"));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("GET /api/export returns attachment JSON with no-cache headers when authenticated", async () => {
      vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(aliceId);
      const res = await exportRoute.GET(new NextRequest("http://localhost:3000/api/export"));

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      expect(res.headers.get("Cache-Control")).toContain("no-store");

      const body = await res.json();
      expect(body.exportMetadata.version).toBe("1.0.0");
      expect(body.user.id).toBe(aliceId);
    });
  });

  describe("B. Secure Account Deletion (AccountLifecycleService & DELETE /api/account)", () => {
    it("requires explicit confirmation 'DELETE' and rejects invalid or missing confirmation", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockResolvedValue({
        id: aliceId,
        clerkId: aliceClerkId,
      } as any);

      // 1. Missing confirmation
      const resEmpty = await accountRoute.DELETE(
        new NextRequest("http://localhost:3000/api/account", {
          method: "DELETE",
          body: JSON.stringify({}),
        })
      );
      expect(resEmpty.status).toBe(400);
      const bodyEmpty = await resEmpty.json();
      expect(bodyEmpty.error.code).toBe("CONFIRMATION_REQUIRED");

      // 2. Incorrect confirmation text
      const resWrong = await accountRoute.DELETE(
        new NextRequest("http://localhost:3000/api/account", {
          method: "DELETE",
          body: JSON.stringify({ confirmation: "REMOVE_ME" }),
        })
      );
      expect(resWrong.status).toBe(400);
      const bodyWrong = await resWrong.json();
      expect(bodyWrong.error.code).toBe("CONFIRMATION_REQUIRED");
    });

    it("DELETE /api/account returns 401 when request is unauthenticated", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockRejectedValue(new UnauthorizedError("Unauthorized"));
      const res = await accountRoute.DELETE(
        new NextRequest("http://localhost:3000/api/account", {
          method: "DELETE",
          body: JSON.stringify({ confirmation: "DELETE" }),
        })
      );
      expect(res.status).toBe(401);
    });

    it("permanently purges user account and all child financial records atomically", async () => {
      // 1. Seed Alice with diverse financial entities
      const acc = await prisma.account.create({
        data: { userId: aliceId, name: "Alice Axis Bank", type: "BANK" },
      });
      await prisma.asset.create({
        data: {
          userId: aliceId,
          type: "MUTUAL_FUND",
          name: "Parag Parikh Flexi Cap",
          quantity: 120,
          avgBuyPrice: 65,
          currentPrice: 80,
          accountId: acc.id,
        },
      });
      await prisma.transaction.create({
        data: {
          userId: aliceId,
          type: "EXPENSE",
          amount: 500,
          category: "Coffee",
          date: new Date(),
          accountId: acc.id,
        },
      });
      await prisma.liability.create({
        data: {
          userId: aliceId,
          type: "PERSONAL_LOAN",
          name: "Personal Loan",
          principalAmount: 100000,
          outstandingAmount: 90000,
          interestRate: 11.5,
        },
      });
      await prisma.budget.create({
        data: { userId: aliceId, category: "Dining", monthlyLimit: 4000, month: 10, year: 2026 },
      });
      await prisma.goal.create({
        data: { userId: aliceId, name: "Vacation", targetAmount: 80000, targetDate: new Date("2027-01-01") },
      });

      // 2. Execute deletion bypassing external Clerk API call in unit test
      const result = await AccountLifecycleService.deleteAccount(aliceId, { bypassIdp: true });

      expect(result.success).toBe(true);
      expect(result.dbPurged).toBe(true);
      expect(result.deletedCounts.accounts).toBe(1);
      expect(result.deletedCounts.assets).toBe(1);
      expect(result.deletedCounts.transactions).toBe(1);
      expect(result.deletedCounts.liabilities).toBe(1);
      expect(result.deletedCounts.budgets).toBe(1);
      expect(result.deletedCounts.goals).toBe(1);

      // 3. Confirm in database that Alice's records are completely wiped
      const userExists = await prisma.user.findUnique({ where: { id: aliceId } });
      expect(userExists).toBeNull();

      const assetsRemaining = await prisma.asset.count({ where: { userId: aliceId } });
      expect(assetsRemaining).toBe(0);

      const txRemaining = await prisma.transaction.count({ where: { userId: aliceId } });
      expect(txRemaining).toBe(0);

      const accountsRemaining = await prisma.account.count({ where: { userId: aliceId } });
      expect(accountsRemaining).toBe(0);
    });

    it("guarantees no unrelated user records are deleted when Alice purges her account", async () => {
      // 1. Create Bob's records
      const bobAcc = await prisma.account.create({
        data: { userId: bobId, name: "Bob ICICI Bank", type: "BANK" },
      });
      const bobAsset = await prisma.asset.create({
        data: {
          userId: bobId,
          type: "STOCK",
          name: "TCS",
          quantity: 10,
          avgBuyPrice: 3500,
          currentPrice: 4000,
        },
      });

      // 2. Delete Alice's account
      await AccountLifecycleService.deleteAccount(aliceId, { bypassIdp: true });

      // 3. Verify Bob's records are 100% intact
      const bobUser = await prisma.user.findUnique({ where: { id: bobId } });
      expect(bobUser).not.toBeNull();
      expect(bobUser?.name).toBe("Bob Trader");

      const bobAccountInDb = await prisma.account.findUnique({ where: { id: bobAcc.id } });
      expect(bobAccountInDb).not.toBeNull();

      const bobAssetInDb = await prisma.asset.findUnique({ where: { id: bobAsset.id } });
      expect(bobAssetInDb).not.toBeNull();
    });

    it("rolls back database transaction and preserves data if a database failure occurs", async () => {
      // 1. Seed Alice with an asset
      await prisma.asset.create({
        data: {
          userId: aliceId,
          type: "STOCK",
          name: "Rollback Guard Stock",
          quantity: 10,
          avgBuyPrice: 100,
          currentPrice: 110,
        },
      });

      // 2. Expect deletion to throw and roll back database transaction
      await expect(
        AccountLifecycleService.deleteAccount(aliceId, {
          bypassIdp: true,
          _testFailBeforeCommit: true,
        })
      ).rejects.toThrow("Simulated database failure before commit");

      // 4. Verify user and asset still exist in database due to rollback
      const userStillExists = await prisma.user.findUnique({ where: { id: aliceId } });
      expect(userStillExists).not.toBeNull();

      const assetStillExists = await prisma.asset.findFirst({ where: { userId: aliceId } });
      expect(assetStillExists).not.toBeNull();
      expect(assetStillExists?.name).toBe("Rollback Guard Stock");
    });

    it("handles external identity provider deletion failures safely without corrupting DB state", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockResolvedValue({
        id: aliceId,
        clerkId: "clerk_failing_id",
      } as any);

      // Seed an account
      await prisma.account.create({
        data: { userId: aliceId, name: "Alice Test Bank", type: "BANK" },
      });

      // Call API endpoint; Clerk client in test environment won't connect to Clerk servers or will fail gracefully
      const res = await accountRoute.DELETE(
        new NextRequest("http://localhost:3000/api/account", {
          method: "DELETE",
          body: JSON.stringify({ confirmation: "DELETE" }),
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data.dbPurged).toBe(true);
      // If IdP fails in test environment, it truthfully reports idpDeleted: false with a warning, not crashing
      if (!body.data.idpDeleted) {
        expect(body.data.idpWarning).toBeDefined();
      }

      // Database user is purged
      const user = await prisma.user.findUnique({ where: { id: aliceId } });
      expect(user).toBeNull();
    });

    it("repeated deletion attempt returns 404", async () => {
      // First deletion
      await AccountLifecycleService.deleteAccount(aliceId, { bypassIdp: true });

      // Second deletion attempt
      await expect(
        AccountLifecycleService.deleteAccount(aliceId, { bypassIdp: true })
      ).rejects.toThrow("User not found");
    });
  });
});
