import { z } from "zod";
import { fetchJson, ProviderError } from "../../lib/http";

export interface FxQuote {
  rate: number; // 1 base = rate quote
  /** Reference-rate date reported by the provider (YYYY-MM-DD). */
  asOf: string;
}

export interface FxProvider {
  name: string;
  getRate(base: "USD", quote: "INR"): Promise<FxQuote>;
}

const frankfurterSchema = z.object({
  date: z.string(),
  rates: z.record(z.number()),
});

/**
 * Frankfurter (https://frankfurter.dev) — ECB-derived reference rates, published once per working
 * day. This is a daily reference rate, NOT a tick-level / live FX quote.
 */
export function createFrankfurterProvider(
  opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}
): FxProvider {
  const baseUrl = (opts.baseUrl ?? process.env.FX_API_BASE_URL ?? "https://api.frankfurter.dev/v1").replace(/\/$/, "");
  return {
    name: "frankfurter",
    async getRate(base, quote) {
      const raw = await fetchJson(`${baseUrl}/latest?base=${base}&symbols=${quote}`, { fetchImpl: opts.fetchImpl });
      const parsed = frankfurterSchema.safeParse(raw);
      const rate = parsed.success ? parsed.data.rates[quote] : undefined;
      if (!parsed.success || typeof rate !== "number" || !(rate > 0)) {
        throw new ProviderError("invalid_response", "Unexpected FX response shape");
      }
      return { rate, asOf: parsed.data.date };
    },
  };
}
