import { createLogger } from "../../lib/logger";

const log = createLogger("MinimaxClient");

/**
 * Minimax API client.
 *
 * CURRENT STATE: if MINIMAX_API_KEY is set, calls the real API. Otherwise
 * returns `null` to signal the caller should fall back to rule-based generation.
 *
 * TODO (production): implement SSE streaming, JSON-mode, retry with backoff,
 * and circuit breaker for sustained failures.
 */
export const MinimaxClient = {
  async complete(prompt: string): Promise<string | null> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const apiUrl =
      process.env.MINIMAX_API_URL ?? "https://api.minimax.chat/v1/text/chatcompletion_v2";
    if (!apiKey) {
      log.info("no api key; using fallback");
      return null;
    }
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "abab6.5-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        log.warn("minimax non-ok", { status: res.status });
        return null;
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return body.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      log.warn("minimax call failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }
  },
};
