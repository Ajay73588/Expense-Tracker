import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as authModule from "../src/lib/auth";
import { UnauthorizedError } from "../src/lib/errors";
import { prisma } from "../src/lib/prisma";

// Import all API route handlers directly
import * as accountsRoute from "../app/api/accounts/route";
import * as accountsIdRoute from "../app/api/accounts/[id]/route";
import * as accountCloseRoute from "../app/api/accounts/[id]/close/route";
import * as accountMigrateRoute from "../app/api/accounts/migrate/route";
import * as assetsRoute from "../app/api/assets/route";
import * as assetsIdRoute from "../app/api/assets/[id]/route";
import * as transactionsRoute from "../app/api/transactions/route";
import * as transactionTransferRoute from "../app/api/transactions/transfer/route";
import * as budgetRoute from "../app/api/budget/route";
import * as goalsRoute from "../app/api/goals/route";
import * as importRoute from "../app/api/import/route";
import * as importTemplateRoute from "../app/api/import/template/route";
import * as importTxRoute from "../app/api/import/transactions/route";
import * as importCasRoute from "../app/api/import/cas/route";
import * as importHistoryRoute from "../app/api/import/history/route";
import * as importRollbackRoute from "../app/api/import/rollback/route";
import * as portfolioRoute from "../app/api/portfolio/route";
import * as portfolioRebalanceRoute from "../app/api/portfolio/rebalance/route";
import * as pricesRefreshRoute from "../app/api/prices/refresh/route";
import * as aiRoute from "../app/api/ai/route";
import * as dashboardRoute from "../app/api/dashboard/route";
import * as healthScoreRoute from "../app/api/health-score/route";
import * as netWorthRoute from "../app/api/net-worth/route";
import * as insightsRoute from "../app/api/insights/route";
import * as liabilitiesRoute from "../app/api/liabilities/route";
import * as liabilitiesIdRoute from "../app/api/liabilities/[id]/route";
import * as liabilitiesScheduleRoute from "../app/api/liabilities/[id]/schedule/route";
import * as exportRoute from "../app/api/export/route";
import * as accountRoute from "../app/api/account/route";
import * as settingsRoute from "../app/api/settings/route";

describe("STAB-002: Complete API Route Authorization Coverage", () => {
  let userAliceId = "";
  let userBobId = "";
  let bobAccountId = "";
  let bobAssetId = "";
  let bobTxId = "";
  let bobBudgetId = "";
  let bobGoalId = "";
  let bobLiabilityId = "";

  beforeEach(async () => {
    const timestamp = Date.now() + "_" + Math.random().toString(36).substring(7);
    const alice = await prisma.user.create({
      data: { clerkId: `clerk_a_${timestamp}`, email: `alice_${timestamp}@example.com`, name: "Alice" },
    });
    const bob = await prisma.user.create({
      data: { clerkId: `clerk_b_${timestamp}`, email: `bob_${timestamp}@example.com`, name: "Bob" },
    });
    userAliceId = alice.id;
    userBobId = bob.id;

    // Create Bob's private records
    const bobAccount = await prisma.account.create({
      data: { userId: userBobId, name: "Bob Bank " + timestamp, type: "BANK" },
    });
    bobAccountId = bobAccount.id;

    const bobAsset = await prisma.asset.create({
      data: {
        userId: userBobId,
        type: "STOCK",
        name: "Bob Holdings",
        quantity: 10,
        avgBuyPrice: 100,
        currentPrice: 120,
        accountId: bobAccountId,
      },
    });
    bobAssetId = bobAsset.id;

    const bobTx = await prisma.transaction.create({
      data: {
        userId: userBobId,
        type: "EXPENSE",
        amount: 500,
        category: "Food",
        date: new Date(),
        accountId: bobAccountId,
      },
    });
    bobTxId = bobTx.id;

    const bobBudget = await prisma.budget.create({
      data: {
        userId: userBobId,
        category: "Entertainment",
        monthlyLimit: 5000,
        month: 10,
        year: 2026,
      },
    });
    bobBudgetId = bobBudget.id;

    const bobGoal = await prisma.goal.create({
      data: {
        userId: userBobId,
        name: "Bob Private Goal",
        targetAmount: 50000,
        targetDate: new Date("2027-01-01"),
      },
    });
    bobGoalId = bobGoal.id;

    const bobLiability = await prisma.liability.create({
      data: {
        userId: userBobId,
        name: "Bob Car Loan",
        type: "CAR_LOAN",
        principalAmount: 400000,
        outstandingAmount: 400000,
        interestRate: 8.5,
        monthlyEMI: 10000,
      },
    });
    bobLiabilityId = bobLiability.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Unauthenticated Requests Return HTTP 401 Across All Route Groups", () => {
    beforeEach(() => {
      vi.spyOn(authModule, "getCurrentUserId").mockRejectedValue(new UnauthorizedError("Unauthorized"));
    });

    it("enforces 401 on /api/accounts (GET, POST)", async () => {
      const getRes = await accountsRoute.GET();
      expect(getRes.status).toBe(401);
      const getBody = await getRes.json();
      expect(getBody.error.code).toBe("UNAUTHORIZED");

      const postRes = await accountsRoute.POST(
        new NextRequest("http://localhost:3000/api/accounts", {
          method: "POST",
          body: JSON.stringify({ name: "Hacked" }),
        })
      );
      expect(postRes.status).toBe(401);
    });

    it("enforces 401 on /api/accounts/[id] (GET, PATCH, DELETE)", async () => {
      const dummyParams = { params: { id: "acc_123" } };
      const req = new NextRequest("http://localhost:3000/api/accounts/acc_123");

      const getRes = await accountsIdRoute.GET(req, dummyParams);
      expect(getRes.status).toBe(401);

      const patchRes = await accountsIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/accounts/acc_123", {
          method: "PATCH",
          body: JSON.stringify({ name: "Renamed" }),
        }),
        dummyParams
      );
      expect(patchRes.status).toBe(401);

      const deleteRes = await accountsIdRoute.DELETE(req, dummyParams);
      expect(deleteRes.status).toBe(401);
    });

    it("enforces 401 on /api/accounts/[id]/close (POST) and /api/accounts/migrate (POST)", async () => {
      const closeRes = await accountCloseRoute.POST(
        new NextRequest("http://localhost:3000/api/accounts/acc_123/close", { method: "POST" }),
        { params: { id: "acc_123" } }
      );
      expect(closeRes.status).toBe(401);

      const migrateRes = await accountMigrateRoute.POST(
        new NextRequest("http://localhost:3000/api/accounts/migrate", { method: "POST" })
      );
      expect(migrateRes.status).toBe(401);
    });

    it("enforces 401 on /api/assets (GET, POST, PATCH, DELETE)", async () => {
      const getRes = await assetsRoute.GET(new NextRequest("http://localhost:3000/api/assets"));
      expect(getRes.status).toBe(401);

      const postRes = await assetsRoute.POST(
        new NextRequest("http://localhost:3000/api/assets", {
          method: "POST",
          body: JSON.stringify({ type: "STOCK", name: "Apple", avgBuyPrice: 150 }),
        })
      );
      expect(postRes.status).toBe(401);

      const patchRes = await assetsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/assets?id=ast_123", {
          method: "PATCH",
          body: JSON.stringify({ currentPrice: 200 }),
        })
      );
      expect(patchRes.status).toBe(401);

      const deleteRes = await assetsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/assets?id=ast_123", { method: "DELETE" })
      );
      expect(deleteRes.status).toBe(401);
    });

    it("enforces 401 on /api/assets/[id] (GET, PATCH, DELETE)", async () => {
      const dummyParams = { params: { id: "ast_123" } };
      const req = new NextRequest("http://localhost:3000/api/assets/ast_123");

      const getRes = await assetsIdRoute.GET(req, dummyParams);
      expect(getRes.status).toBe(401);

      const patchRes = await assetsIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/assets/ast_123", {
          method: "PATCH",
          body: JSON.stringify({ currentPrice: 200 }),
        }),
        dummyParams
      );
      expect(patchRes.status).toBe(401);

      const delRes = await assetsIdRoute.DELETE(req, dummyParams);
      expect(delRes.status).toBe(401);
    });

    it("enforces 401 on /api/transactions (GET, POST, PATCH, DELETE)", async () => {
      const getRes = await transactionsRoute.GET(new NextRequest("http://localhost:3000/api/transactions"));
      expect(getRes.status).toBe(401);

      const postRes = await transactionsRoute.POST(
        new NextRequest("http://localhost:3000/api/transactions", {
          method: "POST",
          body: JSON.stringify({ type: "EXPENSE", amount: 100, category: "Food", date: new Date().toISOString() }),
        })
      );
      expect(postRes.status).toBe(401);

      const patchRes = await transactionsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/transactions?id=tx_123", {
          method: "PATCH",
          body: JSON.stringify({ amount: 150 }),
        })
      );
      expect(patchRes.status).toBe(401);

      const delRes = await transactionsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/transactions?id=tx_123", { method: "DELETE" })
      );
      expect(delRes.status).toBe(401);

      const transferRes = await transactionTransferRoute.POST(
        new NextRequest("http://localhost:3000/api/transactions/transfer", {
          method: "POST",
          body: JSON.stringify({ fromAccountId: "a1", toAccountId: "a2", amount: 1000, date: new Date().toISOString() }),
        })
      );
      expect(transferRes.status).toBe(401);
    });

    it("enforces 401 on /api/budget (GET, POST, PATCH, DELETE)", async () => {
      const getRes = await budgetRoute.GET(new NextRequest("http://localhost:3000/api/budget"));
      expect(getRes.status).toBe(401);

      const postRes = await budgetRoute.POST(
        new NextRequest("http://localhost:3000/api/budget", {
          method: "POST",
          body: JSON.stringify({ category: "Food", monthlyLimit: 5000, month: 10, year: 2026 }),
        })
      );
      expect(postRes.status).toBe(401);

      const patchRes = await budgetRoute.PATCH(
        new NextRequest("http://localhost:3000/api/budget", {
          method: "PATCH",
          body: JSON.stringify({ category: "Food", monthlyLimit: 6000, month: 10, year: 2026 }),
        })
      );
      expect(patchRes.status).toBe(401);

      const delRes = await budgetRoute.DELETE(
        new NextRequest("http://localhost:3000/api/budget?id=bg_123", { method: "DELETE" })
      );
      expect(delRes.status).toBe(401);
    });

    it("enforces 401 on /api/goals (GET, POST, PATCH, DELETE)", async () => {
      const getRes = await goalsRoute.GET();
      expect(getRes.status).toBe(401);

      const postRes = await goalsRoute.POST(
        new NextRequest("http://localhost:3000/api/goals", {
          method: "POST",
          body: JSON.stringify({ name: "Car", targetAmount: 500000, targetDate: new Date().toISOString() }),
        })
      );
      expect(postRes.status).toBe(401);

      const patchRes = await goalsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/goals?id=g_123", {
          method: "PATCH",
          body: JSON.stringify({ targetAmount: 600000 }),
        })
      );
      expect(patchRes.status).toBe(401);

      const delRes = await goalsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/goals?id=g_123", { method: "DELETE" })
      );
      expect(delRes.status).toBe(401);
    });

    it("enforces 401 on /api/import (GET, POST)", async () => {
      const getRes = await importRoute.GET();
      expect(getRes.status).toBe(401);

      const postRes = await importRoute.POST(
        new NextRequest("http://localhost:3000/api/import", {
          method: "POST",
          headers: { "content-type": "multipart/form-data; boundary=---boundary" },
        })
      );
      expect(postRes.status).toBe(401);
    });

    it("enforces 401 on unified import routes (/api/import/template, /api/import/transactions, /api/import/cas, /api/import/history, /api/import/rollback)", async () => {
      expect((await importTemplateRoute.GET()).status).toBe(401);
      expect((await importTxRoute.POST(new NextRequest("http://localhost:3000/api/import/transactions", { method: "POST" }))).status).toBe(401);
      expect((await importCasRoute.POST(new NextRequest("http://localhost:3000/api/import/cas", { method: "POST" }))).status).toBe(401);
      expect((await importHistoryRoute.GET()).status).toBe(401);
      expect((await importRollbackRoute.POST(new NextRequest("http://localhost:3000/api/import/rollback", { method: "POST" }))).status).toBe(401);
    });

    it("enforces 401 on /api/portfolio (GET), /api/portfolio/rebalance (GET, POST), and /api/prices/refresh (POST)", async () => {
      const portRes = await portfolioRoute.GET();
      expect(portRes.status).toBe(401);

      const rebalGetRes = await portfolioRebalanceRoute.GET(new NextRequest("http://localhost:3000/api/portfolio/rebalance"));
      expect(rebalGetRes.status).toBe(401);

      const rebalPostRes = await portfolioRebalanceRoute.POST(new NextRequest("http://localhost:3000/api/portfolio/rebalance", {
        method: "POST",
        body: JSON.stringify({ mode: "CASH_ONLY" }),
      }));
      expect(rebalPostRes.status).toBe(401);

      const refreshRes = await pricesRefreshRoute.POST();
      expect(refreshRes.status).toBe(401);
    });

    it("enforces 401 on /api/ai (GET, POST)", async () => {
      const getRes = await aiRoute.GET();
      expect(getRes.status).toBe(401);

      const postRes = await aiRoute.POST(
        new NextRequest("http://localhost:3000/api/ai", {
          method: "POST",
          body: JSON.stringify({ action: "PORTFOLIO_ANALYSIS" }),
        })
      );
      expect(postRes.status).toBe(401);
    });

    it("enforces 401 on dashboard and analytics routes (/api/dashboard, /api/health-score, /api/net-worth, /api/insights)", async () => {
      expect((await dashboardRoute.GET()).status).toBe(401);
      expect((await healthScoreRoute.GET()).status).toBe(401);
      expect((await netWorthRoute.GET(new NextRequest("http://localhost:3000/api/net-worth"))).status).toBe(401);
      expect((await insightsRoute.GET()).status).toBe(401);
    });

    it("enforces 401 on /api/liabilities (GET, POST, PATCH, DELETE, and [id] routes)", async () => {
      expect((await liabilitiesRoute.GET(new NextRequest("http://localhost:3000/api/liabilities"))).status).toBe(401);
      expect(
        (
          await liabilitiesRoute.POST(
            new NextRequest("http://localhost:3000/api/liabilities", {
              method: "POST",
              body: JSON.stringify({ name: "Unauth Loan" }),
            })
          )
        ).status
      ).toBe(401);
      const params = { params: { id: "liab_123" } };
      expect((await liabilitiesIdRoute.GET(new NextRequest("http://localhost:3000/api/liabilities/liab_123"), params)).status).toBe(401);
      expect((await liabilitiesScheduleRoute.POST(new NextRequest("http://localhost:3000/api/liabilities/liab_123/schedule"), params)).status).toBe(401);
    });

    it("enforces 401 on /api/export (GET) and /api/account (DELETE)", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockRejectedValue(new UnauthorizedError("Unauthorized"));
      expect((await exportRoute.GET(new NextRequest("http://localhost:3000/api/export"))).status).toBe(401);
      expect(
        (
          await accountRoute.DELETE(
            new NextRequest("http://localhost:3000/api/account", {
              method: "DELETE",
              body: JSON.stringify({ confirmation: "DELETE" }),
            })
          )
        ).status
      ).toBe(401);
    });

    it("enforces 401 on /api/settings (GET, PATCH)", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockRejectedValue(new UnauthorizedError("Unauthorized"));
      expect((await settingsRoute.GET(new NextRequest("http://localhost:3000/api/settings"))).status).toBe(401);
      expect(
        (
          await settingsRoute.PATCH(
            new NextRequest("http://localhost:3000/api/settings", {
              method: "PATCH",
              body: JSON.stringify({ privacyMode: true }),
            })
          )
        ).status
      ).toBe(401);
    });
  });

  describe("2. Cross-User Resource Access Returns HTTP 404", () => {
    beforeEach(() => {
      // Authenticate as Alice
      vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(userAliceId);
    });

    it("Alice accessing Bob's account returns HTTP 404 (GET, PATCH, DELETE, CLOSE)", async () => {
      const params = { params: { id: bobAccountId } };

      const getRes = await accountsIdRoute.GET(new NextRequest("http://localhost:3000/api/accounts/" + bobAccountId), params);
      expect(getRes.status).toBe(404);
      expect((await getRes.json()).error.code).toBe("NOT_FOUND");

      const patchRes = await accountsIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/accounts/" + bobAccountId, {
          method: "PATCH",
          body: JSON.stringify({ name: "Alice Hacked" }),
        }),
        params
      );
      expect(patchRes.status).toBe(404);

      const closeRes = await accountCloseRoute.POST(
        new NextRequest("http://localhost:3000/api/accounts/" + bobAccountId + "/close", { method: "POST" }),
        params
      );
      expect(closeRes.status).toBe(404);

      const delRes = await accountsIdRoute.DELETE(
        new NextRequest("http://localhost:3000/api/accounts/" + bobAccountId),
        params
      );
      expect(delRes.status).toBe(404);
    });

    it("Alice accessing Bob's asset returns HTTP 404 (GET, PATCH, DELETE via [id] and query param)", async () => {
      const params = { params: { id: bobAssetId } };

      const getRes = await assetsIdRoute.GET(new NextRequest("http://localhost:3000/api/assets/" + bobAssetId), params);
      expect(getRes.status).toBe(404);

      const patchRes = await assetsIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/assets/" + bobAssetId, {
          method: "PATCH",
          body: JSON.stringify({ currentPrice: 999 }),
        }),
        params
      );
      expect(patchRes.status).toBe(404);

      const delRes = await assetsIdRoute.DELETE(new NextRequest("http://localhost:3000/api/assets/" + bobAssetId), params);
      expect(delRes.status).toBe(404);

      // Query param routes on /api/assets
      const patchQueryRes = await assetsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/assets?id=" + bobAssetId, {
          method: "PATCH",
          body: JSON.stringify({ currentPrice: 999 }),
        })
      );
      expect(patchQueryRes.status).toBe(404);

      const delQueryRes = await assetsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/assets?id=" + bobAssetId, { method: "DELETE" })
      );
      expect(delQueryRes.status).toBe(404);
    });

    it("Alice deleting Bob's transaction returns HTTP 404", async () => {
      const delRes = await transactionsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/transactions?id=" + bobTxId, { method: "DELETE" })
      );
      expect(delRes.status).toBe(404);
      expect((await delRes.json()).error.code).toBe("NOT_FOUND");
    });

    it("Alice updating Bob's transaction returns HTTP 404", async () => {
      const patchRes = await transactionsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/transactions?id=" + bobTxId, {
          method: "PATCH",
          body: JSON.stringify({ amount: 999 }),
        })
      );
      expect(patchRes.status).toBe(404);
      expect((await patchRes.json()).error.code).toBe("NOT_FOUND");
    });

    it("Bob updating his own transaction via PATCH returns HTTP 200", async () => {
      vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(userBobId);
      const patchRes = await transactionsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/transactions?id=" + bobTxId, {
          method: "PATCH",
          body: JSON.stringify({ amount: 750, description: "Updated Bob Food" }),
        })
      );
      expect(patchRes.status).toBe(200);
      const json = await patchRes.json();
      expect(json.ok).toBe(true);
      expect(Number(json.data.amount)).toBe(750);
      expect(json.data.description).toBe("Updated Bob Food");
      vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(userAliceId);
    });

    it("Alice deleting Bob's budget returns HTTP 404", async () => {
      const delRes = await budgetRoute.DELETE(
        new NextRequest("http://localhost:3000/api/budget?id=" + bobBudgetId, { method: "DELETE" })
      );
      expect(delRes.status).toBe(404);
      expect((await delRes.json()).error.code).toBe("NOT_FOUND");
    });

    it("Alice updating or deleting Bob's goal returns HTTP 404", async () => {
      const patchRes = await goalsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/goals?id=" + bobGoalId, {
          method: "PATCH",
          body: JSON.stringify({ targetAmount: 99999 }),
        })
      );
      expect(patchRes.status).toBe(404);

      const delRes = await goalsRoute.DELETE(
        new NextRequest("http://localhost:3000/api/goals?id=" + bobGoalId, { method: "DELETE" })
      );
      expect(delRes.status).toBe(404);
      expect((await delRes.json()).error.code).toBe("NOT_FOUND");
    });

    it("Alice accessing Bob's liability returns HTTP 404 (GET, PATCH, DELETE via [id] and query param)", async () => {
      const params = { params: { id: bobLiabilityId } };

      const getRes = await liabilitiesIdRoute.GET(
        new NextRequest("http://localhost:3000/api/liabilities/" + bobLiabilityId),
        params
      );
      expect(getRes.status).toBe(404);

      const patchRes = await liabilitiesIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/liabilities/" + bobLiabilityId, {
          method: "PATCH",
          body: JSON.stringify({ outstandingAmount: 0 }),
        }),
        params
      );
      expect(patchRes.status).toBe(404);

      const scheduleRes = await liabilitiesScheduleRoute.POST(
        new NextRequest("http://localhost:3000/api/liabilities/" + bobLiabilityId + "/schedule", {
          method: "POST",
          body: JSON.stringify({ monthlyExtra: 5000 }),
        }),
        params
      );
      expect(scheduleRes.status).toBe(404);

      const delRes = await liabilitiesIdRoute.DELETE(
        new NextRequest("http://localhost:3000/api/liabilities/" + bobLiabilityId),
        params
      );
      expect(delRes.status).toBe(404);

      // Query param routes on /api/liabilities
      const patchQueryRes = await liabilitiesRoute.PATCH(
        new NextRequest("http://localhost:3000/api/liabilities?id=" + bobLiabilityId, {
          method: "PATCH",
          body: JSON.stringify({ outstandingAmount: 0 }),
        })
      );
      expect(patchQueryRes.status).toBe(404);

      const delQueryRes = await liabilitiesRoute.DELETE(
        new NextRequest("http://localhost:3000/api/liabilities?id=" + bobLiabilityId, { method: "DELETE" })
      );
      expect(delQueryRes.status).toBe(404);
    });
  });

  describe("3. Nested Resource Authorization Protection", () => {
    beforeEach(() => {
      vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(userAliceId);
    });

    it("Alice cannot create an asset attached to Bob's accountId (returns 404)", async () => {
      const res = await assetsRoute.POST(
        new NextRequest("http://localhost:3000/api/assets", {
          method: "POST",
          body: JSON.stringify({
            type: "STOCK",
            name: "Alice Intruder Asset",
            avgBuyPrice: 200,
            accountId: bobAccountId,
          }),
        })
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("Account");
    });

    it("Alice cannot update an existing asset to point to Bob's accountId (returns 404)", async () => {
      const aliceAsset = await prisma.asset.create({
        data: {
          userId: userAliceId,
          type: "GOLD",
          name: "Alice Gold",
          quantity: 1,
          avgBuyPrice: 5000,
          currentPrice: 5000,
        },
      });

      const res = await assetsIdRoute.PATCH(
        new NextRequest("http://localhost:3000/api/assets/" + aliceAsset.id, {
          method: "PATCH",
          body: JSON.stringify({ accountId: bobAccountId }),
        }),
        { params: { id: aliceAsset.id } }
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error.message).toContain("Account");
    });

    it("Alice cannot create a transaction attached to Bob's accountId (returns 404)", async () => {
      const res = await transactionsRoute.POST(
        new NextRequest("http://localhost:3000/api/transactions", {
          method: "POST",
          body: JSON.stringify({
            type: "EXPENSE",
            amount: 1500,
            category: "Shopping",
            date: new Date().toISOString(),
            accountId: bobAccountId,
          }),
        })
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error.message).toContain("Account");
    });

    it("Alice cannot import holdings targeting Bob's accountId (returns 404)", async () => {
      const formData = new FormData();
      formData.append("broker", "GROWW");
      formData.append("assetClass", "MUTUAL_FUND");
      formData.append("account", bobAccountId);
      formData.append("confirm", "false");
      const file = new File([new Uint8Array([1, 2, 3])], "test.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      formData.append("file", file);

      const req = new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        body: formData,
      });

      const res = await importRoute.POST(req);
      expect(res.status).toBe(404);
      expect((await res.json()).error.message).toContain("Account");
    });
  });

  describe("4. Error Responses Never Leak Database Details or Secrets", () => {
    it("sanitizes unexpected database errors to prevent credential or schema leaks", async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";
        vi.spyOn(authModule, "getCurrentUserId").mockRejectedValue(
          new Error("PG::ConnectionBad: connection to server at '127.0.0.1', port 5432 failed: FATAL: password authentication failed for user 'postgres'")
        );

        const res = await accountsRoute.GET();
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error.code).toBe("INTERNAL_ERROR");
        expect(body.error.message).toBe("Internal server error");
        expect(JSON.stringify(body)).not.toContain("password");
        expect(JSON.stringify(body)).not.toContain("postgres");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("enforces validation on /api/settings PATCH (invalid currency / payload)", async () => {
      vi.spyOn(authModule, "getCurrentUser").mockResolvedValue({
        id: userAliceId,
        email: "alice@example.com",
        name: "Alice",
        currency: "INR",
        privacyMode: false,
        clerkId: "clerk_alice",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const invalidRes = await settingsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/settings", {
          method: "PATCH",
          body: JSON.stringify({ currency: "INVALID_CURRENCY" }),
        })
      );
      expect(invalidRes.status).toBe(400);
      const invalidBody = await invalidRes.json();
      expect(invalidBody.error.code).toBe("VALIDATION_ERROR");

      const validRes = await settingsRoute.PATCH(
        new NextRequest("http://localhost:3000/api/settings", {
          method: "PATCH",
          body: JSON.stringify({ currency: "USD", privacyMode: true }),
        })
      );
      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody.data.currency).toBe("USD");
      expect(validBody.data.privacyMode).toBe(true);
    });
  });
});
