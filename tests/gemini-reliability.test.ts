import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GeminiClient,
  DEFAULT_MODEL,
  classifyGeminiError,
  isTransientGeminiError,
  isDailyQuotaError,
  parseRetryAfterMs,
  type GeminiPart,
} from "../src/services/ai/gemini-client";
import { ImportExtractionService } from "../src/services/ai/import-extraction.service";
import { AIAdvisoryService } from "../src/services/ai/ai-advisory.service";
import { NvidiaClient } from "../src/services/ai/nvidia-client";
import { BankStatementService } from "../src/services/import/bank-statement.service";
import { NetWorthService } from "../src/services/networth.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { TransactionService } from "../src/services/transaction.service";
import { GoalService } from "../src/services/goal.service";
import { HealthScoreService } from "../src/services/healthscore.service";
import { AssetService } from "../src/services/asset.service";
import { ValidationError } from "../src/lib/errors";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    aIConversation: {
      create: vi.fn().mockResolvedValue({ id: "conv-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "demo-user", name: "Demo User" }),
    },
    account: {
      findFirst: vi.fn().mockResolvedValue({ id: "acc-1", userId: "demo-user", name: "HDFC Primary" }),
    },
    transaction: {
      create: vi.fn().mockResolvedValue({ id: "tx-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

describe("FinanceAI: Targeted Gemini Reliability & AI Advisor Regression Fix", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = "test-gemini-key";

    vi.spyOn(NetWorthService, "getCurrent").mockResolvedValue({
      netWorth: 1000000,
      totalAssets: 1000000,
      totalLiabilities: 0,
    } as any);

    vi.spyOn(PortfolioService, "getAllocation").mockResolvedValue([
      { assetType: "STOCK", percent: 70, value: 700000, count: 5 },
      { assetType: "CASH", percent: 30, value: 300000, count: 1 },
    ] as any);

    vi.spyOn(PortfolioService, "getRiskScore").mockResolvedValue(5);

    vi.spyOn(TransactionService, "currentMonthTotals").mockResolvedValue({
      income: 150000,
      expense: 80000,
      net: 70000,
    } as any);

    vi.spyOn(GoalService, "getAllWithProgress").mockResolvedValue([]);
    vi.spyOn(HealthScoreService, "compute").mockResolvedValue({ total: 8 } as any);
    vi.spyOn(AssetService, "getPortfolioWithPL").mockResolvedValue([]);

    // Restore mocked Prisma delegates
    const { prisma } = await import("../src/lib/prisma");
    (prisma.account.findFirst as any) = vi.fn().mockResolvedValue({ id: "acc-1", userId: "demo-user", name: "HDFC Primary" });
    (prisma.transaction.create as any) = vi.fn().mockResolvedValue({ id: "tx-1" });
    (prisma.aIConversation.create as any) = vi.fn().mockResolvedValue({ id: "conv-1" });
  });

  // 1. Successful text-only Gemini requests
  it("1. handles successful text-only Gemini requests", async () => {
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: Promise.resolve({
            text: () => "Here is your portfolio analysis: healthy allocation.",
          }),
        }),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Review my portfolio allocation." }],
      genAIClient: mockGenAI,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Here is your portfolio analysis");
      expect(result.model).toBe(DEFAULT_MODEL);
    }
  });

  // 2. Successful multimodal PDF extraction requests
  it("2. handles successful multimodal PDF extraction requests with inlineData", async () => {
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: Promise.resolve({
            text: () => JSON.stringify({
              bankName: "State Bank of India",
              accountNumberMasked: "XX1234",
              accountType: "SAVINGS",
              transactions: [
                {
                  date: "2026-03-01",
                  description: "SALARY CREDIT",
                  amount: 75000,
                  direction: "CREDIT",
                },
              ],
            }),
          }),
        }),
      }),
    };

    const parts: GeminiPart[] = [
      { text: "Extract transactions" },
      { inlineData: { mimeType: "application/pdf", data: "JVBERi0xLjQK" } },
    ];

    const result = await GeminiClient.complete({
      messages: [{ role: "user", parts }],
      genAIClient: mockGenAI,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("State Bank of India");
      expect(result.text).toContain("SALARY CREDIT");
    }
  });

  // 3. Transient 503 followed by success on retry
  it("3. handles transient HTTP 503 error followed by success on backoff retry", async () => {
    let callCount = 0;
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("503 Service Unavailable: The model is overloaded. Please try again later.");
          }
          return {
            response: Promise.resolve({
              text: () => "Recovered response after transient 503 overload.",
            }),
          };
        }),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      maxRetries: 2,
    });

    expect(callCount).toBe(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Recovered response after transient 503 overload.");
    }
  });

  // 4. Repeated transient failures reaching bounded fallback
  it("4. handles repeated transient 503 failures by exhausting retries and returning SERVICE_UNAVAILABLE", async () => {
    let callCount = 0;
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          throw new Error("503 Service Unavailable: High demand on gemini-3.5-flash.");
        }),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      maxRetries: 2,
    });

    expect(callCount).toBe(3); // Initial attempt + 2 retries
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVICE_UNAVAILABLE");
      expect(result.error).toContain("overloaded (503)");
    }

    // Verify AI Advisor turns this into a clear, honest fallback response
    vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
      ok: false,
      error: "NVIDIA NIM service temporarily overloaded (HTTP 503). High demand.",
      code: "SERVICE_UNAVAILABLE",
      durationMs: 50,
    });
    const advisorResult = await AIAdvisoryService.runAction("demo-user", "CUSTOM_CHAT", {
      message: "Explain inflation",
    });

    expect(advisorResult.source).toBe("fallback");
    expect(advisorResult.fallbackReason).toBe("SERVICE_UNAVAILABLE");
    expect(advisorResult.response).toContain("AI Advisor Temporarily Unavailable");
    expect(advisorResult.response).toContain("NVIDIA NIM service temporarily overloaded (HTTP 503)");
  });

  // 4a. HTTP 429 Daily Quota stops unnecessary cross-model retries immediately
  it("4a. stops unnecessary cross-model retries immediately on HTTP 429 daily quota exhaustion", async () => {
    let callCount = 0;
    const requestedModels: string[] = [];

    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockImplementation((config: { model: string }) => {
        requestedModels.push(config.model);
        return {
          generateContent: vi.fn().mockImplementation(async () => {
            callCount++;
            throw new Error(
              "[429 Too Many Requests] You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20. GenerateRequestsPerDayPerProjectPerModel-FreeTier. Please retry in 5h53m48s."
            );
          }),
        };
      }),
    };

    const startTime = Date.now();
    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Analyze my portfolio" }],
      genAIClient: mockGenAI,
      maxRetries: 3,
    });
    const duration = Date.now() - startTime;

    // Must make only 1 attempt and stop immediately without retrying or switching models
    expect(callCount).toBe(1);
    expect(requestedModels).toEqual([DEFAULT_MODEL]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMIT");
      expect(result.isDailyQuota).toBe(true);
      expect(result.error).toContain("Gemini API quota exhausted");
    }

    // Verify AI Advisor turns this into an honest fallback response without claiming NVIDIA succeeded
    vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
      ok: false,
      error: "NVIDIA NIM rate limit or quota exceeded.",
      code: "RATE_LIMIT",
      durationMs: 50,
    });
    const advisorResult = await AIAdvisoryService.runAction("demo-user", "CUSTOM_CHAT", {
      message: "Recommend stocks",
    });

    expect(advisorResult.source).toBe("fallback");
    expect(advisorResult.provider).toBe("rule-engine");
    expect(advisorResult.fallbackReason).toBe("RATE_LIMIT");
    expect(advisorResult.model).toBeUndefined();
    expect(advisorResult.response).toContain("AI Advisor Temporarily Unavailable");
    expect(advisorResult.response).toContain("NVIDIA NIM rate limit or quota exceeded");
    expect(advisorResult.response).toContain("NVIDIA NIM was not used");
  });

  // 4b. HTTP 429 with short Retry-After respects deadline and retries on the SAME model
  it("4b. respects short-term Retry-After without switching models when remaining deadline permits", async () => {
    let callCount = 0;
    const requestedModels: string[] = [];

    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockImplementation((config: { model: string }) => {
        requestedModels.push(config.model);
        return {
          generateContent: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              throw new Error("429 Too Many Requests: Rate limit exceeded. Retry-After: 0.02s");
            }
            return {
              response: Promise.resolve({
                text: () => "Live response after short-term 429 rate limit backoff.",
              }),
            };
          }),
        };
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      timeoutMs: 5000,
      maxRetries: 2,
    });

    expect(callCount).toBe(2);
    // Both attempts must use the SAME model (no cross-model retry)
    expect(requestedModels).toEqual([DEFAULT_MODEL, DEFAULT_MODEL]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("Live response after short-term 429 rate limit backoff.");
      expect(result.model).toBe(DEFAULT_MODEL);
    }
  });

  // 4c. HTTP 429 with Retry-After exceeding deadline stops immediately
  it("4c. aborts retries immediately when HTTP 429 Retry-After exceeds remaining deadline budget", async () => {
    let callCount = 0;
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          throw new Error("429 Too Many Requests: Rate limit exceeded. Retry-After: 10s");
        }),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      timeoutMs: 2000, // Deadline is 2s, but Retry-After requires 10s
      maxRetries: 3,
    });

    // Should NOT wait 10s or retry
    expect(callCount).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMIT");
      expect(result.retryAfterMs).toBe(10000);
    }
  });

  // 5. Permanent authentication/configuration errors without inappropriate retries
  it("5. fails fast on permanent authentication errors (401/403) without retrying", async () => {
    let callCount = 0;
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(async () => {
          callCount++;
          throw new Error("403 Forbidden: API key not valid. Please pass a valid API key.");
        }),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      maxRetries: 3,
    });

    // Should NOT retry on 403 Forbidden
    expect(callCount).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ERROR");
      expect(result.error).toContain("credentials invalid");
    }
  });

  it("5b. fails immediately when GEMINI_API_KEY is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_CONFIGURED");
    }
  });

  // 6. Request timeout and retry deadline enforcement
  it("6. strictly enforces total timeout deadline and aborts further retries", async () => {
    const mockGenAI: any = {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error("503 Overloaded")), 150))
        ),
      }),
    };

    const result = await GeminiClient.complete({
      messages: [{ role: "user", content: "Hello" }],
      genAIClient: mockGenAI,
      timeoutMs: 100, // Small deadline
      maxRetries: 5,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["TIMEOUT", "SERVICE_UNAVAILABLE"]).toContain(result.code);
    }
  });

  // 7. AI Advisor and document extraction retaining independent request settings
  it("7. maintains independent settings between AI Advisor and document extraction", async () => {
    const configSpy = vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    const completeSpy = vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
      ok: true,
      text: "Advice",
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      durationMs: 100,
    });

    // AI Advisor call
    await AIAdvisoryService.runAction("demo-user", "MONTHLY_SUMMARY");
    expect(completeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "advisor",
        messages: expect.any(Array),
      })
    );

    // Multimodal/Text PDF extraction call
    completeSpy.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({ bankName: "Test Bank", transactions: [] }),
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      durationMs: 150,
    });

    const pdfText = "A".repeat(160) + " 123456";
    const pdfBytes = new TextEncoder().encode(`%PDF-1.4\nBT\n(${pdfText}) Tj\nET\n`);
    await ImportExtractionService.extractBankStatementPdf(pdfBytes);

    expect(completeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        feature: "import",
      })
    );
    configSpy.mockRestore();
  });

  // 8. Correct distinction between AI-generated and fallback responses
  it("8. correctly distinguishes between AI-generated and fallback responses", async () => {
    const configSpy = vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(NvidiaClient, "complete").mockResolvedValueOnce({
      ok: true,
      text: "### Customized Portfolio Analysis\nYour savings rate is in the top decile.",
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      durationMs: 200,
    });

    const aiRes = await AIAdvisoryService.runAction("demo-user", "PORTFOLIO_ANALYSIS");
    expect(aiRes.source).toBe("ai");
    expect(aiRes.provider).toBe("nvidia");
    expect(aiRes.fallbackReason).toBeUndefined();
    expect(aiRes.response).toContain("Customized Portfolio Analysis");

    // Failure case
    vi.spyOn(NvidiaClient, "complete").mockResolvedValueOnce({
      ok: false,
      error: "NVIDIA NIM service temporarily overloaded (503). High demand.",
      code: "SERVICE_UNAVAILABLE",
      durationMs: 50,
    });

    const fallbackRes = await AIAdvisoryService.runAction("demo-user", "PORTFOLIO_ANALYSIS");
    expect(fallbackRes.source).toBe("fallback");
    expect(fallbackRes.provider).toBe("rule-engine");
    expect(fallbackRes.fallbackReason).toBe("SERVICE_UNAVAILABLE");
    expect(fallbackRes.response).toContain("This is a rule-based analysis");
    configSpy.mockRestore();
  });

  // 9. PDF import timeout with successful deterministic fallback (HDFC)
  it("9. falls back to deterministic HDFC adapter when AI times out on a text-based HDFC PDF", async () => {
    // Generate text representing an HDFC statement
    const hdfcText = `
HDFC BANK LIMITED
ACCOUNT STATEMENT
Account No: 50100012345678
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/03/2026,UPI-SWIGGY-1234,REF1001,01/03/2026,450.00,,50000.00
02/03/2026,SALARY CREDIT,REF1002,02/03/2026,,85000.00,135000.00
    `.trim();

    // Mock extractPdfTextStreams to return this text
    const pdfBytes = new TextEncoder().encode(`%PDF-1.4\nBT\n(${hdfcText}) Tj\nET\n`);

    const configSpy = vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
      ok: false,
      error: "NVIDIA NIM API request timed out.",
      code: "TIMEOUT",
      durationMs: 25000,
    });

    const result = await ImportExtractionService.extractBankStatementPdf(pdfBytes, {
      fileName: "hdfc_statement.pdf",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.bankName).toBe("HDFC Bank");
    expect(result.data?.transactions.length).toBe(2);
    expect(result.data?.transactions[0].description).toContain("UPI-SWIGGY-1234");
    expect(result.data?.transactions[0].amount).toBe(450);
    expect(result.data?.warnings).toContain("Extracted via deterministic HDFC parser after AI extraction was unavailable.");
    configSpy.mockRestore();
  });

  // 10. PDF import timeout with no usable fallback
  it("10. handles PDF import timeout with no usable fallback by reporting canImport=false and blocking commit", async () => {
    const pdfText = "A".repeat(160) + " 123456";
    const pdfBytes = new TextEncoder().encode(`%PDF-1.4\nBT\n(${pdfText}) Tj\nET\n`);

    const configSpy = vi.spyOn(NvidiaClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(NvidiaClient, "complete").mockResolvedValue({
      ok: false,
      error: "NVIDIA NIM API request timed out after 30000ms",
      code: "TIMEOUT",
      durationMs: 30000,
    });

    const preview = await BankStatementService.preview("demo-user", {
      fileName: "unfamiliar_bank.pdf",
      bytes: pdfBytes,
    });

    expect(preview.canImport).toBe(false);
    expect(preview.totalRows).toBe(0);
    expect(preview.warnings.some((w) => w.includes("timed out"))).toBe(true);

    // Attempting to commit an unimportable preview must throw ValidationError
    await expect(
      BankStatementService.commit("demo-user", {
        fileName: "unfamiliar_bank.pdf",
        bytes: pdfBytes,
        accountId: "acc-1",
      })
    ).rejects.toThrow(ValidationError);
    configSpy.mockRestore();
  });

  // 11. Helper functions: isTransientGeminiError & parseRetryAfterMs
  it("11. accurately classifies transient errors and extracts retry-after headers", () => {
    expect(isTransientGeminiError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isTransientGeminiError(new Error("The model is overloaded. Please try again later."))).toBe(true);
    expect(isTransientGeminiError(new Error("429 ResourceExhausted"))).toBe(true);
    expect(isTransientGeminiError(new Error("fetch failed"))).toBe(true);
    expect(isTransientGeminiError(new Error("Gemini request timed out after 8000ms"))).toBe(true);

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    expect(isTransientGeminiError(abortError)).toBe(true);

    expect(isTransientGeminiError(new Error("403 Forbidden: API key not valid"))).toBe(false);
    expect(isTransientGeminiError(new Error("Response blocked by safety filters"))).toBe(false);
    expect(isTransientGeminiError(new Error("model not found"))).toBe(false);

    expect(parseRetryAfterMs(new Error("Rate limited. Retry-After: 3s"))).toBe(3000);
    expect(parseRetryAfterMs(new Error("Please retry in 2 seconds"))).toBe(2000);
    expect(parseRetryAfterMs(new Error("Please retry in 5h53m48.3s"))).toBe(21228300);
    expect(parseRetryAfterMs(new Error('{"@type":"RetryInfo","retryDelay":"21228s"}'))).toBe(21228000);
    expect(parseRetryAfterMs(new Error("Unknown error"))).toBeNull();

    // Daily quota detection
    expect(isDailyQuotaError(new Error("Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests"))).toBe(true);
    expect(isDailyQuotaError(new Error("GenerateRequestsPerDayPerProjectPerModel-FreeTier"))).toBe(true);
    expect(isDailyQuotaError(new Error("You exceeded your current quota, please check your plan and billing details."))).toBe(true);
    expect(isDailyQuotaError(new Error("Please retry in 5h53m48s"))).toBe(true);
    expect(isDailyQuotaError(new Error("503 Overloaded"))).toBe(false);

    // Daily quota must NOT be considered transient for immediate retry
    expect(isTransientGeminiError(new Error("429 Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier"))).toBe(false);
  });
});
