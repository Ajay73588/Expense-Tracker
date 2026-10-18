/**
 * AI Configuration Module
 * Centralizes model selection, timeout budgets, and model failover strategies.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const FALLBACK_GEMINI_MODEL = "gemini-3.6-flash";

export const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_NVIDIA_ADVISOR_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
export const DEFAULT_NVIDIA_IMPORT_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

/**
 * List of verified models supported by Google Generative AI API for low-latency & multimodal tasks.
 */
export const VERIFIED_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

/**
 * NVIDIA NIM Configuration
 * Supports separate API keys and models for AI Advisor and Document Import.
 */
export const NVIDIA_NIM_CONFIG = {
  baseUrl: process.env.NVIDIA_NIM_BASE_URL || DEFAULT_NVIDIA_BASE_URL,
  advisorKey: process.env.NVIDIA_NIM_API_KEY || "",
  importKey: process.env.NVIDIA_NIM_IMPORT_API_KEY || "",
  advisorModel: process.env.NVIDIA_NIM_ADVISOR_MODEL || DEFAULT_NVIDIA_ADVISOR_MODEL,
  importModel: process.env.NVIDIA_NIM_IMPORT_MODEL || DEFAULT_NVIDIA_IMPORT_MODEL,
  advisorTimeoutMs: process.env.NVIDIA_NIM_TIMEOUT_MS ? parseInt(process.env.NVIDIA_NIM_TIMEOUT_MS, 10) : 45000,
  importTimeoutMs: process.env.NVIDIA_NIM_IMPORT_TIMEOUT_MS ? parseInt(process.env.NVIDIA_NIM_IMPORT_TIMEOUT_MS, 10) : 90000,
  maxRetries: 2,
};

export function isNvidiaAdvisorConfigured(): boolean {
  return Boolean(process.env.NVIDIA_NIM_API_KEY && process.env.NVIDIA_NIM_API_KEY.trim().length > 0);
}

export function isNvidiaImportConfigured(): boolean {
  return Boolean(process.env.NVIDIA_NIM_IMPORT_API_KEY && process.env.NVIDIA_NIM_IMPORT_API_KEY.trim().length > 0);
}

export function resolveNvidiaAdvisorModel(overrideModel?: string): string {
  return overrideModel || process.env.NVIDIA_NIM_ADVISOR_MODEL || DEFAULT_NVIDIA_ADVISOR_MODEL;
}

export function resolveNvidiaImportModel(overrideModel?: string): string {
  return overrideModel || process.env.NVIDIA_NIM_IMPORT_MODEL || DEFAULT_NVIDIA_IMPORT_MODEL;
}

export const AI_CONFIG = {
  defaultModel: DEFAULT_GEMINI_MODEL,
  fallbackModel: FALLBACK_GEMINI_MODEL,
  timeoutMs: process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 20000,
  maxRetries: process.env.AI_MAX_RETRIES ? parseInt(process.env.AI_MAX_RETRIES, 10) : 2,
  primaryProvider: process.env.AI_PRIMARY_PROVIDER || "nvidia",
  /** On HTTP 429 rate limit or quota exhaustion, do not failover cross-model by default */
  crossModelRetryOnRateLimit: false,
};

/**
 * Resolves the effective model name, automatically mapping deprecated or non-functional
 * model strings to the verified healthy default model.
 */
export function resolveGeminiModel(overrideModel?: string): string {
  const configured = overrideModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  // Map non-functional, deprecated, or hanging model strings to the default model
  if (
    configured === "gemini-1.5-flash" ||
    configured === "gemini-1.5-flash-8b" ||
    configured === "gemini-2.0-flash" ||
    configured === "gemini-2.0-flash-lite" ||
    configured === "gemini-2.5-flash" ||
    configured === "gemini-2.5-flash-lite" ||
    configured === "gemini-flash-lite-latest"
  ) {
    return DEFAULT_GEMINI_MODEL;
  }

  return configured;
}

