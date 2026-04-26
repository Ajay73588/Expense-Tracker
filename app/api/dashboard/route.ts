import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { NetWorthService } from "@/services/networth.service";
import { TransactionService } from "@/services/transaction.service";
import { BudgetService } from "@/services/budget.service";
import { PortfolioService } from "@/services/portfolio.service";
import { HealthScoreService } from "@/services/healthscore.service";
import { GoalService } from "@/services/goal.service";
import { InsightsService } from "@/services/insights.service";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    // Parallel fetch — matches the architecture doc's dashboard flow.
    const [netWorth, monthly, budgets, allocation, healthScore, goals, insights, portfolio] =
      await Promise.all([
        NetWorthService.getCurrent(userId),
        TransactionService.summarizeByMonth(userId, 6),
        BudgetService.getUsage(userId),
        PortfolioService.getAllocation(userId),
        HealthScoreService.compute(userId),
        GoalService.getAllWithProgress(userId),
        InsightsService.getLatest(userId),
        PortfolioService.getPortfolioSummary(userId),
      ]);
    return ok({
      netWorth,
      monthly,
      budgets,
      allocation,
      healthScore,
      goals,
      insights,
      portfolio,
    });
  } catch (err) {
    return handleError(err);
  }
}
