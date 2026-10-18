import { createLogger } from "../../lib/logger";
import { NetWorthService } from "../networth.service";
import { PortfolioService } from "../portfolio.service";
import { TransactionService } from "../transaction.service";
import { GoalService } from "../goal.service";
import { HealthScoreService } from "../healthscore.service";
import { AssetService } from "../asset.service";
import { PromptBuilder, type FinancialContext } from "./prompt-builder.service";
import { NvidiaClient } from "./nvidia-client";
import { GeminiClient } from "./gemini-client";
import type { AIAction, PortfolioAllocation } from "../../types";
import { getCollection, createDoc } from "../../lib/firebase";

const log = createLogger("AIAdvisoryService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const COLLECTION = "aiConversations";
const QUERY_LIMIT = 50;

/** Build the full financial context used by every AI action. */
async function buildContext(userId: string): Promise<FinancialContext> {
  const [netWorth, alloc, risk, monthly, goals, health, assets, targets] = await Promise.all([
    NetWorthService.getCurrent(userId),
    PortfolioService.getAllocation(userId),
    PortfolioService.getRiskScore(userId),
    TransactionService.currentMonthTotals(userId),
    GoalService.getAllWithProgress(userId),
    HealthScoreService.compute(userId),
    AssetService.getPortfolioWithPL(userId),
    PortfolioService.getAllocationTargets(userId),
  ]);

  let rebalancePlanData = undefined;
  if (targets.length > 0) {
    try {
      const plan = await PortfolioService.getComprehensiveRebalancePlan(
        userId,
        { mode: "CASH_ONLY" },
        { assets, targets }
      );
      if (plan.ok) {
        rebalancePlanData = {
          mode: plan.mode,
          items: plan.items.map((i) => ({
            assetType: i.assetType,
            currentPct: i.currentPct,
            targetPct: i.targetPct,
            driftPct: i.driftPct,
            action: i.action,
            suggestedAmount: i.suggestedAmount,
          })),
          residualCash: plan.residualCash,
          warnings: plan.warnings,
        };
      }
    } catch (err: any) {
      log.warn("ai.advisor.rebalancePlanFailed", { userId, error: err?.message });
    }
  }

  const topHoldings = [...assets]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((a) => ({ name: a.name, value: a.currentValue, pnlPercent: a.pnlPercent }));

  return {
    netWorth: {
      total: netWorth.netWorth,
    },
    portfolio: {
      allocation: alloc.map((a: PortfolioAllocation) => ({
        assetType: a.assetType,
        percent: a.percent,
        value: a.value,
      })),
      topHoldings,
      riskScore: risk,
    },
    cashFlow: {
      savingsRate: monthly.income > 0 ? ((monthly.income - monthly.expense) / monthly.income) * 100 : 0,
      income: monthly.income,
      expenses: monthly.expense,
    },
    goals: goals.map((g: any) => ({
      name: g.name,
      progress: g.progress,
      target: g.targetAmount,
      deadline: new Date(g.targetDate).toISOString().slice(0, 10),
    })),
    healthScore: {
      total: health.total,
    },
    rebalancePlan: rebalancePlanData,
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
    recs.push(`Move ₹${Math.round(ctx.netWorth.total * 0.1).toLocaleString("en-IN")} from cash into a liquid/short-duration debt fund.`);
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
    "_Note: This is a rule-based analysis. Configure NVIDIA_NIM_API_KEY for full AI-driven insights._",
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

  if (ctx.rebalancePlan && ctx.rebalancePlan.items.length > 0) {
    const actions = ctx.rebalancePlan.items.map((i) => {
      if (i.action === "HOLD") {
        return `- **${i.assetType}**: HOLD (${i.currentPct.toFixed(1)}% vs target ${i.targetPct.toFixed(1)}%, drift ${i.driftPct > 0 ? "+" : ""}${i.driftPct.toFixed(1)}%)`;
      }
      return `- **${i.assetType}**: **${i.action}** ₹${Math.round(i.suggestedAmount).toLocaleString("en-IN")} (${i.currentPct.toFixed(1)}% vs target ${i.targetPct.toFixed(1)}%, drift ${i.driftPct > 0 ? "+" : ""}${i.driftPct.toFixed(1)}%)`;
    });

    const lines = [
      "### Deterministic Portfolio Rebalance Plan",
      `_Mode: ${ctx.rebalancePlan.mode === "CASH_ONLY" ? "Cash-only (no sells recommended)" : "Balanced"} (Deterministic Rule Engine)_`,
      "",
      "**Current Allocation & Drift:**",
      ...actions,
      "",
      "**Rebalancing Guidance:**",
      "- Target allocations are evaluated with a 5% drift threshold band.",
      "- Suggested amounts are computed deterministically based on your portfolio value.",
      "- Taxes (STCG/LTCG), exit loads, and lot constraints are not modeled — verify before execution.",
    ];

    if (ctx.rebalancePlan.warnings && ctx.rebalancePlan.warnings.length > 0) {
      lines.push("", "**Notices:**", ...ctx.rebalancePlan.warnings.map((w) => `- ${w}`));
    }

    return lines.join("\n");
  }

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
    "### 12-Month Financial Roadmap (Rule-Based)",
    `**12-month roadmap** (monthly surplus: ₹${Math.round(surplus).toLocaleString("en-IN")})`,
    "",
    "- **Months 1-3:** Build/top-up emergency fund to 6× expenses. Review all SIPs.",
    "- **Months 4-6:** Maximize 80C (ELSS + PPF + EPF) up to ₹1.5L. Start/increase index SIP.",
    "- **Months 7-9:** Review goal progress; redirect bonuses toward underfunded goals.",
    "- **Months 10-12:** Harvest LTCG up to ₹1L annual exemption. Rebalance toward targets.",
    "",
    "_Timing and amounts are indicative. Rule engine fallback active (NVIDIA NIM not used)._",
  ].join("\n");
}

function fallbackMonthly(ctx: FinancialContext): string {
  const { cashFlow, netWorth, healthScore } = ctx;
  return [
    "### Monthly Summary (Rule-Based)",
    "_Note: Generated from recorded cash flow and current net worth. NVIDIA NIM was not used._",
    "",
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

function fallbackCustom(ctx: FinancialContext, userMessage: string, errorCode?: string): string {
  const msg = userMessage.toLowerCase().trim();
  // Supported local deterministic calculations
  if (/portfolio|allocation|holding/.test(msg)) return fallbackPortfolioAnalysis(ctx);
  if (/invest|sip|where.*put/.test(msg)) return fallbackSuggestInvestments(ctx);
  if (/rebalanc/.test(msg)) return fallbackRebalancing(ctx);
  if (/roadmap|plan/.test(msg)) return fallbackRoadmap(ctx);
  if (/summary|month|recap|report/.test(msg)) return fallbackMonthly(ctx);
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

  // General questions that cannot be computed locally: provide a clear status and guidance
  const reasonText =
    errorCode === "NOT_CONFIGURED"
      ? "NVIDIA_NIM_API_KEY is not configured"
      : errorCode === "AUTH_ERROR"
      ? "NVIDIA NIM API credentials invalid or unauthorized"
      : errorCode === "SERVICE_UNAVAILABLE"
      ? "NVIDIA NIM service temporarily overloaded (HTTP 503)"
      : errorCode === "RATE_LIMIT"
      ? "NVIDIA NIM rate limit or quota exceeded"
      : errorCode === "TIMEOUT"
      ? "NVIDIA NIM request timed out"
      : errorCode === "MODEL_ERROR"
      ? "Configured NVIDIA NIM model is unavailable"
      : errorCode === "INVALID_REQUEST"
      ? "Invalid request parameter or payload"
      : "AI service temporarily unavailable";

  return [
    "### AI Advisor Temporarily Unavailable",
    `We could not generate a real-time AI response for your inquiry (${reasonText}).`,
    "",
    "**What you can do:**",
    "- Check back shortly or retry your question.",
    "- Ask about portfolio analysis, investment suggestions, rebalancing, or goals to use local calculations.",
    "",
    `_Note: Fallback engine active (${errorCode ?? "UNKNOWN"}). NVIDIA NIM was not used._`,
  ].join("\n");
}

function fallbackFor(action: AIAction, ctx: FinancialContext, userMessage?: string, errorCode?: string): string {
  switch (action) {
    case "PORTFOLIO_ANALYSIS":
      return fallbackPortfolioAnalysis(ctx);
    case "SUGGEST_INVESTMENTS":
      return fallbackSuggestInvestments(ctx);
    case "REBALANCING_ADVICE":
      return fallbackRebalancing(ctx);
    case "MARKET_INSIGHTS":
      return "Market insights require live financial intelligence; in fallback mode, see Portfolio Analysis for a data-driven take on your holdings (NVIDIA NIM bypassed).";
    case "FINANCIAL_ROADMAP":
      return fallbackRoadmap(ctx);
    case "MONTHLY_SUMMARY":
      return fallbackMonthly(ctx);
    case "CUSTOM_CHAT":
      return fallbackCustom(ctx, userMessage ?? "", errorCode);
  }
}

export interface AIAdvisoryResult {
  response: string;
  source: "ai" | "fallback";
  durationMs: number;
  provider: "nvidia" | "rule-engine" | "gemini" | string;
  fallbackReason?: string;
  model?: string;
  retryAfterMs?: number | null;
  isDailyQuota?: boolean;
}

export const AIAdvisoryService = {
  async runAction(
    userId: string,
    action: AIAction,
    opts: {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      overrideClient?: typeof NvidiaClient;
    } = {}
  ): Promise<AIAdvisoryResult> {
    const context = await buildContext(userId);
    const generatedMessages = PromptBuilder.build(action, context, opts.message);
    const start = Date.now();

    // Include history if present, skipping the system/context messages which we just generated
    const fullPrompt = opts.history && opts.history.length > 0 
      ? [generatedMessages[0], ...opts.history, ...generatedMessages.slice(1)]
      : generatedMessages;

    let response: string;
    let source: "ai" | "fallback" = "ai";
    let fallbackReason: string | undefined = undefined;
    let modelUsed: string | undefined = undefined;
    let retryAfterMs: number | null | undefined = undefined;
    let isDailyQuota: boolean | undefined = undefined;

    const client = opts.overrideClient ?? NvidiaClient;
    const completion = await client.complete({
      messages: fullPrompt,
      feature: "advisor",
    });

    if (completion.ok) {
      response = completion.text;
      source = "ai";
      modelUsed = completion.model;
    } else {
      response = fallbackFor(action, context, opts.message, completion.code);
      source = "fallback";
      fallbackReason = completion.code;
      modelUsed = undefined;
      retryAfterMs = completion.retryAfterMs;
      isDailyQuota = completion.code === "RATE_LIMIT";
    }

    const durationMs = Date.now() - start;
    log.info("ai.advisor.resolved", {
      userId,
      action,
      source,
      provider: source === "ai" ? "nvidia" : "rule-engine",
      model: modelUsed || "rule-engine",
      fallbackReason,
      durationMs,
    });

    // Persist conversation history
    const history = opts.history ?? [];
    const messages = [
      ...history,
      ...(opts.message ? [{ role: "user" as const, content: opts.message }] : []),
      { role: "assistant" as const, content: response },
    ];

    if (USE_FIREBASE) {
      await createDoc(COLLECTION, {
        userId,
        action,
        messages: JSON.stringify(messages),
        contextSnapshot: JSON.stringify(context),
        createdAt: new Date()
      });
    } else {
      const { prisma } = await import("../../lib/prisma");
      await prisma.aIConversation.create({
        data: {
          userId,
          action,
          messages: JSON.stringify(messages),
          contextSnapshot: JSON.stringify(context),
        },
      });
    }

    return {
      response,
      source,
      durationMs,
      provider: source === "ai" ? "nvidia" : "rule-engine",
      fallbackReason,
      model: modelUsed,
      retryAfterMs,
      isDailyQuota,
    };
  },

  async getHistory(userId: string, limit = 20) {
    let rows: any[] = [];
    if (USE_FIREBASE) {
      try {
        // Single where(userId) + orderBy(createdAt) requires a 2-field composite index.
        // Wrapped in try/catch — falls back to unordered fetch + JS sort if index is missing.
        const db = getCollection(COLLECTION);
        let snapshot: FirebaseFirestore.QuerySnapshot;
        try {
          snapshot = await db
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        } catch (indexErr: any) {
          // Index not yet created — fall back to unordered fetch, sort in JS
          log.warn("ai.getHistory.firebase.index-missing", {
            userId,
            error: indexErr?.message ?? String(indexErr),
            fallback: "fetching without orderBy, sorting in JS",
          });
          snapshot = await db
            .where("userId", "==", userId)
            .limit(QUERY_LIMIT)
            .get();
        }

        rows = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate
              ? doc.data().createdAt.toDate()
              : new Date(doc.data().createdAt),
          }))
          .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, limit);

        log.info("ai.getHistory.firebase", { userId, count: rows.length });
      } catch (error: any) {
        log.error("ai.getHistory.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
          fallback: "returning empty history",
        });
        return [];
      }
    } else {
      const { prisma } = await import("../../lib/prisma");
      rows = await prisma.aIConversation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    }

    return rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      createdAt: r.createdAt,
      messages: JSON.parse(r.messages) as { role: string; content: string }[],
    }));
  },

  getProviderHealth() {
    const isNvidiaConfigured = NvidiaClient.isConfigured("advisor");
    const isGeminiConfigured = GeminiClient.isConfigured();
    return {
      configured: isNvidiaConfigured || isGeminiConfigured,
      primary: isNvidiaConfigured ? "nvidia" : isGeminiConfigured ? "gemini" : "none",
      nvidia: isNvidiaConfigured,
      gemini: isGeminiConfigured,
    };
  },
};

