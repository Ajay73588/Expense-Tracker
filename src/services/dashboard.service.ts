import { cache } from "react";
import { NetWorthService } from "./networth.service";
import { TransactionService } from "./transaction.service";
import { BudgetService } from "./budget.service";
import { PortfolioService } from "./portfolio.service";
import { HealthScoreService } from "./healthscore.service";
import { GoalService } from "./goal.service";
import { InsightsService } from "./insights.service";
import { getCurrentUserId } from "../lib/auth";

export const DashboardService = {
  getAggregatedData: cache(async (userId: string) => {
    // We wrap all the expensive operations inside a React cache() so they are 
    // deduplicated if called multiple times in the same server request.
    const [
      netWorth,
      monthly,
      budgets,
      allocation,
      healthScore,
      goals,
      insights,
      portfolio,
      currentMonth,
    ] = await Promise.all([
      NetWorthService.getCurrent(userId),
      TransactionService.summarizeByMonth(userId, 6),
      BudgetService.getUsage(userId),
      PortfolioService.getAllocation(userId),
      HealthScoreService.compute(userId),
      GoalService.getAllWithProgress(userId),
      InsightsService.getLatest(userId),
      PortfolioService.getPortfolioSummary(userId),
      TransactionService.currentMonthTotals(userId),
    ]);

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
