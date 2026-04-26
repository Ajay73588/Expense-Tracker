import { getCurrentUserId } from "@/lib/auth";
import { NetWorthService } from "@/services/networth.service";
import { TransactionService } from "@/services/transaction.service";
import { BudgetService } from "@/services/budget.service";
import { PortfolioService } from "@/services/portfolio.service";
import { HealthScoreService } from "@/services/healthscore.service";
import { GoalService } from "@/services/goal.service";
import { InsightsService } from "@/services/insights.service";
import { StatCard, Card, CardHeader } from "@/components/cards/Card";
import { NetWorthChart, IncomeExpenseChart, AllocationPie, HealthScoreRadial } from "@/components/charts/Charts";
import { formatINR, formatPercent } from "@/utils/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const [netWorth, monthly, budgets, allocation, healthScore, goals, insights, portfolio, currentMonth] =
    await Promise.all([
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

  const nwChange =
    netWorth.history.length >= 2
      ? ((netWorth.netWorth - netWorth.history[0].netWorth) / netWorth.history[0].netWorth) * 100
      : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Your complete financial picture, at a glance.</p>
        </div>
        <Link href="/ai" className="btn-primary">
          ✦ Ask AI Advisor
        </Link>
      </header>

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net Worth"
          value={formatINR(netWorth.netWorth, { compact: true })}
          change={`${nwChange >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(nwChange))} (90d)`}
          tone={nwChange >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="This Month Net"
          value={formatINR(currentMonth.net, { compact: true })}
          hint={`₹${currentMonth.income.toLocaleString("en-IN")} in · ₹${currentMonth.expense.toLocaleString("en-IN")} out`}
          tone={currentMonth.net >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Portfolio Value"
          value={formatINR(portfolio.currentValue, { compact: true })}
          change={`${portfolio.pnl >= 0 ? "▲" : "▼"} ${formatINR(Math.abs(portfolio.pnl), { compact: true })} (${formatPercent(portfolio.pnlPercent)})`}
          tone={portfolio.pnl >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Health Score"
          value={`${healthScore.total}/10`}
          hint={healthScore.rating.replace("_", " ")}
          tone={healthScore.total >= 7 ? "positive" : healthScore.total >= 4 ? "neutral" : "negative"}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Net Worth Trend" subtitle="Last 90 days" />
          <NetWorthChart data={netWorth.history} />
        </Card>

        <Card>
          <CardHeader title="Financial Health" subtitle={healthScore.rating.replace("_", " ")} />
          <HealthScoreRadial score={healthScore.total} />
          <div className="mt-4 space-y-1.5">
            {Object.entries(healthScore.breakdown).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="tabular-nums text-gray-300 font-medium">
                  {v.score}/2
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Income vs Expense" subtitle="Last 6 months" />
          <IncomeExpenseChart data={monthly} />
        </Card>

        <Card>
          <CardHeader title="Asset Allocation" subtitle={`${portfolio.assetCount} assets`} />
          <AllocationPie data={allocation} />
        </Card>

        <Card>
          <CardHeader title="Insights" subtitle={`${insights.length} active`} action={<Link href="/ai" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>} />
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {insights.slice(0, 5).map((i) => (
              <div key={i.id} className="p-3 bg-bg-hover/40 rounded-lg border border-bg-border">
                <div className="flex items-start gap-2">
                  <span
                    className={
                      i.severity === "ALERT"
                        ? "pill-negative"
                        : i.severity === "WARN"
                        ? "pill-warn"
                        : "pill-neutral"
                    }
                  >
                    {i.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200">{i.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{i.body}</div>
                  </div>
                </div>
              </div>
            ))}
            {insights.length === 0 && (
              <div className="text-xs text-gray-500 p-4 text-center">All clear. No active insights.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 4 - Budget + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Budgets" subtitle={`${budgets.length} categories`} action={<Link href="/budget" className="text-xs text-brand-400">Manage →</Link>} />
          <div className="space-y-3">
            {budgets.slice(0, 5).map((b) => (
              <div key={b.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-300">{b.category}</span>
                  <span className="tabular-nums text-xs text-gray-400">
                    {formatINR(b.spent, { compact: true })} / {formatINR(b.monthlyLimit, { compact: true })}
                  </span>
                </div>
                <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                  <div
                    className={
                      b.status === "EXCEEDED"
                        ? "h-full bg-negative"
                        : b.status === "WARN"
                        ? "h-full bg-warning"
                        : "h-full bg-positive"
                    }
                    style={{ width: `${Math.min(100, b.usedPercent)}%` }}
                  />
                </div>
              </div>
            ))}
            {budgets.length === 0 && (
              <div className="text-xs text-gray-500 p-4 text-center">
                No budgets yet.{" "}
                <Link href="/budget" className="text-brand-400">
                  Create one →
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Goals" subtitle={`${goals.filter((g) => g.status === "ACTIVE").length} active`} action={<Link href="/goals" className="text-xs text-brand-400">Manage →</Link>} />
          <div className="space-y-3">
            {goals.slice(0, 4).map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-300 truncate">{g.name}</span>
                  <span className="tabular-nums text-xs text-gray-400">
                    {g.progress.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, g.progress)}%` }} />
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {formatINR(g.currentAmount, { compact: true })} of {formatINR(g.targetAmount, { compact: true })} · {g.monthsRemaining}mo left
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
