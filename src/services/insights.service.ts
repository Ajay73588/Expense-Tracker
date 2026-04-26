import { prisma } from "../lib/prisma";
import { BudgetService } from "./budget.service";
import { PortfolioService } from "./portfolio.service";
import { GoalService } from "./goal.service";
import { HealthScoreService } from "./healthscore.service";
import type { Insight } from "../types";

/**
 * Rule-based insight engine. Scans the user's finances and produces
 * a prioritized feed of observations and nudges. This is the deterministic
 * fallback; AI enrichment layers on top in AIAdvisoryService.
 */
export const InsightsService = {
  async generate(userId: string): Promise<Insight[]> {
    const [budgets, rebalance, goals, health] = await Promise.all([
      BudgetService.getUsage(userId),
      PortfolioService.getRebalancePlan(userId),
      GoalService.getAllWithProgress(userId),
      HealthScoreService.compute(userId),
    ]);

    const insights: Insight[] = [];

    // Budget breaches
    for (const b of budgets) {
      if (b.status === "EXCEEDED") {
        insights.push({
          id: `budget-exceeded-${b.id}`,
          severity: "ALERT",
          title: `${b.category} budget exceeded`,
          body: `You've spent ₹${b.spent.toFixed(0)} against a ₹${b.monthlyLimit.toFixed(0)} limit this month.`,
          category: "budget",
        });
      } else if (b.status === "WARN") {
        insights.push({
          id: `budget-warn-${b.id}`,
          severity: "WARN",
          title: `${b.category} at ${b.usedPercent.toFixed(0)}% of budget`,
          body: `₹${b.remaining.toFixed(0)} remaining for this month. Pace yourself on ${b.category}.`,
          category: "budget",
        });
      }
    }

    // Portfolio drift
    for (const p of rebalance) {
      if (p.action !== "HOLD" && Math.abs(p.driftPct) >= 5) {
        insights.push({
          id: `drift-${p.assetType}`,
          severity: "WARN",
          title: `${p.assetType} drifted ${p.driftPct > 0 ? "above" : "below"} target`,
          body: `Current ${p.currentPct.toFixed(1)}% vs target ${p.targetPct.toFixed(1)}%. Consider ${p.action === "BUY" ? "adding" : "trimming"} ~₹${p.suggestedAmount.toFixed(0)}.`,
          category: "portfolio",
        });
      }
    }

    // Goals behind schedule
    for (const g of goals) {
      if (g.status === "ACTIVE" && !g.onTrack && g.progress < 100) {
        insights.push({
          id: `goal-behind-${g.id}`,
          severity: "INFO",
          title: `${g.name} needs attention`,
          body: `Currently at ${g.progress.toFixed(0)}% with ${g.monthsRemaining} months left. Monthly contribution needed: ₹${g.monthlyRequired.toFixed(0)}.`,
          category: "goals",
        });
      }
    }

    // Health score guidance
    if (health.breakdown.savingsRate.score === 0) {
      insights.push({
        id: "health-savings",
        severity: "WARN",
        title: "Savings rate below 10%",
        body: "Try automating an SIP or recurring deposit for at least 10% of your monthly income.",
        category: "health",
      });
    }
    if (health.breakdown.debtToIncome.score === 0) {
      insights.push({
        id: "health-dti",
        severity: "ALERT",
        title: "High debt-to-income ratio",
        body: "EMIs are consuming over 50% of income. Consider prepaying high-interest loans or restructuring.",
        category: "health",
      });
    }
    if (health.breakdown.investmentAllocation.score === 0) {
      insights.push({
        id: "health-invest",
        severity: "INFO",
        title: "Low invested allocation",
        body: "Less than 20% of your net worth is invested. Cash loses ~6% annually to inflation.",
        category: "health",
      });
    }

    // Sort by severity
    const order = { ALERT: 0, WARN: 1, INFO: 2 } as const;
    insights.sort((a, b) => order[a.severity] - order[b.severity]);
    return insights.slice(0, 10);
  },

  async getLatest(userId: string) {
    return InsightsService.generate(userId);
  },
};
