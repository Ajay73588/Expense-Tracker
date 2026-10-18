import { cache } from "./cache";
import { createLogger } from "./logger";

const log = createLogger("rate-limit");

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

interface WindowData {
  count: number;
  expiresAt: number;
}

/**
 * Lightweight sliding-window rate limiter utilizing the central cache interface.
 * Supports in-memory Map in development/testing and Upstash Redis in serverless production.
 *
 * @param identifier Unique key (e.g., `ai:${userId}` or `ip:${ip}`)
 * @param limit Maximum allowed requests within the window
 * @param windowSeconds Time window in seconds (defaults to 60s)
 */
export async function checkRateLimit(
  identifier: string,
  limit = 30,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const cacheKey = `ratelimit:${identifier}`;
  const now = Date.now();

  try {
    const existing = await cache.get<WindowData>(cacheKey);

    if (!existing || existing.expiresAt <= now) {
      // First hit or window expired: start new window
      const newWindow: WindowData = {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      };
      await cache.set(cacheKey, newWindow, windowSeconds);
      return {
        success: true,
        limit,
        remaining: limit - 1,
        resetInSeconds: windowSeconds,
      };
    }

    // Existing window is active
    const remainingSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));

    if (existing.count >= limit) {
      log.warn("rate_limit_exceeded", {
        identifier,
        limit,
        current: existing.count,
        resetInSeconds: remainingSeconds,
      });
      return {
        success: false,
        limit,
        remaining: 0,
        resetInSeconds: remainingSeconds,
      };
    }

    // Increment count
    existing.count += 1;
    await cache.set(cacheKey, existing, remainingSeconds);

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - existing.count),
      resetInSeconds: remainingSeconds,
    };
  } catch (err) {
    // Fail-open policy: If cache or rate limit check fails, log error and allow request
    log.error("rate_limit_check_failed", {
      identifier,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: true,
      limit,
      remaining: 1,
      resetInSeconds: windowSeconds,
    };
  }
}
