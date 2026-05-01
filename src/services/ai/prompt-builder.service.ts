import type { AIAction } from "../../types";

export interface FinancialContext {
  netWorth: { total: number }; // Only keep total to reduce tokens
  portfolio: {
    allocation: { assetType: string; percent: number; value: number }[];
    topHoldings: { name: string; pnlPercent: number }[];
    riskScore: number;
  };
  cashFlow: { savingsRate: number; income: number; expenses: number }; // Just the rate + totals
  goals: { name: string; progress: number; target: number; deadline: string }[];
  healthScore: { total: number }; // Overall score only
}

const SYSTEM_ROLE = `You are a SEBI-registered personal finance advisor AI for Indian investors.
Guidelines:
- Base every recommendation on the user's actual data (provided below).
- Never guarantee returns. Use "historically", "typically", "consider".
- Default currency: INR. Assume Indian tax context (LTCG, STCG, 80C, ELSS).
- Be concrete: give numbers, percentages, and specific action items.
- Keep responses under 400 words unless the user asks for detail.`;

const ACTION_INSTRUCTIONS: Record<AIAction, string> = {
  PORTFOLIO_ANALYSIS: `Analyze the portfolio's strengths, risks, and concentration. Return:
- 3 strengths (what's working)
- 3 risks (what to watch)
- 3 actionable recommendations with INR amounts`,

  SUGGEST_INVESTMENTS: `Suggest 3-5 investment moves aligned with the user's goals, health score, and risk tolerance. Each with rationale and approximate INR allocation.`,

  REBALANCING_ADVICE: `Review the current vs target allocation drift. Output a step-by-step rebalancing plan: which assets to buy/sell, approximate INR amounts, suggested timing.`,

  MARKET_INSIGHTS: `Comment on the user's holdings in context of current Indian market conditions. Focus on sector exposure, overweight/underweight positions, and macro factors.`,

  FINANCIAL_ROADMAP: `Build a 12-month month-by-month investment roadmap based on the user's goals, income, and expenses. Include SIP amounts, goal milestones, and review checkpoints.`,

  CUSTOM_CHAT: `Respond to the user's free-form question using their financial context. Be direct, numbers-grounded, and India-specific.`,

  MONTHLY_SUMMARY: `Produce a narrative monthly summary covering: cash flow, portfolio movement, goal progress, and 3 action items for next month.`,
};

export const PromptBuilder = {
  build(action: AIAction, context: FinancialContext, userMessage?: string): { role: string; content: string }[] {
    const messages = [];
    
    messages.push({
      role: "system",
      content: SYSTEM_ROLE
    });

    messages.push({
      role: "user",
      content: `## FINANCIAL CONTEXT\n${JSON.stringify(context)}\n\n## TASK\n${ACTION_INSTRUCTIONS[action]}`
    });

    if (userMessage) {
      messages.push({
        role: "user",
        content: `## USER MESSAGE\n${userMessage}`
      });
    }

    return messages;
  },
};
