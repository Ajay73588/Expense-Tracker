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
  async complete(messages: { role: string; content: string }[], timeoutMs = 15000): Promise<string | null> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const apiUrl =
      process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/chat/completions";

    log.info("Checking API Key...", { hasKey: !!apiKey, keyLength: apiKey?.length });

    if (!apiKey) {
      log.info("no api key; using fallback");
      return null;
    }
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "MiniMax-M2.1",
          messages,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!res.ok) {
        const errorBody = await res.text();
        log.warn("minimax non-ok response", { status: res.status, body: errorBody });
        return null;
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      
      log.info("minimax success", { 
        hasChoices: !!body.choices, 
        choiceCount: body.choices?.length 
      });
      
      return body.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      log.warn("minimax call failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }
  },
};
