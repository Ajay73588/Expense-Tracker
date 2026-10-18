import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GeminiClient,
  DEFAULT_MODEL,
  classifyGeminiError,
  formatGeminiContents,
} from "../src/services/ai/gemini-client";
import {
  PromptBuilder,
  SYSTEM_ROLE,
  ACTION_INSTRUCTIONS,
  type FinancialContext,
} from "../src/services/ai/prompt-builder.service";
import { AIAdvisoryService } from "../src/services/ai/ai-advisory.service";
import { NvidiaClient } from "../src/services/ai/nvidia-client";
import { NetWorthService } from "../src/services/networth.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { TransactionService } from "../src/services/transaction.service";
import { GoalService } from "../src/services/goal.service";
import { HealthScoreService } from "../src/services/healthscore.service";
import { AssetService } from "../src/services/asset.service";
import { AIAction } from "../src/types";

// In-memory conversations store for test assertions
const conversationDb: any[] = [];

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    aIConversation: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const row = { id: `conv-${conversationDb.length + 1}`, createdAt: new Date(), ...data };
        conversationDb.push(row);
        return row;
      }),
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        return conversationDb.filter((c) => !where?.userId || c.userId === where.userId);
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "demo-user", name: "Demo User" }),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

describe("Phase 5: Gemini AI Integration & Prompt Preservation", () => {
  const originalEnv = { ...process.env };

  const mockContext: FinancialContext = {
    netWorth: { total: 1500000 },
    portfolio: {
      allocation: [
        { assetType: "STOCK", percent: 60, value: 900000 },
        { assetType: "MUTUAL_FUND", percent: 30, value: 450000 },
        { assetType: "CASH", percent: 10, value: 150000 },
      ],
      topHoldings: [
        { name: "Reliance Industries", pnlPercent: 18.5 },
        { name: "Parag Parikh Flexi Cap", pnlPercent: 24.2 },
      ],
      riskScore: 6,
    },
    cashFlow: { savingsRate: 35, income: 100000, expenses: 65000 },
    goals: [
      { name: "Retirement", progress: 45, target: 10000000, deadline: "2040-01-01" },
      { name: "Emergency Fund", progress: 80, target: 400000, deadline: "2026-12-31" },
    ],
    healthScore: { total: 8 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NVIDIA_NIM_API_KEY;
    delete process.env.NVIDIA_NIM_IMPORT_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MINIMAX_API_KEY;
    conversationDb.length = 0;

    // Mock deterministic services used by buildContext
    vi.spyOn(NetWorthService, "getCurrent").mockResolvedValue({
      netWorth: 1500000,
      totalAssets: 1500000,
      totalLiabilities: 0,
    } as any);

    vi.spyOn(PortfolioService, "getAllocation").mockResolvedValue([
      { assetType: "STOCK", percent: 60, value: 900000, count: 5 },
      { assetType: "MUTUAL_FUND", percent: 30, value: 450000, count: 3 },
      { assetType: "CASH", percent: 10, value: 150000, count: 1 },
    ] as any);

    vi.spyOn(PortfolioService, "getRiskScore").mockResolvedValue(6);

    vi.spyOn(TransactionService, "currentMonthTotals").mockResolvedValue({
      income: 100000,
      expense: 65000,
      net: 35000,
    } as any);

    vi.spyOn(GoalService, "getAllWithProgress").mockResolvedValue([
      { name: "Retirement", progress: 45, targetAmount: 10000000, targetDate: new Date("2040-01-01") },
    ] as any);

    vi.spyOn(HealthScoreService, "compute").mockResolvedValue({
      total: 8,
      max: 10,
    } as any);

    vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([
      { name: "Reliance Industries", currentValue: 300000, pnlPercent: 18.5 } as any,
      { name: "Parag Parikh Flexi Cap", currentValue: 200000, pnlPercent: 24.2 } as any,
    ]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Prompt Preservation & Deterministic Prompt Builder", () => {
    it("preserves exact SYSTEM_ROLE instructions and regulatory guidelines", () => {
      expect(SYSTEM_ROLE).toContain("SEBI-registered personal finance advisor AI for Indian investors");
      expect(SYSTEM_ROLE).toContain("Never guarantee returns");
      expect(SYSTEM_ROLE).toContain("Default currency: INR");
      expect(SYSTEM_ROLE).toContain("Use structured Markdown formatting");
      expect(SYSTEM_ROLE).toContain("Add a \"Pro-Tip\" section at the end of each response");
      expect(SYSTEM_ROLE).toContain("between 200-500 words");
    });

    it("preserves all 7 action instruction templates verbatim", () => {
      const actions: AIAction[] = [
        "PORTFOLIO_ANALYSIS",
        "SUGGEST_INVESTMENTS",
        "REBALANCING_ADVICE",
        "MARKET_INSIGHTS",
        "FINANCIAL_ROADMAP",
        "CUSTOM_CHAT",
        "MONTHLY_SUMMARY",
      ];

      for (const act of actions) {
        expect(ACTION_INSTRUCTIONS[act]).toBeDefined();
        expect(ACTION_INSTRUCTIONS[act].length).toBeGreaterThan(20);
      }

      expect(ACTION_INSTRUCTIONS.PORTFOLIO_ANALYSIS).toContain("### Portfolio Strengths");
      expect(ACTION_INSTRUCTIONS.PORTFOLIO_ANALYSIS).toContain("### Key Risks");
      expect(ACTION_INSTRUCTIONS.PORTFOLIO_ANALYSIS).toContain("### Actionable Recommendations");

      expect(ACTION_INSTRUCTIONS.REBALANCING_ADVICE).toContain("### Allocation Drift");
      expect(ACTION_INSTRUCTIONS.REBALANCING_ADVICE).toContain("### Rebalancing Steps");
    });

    it("builds structured prompt with financial context JSON and optional user message", () => {
      const messages = PromptBuilder.build("PORTFOLIO_ANALYSIS", mockContext, "What should I change?");
      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({ role: "system", content: SYSTEM_ROLE });
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain("## FINANCIAL CONTEXT");
      expect(messages[1].content).toContain("1500000"); // net worth
      expect(messages[1].content).toContain(ACTION_INSTRUCTIONS.PORTFOLIO_ANALYSIS);
      expect(messages[2]).toEqual({ role: "user", content: "## USER MESSAGE\nWhat should I change?" });
    });
  });

  describe("2. Gemini Content Normalization & Formatting", () => {
    it("extracts system instruction and maps roles to Gemini user/model turns", () => {
      const input = [
        { role: "system", content: "System rule 1" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "Analyze my portfolio" },
      ];

      const { systemInstruction, contents } = formatGeminiContents(input);
      expect(systemInstruction).toBe("System rule 1");
      expect(contents).toHaveLength(3);
      expect(contents[0]).toEqual({ role: "user", parts: [{ text: "Hello" }] });
      expect(contents[1]).toEqual({ role: "model", parts: [{ text: "Hi there!" }] });
      expect(contents[2]).toEqual({ role: "user", parts: [{ text: "Analyze my portfolio" }] });
    });

    it("merges consecutive turns of the same role into valid Gemini parts", () => {
      const input = [
        { role: "user", content: "Part 1 Context" },
        { role: "user", content: "Part 2 Question" },
      ];

      const { contents } = formatGeminiContents(input);
      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe("user");
      expect(contents[0].parts).toEqual([
        { text: "Part 1 Context" },
        { text: "Part 2 Question" },
      ]);
    });
  });

  describe("3. Error Classification", () => {
    it("correctly identifies timeout and abort errors", () => {
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      expect(classifyGeminiError(abortErr).code).toBe("TIMEOUT");

      const timeoutErr = new Error("Request timed out after 25000ms");
      expect(classifyGeminiError(timeoutErr).code).toBe("TIMEOUT");
    });

    it("correctly identifies auth errors", () => {
      expect(classifyGeminiError(new Error("API key not valid. Please pass a valid API key.")).code).toBe("AUTH_ERROR");
      expect(classifyGeminiError(new Error("Request failed with 401 Unauthorized")).code).toBe("AUTH_ERROR");
      expect(classifyGeminiError(new Error("PERMISSION_DENIED")).code).toBe("AUTH_ERROR");
    });

    it("correctly identifies rate limit and quota exhaustion", () => {
      expect(classifyGeminiError(new Error("Resource has been exhausted (e.g. check quota).")).code).toBe("RATE_LIMIT");
      expect(classifyGeminiError(new Error("429 Too Many Requests")).code).toBe("RATE_LIMIT");
    });

    it("correctly identifies unsupported or deprecated model errors", () => {
      expect(
        classifyGeminiError(
          new Error("404 Not Found: models/gemini-1.5-flash is not found for API version v1beta, or is not supported for generateContent.")
        ).code
      ).toBe("MODEL_ERROR");
      expect(
        classifyGeminiError(
          new Error("This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.5-flash.")
        ).code
      ).toBe("MODEL_ERROR");
    });
  });

  describe("4. GeminiClient Provider Behavior (Mocked)", () => {
    it("returns NOT_CONFIGURED when GEMINI_API_KEY is not set", async () => {
      delete process.env.GEMINI_API_KEY;
      expect(GeminiClient.isConfigured()).toBe(false);

      const result = await GeminiClient.complete({
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NOT_CONFIGURED");
        expect(result.error).toContain("GEMINI_API_KEY is not configured");
      }
    });

    it("successfully generates content with mocked GoogleGenerativeAI client", async () => {
      process.env.GEMINI_API_KEY = "mock-key";
      delete process.env.GEMINI_MODEL;
      expect(GeminiClient.isConfigured()).toBe(true);

      const mockGenAI: any = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: Promise.resolve({
              text: () => "### Portfolio Strengths\n- Strong diversification across equities.",
            }),
          }),
        }),
      };

      const result = await GeminiClient.complete({
        messages: [{ role: "user", content: "Analyze my portfolio" }],
        genAIClient: mockGenAI,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toContain("Strong diversification across equities");
        expect(result.model).toBe(DEFAULT_MODEL);
      }
    });

    it("handles rate limit / quota error from provider", async () => {
      process.env.GEMINI_API_KEY = "mock-key";

      const mockGenAI: any = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockRejectedValue(new Error("429 ResourceExhausted: rate limit exceeded")),
        }),
      };

      const result = await GeminiClient.complete({
        messages: [{ role: "user", content: "Analyze" }],
        genAIClient: mockGenAI,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("RATE_LIMIT");
        expect(result.error).toContain("rate limit");
      }
    });

    it("handles empty response from model gracefully", async () => {
      process.env.GEMINI_API_KEY = "mock-key";

      const mockGenAI: any = {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: Promise.resolve({
              text: () => "   ",
            }),
          }),
        }),
      };

      const result = await GeminiClient.complete({
        messages: [{ role: "user", content: "Analyze" }],
        genAIClient: mockGenAI,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BAD_RESPONSE");
      }
    });
  });

  describe("5. AIAdvisoryService Deterministic Fallback & Isolation", () => {
    it("falls back to rule-based engine when NVIDIA NIM is unconfigured without inventing data", async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const result = await AIAdvisoryService.runAction("demo-user", "PORTFOLIO_ANALYSIS");

      expect(result).toBeDefined();
      expect(result.source).toBe("fallback");
      expect(result.provider).toBe("rule-engine");
      expect(result.fallbackReason).toBe("NOT_CONFIGURED");
      expect(result.response).toContain("**Strengths**");
      expect(result.response).toContain("**Risks**");
      expect(result.response).toContain("**Recommendations**");
      expect(result.response).toContain("Configure NVIDIA_NIM_API_KEY for full AI-driven insights");
      expect(conversationDb.length).toBe(1);
    });

    it("returns deterministic rule-based response for REBALANCING_ADVICE", async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const result = await AIAdvisoryService.runAction("demo-user", "REBALANCING_ADVICE");
      expect(result.source).toBe("fallback");
      expect(result.response).toContain("**Current allocation:**");
      expect(result.response).toContain("**Rebalancing guidance:**");
    });

    it("returns deterministic rule-based response for MONTHLY_SUMMARY", async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const result = await AIAdvisoryService.runAction("demo-user", "MONTHLY_SUMMARY");
      expect(result.source).toBe("fallback");
      expect(result.response).toContain("**This month at a glance**");
      expect(result.response).toContain("Income:");
      expect(result.response).toContain("Expenses:");
    });

    it("uses live NVIDIA NIM completion when provider succeeds", async () => {
      process.env.NVIDIA_NIM_API_KEY = "mock-valid-key";

      vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
        ok: true,
        text: "### Investment Strategy\nHere are 3 tailored recommendations based on your goals.",
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        durationMs: 350,
      });

      const result = await AIAdvisoryService.runAction("demo-user", "SUGGEST_INVESTMENTS");

      expect(result.source).toBe("ai");
      expect(result.provider).toBe("nvidia");
      expect(result.model).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
      expect(result.response).toContain("Here are 3 tailored recommendations");
      expect(result.fallbackReason).toBeUndefined();
    });

    it("presents clear AI-unavailable guidance for general questions when provider fails", async () => {
      delete process.env.NVIDIA_NIM_API_KEY;

      const result = await AIAdvisoryService.runAction("demo-user", "CUSTOM_CHAT", {
        message: "What is an S&P 500 ETF and how does the expense ratio work?",
      });

      expect(result.source).toBe("fallback");
      expect(result.provider).toBe("rule-engine");
      expect(result.fallbackReason).toBe("NOT_CONFIGURED");
      expect(result.response).toContain("AI Advisor Temporarily Unavailable");
      expect(result.response).toContain("NVIDIA_NIM_API_KEY is not configured");
      expect(result.response).toContain("What you can do:");
    });
  });
});
