import { cache } from "../lib/cache";
import { createLogger } from "../lib/logger";
import { createFrankfurterProvider, type FxProvider } from "./fx/fx.provider";

const log = createLogger("FxRateService");

export interface FxRate {
  base: "USD";
  quote: "INR";
  rate: number;
  asOf: string; // provider's reference date
  fetchedAt: string;
  source: string;
  /** True when the live fetch failed and a previously fetched rate is being reused. */
  stale: boolean;
}

export class FxUnavailableError extends Error {
  constructor(message = "USD/INR exchange rate is currently unavailable") {
    super(message);
    this.name = "FxUnavailableError";
  }
}

const FRESH_KEY = "fx:USD:INR";
const LAST_GOOD_KEY = "fx:USD:INR:lastgood";
const FRESH_TTL_S = 6 * 60 * 60; // reference rate changes once per working day
const LAST_GOOD_TTL_S = 7 * 24 * 60 * 60;

let provider: FxProvider = createFrankfurterProvider();
let inflight: Promise<FxRate> | null = null;

export const FxRateService = {
  /** Test seam / future provider swap. */
  setProvider(p: FxProvider) { provider = p; inflight = null; },

  /**
   * Latest available USD→INR reference rate. Cache → provider (single in-flight request shared by all
   * concurrent callers) → last-known-good (flagged stale) → FxUnavailableError. Never a hard-coded rate.
   */
  async getUsdInr(): Promise<FxRate> {
    const cached = await cache.get<FxRate>(FRESH_KEY);
    if (cached) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const q = await provider.getRate("USD", "INR");
        const fresh: FxRate = {
          base: "USD", quote: "INR", rate: q.rate, asOf: q.asOf,
          fetchedAt: new Date().toISOString(), source: provider.name, stale: false,
        };
        await cache.set(FRESH_KEY, fresh, FRESH_TTL_S);
        await cache.set(LAST_GOOD_KEY, fresh, LAST_GOOD_TTL_S);
        return fresh;
      } catch (err) {
        const lastGood = await cache.get<FxRate>(LAST_GOOD_KEY);
        log.warn("fx.fetch.failed", { error: err instanceof Error ? err.message : "unknown", usingStale: !!lastGood });
        if (lastGood) return { ...lastGood, stale: true };
        throw new FxUnavailableError();
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  /** Rate for converting `currency` → INR. INR is 1 and needs no network. */
  async rateToInr(currency: string): Promise<{ rate: number; info: FxRate | null }> {
    if (currency === "INR") return { rate: 1, info: null };
    if (currency === "USD") { const info = await FxRateService.getUsdInr(); return { rate: info.rate, info }; }
    throw new FxUnavailableError(`Unsupported currency: ${currency}`);
  },

  convertUsdToInr(usd: number, rate: number): number { return usd * rate; },
};
