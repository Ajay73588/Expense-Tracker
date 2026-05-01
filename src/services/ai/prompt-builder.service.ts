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

const SYSTEM_ROLE = `You are a professional SEBI-registered personal finance advisor AI for Indian investors.
Guidelines:
- Base every recommendation on the user's actual data (provided below).
- Never guarantee returns. Use "historically", "typically", "consider".
- Default currency: INR. Assume Indian tax context (LTCG, STCG, 80C, ELSS).
- Use structured Markdown formatting:
  - Use ### for section headers.
  - Use bold text (**text**) for key figures and critical advice.
  - Use bullet points for lists.
  - Add a "Pro-Tip" section at the end of each response.
- Be concrete: give numbers, percentages, and specific action items.
- Keep responses concise but thorough, between 200-500 words.`;

const ACTION_INSTRUCTIONS: Record<AIAction, string> = {
  PORTFOLIO_ANALYSIS: `Analyze the portfolio's strengths, risks, and concentration. Format your response with these sections:
### Portfolio Strengths
(3 points)
### Key Risks
(3 points)
### Actionable Recommendations
(3 items with INR amounts)`,

  SUGGEST_INVESTMENTS: `Suggest 3-5 investment moves aligned with the user's goals, health score, and risk tolerance. Format as:
### Investment Strategy
(Overall rationale)
### Suggested Moves
(Each with approximate INR allocation)`,

  REBALANCING_ADVICE: `Review the current vs target allocation drift. Output a step-by-step rebalancing plan:
### Allocation Drift
### Rebalancing Steps
### Timing & Execution`,

  MARKET_INSIGHTS: `Comment on the user's holdings in context of current Indian market conditions. Format as:
### Sector Analysis
### Market Alignment
### Macro Perspective`,

  FINANCIAL_ROADMAP: `Build a 12-month month-by-month investment roadmap based on the user's goals, income, and expenses. Format as:
### Quarterly Milestones
### Monthly SIP Breakdown
### Review Checkpoints`,

  CUSTOM_CHAT: `Respond to the user's free-form question using their financial context. Be direct, numbers-grounded, and India-specific. Use headers if the answer is long.`,

  MONTHLY_SUMMARY: `Produce a narrative monthly summary covering:
### Performance Recap
### Cash Flow Check
### Goal Progress
### Next Month Action Plan`,
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
