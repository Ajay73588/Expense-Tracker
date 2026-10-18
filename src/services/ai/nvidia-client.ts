import { createLogger } from "../../lib/logger";
import {
  NVIDIA_NIM_CONFIG,
  resolveNvidiaAdvisorModel,
  resolveNvidiaImportModel,
  DEFAULT_NVIDIA_BASE_URL,
  DEFAULT_NVIDIA_ADVISOR_MODEL,
  DEFAULT_NVIDIA_IMPORT_MODEL,
} from "../../config/ai.config";

const log = createLogger("NvidiaClient");

export type NvidiaErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "BAD_RESPONSE"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_REQUEST";

export interface NvidiaChatMessage {
  role: "system" | "user" | "assistant" | string;
  content: string;
}

export type NvidiaCompletionResult =
  | {
      ok: true;
      text: string;
      model: string;
      durationMs: number;
      reasoningContent?: string;
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    }
  | {
      ok: false;
      error: string;
      code: NvidiaErrorCode;
      durationMs: number;
      retryAfterMs?: number | null;
      httpStatus?: number | null;
    };

export interface NvidiaCompleteOptions {
  messages: NvidiaChatMessage[];
  systemInstruction?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  feature?: "advisor" | "import";
  fetchFn?: typeof fetch;
}

/**
 * Sanitizes any sensitive string from output logs or error messages.
 */
export function sanitizeLog<T>(input: T, secrets?: (string | undefined)[]): T {
  if (typeof input === "string") {
    let cleaned: string = input;
    if (secrets && Array.isArray(secrets)) {
      for (const s of secrets) {
        if (s && s.trim().length >= 4) {
          cleaned = cleaned.split(s).join("[REDACTED_SECRET]");
        }
      }
    }
    cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "[REDACTED_BEARER]");
    cleaned = cleaned.replace(/nvapi-[a-zA-Z0-9_\-]+/g, "[REDACTED_API_KEY]");
    return cleaned as unknown as T;
  }

  if (input !== null && typeof input === "object") {
    if (Array.isArray(input)) {
      return input.map((item) => sanitizeLog(item, secrets)) as unknown as T;
    }
    const sanitizedObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      sanitizedObj[k] = sanitizeLog(v, secrets);
    }
    return sanitizedObj as unknown as T;
  }

  return input;
}

/**
 * Parses Retry-After duration in milliseconds from HTTP response headers or error messages.
 */
export function parseNvidiaRetryAfterMs(headers?: Headers | Record<string, string>, bodyText?: string): number | null {
  // 1. From HTTP Header
  if (headers) {
    let headerVal: string | null = null;
    if (typeof (headers as Headers).get === "function") {
      headerVal = (headers as Headers).get("retry-after") || (headers as Headers).get("Retry-After");
    } else {
      headerVal = (headers as Record<string, string>)["retry-after"] || (headers as Record<string, string>)["Retry-After"] || null;
    }

    if (headerVal) {
      const sec = parseFloat(headerVal);
      if (!isNaN(sec) && sec >= 0) {
        return Math.round(sec * 1000);
      }
      // Check RFC 2822 or ISO date
      const dateMs = Date.parse(headerVal);
      if (!isNaN(dateMs)) {
        const delta = dateMs - Date.now();
        if (delta > 0) return delta;
      }
    }
  }

  // 2. From error body
  if (bodyText) {
    const delayMatch = bodyText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s?"/i);
    if (delayMatch && delayMatch[1]) {
      const sec = parseFloat(delayMatch[1]);
      if (!isNaN(sec) && sec > 0) return Math.round(sec * 1000);
    }

    const compoundMatch = bodyText.match(
      /retry(?:-after|\s+after|\s+in)[:\s]+(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?/i
    );
    if (compoundMatch && (compoundMatch[1] || compoundMatch[2] || compoundMatch[3])) {
      const hours = compoundMatch[1] ? parseFloat(compoundMatch[1]) : 0;
      const minutes = compoundMatch[2] ? parseFloat(compoundMatch[2]) : 0;
      const seconds = compoundMatch[3] ? parseFloat(compoundMatch[3]) : 0;
      const totalSec = hours * 3600 + minutes * 60 + seconds;
      if (totalSec > 0) return Math.round(totalSec * 1000);
    }
  }

  return null;
}

/**
 * Classifies HTTP status and error descriptions into standardized NvidiaErrorCode.
 */
export function classifyNvidiaStatus(
  status: number | null,
  message: string
): { code: NvidiaErrorCode; isTransient: boolean } {
  if (status === 401 || status === 403) {
    return { code: "AUTH_ERROR", isTransient: false };
  }
  if (status === 404) {
    return { code: "MODEL_ERROR", isTransient: false };
  }
  if (status === 400 || status === 422) {
    return { code: "INVALID_REQUEST", isTransient: false };
  }
  if (status === 429) {
    return { code: "RATE_LIMIT", isTransient: true };
  }
  if (status === 503 || status === 502 || status === 504 || status === 500) {
    return { code: "SERVICE_UNAVAILABLE", isTransient: true };
  }

  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("deadline")) {
    return { code: "TIMEOUT", isTransient: true };
  }
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("econnreset") || lower.includes("etimedout")) {
    return { code: "NETWORK_ERROR", isTransient: true };
  }

  return { code: "BAD_RESPONSE", isTransient: false };
}

/**
 * Classifies an error object or message into standardized NvidiaErrorCode and transient flag.
 */
export function classifyNvidiaError(
  error: unknown,
  status?: number | null
): { code: NvidiaErrorCode; isTransient: boolean; message: string } {
  let errStatus = status ?? null;
  const msg = error instanceof Error ? error.message : String(error || "");

  if (!errStatus) {
    const statusMatch = msg.match(/\b(400|401|403|404|422|429|500|502|503|504)\b/);
    if (statusMatch) {
      errStatus = parseInt(statusMatch[1], 10);
    }
  }

  const { code, isTransient } = classifyNvidiaStatus(errStatus, msg);
  return { code, isTransient, message: msg };
}

/**
 * Checks whether an error code or status represents a transient failure eligible for bounded retry.
 */
export function isTransientNvidiaError(code: NvidiaErrorCode, status?: number | null): boolean {
  return classifyNvidiaStatus(status ?? null, code).isTransient;
}

/**
 * Extracts clean answer text and reasoning trace from reasoning-capable models.
 */
export function parseReasoningContent(rawContent: string): { text: string; reasoning?: string } {
  if (!rawContent) return { text: "" };

  // Case 1: <think> ... </think> tags
  const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    const reasoning = thinkMatch[1].trim();
    const text = rawContent.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
    return { text, reasoning };
  }

  // Case 2: <thought> ... </thought> tags
  const thoughtMatch = rawContent.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    const reasoning = thoughtMatch[1].trim();
    const text = rawContent.replace(/<thought>[\s\S]*?<\/thought>/i, "").trim();
    return { text, reasoning };
  }

  return { text: rawContent };
}

export const DEFAULT_BASE_URL = DEFAULT_NVIDIA_BASE_URL;
export const DEFAULT_ADVISOR_MODEL = DEFAULT_NVIDIA_ADVISOR_MODEL;
export const DEFAULT_IMPORT_MODEL = DEFAULT_NVIDIA_IMPORT_MODEL;

export const NvidiaClient = {
  /**
   * Check if the API key for a given feature is configured.
   */
  isConfigured(feature: "advisor" | "import" = "advisor"): boolean {
    if (feature === "import") {
      const key = process.env.NVIDIA_NIM_IMPORT_API_KEY || NVIDIA_NIM_CONFIG.importKey;
      return Boolean(key && key.trim().length > 0);
    }
    const key = process.env.NVIDIA_NIM_API_KEY || NVIDIA_NIM_CONFIG.advisorKey;
    return Boolean(key && key.trim().length > 0);
  },

  /**
   * Get the active base URL for NVIDIA NIM.
   */
  getBaseUrl(): string {
    return (process.env.NVIDIA_NIM_BASE_URL || NVIDIA_NIM_CONFIG.baseUrl || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, "");
  },

  /**
   * Get the resolved model ID for a given feature.
   */
  getModel(feature: "advisor" | "import" = "advisor"): string {
    return feature === "import" ? resolveNvidiaImportModel() : resolveNvidiaAdvisorModel();
  },

  /**
   * Complete a chat request via NVIDIA NIM OpenAI-compatible chat completions endpoint.
   */
  async complete(opts: NvidiaCompleteOptions): Promise<NvidiaCompletionResult> {
    const startTime = Date.now();
    const feature = opts.feature || "advisor";
    const fetchImpl = opts.fetchFn || fetch;

    // Resolve API key strictly per feature without silent cross-feature fallback
    const apiKey =
      opts.apiKey ||
      (feature === "import"
        ? process.env.NVIDIA_NIM_IMPORT_API_KEY || NVIDIA_NIM_CONFIG.importKey
        : process.env.NVIDIA_NIM_API_KEY || NVIDIA_NIM_CONFIG.advisorKey);

    if (!apiKey || apiKey.trim().length === 0) {
      const keyName = feature === "import" ? "NVIDIA_NIM_IMPORT_API_KEY" : "NVIDIA_NIM_API_KEY";
      log.warn("nvidia.not_configured", { feature, missingKey: keyName });
      return {
        ok: false,
        error: `${keyName} is not configured.`,
        code: "NOT_CONFIGURED",
        durationMs: Date.now() - startTime,
      };
    }

    const baseUrl = (opts.baseUrl || process.env.NVIDIA_NIM_BASE_URL || NVIDIA_NIM_CONFIG.baseUrl || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, "");
    const endpoint = `${baseUrl}/chat/completions`;

    const model =
      opts.model ||
      (feature === "import"
        ? resolveNvidiaImportModel()
        : resolveNvidiaAdvisorModel());

    const defaultTimeout =
      feature === "import"
        ? NVIDIA_NIM_CONFIG.importTimeoutMs
        : NVIDIA_NIM_CONFIG.advisorTimeoutMs;

    const totalTimeoutMs = opts.timeoutMs ?? defaultTimeout;
    const deadline = startTime + totalTimeoutMs;
    const maxRetries = opts.maxRetries ?? NVIDIA_NIM_CONFIG.maxRetries;
    const baseBackoff = process.env.NODE_ENV === "test" ? 15 : 500;

    // Build messages payload
    const formattedMessages: { role: string; content: string }[] = [];
    if (opts.systemInstruction && opts.systemInstruction.trim().length > 0) {
      formattedMessages.push({ role: "system", content: opts.systemInstruction.trim() });
    }
    for (const msg of opts.messages) {
      formattedMessages.push({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : msg.role === "system" ? "system" : "user",
        content: msg.content || "",
      });
    }

    const payload = {
      model,
      messages: formattedMessages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      stream: false,
    };

    let attempt = 0;
    let lastError: unknown = null;
    let lastStatus: number | null = null;
    let lastRetryAfterMs: number | null = null;

    while (attempt <= maxRetries) {
      const attemptStartTime = Date.now();
      const remainingMs = deadline - attemptStartTime;

      if (remainingMs <= 100) {
        const timeoutErr = new Error(`NVIDIA NIM request timed out after ${totalTimeoutMs}ms`);
        timeoutErr.name = "AbortError";
        lastError = timeoutErr;
        break;
      }

      // Per-attempt timeout capped at remaining budget
      const attemptTimeout = Math.min(remainingMs, 45000);
      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
        abortController.abort();
      }, attemptTimeout);
      if (typeof timeoutId === "object" && "unref" in timeoutId) {
        timeoutId.unref();
      }

      log.info("nvidia.request.attempt", {
        feature,
        model,
        attempt,
        attemptTimeoutMs: attemptTimeout,
        remainingDeadlineMs: remainingMs,
        endpoint,
      });

      try {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        if (timeoutId) clearTimeout(timeoutId);
        lastStatus = res.status;

        const responseText = await res.text();
        const retryAfterMs = parseNvidiaRetryAfterMs(res.headers, responseText);
        if (retryAfterMs !== null) {
          lastRetryAfterMs = retryAfterMs;
        }

        if (!res.ok) {
          const sanitizedErrBody = sanitizeLog(responseText, [apiKey]);
          let parsedMessage = `HTTP ${res.status} ${res.statusText}`;
          try {
            const errJson = JSON.parse(responseText);
            if (errJson.error?.message) {
              parsedMessage = errJson.error.message;
            } else if (errJson.message) {
              parsedMessage = errJson.message;
            }
          } catch {
            // Keep default parsedMessage
          }
          parsedMessage = sanitizeLog(parsedMessage, [apiKey]);

          const { code, isTransient } = classifyNvidiaStatus(res.status, parsedMessage);

          log.warn("nvidia.request.failure", {
            feature,
            model,
            attempt,
            httpStatus: res.status,
            code,
            isTransient,
            retryAfterMs,
            error: parsedMessage,
          });

          // Non-transient errors (400, 401, 403, 404): abort immediately
          if (!isTransient || attempt >= maxRetries) {
            return {
              ok: false,
              error: parsedMessage,
              code,
              durationMs: Date.now() - startTime,
              retryAfterMs,
              httpStatus: res.status,
            };
          }

          // Rate limit (429): respect Retry-After if within deadline
          if (res.status === 429 && retryAfterMs !== null) {
            if (Date.now() + retryAfterMs + 500 >= deadline) {
              log.warn("nvidia.rate_limit.retry_after_exceeds_deadline", {
                feature,
                attempt,
                retryAfterMs,
                remainingMs: deadline - Date.now(),
              });
              return {
                ok: false,
                error: `NVIDIA NIM rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
                code: "RATE_LIMIT",
                durationMs: Date.now() - startTime,
                retryAfterMs,
                httpStatus: 429,
              };
            }

            attempt++;
            log.info("nvidia.rate_limit.waiting", { waitMs: retryAfterMs, attempt });
            await new Promise((r) => setTimeout(r, retryAfterMs));
            continue;
          }

          // Transient 5xx / other 429: backoff and retry
          attempt++;
          const backoff = retryAfterMs ?? Math.min(3000, baseBackoff * Math.pow(2, attempt - 1) + Math.random() * (baseBackoff / 2));
          if (Date.now() + backoff >= deadline) {
            break;
          }
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        // Response is 200 OK
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          log.warn("nvidia.malformed_json_response", { feature, model, attempt });
          return {
            ok: false,
            error: "NVIDIA NIM returned invalid or malformed JSON.",
            code: "BAD_RESPONSE",
            durationMs: Date.now() - startTime,
            httpStatus: 200,
          };
        }

        const choice = data.choices && data.choices[0];
        const rawContent = choice?.message?.content || "";
        const reasoningField = choice?.message?.reasoning_content || undefined;

        const { text: cleanText, reasoning: tagReasoning } = parseReasoningContent(rawContent);
        const finalReasoning = reasoningField || tagReasoning;

        const trimmedText = cleanText.trim();
        if (!trimmedText && !finalReasoning) {
          log.warn("nvidia.empty_response", { feature, model, attempt });
          return {
            ok: false,
            error: "NVIDIA NIM returned an empty response.",
            code: "BAD_RESPONSE",
            durationMs: Date.now() - startTime,
            httpStatus: 200,
          };
        }

        const durationMs = Date.now() - startTime;
        log.info("nvidia.request.success", {
          feature,
          model: data.model || model,
          durationMs,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          textLength: (cleanText || finalReasoning || "").length,
        });

        return {
          ok: true,
          text: cleanText || finalReasoning || "",
          reasoningContent: finalReasoning,
          model: data.model || model,
          durationMs,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        };
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);
        lastError = err;
        const errMessage = sanitizeLog(err?.message || String(err), [apiKey]);
        const { code, isTransient } = classifyNvidiaStatus(lastStatus, errMessage);

        log.warn("nvidia.request.exception", {
          feature,
          model,
          attempt,
          code,
          isTransient,
          error: errMessage,
        });

        if (!isTransient || attempt >= maxRetries) {
          break;
        }

        attempt++;
        const backoff = Math.min(3000, baseBackoff * Math.pow(2, attempt - 1) + Math.random() * (baseBackoff / 2));
        if (Date.now() + backoff >= deadline) {
          break;
        }
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    // Loop exhausted
    const durationMs = Date.now() - startTime;
    const finalErrMessage = sanitizeLog(
      (lastError as Error)?.message || (lastStatus ? `HTTP ${lastStatus}` : "NVIDIA request failed."),
      [apiKey]
    );
    const { code } = classifyNvidiaStatus(lastStatus, finalErrMessage);

    log.warn("nvidia.request.exhausted", {
      feature,
      model,
      code,
      durationMs,
      httpStatus: lastStatus,
      error: finalErrMessage,
    });

    return {
      ok: false,
      error: finalErrMessage,
      code,
      durationMs,
      retryAfterMs: lastRetryAfterMs,
      httpStatus: lastStatus,
    };
  },
};
