import { prisma } from "../../lib/prisma";
import { createLogger } from "../../lib/logger";
import { NetWorthService } from "../networth.service";
import { PortfolioService } from "../portfolio.service";
import { TransactionService } from "../transaction.service";
import { GoalService } from "../goal.service";
import { HealthScoreService } from "../healthscore.service";
import { AssetService } from "../asset.service";
import { PromptBuilder, type FinancialContext } from "./prompt-builder.service";
import { MinimaxClient } from "./minimax-client";
import type { AIAction } from "../../types";

const log = createLogger("AIAdvisoryService");

/** Build the full financial context used by every AI action. */
async function buildContext(userId: string): Promise<FinancialContext> {
  const [netWorth, alloc, risk, monthly, goals, health, assets] = await Promise.all([
    NetWorthService.getCurrent(userId),
    PortfolioService.getAllocation(userId),
    PortfolioService.getRiskScore(userId),
    TransactionService.currentMonthTotals(userId),
    GoalService.getAllWithProgress(userId),
    HealthScoreService.compute(userId),
    AssetService.getPortfolioWithPL(userId),
  ]);

  const topHoldings = [...assets]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((a) => ({ name: a.name, value: a.currentValue, pnlPercent: a.pnlPercent }));

  return {
    netWorth: {
      total: netWorth.netWorth,
      assets: netWorth.totalAssets,
      liabilities: netWorth.totalLiabilities,
    },
    portfolio: {
      allocation: alloc.map((a) => ({
        assetType: a.assetType,
        value: a.value,
        percent: a.percent,
      })),
      topHoldings,
      riskScore: risk,
    },
    cashFlow: {
      income: monthly.income,
      expenses: monthly.expense,
      savingsRate: monthly.income > 0 ? ((monthly.income - monthly.expense) / monthly.income) * 100 : 0,
    },
    goals: goals.map((g) => ({
      name: g.name,
      target: g.targetAmount,
      current: g.currentAmount,
      progress: g.progress,
      deadline: g.targetDate.toISOString().slice(0, 10),
    })),
    healthScore: {
      total: health.total,
      breakdown: Object.fromEntries(
        Object.entries(health.breakdown).map(([k, v]) => [k, v.score])
      ),
    },
  };
}

// ---------- Rule-based fallback generators ----------

function fallbackPortfolioAnalysis(ctx: FinancialContext): string {
  const { portfolio, healthScore, cashFlow } = ctx;
  const stockPct = portfolio.allocation.find((a) => a.assetType === "STOCK")?.percent ?? 0;
  const cryptoPct = portfolio.allocation.find((a) => a.assetType === "CRYPTO")?.percent ?? 0;
  const cashPct = portfolio.allocation.find((a) => a.assetType === "CASH")?.percent ?? 0;

  const strengths: string[] = [];
  const risks: string[] = [];
  const recs: string[] = [];

  if (portfolio.allocation.length >= 3) strengths.push("Diversified across 3+ asset classes.");
  if (cashFlow.savingsRate > 20) strengths.push(`Strong savings rate of ${cashFlow.savingsRate.toFixed(0)}%.`);
  if (healthScore.total >= 7) strengths.push(`Healthy overall score of ${healthScore.total}/10.`);
  if (strengths.length === 0) strengths.push("Good that you're tracking your finances in one place.");

  if (cryptoPct > 15) risks.push(`Crypto at ${cryptoPct.toFixed(0)}% is aggressive — consider capping at 5-10%.`);
  if (cashPct > 30) risks.push(`${cashPct.toFixed(0)}% cash is losing ~6%/yr to inflation.`);
  if (stockPct > 70) risks.push(`Equity concentration of ${stockPct.toFixed(0)}% exposes you to market cycles.`);
  if (portfolio.riskScore >= 7) risks.push(`Portfolio risk score ${portfolio.riskScore}/10 is on the higher end.`);
  if (risks.length === 0) risks.push("No immediate red flags, but review quarterly.");

  if (cashPct > 20)
    recs.push(`Move ₹${Math.round(ctx.netWorth.assets * 0.1).toLocaleString("en-IN")} from cash into a liquid/short-duration debt fund.`);
  if (cryptoPct > 10)
    recs.push(`Trim crypto exposure back to 5-10% over the next 2-3 months.`);
  if (ctx.goals.some((g) => g.progress < 50))
    recs.push("Increase SIP allocation toward goals that are below 50% progress.");
  if (recs.length === 0) recs.push("Keep investing consistently; review allocation targets every quarter.");

  return [
    "**Strengths**",
    ...strengths.map((s) => `- ${s}`),
    "",
    "**Risks**",
    ...risks.map((s) => `- ${s}`),
    "",
    "**Recommendations**",
    ...recs.map((s) => `- ${s}`),
    "",
    "_Note: This is a rule-based analysis. Connect a Minimax API key for full AI-driven insights._",
  ].join("\n");
}

function fallbackSuggestInvestments(ctx: FinancialContext): string {
  const lines: string[] = ["Based on your current financial picture, here are suggested moves:", ""];
  const canInvest = Math.max(0, ctx.cashFlow.income - ctx.cashFlow.expenses) * 0.6;
  const monthly = Math.round(canInvest);

  if (ctx.healthScore.total < 6) {
    lines.push(`1. **Build emergency fund first** — park ₹${Math.round(ctx.cashFlow.expenses * 6).toLocaleString("en-IN")} (6 months expenses) in a liquid fund before increasing risk.`);
  }
  lines.push(`2. **Index SIP** — start/increase a Nifty 50 index fund SIP at ₹${Math.round(monthly * 0.5).toLocaleString("en-IN")}/month for long-term compounding.`);
  lines.push(`3. **ELSS for tax + equity** — up to ₹1.5L/year under 80C via an ELSS fund covers tax and equity exposure.`);
  if (ctx.portfolio.allocation.find((a) => a.assetType === "CRYPTO")?.percent ?? 0 < 5) {
    lines.push(`4. **Small crypto allocation** — cap at 3-5% of portfolio via a regulated Indian exchange.`);
  }
  lines.push(`5. **Debt fund for stability** — allocate ₹${Math.round(monthly * 0.2).toLocaleString("en-IN")}/month to a short-duration debt fund for ballast.`);
  lines.push("", "_Rule-based suggestions. Your actual choice depends on risk tolerance and timeline._");
  return lines.join("\n");
}

function fallbackRebalancing(ctx: FinancialContext): string {
  const alloc = ctx.portfolio.allocation.map(
    (a) => `- ${a.assetType}: ${a.percent.toFixed(1)}% (₹${a.value.toLocaleString("en-IN")})`
  );
  return [
    "**Current allocation:**",
    ...alloc,
    "",
    "**Rebalancing guidance:**",
    "- Set allocation targets on the Portfolio page for precise rebalancing advice.",
    "- As a rule of thumb: equity % ≈ 100 − your age.",
    "- Rebalance when any asset class drifts >5% from target.",
    "",
    "_Configure AllocationTarget entries to get a specific rebalance plan._",
  ].join("\n");
}

function fallbackRoadmap(ctx: FinancialContext): string {
  const surplus = Math.max(0, ctx.cashFlow.income - ctx.cashFlow.expenses);
  return [
    `**12-month roadmap** (monthly surplus: ₹${Math.round(surplus).toLocaleString("en-IN")})`,
    "",
    "- **Months 1-3:** Build/top-up emergency fund to 6× expenses. Review all SIPs.",
    "- **Months 4-6:** Maximize 80C (ELSS + PPF + EPF) up to ₹1.5L. Start/increase index SIP.",
    "- **Months 7-9:** Review goal progress; redirect bonuses toward underfunded goals.",
    "- **Months 10-12:** Harvest LTCG up to ₹1L annual exemption. Rebalance toward targets.",
    "",
    "_Timing and amounts are indicative. Adjust based on your goal deadlines and income stability._",
  ].join("\n");
}

function fallbackMonthly(ctx: FinancialContext): string {
  const { cashFlow, netWorth, healthScore } = ctx;
  return [
    "**This month at a glance**",
    `- Income: ₹${cashFlow.income.toLocaleString("en-IN")}`,
    `- Expenses: ₹${cashFlow.expenses.toLocaleString("en-IN")}`,
    `- Net: ₹${(cashFlow.income - cashFlow.expenses).toLocaleString("en-IN")}`,
    `- Net worth: ₹${netWorth.total.toLocaleString("en-IN")}`,
    `- Health score: ${healthScore.total}/10`,
    "",
    "**Action items for next month:**",
    "- Review any budget categories that exceeded their limit.",
    "- Top up contributions to the lowest-progress goal.",
    "- Rebalance any asset class drifted >5% from target.",
  ].join("\n");
}

function fallbackCustom(ctx: FinancialContext, userMessage: string): string {
  const msg = userMessage.toLowerCase();
  // Best-effort intent routing
  if (/portfolio|allocation|holding/.test(msg)) return fallbackPortfolioAnalysis(ctx);
  if (/invest|sip|where.*put/.test(msg)) return fallbackSuggestInvestments(ctx);
  if (/rebalanc/.test(msg)) return fallbackRebalancing(ctx);
  if (/roadmap|plan|month/.test(msg)) return fallbackRoadmap(ctx);
  if (/summary|month|report/.test(msg)) return fallbackMonthly(ctx);
  if (/goal/.test(msg)) {
    const behind = ctx.goals.filter((g) => g.progress < 50);
    if (behind.length === 0) return "All your active goals are over 50% progress — good shape. Keep contributing monthly.";
    return [
      `You have ${behind.length} goal(s) under 50% progress:`,
      ...behind.map(
        (g) => `- **${g.name}**: ${g.progress.toFixed(0)}% of ₹${g.target.toLocaleString("en-IN")} by ${g.deadline}`
      ),
    ].join("\n");
  }
  if (/health|score/.test(msg)) {
    return `Your current financial health score is **${ctx.healthScore.total}/10**. The biggest lever is usually savings rate — aim for >20% of income.`;
  }
  // Generic
  return [
    "Here's your current financial snapshot:",
    `- Net worth: ₹${ctx.netWorth.total.toLocaleString("en-IN")}`,
    `- Savings rate: ${ctx.cashFlow.savingsRate.toFixed(1)}%`,
    `- Health score: ${ctx.healthScore.total}/10`,
    `- Risk score: ${ctx.portfolio.riskScore}/10`,
    "",
    "Ask me about: portfolio analysis, investment suggestions, rebalancing, goals, or a 12-month roadmap.",
  ].join("\n");
}

function fallbackFor(action: AIAction, ctx: FinancialContext, userMessage?: string): string {
  switch (action) {
    case "PORTFOLIO_ANALYSIS":
      return fallbackPortfolioAnalysis(ctx);
    case "SUGGEST_INVESTMENTS":
      return fallbackSuggestInvestments(ctx);
    case "REBALANCING_ADVICE":
      return fallbackRebalancing(ctx);
    case "MARKET_INSIGHTS":
      return "Market insights require a live news feed; in fallback mode, see Portfolio Analysis for a data-driven take on your holdings.";
    case "FINANCIAL_ROADMAP":
      return fallbackRoadmap(ctx);
    case "MONTHLY_SUMMARY":
      return fallbackMonthly(ctx);
    case "CUSTOM_CHAT":
      return fallbackCustom(ctx, userMessage ?? "");
  }
}

export const AIAdvisoryService = {
  async runAction(
    userId: string,
    action: AIAction,
    opts: { message?: string; history?: { role: "user" | "assistant"; content: string }[] } = {}
  ) {
    const context = await buildContext(userId);
    const prompt = PromptBuilder.build(action, context, opts.message);
    const start = Date.now();

    let response = await MinimaxClient.complete(prompt);
    let source: "ai" | "fallback" = "ai";
    if (!response) {
      response = fallbackFor(action, context, opts.message);
      source = "fallback";
    }

    const durationMs = Date.now() - start;
    log.info("ai.action", { userId, action, source, durationMs });

    // Persist conversation history
    const history = opts.history ?? [];
    const messages = [
      ...history,
      ...(opts.message ? [{ role: "user" as const, content: opts.message }] : []),
      { role: "assistant" as const, content: response },
    ];

    await prisma.aIConversation.create({
      data: {
        userId,
        action,
        messages: JSON.stringify(messages),
        contextSnapshot: JSON.stringify(context),
      },
    });

    return { response, source, durationMs };
  },

  async getHistory(userId: string, limit = 20) {
    const rows = await prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.createdAt,
      messages: JSON.parse(r.messages) as { role: string; content: string }[],
    }));
  },
};
