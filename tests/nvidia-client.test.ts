import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NvidiaClient,
  classifyNvidiaError,
  parseNvidiaRetryAfterMs,
  parseReasoningContent,
  isTransientNvidiaError,
  sanitizeLog,
  DEFAULT_BASE_URL,
  DEFAULT_ADVISOR_MODEL,
  DEFAULT_IMPORT_MODEL,
} from "../src/services/ai/nvidia-client";

describe("NVIDIA NIM Transport Client Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NVIDIA_NIM_API_KEY;
    delete process.env.NVIDIA_NIM_IMPORT_API_KEY;
    delete process.env.NVIDIA_NIM_BASE_URL;
    delete process.env.NVIDIA_NIM_ADVISOR_MODEL;
    delete process.env.NVIDIA_NIM_IMPORT_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Configuration and Key Separation", () => {
    it("reports not configured when respective keys are missing", () => {
      expect(NvidiaClient.isConfigured("advisor")).toBe(false);
      expect(NvidiaClient.isConfigured("import")).toBe(false);
    });

    it("strictly isolates Advisor key from Import key", () => {
      process.env.NVIDIA_NIM_API_KEY = "advisor-nvapi-12345";
      expect(NvidiaClient.isConfigured("advisor")).toBe(true);
      expect(NvidiaClient.isConfigured("import")).toBe(false);

      delete process.env.NVIDIA_NIM_API_KEY;
      process.env.NVIDIA_NIM_IMPORT_API_KEY = "import-nvapi-67890";
      expect(NvidiaClient.isConfigured("advisor")).toBe(false);
      expect(NvidiaClient.isConfigured("import")).toBe(true);
    });

    it("returns NOT_CONFIGURED error without silent cross-key contamination", async () => {
      process.env.NVIDIA_NIM_API_KEY = "advisor-nvapi-12345";
      // Import key is missing
      const result = await NvidiaClient.complete({
        messages: [{ role: "user", content: "Extract statement" }],
        feature: "import",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NOT_CONFIGURED");
        expect(result.error).toContain("NVIDIA_NIM_IMPORT_API_KEY is not configured");
      }
    });

    it("resolves model names per feature with fallback defaults", () => {
      expect(NvidiaClient.getModel("advisor")).toBe(DEFAULT_ADVISOR_MODEL);
      expect(NvidiaClient.getModel("import")).toBe(DEFAULT_IMPORT_MODEL);

      process.env.NVIDIA_NIM_ADVISOR_MODEL = "custom-advisor-model";
      process.env.NVIDIA_NIM_IMPORT_MODEL = "custom-import-model";
      expect(NvidiaClient.getModel("advisor")).toBe("custom-advisor-model");
      expect(NvidiaClient.getModel("import")).toBe("custom-import-model");
    });
  });

  describe("2. Request Construction & Headers (Mocked Fetch)", () => {
    it("sends standard chat completions payload with Bearer auth header", async () => {
      process.env.NVIDIA_NIM_API_KEY = "nvapi-test-key-abc";
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "chat-123",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "### Advisory Analysis\nHere is your financial plan.",
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 100 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const result = await NvidiaClient.complete({
        messages: [{ role: "user", content: "Review my finances" }],
        feature: "advisor",
        temperature: 0.3,
        maxTokens: 2048,
      });

      expect(result.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
      expect(calledInit?.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer nvapi-test-key-abc",
          "Content-Type": "application/json",
        })
      );

      const parsedBody = JSON.parse(calledInit?.body as string);
      expect(parsedBody.model).toBe(DEFAULT_ADVISOR_MODEL);
      expect(parsedBody.temperature).toBe(0.3);
      expect(parsedBody.max_tokens).toBe(2048);
      expect(parsedBody.stream).toBe(false);
      expect(parsedBody.messages).toHaveLength(1);
    });

    it("respects custom base URL without trailing slash duplication", async () => {
      process.env.NVIDIA_NIM_API_KEY = "nvapi-test-key";
      process.env.NVIDIA_NIM_BASE_URL = "https://custom-nim.internal.corp/v1/";

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "OK" } }],
          }),
          { status: 200 }
        )
      );

      await NvidiaClient.complete({
        messages: [{ role: "user", content: "test" }],
        feature: "advisor",
      });

      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://custom-nim.internal.corp/v1/chat/completions");
    });
  });

  describe("3. Reasoning Content and Response Parsing", () => {
    it("extracts and strips <think>...</think> reasoning blocks correctly", () => {
      const rawText = "<think>Calculating asset allocation drift...</think>### Allocation Drift\nEquities are at 70%.";
      const { text, reasoning } = parseReasoningContent(rawText);
      expect(reasoning).toBe("Calculating asset allocation drift...");
      expect(text).toBe("### Allocation Drift\nEquities are at 70%.");
    });

    it("extracts and strips <thought>...</thought> reasoning blocks correctly", () => {
      const rawText = "<thought>Checking Indian tax limits under Section 80C.</thought>Invest up to ₹1.5L in ELSS.";
      const { text, reasoning } = parseReasoningContent(rawText);
      expect(reasoning).toBe("Checking Indian tax limits under Section 80C.");
      expect(text).toBe("Invest up to ₹1.5L in ELSS.");
    });

    it("rejects empty choice content as BAD_RESPONSE", async () => {
      process.env.NVIDIA_NIM_API_KEY = "nvapi-test-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "   " } }],
          }),
          { status: 200 }
        )
      );

      const result = await NvidiaClient.complete({
        messages: [{ role: "user", content: "test" }],
        feature: "advisor",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BAD_RESPONSE");
        expect(result.error).toContain("empty response");
      }
    });

    it("rejects invalid JSON response body as BAD_RESPONSE", async () => {
      process.env.NVIDIA_NIM_API_KEY = "nvapi-test-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("<html>502 Bad Gateway</html>", { status: 200 })
      );

      const result = await NvidiaClient.complete({
        messages: [{ role: "user", content: "test" }],
        feature: "advisor",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BAD_RESPONSE");
      }
    });
  });

  describe("4. Error Classification & Fast Failures", () => {
    it("classifies HTTP 400 as INVALID_REQUEST without retry", () => {
      const err = classifyNvidiaError(new Error("400 Bad Request: unsupported parameter 'reasoning_budget'"));
      expect(err.code).toBe("INVALID_REQUEST");
      expect(isTransientNvidiaError(err.code, 400)).toBe(false);
    });

    it("classifies HTTP 401 and 403 as AUTH_ERROR without retry", () => {
      const err401 = classifyNvidiaError(new Error("401 Unauthorized: Invalid API Key"));
      expect(err401.code).toBe("AUTH_ERROR");
      expect(isTransientNvidiaError(err401.code, 401)).toBe(false);

      const err403 = classifyNvidiaError(new Error("403 Forbidden: Missing permissions"));
      expect(err403.code).toBe("AUTH_ERROR");
      expect(isTransientNvidiaError(err403.code, 403)).toBe(false);
    });

    it("classifies HTTP 404 as MODEL_ERROR without retry", () => {
      const err = classifyNvidiaError(new Error("404 Not Found: Model nvidia/unknown-model not found"));
      expect(err.code).toBe("MODEL_ERROR");
      expect(isTransientNvidiaError(err.code, 404)).toBe(false);
    });

    it("classifies HTTP 429 as RATE_LIMIT and marks as transient", () => {
      const err = classifyNvidiaError(new Error("429 Too Many Requests: Rate limit exceeded"));
      expect(err.code).toBe("RATE_LIMIT");
      expect(isTransientNvidiaError(err.code, 429)).toBe(true);
    });

    it("classifies HTTP 500, 502, 503, 504 as SERVICE_UNAVAILABLE and transient", () => {
      for (const status of [500, 502, 503, 504]) {
        const err = classifyNvidiaError(new Error(`${status} Service Error`), status);
        expect(err.code).toBe("SERVICE_UNAVAILABLE");
        expect(isTransientNvidiaError(err.code, status)).toBe(true);
      }
    });

    it("classifies AbortError / Timeout as TIMEOUT", () => {
      const abortErr = new Error("The operation was aborted");
      abortErr.name = "AbortError";
      const classified = classifyNvidiaError(abortErr);
      expect(classified.code).toBe("TIMEOUT");
    });
  });

  describe("5. Retry-After Header and Body Parsing", () => {
    it("parses seconds from Retry-After header", () => {
      const headers = new Headers({ "retry-after": "5" });
      expect(parseNvidiaRetryAfterMs(headers, "")).toBe(5000);
    });

    it("parses HTTP-date from Retry-After header", () => {
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const headers = new Headers({ "retry-after": futureDate });
      const ms = parseNvidiaRetryAfterMs(headers, "");
      expect(ms).toBeGreaterThan(8000);
      expect(ms).toBeLessThanOrEqual(11000);
    });

    it("parses retry seconds from error message string", () => {
      expect(parseNvidiaRetryAfterMs(undefined, "Please retry after 4 seconds")).toBe(4000);
      expect(parseNvidiaRetryAfterMs(undefined, "Rate limit reached. Retry in 15s")).toBe(15000);
    });
  });

  describe("6. Secret Redaction and Diagnostics", () => {
    it("redacts API keys and Bearer tokens from logs and objects", () => {
      const sensitive = {
        auth: "Bearer nvapi-secret-key-1234567890",
        message: "Failed with key nvapi-abcde12345 on endpoint",
        nested: {
          key: "nvapi-sensitive-token",
        },
      };

      const sanitized = sanitizeLog(sensitive);
      const str = JSON.stringify(sanitized);

      expect(str).not.toContain("nvapi-secret-key-1234567890");
      expect(str).not.toContain("nvapi-abcde12345");
      expect(str).not.toContain("nvapi-sensitive-token");
      expect(str).toContain("[REDACTED_API_KEY]");
      expect(str).toContain("[REDACTED_BEARER]");
    });
  });
});
