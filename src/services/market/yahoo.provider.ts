import { cache } from "../../lib/cache";
import { envInt, mapPool, ProviderError, withTimeout } from "../../lib/http";
import type { MarketDataProvider, QuoteFailureReason, QuoteOutcome, StockQuoteRequest } from "./market-data.provider";

/**
 * yahoo-finance2 adapter. UNOFFICIAL: Yahoo provides no public API contract or SLA, so this can be
 * rate-limited or break without notice. Everything vendor-specific stays in this file.
 * Prices are "latest available" (delayed by the exchange/Yahoo rules), not real-time.
 */
export interface YahooClient {
  quote(symbols: string[], queryOptions?: unknown, moduleOptions?: unknown): Promise<unknown>;
  search(query: string, queryOptions?: unknown, moduleOptions?: unknown): Promise<unknown>;
}

let defaultClient: Promise<YahooClient> | null = null;
function getDefaultClient(): Promise<YahooClient> {
  defaultClient ??= import("yahoo-finance2").then((m) => {
    const Ctor = (m as { default: new (o?: unknown) => unknown }).default;
    // suppressNotices: keep server logs clean; validation off so a Yahoo schema tweak doesn't throw.
    return new Ctor({ suppressNotices: ["yahooSurvey"] }) as YahooClient;
  });
  return defaultClient;
}

const ISIN_MAP_TTL_S = 7 * 24 * 3600;
const MOD_OPTS = { validateResult: false };

function classify(err: unknown): { reason: QuoteFailureReason; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof ProviderError && err.kind === "timeout") return { reason: "TIMEOUT", message: msg };
  if (/429|too many requests|rate.?limit/i.test(msg)) return { reason: "RATE_LIMITED", message: "Market data provider rate limit reached" };
  return { reason: "PROVIDER_ERROR", message: msg.slice(0, 200) };
}

interface RawQuote { symbol?: string; regularMarketPrice?: number; currency?: string; regularMarketTime?: Date | number | string }

function toQuoteArray(raw: unknown): RawQuote[] {
  if (Array.isArray(raw)) return raw as RawQuote[];
  return raw && typeof raw === "object" ? [raw as RawQuote] : [];
}

export function createYahooProvider(opts: { client?: YahooClient; timeoutMs?: number } = {}): MarketDataProvider {
  const timeoutMs = opts.timeoutMs ?? envInt("PROVIDER_TIMEOUT_MS", 8000);
  const client = () => (opts.client ? Promise.resolve(opts.client) : getDefaultClient());
  let rateLimitCooldownUntil = 0;

  /** ISIN → NSE/BSE ticker via Yahoo search (cached a week). */
  async function resolveIndianSymbol(isin: string, exchangeHint: string | null): Promise<string | null> {
    const key = `yf:isin:${isin}:${exchangeHint ?? ""}`;
    const hit = await cache.get<string>(key);
    if (hit) return hit;
    const c = await client();
    const res = (await withTimeout(c.search(isin, { quotesCount: 6, newsCount: 0 }, MOD_OPTS), timeoutMs, "Yahoo search")) as {
      quotes?: Array<{ symbol?: string; quoteType?: string }>;
    };
    const syms = (res.quotes ?? []).filter((q) => q.quoteType === "EQUITY" && q.symbol).map((q) => q.symbol as string);
    const want = exchangeHint === "BSE" ? [".BO", ".NS"] : [".NS", ".BO"];
    const pick = want.map((suf) => syms.find((s) => s.endsWith(suf))).find(Boolean) ?? null;
    if (pick) await cache.set(key, pick, ISIN_MAP_TTL_S);
    return pick;
  }

  async function quoteBatch(
    entries: Array<{ key: string; yahooSymbol: string }>,
    expectCurrency: string,
    market: "IN" | "US"
  ): Promise<Map<string, QuoteOutcome>> {
    const out = new Map<string, QuoteOutcome>();
    if (!entries.length) return out;

    if (Date.now() < rateLimitCooldownUntil) {
      for (const e of entries) {
        out.set(e.key, {
          ok: false,
          reason: "RATE_LIMITED",
          message: "Market data provider rate limit cooldown in effect; request withheld",
        });
      }
      return out;
    }

    const uniq = [...new Set(entries.map((e) => e.yahooSymbol))];
    let rows: RawQuote[];
    try {
      const c = await client();
      rows = toQuoteArray(await withTimeout(c.quote(uniq, {}, MOD_OPTS), timeoutMs, "Yahoo quote"));
    } catch (err) {
      const f = classify(err);
      if (f.reason === "RATE_LIMITED") {
        rateLimitCooldownUntil = Date.now() + 60_000;
      }
      for (const e of entries) out.set(e.key, { ok: false, ...f });
      return out;
    }
    const bySymbol = new Map(rows.filter((r) => r.symbol).map((r) => [String(r.symbol).toUpperCase(), r]));
    for (const e of entries) {
      const r = bySymbol.get(e.yahooSymbol.toUpperCase());
      const price = r?.regularMarketPrice;
      if (!r || typeof price !== "number" || !(price > 0)) {
        out.set(e.key, { ok: false, reason: "NOT_FOUND", message: `No price found for ${e.yahooSymbol}` });
      } else if (r.currency && r.currency !== expectCurrency) {
        out.set(e.key, { ok: false, reason: "PROVIDER_ERROR", message: `Unexpected quote currency ${r.currency} for ${e.yahooSymbol}` });
      } else {
        const t = r.regularMarketTime;
        const asOf = t instanceof Date ? t : typeof t === "number" ? new Date(t * 1000) : null;
        const base = e.yahooSymbol.replace(/\.(NS|BO)$/i, "");
        const exch = market === "US" ? "US" : /\.BO$/i.test(e.yahooSymbol) ? "BSE" : "NSE";
        out.set(e.key, { ok: true, quote: { price, currency: expectCurrency, symbol: base, exchange: exch, asOf } });
      }
    }
    return out;
  }

  return {
    name: "yahoo-finance2",

    async getIndianStockQuotes(reqs: StockQuoteRequest[]) {
      const out = new Map<string, QuoteOutcome>();
      const entries: Array<{ key: string; yahooSymbol: string }> = [];
      await mapPool(reqs, 5, async (r) => {
        try {
          let ys: string | null = null;
          if (r.symbol) ys = `${r.symbol.toUpperCase()}${r.exchange === "BSE" ? ".BO" : ".NS"}`;
          else if (r.isin) ys = await resolveIndianSymbol(r.isin, r.exchange);
          if (!ys) out.set(r.key, { ok: false, reason: "NOT_FOUND", message: `Could not resolve a ticker for ${r.isin ?? r.key}` });
          else entries.push({ key: r.key, yahooSymbol: ys });
        } catch (err) {
          out.set(r.key, { ok: false, ...classify(err) });
        }
      });
      const first = await quoteBatch(entries, "INR", "IN");
      // NSE miss with a symbol-based request → retry once on BSE.
      const retry = entries.filter((e) => {
        const o = first.get(e.key);
        return o && !o.ok && o.reason === "NOT_FOUND" && e.yahooSymbol.endsWith(".NS");
      }).map((e) => ({ key: e.key, yahooSymbol: e.yahooSymbol.replace(/\.NS$/, ".BO") }));
      const second = await quoteBatch(retry, "INR", "IN");
      for (const [k, v] of first) out.set(k, second.get(k)?.ok ? (second.get(k) as QuoteOutcome) : v);
      return out;
    },

    async getUSStockQuotes(reqs: StockQuoteRequest[]) {
      // Yahoo spells share classes with a dash (BRK.B → BRK-B).
      const entries = reqs
        .filter((r) => r.symbol)
        .map((r) => ({ key: r.key, yahooSymbol: (r.symbol as string).toUpperCase().replace(/\./g, "-") }));
      const out = await quoteBatch(entries, "USD", "US");
      for (const r of reqs) {
        if (!r.symbol) out.set(r.key, { ok: false, reason: "NOT_FOUND", message: "Missing ticker symbol" });
      }
      return out;
    },
  };
}
