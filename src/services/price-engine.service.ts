import { cache, cacheKey } from "../lib/cache";
import { createLogger } from "../lib/logger";

const log = createLogger("PriceEngineService");

export interface PriceResult {
  symbol: string;
  price: number;
  currency: string;
  fetchedAt: Date;
  stale: boolean;
  source: string;
}

/**
 * Unified price engine. Abstracts over NSE, BSE, MF API, CoinGecko.
 *
 * CURRENT STATE: all providers are MOCKED — they return deterministic pseudo-random
 * prices seeded by the symbol, drifted by the current day. This keeps the UI populated
 * with plausible prices without requiring real API keys.
 *
 * TODO (production):
 *   - Stock: hit NSE/BSE quote endpoints (yahoo-finance2 is a common adapter).
 *   - Mutual fund: use mfapi.in (free, NAV daily).
 *   - Crypto: use CoinGecko /simple/price.
 *   - Wrap each with a circuit breaker + retry policy.
 *   - Persist last known price to DB for "stale" fallback when all providers fail.
 */

// Deterministic hash so the "current price" is stable within a day but drifts day to day.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mockPrice(symbol: string, basePrice: number): number {
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = hash(symbol + dayKey);
  // ±8% drift from base
  const drift = ((seed % 1600) / 10000 - 0.08) * basePrice;
  return Math.max(0.01, basePrice + drift);
}

const CRYPTO_BASES: Record<string, number> = {
  BTC: 5800000,
  ETH: 340000,
  SOL: 18000,
  MATIC: 75,
  DOGE: 12,
};

const STOCK_BASES: Record<string, number> = {
  RELIANCE: 2950,
  TCS: 4150,
  INFY: 1820,
  HDFCBANK: 1680,
  ICICIBANK: 1240,
  ITC: 465,
  SBIN: 820,
  WIPRO: 560,
};

async function fetchStock(symbol: string): Promise<PriceResult> {
  const base = STOCK_BASES[symbol.toUpperCase()] ?? 1500;
  return {
    symbol,
    price: Math.round(mockPrice(symbol, base) * 100) / 100,
    currency: "INR",
    fetchedAt: new Date(),
    stale: false,
    source: "MOCK_NSE",
  };
}

async function fetchMF(symbol: string): Promise<PriceResult> {
  // MFs have smaller daily swings; base NAVs in realistic range.
  const base = 150 + (hash(symbol) % 450);
  return {
    symbol,
    price: Math.round(mockPrice(symbol, base) * 100) / 100,
    currency: "INR",
    fetchedAt: new Date(),
    stale: false,
    source: "MOCK_MFAPI",
  };
}

async function fetchCrypto(symbol: string): Promise<PriceResult> {
  const base = CRYPTO_BASES[symbol.toUpperCase()] ?? 1000;
  return {
    symbol,
    price: Math.round(mockPrice(symbol, base) * 100) / 100,
    currency: "INR",
    fetchedAt: new Date(),
    stale: false,
    source: "MOCK_COINGECKO",
  };
}

export const PriceEngineService = {
  async fetch(
    assetType: string,
    symbol: string,
    opts: { cacheTtl?: number } = {}
  ): Promise<PriceResult> {
    const key = cacheKey("price", assetType, symbol);
    const cached = await cache.get<PriceResult>(key);
    if (cached) return cached;

    let result: PriceResult;
    try {
      if (assetType === "STOCK") result = await fetchStock(symbol);
      else if (assetType === "MUTUAL_FUND") result = await fetchMF(symbol);
      else if (assetType === "CRYPTO") result = await fetchCrypto(symbol);
      else {
        // Real estate / cash — no external price feed.
        result = {
          symbol,
          price: 0,
          currency: "INR",
          fetchedAt: new Date(),
          stale: false,
          source: "NONE",
        };
      }
    } catch (err) {
      log.warn("price fetch failed, returning stale", {
        symbol,
        error: err instanceof Error ? err.message : "unknown",
      });
      result = {
        symbol,
        price: 0,
        currency: "INR",
        fetchedAt: new Date(),
        stale: true,
        source: "FALLBACK",
      };
    }

    const ttl = opts.cacheTtl ?? (assetType === "CRYPTO" ? 300 : 900);
    await cache.set(key, result, ttl);
    return result;
  },

  async refreshForAssets(
    assets: { id: string; type: string; symbol: string | null }[]
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (const a of assets) {
      if (!a.symbol) continue;
      const res = await PriceEngineService.fetch(a.type, a.symbol);
      if (res.price > 0) out.set(a.id, res.price);
    }
    return out;
  },
};
