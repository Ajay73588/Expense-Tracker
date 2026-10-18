import { GoogleGenerativeAI } from "@google/generative-ai";
import { createLogger } from "../../lib/logger";
import { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, resolveGeminiModel, AI_CONFIG } from "../../config/ai.config";

const log = createLogger("GeminiClient");

export type GeminiErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "SAFETY_BLOCK"
  | "BAD_RESPONSE"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "SERVICE_UNAVAILABLE";

export type GeminiCompletionResult =
  | {
      ok: true;
      text: string;
      model: string;
      durationMs: number;
    }
  | {
      ok: false;
      error: string;
      code: GeminiErrorCode;
      durationMs: number;
      retryAfterMs?: number | null;
      isDailyQuota?: boolean;
    };

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export interface ChatMessage {
  role: "user" | "assistant" | "system" | string;
  content?: string;
  parts?: GeminiPart[];
}

export interface GeminiCompleteOptions {
  messages: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Optional custom client instance or mock for testing */
  genAIClient?: GoogleGenerativeAI;
}

export const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const DEFAULT_TIMEOUT_MS = AI_CONFIG.timeoutMs;

/**
 * Extracts HTTP status code from an error message or object if available.
 */
export function extractHttpStatus(err: unknown): number | null {
  if (err && typeof err === "object") {
    if ("status" in err && typeof (err as any).status === "number") {
      return (err as any).status;
    }
  }
  if (err instanceof Error) {
    const match = err.message.match(/\[(\d{3})\s+[^\]]+\]/) || err.message.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
    if (match && match[1]) {
      const status = parseInt(match[1], 10);
      if (!isNaN(status)) return status;
    }
  }
  return null;
}

/**
 * Parses Retry-After duration in milliseconds from error message or errorDetails if available.
 * Handles compound formats ("5h53m48s"), RPC retryDelay ("21228s"), and standard seconds ("3s").
 */
export function parseRetryAfterMs(err: unknown): number | null {
  if (!err) return null;

  // 1. Structured errorDetails from GoogleGenerativeAI Error
  if (typeof err === "object" && err !== null) {
    const errorDetails = (err as any).errorDetails;
    if (Array.isArray(errorDetails)) {
      for (const d of errorDetails) {
        if (d && typeof d.retryDelay === "string") {
          const secMatch = d.retryDelay.match(/^(\d+(?:\.\d+)?)s?$/i);
          if (secMatch) {
            const sec = parseFloat(secMatch[1]);
            if (!isNaN(sec) && sec > 0) return Math.round(sec * 1000);
          }
        }
      }
    }
  }

  if (err instanceof Error || typeof err === "object") {
    const msg = (err instanceof Error ? err.message : String((err as any).message || "")).trim();

    // 2. Embedded retryDelay in JSON or text (e.g., "retryDelay":"21228s")
    const delayMatch = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s?"/i);
    if (delayMatch && delayMatch[1]) {
      const sec = parseFloat(delayMatch[1]);
      if (!isNaN(sec) && sec > 0) return Math.round(sec * 1000);
    }

    // 3. Compound human format: e.g. "Please retry in 5h53m48.3s" or "retry in 10m" or "retry in 5h"
    const compoundMatch = msg.match(/retry(?:-after|\s+after|\s+in)[:\s]+(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?/i);
    if (compoundMatch && (compoundMatch[1] || compoundMatch[2] || compoundMatch[3])) {
      const hours = compoundMatch[1] ? parseFloat(compoundMatch[1]) : 0;
      const minutes = compoundMatch[2] ? parseFloat(compoundMatch[2]) : 0;
      const seconds = compoundMatch[3] ? parseFloat(compoundMatch[3]) : 0;
      const totalSec = hours * 3600 + minutes * 60 + seconds;
      if (totalSec > 0) {
        return Math.round(totalSec * 1000);
      }
    }

    // 4. Standard format: "Retry-After: 3s", "retry in 2 seconds", "Retry-After: 5"
    const standardMatch = msg.match(/retry(?:-after|\s+after|\s+in)[:\s]+(\d+(?:\.\d+)?)\s*(?:s|seconds?|sec)?\b/i);
    if (standardMatch && standardMatch[1]) {
      const sec = parseFloat(standardMatch[1]);
      if (!isNaN(sec) && sec > 0) {
        return Math.round(sec * 1000);
      }
    }
  }

  return null;
}

/**
 * Detects whether an error indicates daily or project-level quota exhaustion.
 */
export function isDailyQuotaError(err: unknown): boolean {
  if (err instanceof Error || (err && typeof err === "object")) {
    const msg = (err instanceof Error ? err.message : String((err as any).message || "")).toLowerCase();

    // Check structured errorDetails
    const details = (err as any).errorDetails;
    if (Array.isArray(details)) {
      for (const d of details) {
        const id = (d.quotaId || "").toLowerCase();
        const metric = (d.quotaMetric || "").toLowerCase();
        if (id.includes("perday") || id.includes("daily") || metric.includes("perday") || metric.includes("free_tier")) {
          return true;
        }
      }
    }

    // Check message keywords
    if (
      msg.includes("perday") ||
      msg.includes("per_day") ||
      msg.includes("daily") ||
      msg.includes("free_tier_requests") ||
      msg.includes("generaterequestsperday") ||
      msg.includes("exceeded your current quota") ||
      msg.includes("quota exceeded for metric") ||
      msg.includes("check your plan and billing details")
    ) {
      return true;
    }

    // Check retry-after duration: if it asks to wait > 30 seconds (e.g. hours), it is daily quota exhaustion
    const retryAfter = parseRetryAfterMs(err);
    if (retryAfter !== null && retryAfter > 30000) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether an error is transient and eligible for bounded retry.
 * Permanent errors (auth, safety, model, daily quota exhaustion) return false.
 */
export function isTransientGeminiError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Permanent errors: Auth, permissions, safety blocks, invalid model, daily quota exhaustion
    if (
      msg.includes("api key not valid") ||
      msg.includes("api_key_invalid") ||
      msg.includes("unauthorized") ||
      msg.includes("permission_denied") ||
      msg.includes("unauthenticated") ||
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("safety") ||
      msg.includes("blocked") ||
      msg.includes("harm") ||
      msg.includes("not found") ||
      msg.includes("not supported for generatecontent") ||
      msg.includes("is no longer available") ||
      isDailyQuotaError(err)
    ) {
      return false;
    }

    // Transient errors: 503, short-term rate limit, timeouts, network
    if (
      err.name === "AbortError" ||
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("abort") ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("high demand") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("service unavailable") ||
      msg.includes("429") ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests") ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("504") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Classifies an error thrown during Gemini API interaction.
 */
export function classifyGeminiError(err: unknown): {
  code: GeminiErrorCode;
  message: string;
  retryAfterMs?: number | null;
  isDailyQuota?: boolean;
} {
  const retryAfterMs = parseRetryAfterMs(err);
  const isDailyQuota = isDailyQuotaError(err);

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const status = extractHttpStatus(err);

    if (err.name === "AbortError" || msg.includes("timeout") || msg.includes("timed out") || msg.includes("abort")) {
      return { code: "TIMEOUT", message: "Gemini API request timed out.", retryAfterMs, isDailyQuota: false };
    }

    if (
      status === 404 ||
      msg.includes("not found") ||
      msg.includes("not supported for generatecontent") ||
      msg.includes("is no longer available") ||
      msg.includes("call listmodels") ||
      msg.includes("call modelservice.listmodels") ||
      (msg.includes("model") && msg.includes("not supported"))
    ) {
      return { code: "MODEL_ERROR", message: "Configured Gemini model is not supported or no longer available.", retryAfterMs, isDailyQuota: false };
    }

    if (
      status === 401 ||
      status === 403 ||
      msg.includes("api key not valid") ||
      msg.includes("api_key_invalid") ||
      msg.includes("unauthorized") ||
      msg.includes("permission_denied") ||
      msg.includes("unauthenticated")
    ) {
      return { code: "AUTH_ERROR", message: "Gemini API credentials invalid or unauthorized.", retryAfterMs, isDailyQuota: false };
    }

    if (
      status === 429 ||
      msg.includes("resource_exhausted") ||
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests")
    ) {
      if (isDailyQuota) {
        return {
          code: "RATE_LIMIT",
          message: "Gemini API quota exhausted (daily limit reached). Local rule-based fallback active.",
          retryAfterMs,
          isDailyQuota: true,
        };
      }
      return {
        code: "RATE_LIMIT",
        message: "Gemini API rate limit exceeded.",
        retryAfterMs,
        isDailyQuota: false,
      };
    }

    if (
      status === 503 ||
      msg.includes("503") ||
      msg.includes("overloaded") ||
      msg.includes("high demand") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("service unavailable")
    ) {
      return { code: "SERVICE_UNAVAILABLE", message: "Gemini service temporarily overloaded (503). High demand.", retryAfterMs, isDailyQuota: false };
    }

    if (msg.includes("safety") || msg.includes("blocked") || msg.includes("harm")) {
      return { code: "SAFETY_BLOCK", message: "Response blocked by Gemini safety filters.", retryAfterMs, isDailyQuota: false };
    }

    return { code: "NETWORK_ERROR", message: err.message, retryAfterMs, isDailyQuota: false };
  }

  return { code: "NETWORK_ERROR", message: String(err), retryAfterMs, isDailyQuota: false };
}

/**
 * Transforms generic ChatMessage[] into Gemini's multi-turn content format,
 * extracting system instructions and normalizing user/assistant turns.
 */
export function formatGeminiContents(
  messages: ChatMessage[],
  overrideSystemInstruction?: string
): {
  systemInstruction?: string;
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
} {
  let systemInstruction = overrideSystemInstruction;
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const sysText = msg.content || (msg.parts?.map((p) => ("text" in p ? p.text : "")).join(" ") ?? "");
      if (!systemInstruction) {
        systemInstruction = sysText;
      } else {
        systemInstruction += `\n\n${sysText}`;
      }
      continue;
    }

    const role: "user" | "model" = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
    const msgParts: GeminiPart[] =
      msg.parts && msg.parts.length > 0
        ? msg.parts
        : [{ text: msg.content || "" }];

    // If consecutive messages have the same role, combine them to comply with Gemini format
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push(...msgParts);
    } else {
      contents.push({
        role,
        parts: [...msgParts],
      });
    }
  }

  // Gemini contents must start with a 'user' turn if multi-turn
  if (contents.length > 0 && contents[0].role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
  }

  return { systemInstruction, contents };
}

export const GeminiClient = {
  /** Check if the Gemini API key is configured in the environment */
  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  },

  /** Get active model name */
  getModelName(overrideModel?: string): string {
    return resolveGeminiModel(overrideModel);
  },

  /**
   * Complete a chat prompt with Gemini with bounded retries, exponential backoff, and deadline enforcement.
   */
  async complete(opts: GeminiCompleteOptions): Promise<GeminiCompletionResult> {
    const startTime = Date.now();
    const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      log.info("gemini.not_configured", { reason: "Missing GEMINI_API_KEY" });
      return {
        ok: false,
        error: "GEMINI_API_KEY is not configured.",
        code: "NOT_CONFIGURED",
        durationMs: Date.now() - startTime,
      };
    }

    let activeModel = this.getModelName(opts.model);
    const totalTimeoutMs = opts.timeoutMs ?? (process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : DEFAULT_TIMEOUT_MS);
    const deadline = startTime + totalTimeoutMs;
    const maxRetries = opts.maxRetries ?? (process.env.AI_MAX_RETRIES ? parseInt(process.env.AI_MAX_RETRIES, 10) : 2);
    const baseBackoff = process.env.NODE_ENV === "test" ? 15 : 500;

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= maxRetries) {
      const attemptStartTime = Date.now();
      const remainingMs = deadline - attemptStartTime;
      if (remainingMs <= 100) {
        const timeoutErr = new Error(`Gemini request timed out after ${totalTimeoutMs}ms`);
        timeoutErr.name = "AbortError";
        lastError = timeoutErr;
        break;
      }

      // Per-attempt timeout: allocate remaining time, capped at 8000ms to preserve failover budget
      const attemptTimeout = Math.min(remainingMs, 8000);

      let timeoutId: NodeJS.Timeout | null = null;
      try {
        const { systemInstruction, contents } = formatGeminiContents(
          opts.messages,
          opts.systemInstruction
        );

        const genAI = opts.genAIClient || new GoogleGenerativeAI(apiKey);
        // Pass timeout directly to SDK so underlying fetch is aborted natively
        const generativeModel = genAI.getGenerativeModel(
          {
            model: activeModel,
            systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined,
          },
          { timeout: attemptTimeout }
        );

        // Safety timeout promise to guarantee resolution
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            const timeoutErr = new Error(`Gemini request timed out after ${attemptTimeout}ms`);
            timeoutErr.name = "AbortError";
            reject(timeoutErr);
          }, attemptTimeout);
          if (typeof timeoutId === "object" && "unref" in timeoutId) {
            timeoutId.unref();
          }
        });

        log.info("gemini.request.attempt", {
          model: activeModel,
          attempt,
          attemptTimeoutMs: attemptTimeout,
          remainingDeadlineMs: remainingMs,
          turns: contents.length,
        });

        const apiCall = generativeModel.generateContent({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          } as any,
        });

        const response = await Promise.race([apiCall, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);

        const result = await response.response;
        const text = result.text();

        if (!text || text.trim().length === 0) {
          log.warn("gemini.empty_response", { model: activeModel, attempt });
          return {
            ok: false,
            error: "Gemini returned an empty response.",
            code: "BAD_RESPONSE",
            durationMs: Date.now() - startTime,
          };
        }

        const attemptDurationMs = Date.now() - attemptStartTime;
        const totalDurationMs = Date.now() - startTime;
        log.info("gemini.request.success", {
          model: activeModel,
          attempt,
          attemptDurationMs,
          totalDurationMs,
          source: "gemini",
          length: text.length,
        });

        return {
          ok: true,
          text,
          model: activeModel,
          durationMs: totalDurationMs,
        };
      } catch (err: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        const attemptDurationMs = Date.now() - attemptStartTime;
        const classified = classifyGeminiError(err);
        const httpStatus = extractHttpStatus(err);
        const isTransient = isTransientGeminiError(err);
        const retryAfterMs = parseRetryAfterMs(err);
        const isDailyQuota = isDailyQuotaError(err);
        const isRateLimit = httpStatus === 429 || classified.code === "RATE_LIMIT";

        log.warn("gemini.request.failure", {
          model: activeModel,
          attempt,
          attemptDurationMs,
          errorCategory: classified.code,
          httpStatus,
          remainingDeadlineMs: Math.max(0, deadline - Date.now()),
          isTransient,
          isDailyQuota,
          retryAfterMs,
          error: classified.message,
        });

        // Failover: If current model failed due to SERVICE_UNAVAILABLE (503), MODEL_ERROR (404), or TIMEOUT,
        // switch to alternative healthy model.
        // DO NOT perform cross-model failover on RATE_LIMIT / 429 because models in the same project share project quota.
        const previousModel = activeModel;
        const allowCrossModelFailover =
          !opts.genAIClient &&
          (!isRateLimit || AI_CONFIG.crossModelRetryOnRateLimit) &&
          (classified.code === "SERVICE_UNAVAILABLE" || classified.code === "MODEL_ERROR" || classified.code === "TIMEOUT");

        if (allowCrossModelFailover) {
          const nextModel = activeModel === DEFAULT_MODEL ? FALLBACK_GEMINI_MODEL : DEFAULT_MODEL;
          if (nextModel !== activeModel) {
            log.warn("gemini.model_failover.switching", {
              failedModel: activeModel,
              failoverModel: nextModel,
              reason: classified.code,
            });
            activeModel = nextModel;
          }
        }

        // On HTTP 429 / RATE_LIMIT:
        if (isRateLimit) {
          // If response indicates daily quota exhaustion, return honest fallback promptly without retrying
          if (isDailyQuota) {
            log.warn("gemini.rate_limit.daily_quota_exhausted", {
              model: activeModel,
              attempt,
              retryAfterMs,
              action: "abort_immediate_fallback",
            });
            break;
          }

          // If response indicates a short-term rate limit, respect Retry-After only if deadline permits
          if (retryAfterMs !== null) {
            // Check if waiting retryAfterMs + minimum attempt execution (500ms) would exceed deadline
            if (Date.now() + retryAfterMs + 500 >= deadline || attempt >= maxRetries) {
              log.warn("gemini.rate_limit.retry_after_exceeds_deadline", {
                model: activeModel,
                attempt,
                retryAfterMs,
                remainingDeadlineMs: deadline - Date.now(),
              });
              break;
            }

            attempt++;
            log.info("gemini.rate_limit.short_term_retry", {
              model: activeModel,
              attempt,
              waitMs: retryAfterMs,
              remainingDeadlineMs: deadline - Date.now(),
            });
            await new Promise((r) => setTimeout(r, retryAfterMs));
            continue;
          }

          // 429 without Retry-After: stop immediate retries by default
          log.warn("gemini.rate_limit.no_retry_after", {
            model: activeModel,
            attempt,
            action: "stop_immediate_retries",
          });
          break;
        }

        // For non-rate-limit errors (503, timeout, network):
        const switchedModel = activeModel !== previousModel;
        if ((!isTransient && !switchedModel) || attempt >= maxRetries) {
          break;
        }

        attempt++;
        const backoffMs = retryAfterMs ?? Math.min(3000, baseBackoff * Math.pow(2, attempt - 1) + Math.random() * (baseBackoff / 2));

        if (Date.now() + backoffMs >= deadline) {
          log.warn("gemini.retry_skipped.deadline_exceeded", {
            attempt,
            backoffMs,
            remainingDeadlineMs: deadline - Date.now(),
          });
          break;
        }

        log.info("gemini.request.retrying", {
          model: activeModel,
          attempt,
          code: classified.code,
          backoffMs,
          remainingDeadlineMs: deadline - Date.now(),
        });

        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    const classified = classifyGeminiError(lastError);
    const retryAfterMs = parseRetryAfterMs(lastError);
    const isDailyQuota = isDailyQuotaError(lastError);
    const totalDurationMs = Date.now() - startTime;
    log.warn("gemini.request.exhausted", {
      model: activeModel,
      code: classified.code,
      httpStatus: extractHttpStatus(lastError),
      durationMs: totalDurationMs,
      retryAfterMs,
      isDailyQuota,
      finalStatus: "fallback_required",
    });

    return {
      ok: false,
      error: classified.message,
      code: classified.code,
      durationMs: totalDurationMs,
      retryAfterMs,
      isDailyQuota,
    };
  },
};
