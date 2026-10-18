import { safeCache as cache } from "../lib/safe-cache";
import { NetWorthService } from "./networth.service";
import { TransactionService } from "./transaction.service";
import { BudgetService } from "./budget.service";
import { PortfolioService } from "./portfolio.service";
import { HealthScoreService } from "./healthscore.service";
import { GoalService } from "./goal.service";
import { InsightsService } from "./insights.service";
import { AssetService } from "./asset.service";

export const DashboardService = {
  getAggregatedData: cache(async (userId: string) => {
    const USE_FIREBASE = process.env.USE_FIREBASE === "true";

    // 1. Fetch core independent data in parallel (single query per entity):
    const [
      netWorth,
      monthly,
      budgets,
      assets,
      goals,
      currentMonth,
      targets,
      liabilities,
    ] = await Promise.all([
      NetWorthService.getCurrent(userId),
      TransactionService.summarizeByMonth(userId, 6),
      BudgetService.getUsage(userId),
      AssetService.getPortfolioWithPL(userId),
      GoalService.getAllWithProgress(userId),
      TransactionService.currentMonthTotals(userId),
      PortfolioService.getAllocationTargets(userId),
      USE_FIREBASE
        ? Promise.resolve([])
        : import("../lib/prisma").then((p) => p.prisma.liability.findMany({ where: { userId } })),
    ]);

    // 2. Compute allocation & portfolio summaries in-memory from loaded assets:
    const allocation = await PortfolioService.getAllocation(userId, assets);
    const portfolio = await PortfolioService.getPortfolioSummary(userId, assets);
    const rebalance = await PortfolioService.getRebalancePlan(userId, 5, { allocation, targets });

    // 3. Compute health score in-memory using the preloaded data:
    const monthly3 = monthly.slice(0, 3);
    const goalAvgProgress = goals.length
      ? goals.reduce((s, g) => s + (g.progress ?? 0), 0) / goals.length
      : 100;
    const healthScore = await HealthScoreService.compute(userId, {
      monthly: monthly3,
      netWorth,
      portfolioAlloc: allocation,
      goalProgress: goalAvgProgress,
      liabilities,
    });

    // 4. Compute insights in-memory using the preloaded data:
    const insights = await InsightsService.generate(userId, {
      budgets,
      rebalance,
      goals,
      health: healthScore,
    });

    return {
      netWorth,
      monthly,
      budgets,
      allocation,
      healthScore,
      goals,
      insights,
      portfolio,
      currentMonth,
    };
  }),
};
