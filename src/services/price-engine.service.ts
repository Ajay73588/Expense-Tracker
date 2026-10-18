import { cache, cacheKey } from "../lib/cache";
import { envInt, mapPool } from "../lib/http";
import { createLogger } from "../lib/logger";
import type { MarketDataProvider, MutualFundPriceProvider, StockQuoteRequest } from "./market/market-data.provider";
import { createYahooProvider } from "./market/yahoo.provider";
import { createMfApiProvider } from "./market/mfapi.provider";

const log = createLogger("PriceEngineService");

/**
 * Price orchestration: cache lookup → ONE batched provider call per market → cache → result.
 * No mock/random prices exist in this module. A failed lookup is reported, never papered over:
 * callers keep the last stored price and surface the failure.
 *
 *   Portfolio → PriceEngineService → MarketDataProvider (Yahoo) | MutualFundPriceProvider (mfapi.in)
 */
export type PriceSource = "YAHOO" | "MFAPI";

export interface PriceTarget {
  id: string;
  type: string; // STOCK | MUTUAL_FUND | CRYPTO | …
  name: string;
  symbol: string | null;
  isin: string | null;
  exchange: string | null;
  currency: string; // INR | USD
  /** NAV/price implied by the broker statement (used only to disambiguate MF schemes). */
  statementPrice?: number | null;
}

export interface PriceUpdate {
  price: number;
  currency: string;
  source: PriceSource;
  asOf: string | null; // ISO
  symbol: string | null;
  exchange: string | null;
}
export interface PriceFailure { reason: string; message: string }
export interface RefreshResult {
  updates: Map<string, PriceUpdate>;
  failures: Map<string, PriceFailure>;
  /** Targets deliberately not priced (crypto, real estate, cash): no provider exists. */
  unsupported: string[];
}

export interface PriceResult {
  symbol: string; price: number; currency: string; fetchedAt: Date; stale: boolean; source: string;
}

let stockProvider: MarketDataProvider = createYahooProvider();
let mfProvider: MutualFundPriceProvider = createMfApiProvider();

const stockTtl = () => envInt("STOCK_PRICE_TTL_SECONDS", 300);
const navTtl = () => envInt("MF_NAV_TTL_SECONDS", 6 * 3600);

export const PriceEngineService = {
  /** Test seam / provider swap point. */
  setProviders(p: { stock?: MarketDataProvider; mf?: MutualFundPriceProvider }) {
    if (p.stock) stockProvider = p.stock;
    if (p.mf) mfProvider = p.mf;
  },

  async refresh(targets: PriceTarget[]): Promise<RefreshResult> {
    const updates = new Map<string, PriceUpdate>();
    const failures = new Map<string, PriceFailure>();
    const unsupported: string[] = [];

    // ── stocks: group by market, dedupe by security, cache, then one batch per market ────────
    type Group = { req: StockQuoteRequest; ids: string[]; cKey: string };
    const groups: Record<"IN" | "US", Map<string, Group>> = { IN: new Map(), US: new Map() };
    const mfs: PriceTarget[] = [];

    for (const t of targets) {
      if (t.type === "STOCK") {
        const market = t.currency === "USD" ? "US" : "IN";
        const ident = t.symbol ?? t.isin;
        if (!ident) { failures.set(t.id, { reason: "NOT_FOUND", message: "No ticker or ISIN available" }); continue; }
        const key = `${market}:${ident.toUpperCase()}`;
        const g = groups[market].get(key);
        if (g) g.ids.push(t.id);
        else groups[market].set(key, {
          ids: [t.id],
          cKey: cacheKey("price", "stock", key),
          req: { key, symbol: t.symbol, isin: t.isin, exchange: t.exchange },
        });
      } else if (t.type === "MUTUAL_FUND") mfs.push(t);
      else unsupported.push(t.id);
    }

    for (const market of ["IN", "US"] as const) {
      const misses: Group[] = [];
      for (const g of groups[market].values()) {
        const hit = await cache.get<PriceUpdate>(g.cKey);
        if (hit) g.ids.forEach((id) => updates.set(id, hit));
        else misses.push(g);
      }
      if (!misses.length) continue;
      let outcomes;
      try {
        const reqs = misses.map((g) => g.req);
        outcomes = market === "IN" ? await stockProvider.getIndianStockQuotes(reqs) : await stockProvider.getUSStockQuotes(reqs);
      } catch (err) {
        for (const g of misses) g.ids.forEach((id) => failures.set(id, { reason: "PROVIDER_ERROR", message: err instanceof Error ? err.message : "Provider failure" }));
        continue;
      }
      for (const g of misses) {
        const o = outcomes.get(g.req.key);
        if (o?.ok) {
          const u: PriceUpdate = {
            price: o.quote.price, currency: o.quote.currency, source: "YAHOO",
            asOf: o.quote.asOf?.toISOString() ?? null, symbol: o.quote.symbol, exchange: o.quote.exchange,
          };
          await cache.set(g.cKey, u, stockTtl());
          g.ids.forEach((id) => updates.set(id, u));
        } else {
          const f = o ? { reason: o.reason, message: o.message } : { reason: "NOT_FOUND", message: "No result from provider" };
          g.ids.forEach((id) => failures.set(id, f));
        }
      }
    }

    // ── mutual funds: per-scheme lookups, small concurrency, cached ─────────────────────────
    await mapPool(mfs, 4, async (t) => {
      const ck = cacheKey("price", "mf", (t.isin ?? t.name).toUpperCase(), t.name.toUpperCase());
      const hit = await cache.get<PriceUpdate>(ck);
      if (hit) { updates.set(t.id, hit); return; }
      const o = await mfProvider.getLatestNav({ name: t.name, isin: t.isin, statementNav: t.statementPrice ?? null });
      if (o.ok) {
        const u: PriceUpdate = { price: o.nav, currency: "INR", source: "MFAPI", asOf: o.asOf?.toISOString() ?? null, symbol: o.schemeCode, exchange: null };
        await cache.set(ck, u, navTtl());
        updates.set(t.id, u);
      } else failures.set(t.id, { reason: o.reason, message: o.message });
    });

    log.info("price.refresh", { requested: targets.length, updated: updates.size, failed: failures.size, unsupported: unsupported.length });
    return { updates, failures, unsupported };
  },

  /** Compatibility wrapper for single manual-asset creation (AssetService.create). */
  async fetch(assetType: string, symbol: string, opts: { currency?: string } = {}): Promise<PriceResult> {
    const r = await PriceEngineService.refresh([
      { id: "single", type: assetType, name: symbol, symbol, isin: null, exchange: null, currency: opts.currency ?? "INR" },
    ]);
    const u = r.updates.get("single");
    return u
      ? { symbol, price: u.price, currency: u.currency, fetchedAt: new Date(), stale: false, source: u.source }
      : { symbol, price: 0, currency: opts.currency ?? "INR", fetchedAt: new Date(), stale: true, source: "UNAVAILABLE" };
  },
};
