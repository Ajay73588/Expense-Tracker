import { describe, it, vi, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import * as authModule from "../src/lib/auth";
import { NextRequest } from "next/server";

import { DashboardService } from "../src/services/dashboard.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { AssetService } from "../src/services/asset.service";
import { TransactionService } from "../src/services/transaction.service";
import { BudgetService } from "../src/services/budget.service";
import { GoalService } from "../src/services/goal.service";
import { NetWorthService } from "../src/services/networth.service";
import { HealthScoreService } from "../src/services/healthscore.service";
import { InsightsService } from "../src/services/insights.service";

import * as dashboardRoute from "../app/api/dashboard/route";
import * as portfolioRoute from "../app/api/portfolio/route";
import * as transactionsRoute from "../app/api/transactions/route";
import * as budgetRoute from "../app/api/budget/route";
import * as goalsRoute from "../app/api/goals/route";
import * as healthScoreRoute from "../app/api/health-score/route";
import * as netWorthRoute from "../app/api/net-worth/route";
import * as insightsRoute from "../app/api/insights/route";
import * as aiRoute from "../app/api/ai/route";

async function measure<T>(name: string, fn: () => Promise<T>, runs = 3): Promise<{ name: string; avgMs: number; minMs: number; maxMs: number }> {
  const times: number[] = [];
  // Warmup
  await fn();
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return {
    name,
    avgMs: Number(avg.toFixed(2)),
    minMs: Number(min.toFixed(2)),
    maxMs: Number(max.toFixed(2)),
  };
}

describe("Baseline Performance Measurements", () => {
  it("measures DB, service, and API route handler latencies", async () => {
    let user = await prisma.user.findFirst({
      where: { assets: { some: {} } },
      include: {
        _count: {
          select: { assets: true, transactions: true, budgets: true, goals: true },
        },
      },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        include: {
          _count: {
            select: { assets: true, transactions: true, budgets: true, goals: true },
          },
        },
      });
    }

    if (!user) {
      console.log("No user found in database");
      return;
    }

    vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue(user.id);

    console.log(`\n=== Baseline Performance Measurements ===`);
    console.log(`User ID: ${user.id} (${user.email})`);
    console.log(`Entities: Assets=${user._count.assets}, Transactions=${user._count.transactions}, Budgets=${user._count.budgets}, Goals=${user._count.goals}\n`);

    const serviceResults: any[] = [];
    serviceResults.push(await measure("DashboardService.getAggregatedData", () => DashboardService.getAggregatedData(user!.id)));
    serviceResults.push(await measure("AssetService.getPortfolioWithPL", () => AssetService.getPortfolioWithPL(user!.id)));
    serviceResults.push(await measure("PortfolioService.getAggregatedPortfolio", () => PortfolioService.getAggregatedPortfolio(user!.id)));
    serviceResults.push(await measure("PortfolioService.getAllocation", () => PortfolioService.getAllocation(user!.id)));
    serviceResults.push(await measure("PortfolioService.getRiskScore", () => PortfolioService.getRiskScore(user!.id)));
    serviceResults.push(await measure("PortfolioService.getPortfolioSummary", () => PortfolioService.getPortfolioSummary(user!.id)));
    serviceResults.push(await measure("PortfolioService.getRebalancePlan", () => PortfolioService.getRebalancePlan(user!.id)));
    serviceResults.push(await measure("NetWorthService.getCurrent", () => NetWorthService.getCurrent(user!.id)));
    serviceResults.push(await measure("HealthScoreService.compute", () => HealthScoreService.compute(user!.id)));
    serviceResults.push(await measure("TransactionService.list(100)", () => TransactionService.list(user!.id, { limit: 100 })));
    serviceResults.push(await measure("TransactionService.summarizeByMonth(6)", () => TransactionService.summarizeByMonth(user!.id, 6)));
    serviceResults.push(await measure("TransactionService.currentMonthTotals", () => TransactionService.currentMonthTotals(user!.id)));
    serviceResults.push(await measure("TransactionService.categorySplit", () => TransactionService.categorySplit(user!.id)));
    serviceResults.push(await measure("BudgetService.getUsage", () => BudgetService.getUsage(user!.id)));
    serviceResults.push(await measure("GoalService.getAllWithProgress", () => GoalService.getAllWithProgress(user!.id)));
    serviceResults.push(await measure("InsightsService.getLatest", () => InsightsService.getLatest(user!.id)));

    console.log("\n--- Service & DB Query Latency Results (5 runs) ---");
    console.table(serviceResults);

    const routeResults: any[] = [];
    routeResults.push(await measure("GET /api/dashboard", () => dashboardRoute.GET()));
    routeResults.push(await measure("GET /api/portfolio", () => portfolioRoute.GET()));
    routeResults.push(await measure("GET /api/transactions", () => transactionsRoute.GET(new NextRequest("http://localhost:3000/api/transactions"))));
    routeResults.push(await measure("GET /api/budget", () => budgetRoute.GET(new NextRequest("http://localhost:3000/api/budget"))));
    routeResults.push(await measure("GET /api/goals", () => goalsRoute.GET()));
    routeResults.push(await measure("GET /api/health-score", () => healthScoreRoute.GET()));
    routeResults.push(await measure("GET /api/net-worth", () => netWorthRoute.GET(new NextRequest("http://localhost:3000/api/net-worth"))));
    routeResults.push(await measure("GET /api/insights", () => insightsRoute.GET()));
    routeResults.push(await measure("GET /api/ai", () => aiRoute.GET()));

    console.log("\n--- API Route Handler Latency Results (3 runs) ---");
    console.table(routeResults);
  }, 180000);

  afterAll(() => {
    vi.restoreAllMocks();
  });
});
