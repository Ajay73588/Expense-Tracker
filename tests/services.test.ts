import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "../src/lib/cache";
import { FxRateService, FxUnavailableError } from "../src/services/fx-rate.service";
import { createFrankfurterProvider, type FxProvider } from "../src/services/fx/fx.provider";
import { PriceEngineService } from "../src/services/price-engine.service";
import { createYahooProvider, type YahooClient } from "../src/services/market/yahoo.provider";
import { createMfApiProvider } from "../src/services/market/mfapi.provider";
import type { MarketDataProvider, MutualFundPriceProvider } from "../src/services/market/market-data.provider";
import { toPL } from "../src/services/asset.service";
import { assertPrismaMode } from "../src/lib/feature-gate";

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(async () => { await cache.clear(); });

describe("I. USD → INR conversion (FxRateService)", () => {
  const fake = (impl: () => Promise<{ rate: number; asOf: string }>): FxProvider & { calls: number } => {
    const p = { name: "fake", calls: 0, getRate: async () => { p.calls++; return impl(); } };
    return p;
  };

  it("converts using the fetched rate (no hard-coded number anywhere)", async () => {
    FxRateService.setProvider(fake(async () => ({ rate: 83.25, asOf: "2026-10-06" })));
    const fx = await FxRateService.getUsdInr();
    expect(fx).toMatchObject({ rate: 83.25, asOf: "2026-10-06", stale: false, source: "fake" });
    expect(FxRateService.convertUsdToInr(10, fx.rate)).toBeCloseTo(832.5, 8);
  });
  it("100 concurrent callers share ONE provider request, then the cache serves later calls", async () => {
    const p = fake(async () => ({ rate: 84, asOf: "2026-10-06" }));
    FxRateService.setProvider(p);
    await Promise.all(Array.from({ length: 100 }, () => FxRateService.getUsdInr()));
    await FxRateService.getUsdInr();
    expect(p.calls).toBe(1);
  });
  it("INR needs no FX call", async () => {
    const p = fake(async () => ({ rate: 1, asOf: "x" }));
    FxRateService.setProvider(p);
    expect((await FxRateService.rateToInr("INR")).rate).toBe(1);
    expect(p.calls).toBe(0);
  });

  describe("M. FX API failure", () => {
    it("no cached rate + provider down → FxUnavailableError (never a made-up rate)", async () => {
      FxRateService.setProvider(fake(async () => { throw new Error("boom"); }));
      await expect(FxRateService.getUsdInr()).rejects.toBeInstanceOf(FxUnavailableError);
    });
    it("provider down but a previous rate exists → last-known rate flagged stale", async () => {
      let up = true;
      FxRateService.setProvider(fake(async () => { if (!up) throw new Error("down"); return { rate: 85, asOf: "2026-10-01" }; }));
      await FxRateService.getUsdInr();
      await cache.del("fx:USD:INR"); // fresh entry expired; last-good copy remains
      up = false;
      expect(await FxRateService.getUsdInr()).toMatchObject({ rate: 85, stale: true });
    });
  });

  describe("Frankfurter provider", () => {
    it("parses the documented response and requests USD→INR", async () => {
      const f = vi.fn(() => json({ amount: 1, base: "USD", date: "2026-10-06", rates: { INR: 88.1 } }));
      const q = await createFrankfurterProvider({ fetchImpl: f as any, baseUrl: "https://fx.test/v1" }).getRate("USD", "INR");
      expect(q).toEqual({ rate: 88.1, asOf: "2026-10-06" });
      expect((f.mock.calls[0] as unknown[])[0]).toBe("https://fx.test/v1/latest?base=USD&symbols=INR");
    });
    it.each([
      ["HTTP 500", () => json({}, 500)],
      ["HTTP 429", () => json({}, 429)],
      ["malformed body", () => json({ nope: true })],
      ["zero rate", () => json({ date: "d", rates: { INR: 0 } })],
    ])("%s → throws", async (_n, resp) => {
      await expect(createFrankfurterProvider({ fetchImpl: resp as any }).getRate("USD", "INR")).rejects.toThrow();
    });
  });
});

describe("J/K. current value & P&L", () => {
  const base = { id: "1", type: "STOCK", name: "n", symbol: "S", account: null };
  it("J. US stock: USD value × USDINR = INR value; native USD figures preserved", () => {
    const a = toPL({ ...base, quantity: 5, avgBuyPrice: 180, currentPrice: 200, currency: "USD" }, 83);
    expect(a.currentValueNative).toBe(1000);            // 5 × $200
    expect(a.investedNative).toBe(900);                 // original cost untouched
    expect(a.currentValue).toBe(1000 * 83);             // INR
    expect(a.invested).toBe(900 * 83);
    expect(a.pnl).toBe(100 * 83);
    expect(a.pnlPercent).toBeCloseTo((100 / 900) * 100, 8);
    expect(a.currency).toBe("USD");
    expect(a.avgBuyPrice).toBe(180);                    // not converted
    expect(a.valuationStatus).toBe("OK");
  });
  it("J. fractional US shares", () => {
    const a = toPL({ ...base, quantity: 0.13631341, avgBuyPrice: 175.55, currentPrice: 190, currency: "USD" }, 80);
    expect(a.currentValue).toBeCloseTo(0.13631341 * 190 * 80, 6);
  });
  it("J. FX unavailable → excluded from INR totals and flagged (not valued at rate 1)", () => {
    const a = toPL({ ...base, quantity: 5, avgBuyPrice: 180, currentPrice: 200, currency: "USD" }, null);
    expect(a).toMatchObject({ valuationStatus: "FX_UNAVAILABLE", currentValue: 0, invested: 0, fxRateToInr: null, currentValueNative: 1000 });
  });
  it("K. Indian stock: INR, no conversion even if an FX rate is supplied", () => {
    const a = toPL({ ...base, quantity: 10, avgBuyPrice: 2000, currentPrice: 2100, currency: "INR" }, 83);
    expect(a).toMatchObject({ currentValue: 21000, invested: 20000, pnl: 1000, fxRateToInr: 1, valuationStatus: "OK" });
    expect(a.pnlPercent).toBeCloseTo(5, 8);
  });
  it("COST_BASIS price is flagged as 'no market price'", () => {
    const a = toPL({ ...base, quantity: 1, avgBuyPrice: 10, currentPrice: 10, currency: "INR", priceSource: "COST_BASIS" }, null);
    expect(a.valuationStatus).toBe("NO_MARKET_PRICE");
  });
});

describe("L. market-data failures (PriceEngineService)", () => {
  const stockProvider = (impl: MarketDataProvider["getUSStockQuotes"]): MarketDataProvider & { us: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> } => {
    const us = vi.fn(impl);
    const inn = vi.fn(async (reqs: any[]) => new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price: 100, currency: "INR", symbol: "RELIANCE", exchange: "NSE", asOf: null } }])));
    return { name: "fake", getUSStockQuotes: us as any, getIndianStockQuotes: inn as any, us, in: inn };
  };
  const noMf: MutualFundPriceProvider = { name: "x", getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "none" }) };
  const usT = (id: string, symbol: string) => ({ id, type: "STOCK", name: symbol, symbol, isin: null, exchange: null, currency: "USD" });

  it("batches: 10 US tickers → ONE provider call; second refresh served from cache", async () => {
    const p = stockProvider(async (reqs) => new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price: 150, currency: "USD", symbol: r.symbol!, exchange: "US", asOf: null } }])));
    PriceEngineService.setProviders({ stock: p, mf: noMf });
    const targets = Array.from({ length: 10 }, (_, i) => usT(`id${i}`, `T${i}`));
    const r1 = await PriceEngineService.refresh(targets);
    expect(p.us).toHaveBeenCalledTimes(1);
    expect(r1.updates.size).toBe(10);
    await PriceEngineService.refresh(targets);
    expect(p.us).toHaveBeenCalledTimes(1);
  });
  it("same ticker held in two rows is requested once", async () => {
    const p = stockProvider(async (reqs) => new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price: 1, currency: "USD", symbol: "A", exchange: "US", asOf: null } }])));
    PriceEngineService.setProviders({ stock: p, mf: noMf });
    await PriceEngineService.refresh([usT("a", "AAPL"), usT("b", "AAPL")]);
    expect(p.us.mock.calls[0][0]).toHaveLength(1);
  });
  it("provider throws → failures recorded, NO updates, nothing thrown", async () => {
    PriceEngineService.setProviders({ stock: stockProvider(async () => { throw new Error("ECONNRESET"); }), mf: noMf });
    const r = await PriceEngineService.refresh([usT("a", "AAPL")]);
    expect(r.updates.size).toBe(0);
    expect(r.failures.get("a")).toMatchObject({ reason: "PROVIDER_ERROR" });
  });
  it("one bad ticker does not drop the others", async () => {
    PriceEngineService.setProviders({
      stock: stockProvider(async (reqs) => new Map(reqs.map((r) => [r.key, r.symbol === "ZZZZ"
        ? { ok: false as const, reason: "NOT_FOUND" as const, message: "No price found for ZZZZ" }
        : { ok: true as const, quote: { price: 5, currency: "USD", symbol: r.symbol!, exchange: "US", asOf: null } }]))),
      mf: noMf,
    });
    const r = await PriceEngineService.refresh([usT("a", "AAPL"), usT("z", "ZZZZ")]);
    expect([...r.updates.keys()]).toEqual(["a"]);
    expect(r.failures.get("z")?.reason).toBe("NOT_FOUND");
  });
  it("failed lookups are not cached as prices", async () => {
    const p = stockProvider(async (reqs) => new Map(reqs.map((r) => [r.key, { ok: false as const, reason: "TIMEOUT" as const, message: "t" }])));
    PriceEngineService.setProviders({ stock: p, mf: noMf });
    await PriceEngineService.refresh([usT("a", "AAPL")]);
    await PriceEngineService.refresh([usT("a", "AAPL")]);
    expect(p.us).toHaveBeenCalledTimes(2);
  });
  it("crypto / cash are reported unsupported, never given an invented price", async () => {
    PriceEngineService.setProviders({ stock: stockProvider(async () => new Map()), mf: noMf });
    const r = await PriceEngineService.refresh([{ id: "c", type: "CRYPTO", name: "BTC", symbol: "BTC", isin: null, exchange: null, currency: "INR" }]);
    expect(r.unsupported).toEqual(["c"]);
    expect(r.updates.size).toBe(0);
  });
  it("ISIN-only Indian stock is routed to the Indian-market call", async () => {
    const p = stockProvider(async () => new Map());
    PriceEngineService.setProviders({ stock: p, mf: noMf });
    const r = await PriceEngineService.refresh([{ id: "i", type: "STOCK", name: "Alpha", symbol: null, isin: "INE000A01010", exchange: null, currency: "INR" }]);
    expect(p.in).toHaveBeenCalledTimes(1);
    expect(r.updates.get("i")).toMatchObject({ source: "YAHOO", symbol: "RELIANCE", exchange: "NSE" });
  });
});

describe("Yahoo provider (fake client)", () => {
  const client = (quote: YahooClient["quote"], search: YahooClient["search"] = async () => ({ quotes: [] })): YahooClient => ({ quote, search });

  it("US: one batched quote call; maps symbol, price, currency", async () => {
    const quote = vi.fn(async (syms: string[]) => syms.map((s) => ({ symbol: s, regularMarketPrice: 123.4, currency: "USD" })));
    const out = await createYahooProvider({ client: client(quote as any) }).getUSStockQuotes([
      { key: "a", symbol: "AAPL", isin: null, exchange: null }, { key: "b", symbol: "BRK.B", isin: null, exchange: null },
    ]);
    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote.mock.calls[0][0]).toEqual(["AAPL", "BRK-B"]);
    expect(out.get("a")).toMatchObject({ ok: true, quote: { price: 123.4, currency: "USD", symbol: "AAPL" } });
  });
  it("India: ISIN → ticker via search (cached), quoted as .NS in INR", async () => {
    const search = vi.fn(async () => ({ quotes: [{ symbol: "ALPHA.BO", quoteType: "EQUITY" }, { symbol: "ALPHA.NS", quoteType: "EQUITY" }] }));
    const quote = vi.fn(async (syms: string[]) => syms.map((s) => ({ symbol: s, regularMarketPrice: 2100, currency: "INR" })));
    const p = createYahooProvider({ client: client(quote as any, search as any) });
    const req = [{ key: "k", symbol: null, isin: "INE000A01010", exchange: null }];
    const o1 = await p.getIndianStockQuotes(req);
    await p.getIndianStockQuotes(req);
    expect(o1.get("k")).toMatchObject({ ok: true, quote: { symbol: "ALPHA", exchange: "NSE", price: 2100 } });
    expect(search).toHaveBeenCalledTimes(1); // second time from cache
  });
  it("India: NSE miss falls back to BSE", async () => {
    const quote = vi.fn(async (syms: string[]) => syms.filter((s) => s.endsWith(".BO")).map((s) => ({ symbol: s, regularMarketPrice: 50, currency: "INR" })));
    const o = await createYahooProvider({ client: client(quote as any) }).getIndianStockQuotes([{ key: "k", symbol: "SMALLCO", isin: null, exchange: null }]);
    expect(o.get("k")).toMatchObject({ ok: true, quote: { exchange: "BSE" } });
  });
  it.each([
    ["rate limit", new Error("Too Many Requests"), "RATE_LIMITED"],
    ["generic failure", new Error("socket hang up"), "PROVIDER_ERROR"],
  ])("%s is classified, not thrown", async (_n, err, reason) => {
    const o = await createYahooProvider({ client: client((async () => { throw err; }) as any) }).getUSStockQuotes([{ key: "a", symbol: "AAPL", isin: null, exchange: null }]);
    expect(o.get("a")).toMatchObject({ ok: false, reason });
  });
  it("timeout is classified as TIMEOUT", async () => {
    const o = await createYahooProvider({ timeoutMs: 20, client: client((() => new Promise(() => {})) as any) }).getUSStockQuotes([{ key: "a", symbol: "AAPL", isin: null, exchange: null }]);
    expect(o.get("a")).toMatchObject({ ok: false, reason: "TIMEOUT" });
  });
  it("invalid symbol (no result) → NOT_FOUND; wrong currency → rejected", async () => {
    const quote = async (syms: string[]) => syms.filter((s) => s !== "NOPE").map((s) => ({ symbol: s, regularMarketPrice: 9, currency: "GBp" }));
    const o = await createYahooProvider({ client: client(quote as any) }).getUSStockQuotes([
      { key: "n", symbol: "NOPE", isin: null, exchange: null }, { key: "l", symbol: "LSE1", isin: null, exchange: null },
    ]);
    expect(o.get("n")).toMatchObject({ ok: false, reason: "NOT_FOUND" });
    expect(o.get("l")).toMatchObject({ ok: false, reason: "PROVIDER_ERROR" });
  });
});

describe("mfapi.in provider (fake fetch)", () => {
  const route = (map: Record<string, unknown>) => vi.fn((url: string) => {
    const hit = Object.entries(map).find(([k]) => url.includes(k));
    return hit ? json(hit[1]) : json({}, 404);
  });
  const latest = (code: number, name: string, nav: string, isin?: string) => ({
    meta: { scheme_code: code, scheme_name: name, ...(isin ? { isin_growth: isin } : {}) },
    data: [{ date: "06-10-2026", nav }], status: "SUCCESS",
  });
  const search = [
    { schemeCode: 1, schemeName: "Alpha Flexi Cap Fund - Direct Plan - Growth" },
    { schemeCode: 2, schemeName: "Alpha Flexi Cap Fund - Regular Plan - Growth" },
    { schemeCode: 3, schemeName: "Alpha Flexi Cap Fund - Direct Plan - IDCW" },
  ];

  it("name with 'Direct Growth' picks the Direct/Growth scheme and reads latest NAV", async () => {
    const f = route({ "/mf/search": search, "/mf/1/latest": latest(1, "Alpha Flexi Cap Fund - Direct Plan - Growth", "110.55") });
    const o = await createMfApiProvider({ fetchImpl: f as any }).getLatestNav({ name: "Alpha Flexi Cap Fund Direct Growth", isin: null, statementNav: 110 });
    expect(o).toMatchObject({ ok: true, nav: 110.55, schemeCode: "1" });
    expect((o as any).asOf.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
  it("ISIN in scheme metadata is decisive", async () => {
    const f = route({
      "/mf/search": search,
      "/mf/1/latest": latest(1, "Alpha Flexi Cap Fund - Direct Plan - Growth", "110", "INF000A01010"),
      "/mf/2/latest": latest(2, "Alpha Flexi Cap Fund - Regular Plan - Growth", "100", "INF000A01028"),
    });
    const o = await createMfApiProvider({ fetchImpl: f as any }).getLatestNav({ name: "Alpha Flexi Cap Fund", isin: "INF000A01028", statementNav: null });
    expect(o).toMatchObject({ ok: true, schemeCode: "2", nav: 100 });
  });
  it("name without plan info, no ISIN proof, both Direct & Regular plausible → refuses to guess", async () => {
    const f = route({
      "/mf/search": search.slice(0, 2),
      "/mf/1/latest": latest(1, "Alpha Flexi Cap Fund - Direct Plan - Growth", "110"),
      "/mf/2/latest": latest(2, "Alpha Flexi Cap Fund - Regular Plan - Growth", "109"),
    });
    const o = await createMfApiProvider({ fetchImpl: f as any }).getLatestNav({ name: "Alpha Flexi Cap Fund", isin: null, statementNav: 109.5 });
    expect(o).toMatchObject({ ok: false, reason: "NOT_FOUND", message: expect.stringMatching(/Several schemes/) });
  });
  it("…but the statement NAV can disambiguate when plans differ enough", async () => {
    const f = route({
      "/mf/search": search.slice(0, 2),
      "/mf/1/latest": latest(1, "Alpha Flexi Cap Fund - Direct Plan - Growth", "110"),
      "/mf/2/latest": latest(2, "Alpha Flexi Cap Fund - Regular Plan - Growth", "100"),
    });
    const o = await createMfApiProvider({ fetchImpl: f as any }).getLatestNav({ name: "Alpha Flexi Cap Fund", isin: null, statementNav: 100.4 });
    expect(o).toMatchObject({ ok: true, schemeCode: "2" });
  });
  it("NAV far from the statement NAV disqualifies the candidate", async () => {
    const f = route({ "/mf/search": search.slice(0, 1), "/mf/1/latest": latest(1, "Alpha Flexi Cap Fund - Direct Plan - Growth", "50") });
    const o = await createMfApiProvider({ fetchImpl: f as any }).getLatestNav({ name: "Alpha Flexi Cap Fund Direct Growth", isin: null, statementNav: 110 });
    expect(o).toMatchObject({ ok: false, reason: "NOT_FOUND" });
  });
  it.each([
    ["HTTP 429", () => json({}, 429), "RATE_LIMITED"],
    ["HTTP 500", () => json({}, 500), "PROVIDER_ERROR"],
    ["malformed search payload", () => json({ not: "an array" }), "PROVIDER_ERROR"],
  ])("%s → classified failure", async (_n, resp, reason) => {
    const o = await createMfApiProvider({ fetchImpl: resp as any }).getLatestNav({ name: "Alpha Flexi Cap Fund", isin: null, statementNav: 1 });
    expect(o).toMatchObject({ ok: false, reason });
  });
});

describe("Firebase gate", () => {
  it("USE_FIREBASE=true → clear 501 for the new feature", () => {
    process.env.USE_FIREBASE = "true";
    try { expect(() => assertPrismaMode()).toThrow(/not supported when USE_FIREBASE=true/); }
    finally { delete process.env.USE_FIREBASE; }
    expect(() => assertPrismaMode()).not.toThrow();
  });
});
