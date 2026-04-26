import { prisma } from "../lib/prisma";
import { TransactionService } from "./transaction.service";
import { NetWorthService } from "./networth.service";
import { PortfolioService } from "./portfolio.service";
import { GoalService } from "./goal.service";
import type { HealthScore } from "../types";

/**
 * 5-dimension weighted health score (0-10).
 * Each dimension returns a 0-2 sub-score per the architecture doc.
 */
export const HealthScoreService = {
  async compute(userId: string): Promise<HealthScore> {
    const [monthly, netWorth, portfolioAlloc, goalProgress, liabilities] = await Promise.all([
      TransactionService.summarizeByMonth(userId, 3),
      NetWorthService.getCurrent(userId),
      PortfolioService.getAllocation(userId),
      GoalService.getAvgProgress(userId),
      prisma.liability.findMany({ where: { userId } }),
    ]);

    // --- Dimension 1: Savings Rate ---
    const avgIncome = monthly.reduce((s, m) => s + m.income, 0) / Math.max(1, monthly.length);
    const avgExpense = monthly.reduce((s, m) => s + m.expense, 0) / Math.max(1, monthly.length);
    const savingsRatePct = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : 0;
    const savingsScore = savingsRatePct > 20 ? 2 : savingsRatePct >= 10 ? 1 : 0;

    // --- Dimension 2: Debt-to-Income ---
    const monthlyEMI = liabilities.reduce((s, l) => s + (l.monthlyEMI ?? 0), 0);
    const dtiPct = avgIncome > 0 ? (monthlyEMI / avgIncome) * 100 : 0;
    const dtiScore = dtiPct < 30 ? 2 : dtiPct <= 50 ? 1 : 0;

    // --- Dimension 3: Investment Allocation ---
    const invested = portfolioAlloc
      .filter((a) => a.assetType !== "CASH")
      .reduce((s, a) => s + a.value, 0);
    const investmentRatio =
      netWorth.totalAssets > 0 ? (invested / netWorth.totalAssets) * 100 : 0;
    const investmentScore = investmentRatio > 40 ? 2 : investmentRatio >= 20 ? 1 : 0;

    // --- Dimension 4: Goal Progress ---
    const goalPct = goalProgress * 100;
    const goalScore = goalPct > 70 ? 2 : goalPct >= 40 ? 1 : 0;

    // --- Dimension 5: Portfolio Diversification ---
    const divRaw = await PortfolioService.getDiversificationScore(userId);
    const divScore = divRaw >= 0.8 ? 2 : divRaw >= 0.5 ? 1 : 0;

    const total = savingsScore + dtiScore + investmentScore + goalScore + divScore;
    const rating =
      total >= 8 ? "EXCELLENT" : total >= 6 ? "GOOD" : total >= 4 ? "FAIR" : "NEEDS_WORK";

    return {
      total,
      max: 10,
      rating,
      breakdown: {
        savingsRate: {
          score: savingsScore,
          value: savingsRatePct,
          label: `${savingsRatePct.toFixed(1)}% of income saved`,
        },
        debtToIncome: {
          score: dtiScore,
          value: dtiPct,
          label: `${dtiPct.toFixed(1)}% of income to EMIs`,
        },
        investmentAllocation: {
          score: investmentScore,
          value: investmentRatio,
          label: `${investmentRatio.toFixed(1)}% of assets invested`,
        },
        goalProgress: {
          score: goalScore,
          value: goalPct,
          label: `${goalPct.toFixed(1)}% avg goal progress`,
        },
        diversification: {
          score: divScore,
          value: divRaw * 100,
          label: `${(divRaw * 100).toFixed(0)}% allocation fit`,
        },
      },
    };
  },
};
