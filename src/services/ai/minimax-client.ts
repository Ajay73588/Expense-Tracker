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
  async complete(messages: { role: string; content: string }[], timeoutMs = 60000): Promise<string | null> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const primaryUrl = process.env.MINIMAX_API_URL ?? "https://api.minimax.io/v1/chat/completions";
    // Fallback URL if the primary one has DNS/network issues
    const secondaryUrl = "https://api.minimax.chat/v1/text/chatcompletion_pro";

    if (!apiKey) {
      log.info("no api key; using fallback");
      return null;
    }

    const tryRequest = async (url: string, attempt: number): Promise<string | null> => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);

        log.info(`MiniMax Request (Attempt ${attempt})...`, {
          url: url.split("/v1")[0], // Log base URL only for privacy
          model: "MiniMax-M2.1"
        });

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "MiniMax-M2.1",
            messages,
            max_tokens: 2048,
            temperature: 0.7,
            // Some models on the .chat endpoint need this structured payload
            // but the /v1/chat/completions endpoint usually handles the OpenAI format.
          }),
          signal: controller.signal,
        });

        clearTimeout(id);

        if (!res.ok) {
          const errorBody = await res.text();
          log.warn(`MiniMax Error (Attempt ${attempt})`, {
            status: res.status,
            body: errorBody.slice(0, 200)
          });
          return null;
        }

        const body = await res.json();
        // Handle both OpenAI format and MiniMax custom format
        const content = body.choices?.[0]?.message?.content || body.reply || body.content;

        if (content) {
          log.info("MiniMax Success", { length: content.length });
          return content;
        }
        return null;
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        log.warn(`MiniMax Failed (Attempt ${attempt})`, {
          error: err instanceof Error ? err.message : "unknown",
          type: isTimeout ? "TIMEOUT" : "NETWORK_ERROR"
        });
        return null;
      }
    };

    // Attempt 1: Primary URL
    let result = await tryRequest(primaryUrl, 1);

    // Attempt 2: Primary again or Secondary if it was a network error
    if (!result) {
      log.info("Retrying MiniMax request...");
      result = await tryRequest(primaryUrl, 2);
    }

    return result;
  },
};
