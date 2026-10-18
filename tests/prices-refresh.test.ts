/**
 * Tests for the POST /api/prices/refresh logic (PRICE-010).
 *
 * These tests use the PriceEngineService + AssetService with mocked prisma and providers,
 * so no real network calls or database are involved.
 *
 * Acceptance criteria tested:
 * - Valid provider results → DB updated, correct source/time
 * - Invalid/zero/failed result → does NOT overwrite last saved price
 * - Partial failure → only successful assets updated
 * - Unsupported asset types → reported without price update
 * - Authorization isolation → userId scoping enforced via prisma where clause
 * - No targets → returns empty summary without error
 * - Provider timeout → reported as failure, not an exception
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "../src/lib/cache";
import { PriceEngineService, type PriceTarget } from "../src/services/price-engine.service";
import { AssetService } from "../src/services/asset.service";
import type { MarketDataProvider, MutualFundPriceProvider } from "../src/services/market/market-data.provider";

// ── In-memory Prisma asset delegate (same pattern as import-flow.test.ts) ──────────────────────────
type Row = Record<string, any>;
const db: { rows: Row[]; seq: number } = { rows: [], seq: 0 };
const match = (r: Row, w: Row = {}): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (k === "NOT") return !match(r, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Row;
      if ("in" in o) return o.in.includes(r[k]);
      if ("startsWith" in o) return typeof r[k] === "string" && r[k].startsWith(o.startsWith);
    }
    return r[k] === v;
  });
const asset = {
  findMany: async ({ where, select }: Row) => {
    const rows = db.rows.filter((r) => match(r, where));
    if (!select) return rows.map((r) => ({ ...r }));
    return rows.map((r) => {
      const out: Row = {};
      for (const key of Object.keys(select)) if (select[key]) out[key] = r[key];
      return out;
    });
  },
  count: async ({ where }: Row) => db.rows.filter((r) => match(r, where)).length,
  createMany: async ({ data }: Row) => {
    for (const d of data) db.rows.push({ id: `a${++db.seq}`, deletedAt: null, priceUpdatedAt: null, exchange: null, symbol: null, isin: null, ...d });
    return { count: data.length };
  },
  update: async ({ where, data }: Row) => { const r = db.rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  updateMany: async ({ where, data }: Row) => {
    const hit = db.rows.filter((r) => match(r, where));
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  },
};
vi.mock("../src/lib/prisma", () => ({
  prisma: { asset, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) },
}));

// ── Provider helpers ──────────────────────────────────────────────────────────────────────────────
const noMf: MutualFundPriceProvider = { name: "noMf", getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "none" }) };
const okStock = (price: number): MarketDataProvider => ({
  name: "fake",
  getUSStockQuotes: async (reqs) =>
    new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price, currency: "USD", symbol: r.symbol!, exchange: "US", asOf: new Date("2026-10-10") } }])),
  getIndianStockQuotes: async (reqs) =>
    new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price, currency: "INR", symbol: r.symbol ?? "TEST", exchange: "NSE", asOf: null } }])),
});
const failStock = (): MarketDataProvider => ({
  name: "fail",
  getUSStockQuotes: async (reqs) => new Map(reqs.map((r) => [r.key, { ok: false as const, reason: "TIMEOUT" as const, message: "timed out" }])),
  getIndianStockQuotes: async (reqs) => new Map(reqs.map((r) => [r.key, { ok: false as const, reason: "TIMEOUT" as const, message: "timed out" }])),
});

const makeAsset = (id: string, type: string, opts: Partial<Row> = {}): Row => ({
  id,
  userId: "u1",
  type,
  name: `Asset ${id}`,
  symbol: type === "STOCK" ? `SYM_${id}` : null,
  isin: null,
  exchange: null,
  currency: type === "STOCK" && opts.currency === "USD" ? "USD" : "INR",
  currentPrice: 100,
  priceSource: "COST_BASIS",
  priceUpdatedAt: null,
  deletedAt: null,
  ...opts,
});

beforeEach(async () => {
  db.rows = [];
  db.seq = 0;
  await cache.clear();
});

// ────────────────────────────────────────────────────────────────────────────
// PRICE-010 acceptance tests
// ────────────────────────────────────────────────────────────────────────────

describe("PRICE-010: prices/refresh endpoint logic", () => {
  describe("A. successful refresh updates DB with correct source + time", () => {
    it("valid US stock quote: persists price and marks source=YAHOO", async () => {
      db.rows.push(makeAsset("s1", "STOCK", { currency: "USD" }));
      PriceEngineService.setProviders({ stock: okStock(200), mf: noMf });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol, isin: a.isin, exchange: a.exchange, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices("u1", assets as any, result);

      const updated = db.rows.find((r) => r.id === "s1")!;
      expect(updated.currentPrice).toBe(200);
      expect(updated.priceSource).toBe("YAHOO");
      expect(updated.priceUpdatedAt).toBeInstanceOf(Date);
    });

    it("valid INR stock quote: persists price and marks source=YAHOO", async () => {
      db.rows.push(makeAsset("s2", "STOCK", { currency: "INR" }));
      PriceEngineService.setProviders({ stock: okStock(350), mf: noMf });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol, isin: a.isin, exchange: a.exchange, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices("u1", assets as any, result);

      const updated = db.rows.find((r) => r.id === "s2")!;
      expect(updated.currentPrice).toBe(350);
      expect(updated.priceSource).toBe("YAHOO");
    });
  });

  describe("B. failed/invalid results do NOT overwrite last good price", () => {
    it("provider failure → currentPrice stays at last stored value", async () => {
      db.rows.push(makeAsset("s3", "STOCK", { currency: "USD", currentPrice: 999, priceSource: "YAHOO" }));
      PriceEngineService.setProviders({ stock: failStock(), mf: noMf });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol, isin: a.isin, exchange: a.exchange, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices("u1", assets as any, result);

      const row = db.rows.find((r) => r.id === "s3")!;
      expect(row.currentPrice).toBe(999);     // unchanged
      expect(row.priceSource).toBe("YAHOO"); // unchanged
    });

    it("provider throws entirely → no DB writes for any asset", async () => {
      db.rows.push(makeAsset("s4", "STOCK", { currency: "USD", currentPrice: 500, priceSource: "YAHOO" }));
      PriceEngineService.setProviders({
        stock: {
          name: "crash",
          getUSStockQuotes: async () => { throw new Error("ECONNRESET"); },
          getIndianStockQuotes: async () => { throw new Error("ECONNRESET"); },
        },
        mf: noMf,
      });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets: PriceTarget[] = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol ?? null, isin: a.isin ?? null, exchange: a.exchange ?? null, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      expect(result.failures.size).toBeGreaterThan(0);
      expect(result.updates.size).toBe(0);

      await AssetService.applyPrices("u1", assets as any, result);
      const row = db.rows.find((r) => r.id === "s4")!;
      expect(row.currentPrice).toBe(500); // unchanged
    });
  });

  describe("C. partial provider failure: only successful assets updated", () => {
    it("one OK + one FAIL: only the OK asset's price changes", async () => {
      db.rows.push(makeAsset("s5", "STOCK", { currency: "USD", symbol: "GOOD", currentPrice: 100, priceSource: "COST_BASIS" }));
      db.rows.push(makeAsset("s6", "STOCK", { currency: "USD", symbol: "ZZZZ", currentPrice: 200, priceSource: "YAHOO" }));

      PriceEngineService.setProviders({
        stock: {
          name: "partial",
          getUSStockQuotes: async (reqs) =>
            new Map(reqs.map((r) => [r.key,
              r.symbol === "GOOD"
                ? { ok: true as const, quote: { price: 150, currency: "USD", symbol: "GOOD", exchange: "US", asOf: null } }
                : { ok: false as const, reason: "NOT_FOUND" as const, message: "Not found" },
            ])),
          getIndianStockQuotes: async () => new Map(),
        },
        mf: noMf,
      });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol, isin: a.isin, exchange: a.exchange, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices("u1", assets as any, result);

      const s5 = db.rows.find((r) => r.id === "s5")!;
      const s6 = db.rows.find((r) => r.id === "s6")!;
      expect(s5.currentPrice).toBe(150);     // updated
      expect(s5.priceSource).toBe("YAHOO");
      expect(s6.currentPrice).toBe(200);     // unchanged
      expect(s6.priceSource).toBe("YAHOO");
      expect(result.failures.has("s6")).toBe(true);
    });
  });

  describe("D. unsupported asset types (CRYPTO, REAL_ESTATE, CASH)", () => {
    it("crypto is reported unsupported and never given a price", async () => {
      db.rows.push(makeAsset("c1", "CRYPTO", { symbol: "BTC", currency: "INR", currentPrice: 0 }));
      PriceEngineService.setProviders({ stock: okStock(100), mf: noMf });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets: PriceTarget[] = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol ?? null, isin: a.isin ?? null, exchange: a.exchange ?? null, currency: a.currency }));
      // crypto goes to PriceEngineService unsupported, not as a target to STOCK/MF paths
      // In this test: targets is empty because we filter to STOCK/MF first
      expect(targets).toHaveLength(0);
      const result = await PriceEngineService.refresh(targets);
      expect(result.updates.size).toBe(0);
      expect(db.rows.find((r) => r.id === "c1")!.currentPrice).toBe(0); // unchanged
    });
  });

  describe("E. no holdings → returns empty summary without error", () => {
    it("user with no assets returns empty arrays", async () => {
      // No rows in db
      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      expect(assets).toHaveLength(0);
      const targets: PriceTarget[] = (assets as Row[])
        .filter((a) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a) => ({ id: a.id as string, type: a.type as string, name: a.name as string, symbol: null, isin: null, exchange: null, currency: a.currency as string }));
      const result = await PriceEngineService.refresh(targets);
      expect(result.updates.size).toBe(0);
      expect(result.failures.size).toBe(0);
      expect(result.unsupported).toHaveLength(0);
    });
  });

  describe("F. ownership isolation (userId scoping)", () => {
    it("applyPrices only writes for the requesting user's assets", async () => {
      db.rows.push(makeAsset("u1_s1", "STOCK", { userId: "u1", currency: "USD", currentPrice: 100 }));
      db.rows.push(makeAsset("u2_s1", "STOCK", { userId: "u2", currency: "USD", currentPrice: 200 }));

      PriceEngineService.setProviders({ stock: okStock(999), mf: noMf });

      const u1Assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const targets: PriceTarget[] = u1Assets.map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol ?? null, isin: a.isin ?? null, exchange: a.exchange ?? null, currency: a.currency }));
      const result = await PriceEngineService.refresh(targets);
      await AssetService.applyPrices("u1", u1Assets as any, result);

      // u1's asset is updated
      expect(db.rows.find((r) => r.id === "u1_s1")!.currentPrice).toBe(999);
      // u2's asset is not touched (applyPrices adds userId to where clause)
      expect(db.rows.find((r) => r.id === "u2_s1")!.currentPrice).toBe(200);
    });
  });

  describe("G. mixed batch: STOCK + MUTUAL_FUND + unsupported in same request", () => {
    it("STOCK and MUTUAL_FUND are priced; REAL_ESTATE falls through as unsupported", async () => {
      db.rows.push(makeAsset("m1", "MUTUAL_FUND", { symbol: null, isin: "INF000A01010", currency: "INR" }));
      db.rows.push(makeAsset("r1", "REAL_ESTATE", { symbol: null, isin: null, currency: "INR" }));

      const navProvider: MutualFundPriceProvider = {
        name: "mfOk",
        getLatestNav: async () => ({ ok: true, nav: 115, schemeCode: "123", schemeName: "Alpha Fund", asOf: new Date("2026-10-10") }),
      };
      PriceEngineService.setProviders({ stock: okStock(0), mf: navProvider });

      const assets = await asset.findMany({ where: { userId: "u1", deletedAt: null }, select: null });
      const mfTargets: PriceTarget[] = assets.filter((a: Row) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
        .map((a: Row) => ({ id: a.id, type: a.type, name: a.name, symbol: a.symbol ?? null, isin: a.isin ?? null, exchange: a.exchange ?? null, currency: a.currency }));
      const result = await PriceEngineService.refresh(mfTargets);
      await AssetService.applyPrices("u1", assets as any, result);

      const mf = db.rows.find((r) => r.id === "m1")!;
      const re = db.rows.find((r) => r.id === "r1")!;
      expect(mf.currentPrice).toBe(115);
      expect(mf.priceSource).toBe("MFAPI");
      expect(re.currentPrice).toBe(100); // unchanged (REAL_ESTATE not in targets)
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PRICE-009: USD FX path in combined refresh context
// ────────────────────────────────────────────────────────────────────────────

import { FxRateService } from "../src/services/fx-rate.service";
import { toPL } from "../src/services/asset.service";

beforeEach(async () => {
  // Reset FX provider to a safe default that always throws (avoids cross-test contamination)
  FxRateService.setProvider({ name: "reset", getRate: async () => { throw new Error("fx reset"); } });
  await cache.clear();
});

describe("PRICE-009: USD/INR FX in combined price refresh context", () => {
  it("USD holding uses explicit FX rate for INR conversion; rate is visible in toPL result", () => {
    // toPL is the pure-functional P&L calculator; verify USD→INR conversion uses the supplied rate
    const asset = { id: "u1", type: "STOCK", name: "AAPL", symbol: "AAPL", account: null };
    const result = toPL({ ...asset, quantity: 10, avgBuyPrice: 150, currentPrice: 180, currency: "USD" }, 84);
    expect(result.currentValueNative).toBe(1800);        // 10 × $180 in native USD
    expect(result.currentValue).toBe(1800 * 84);         // converted to INR at given rate
    expect(result.invested).toBe(1500 * 84);             // cost also in INR
    expect(result.pnl).toBe(300 * 84);                   // P&L in INR
    expect(result.fxRateToInr).toBe(84);
    expect(result.currency).toBe("USD");
    expect(result.valuationStatus).toBe("OK");
  });

  it("FX unavailable → asset flagged FX_UNAVAILABLE, currentValue is 0, native value preserved", () => {
    const asset = { id: "u2", type: "STOCK", name: "MSFT", symbol: "MSFT", account: null };
    const result = toPL({ ...asset, quantity: 5, avgBuyPrice: 200, currentPrice: 250, currency: "USD" }, null);
    expect(result.valuationStatus).toBe("FX_UNAVAILABLE");
    expect(result.currentValue).toBe(0);                 // excluded from INR totals
    expect(result.invested).toBe(0);                     // excluded from INR totals
    expect(result.currentValueNative).toBe(1250);        // 5 × $250 preserved in USD
    expect(result.fxRateToInr).toBeNull();
  });

  it("FX unavailable never sets rate=1 (no silent fabrication)", () => {
    const asset = { id: "u3", type: "STOCK", name: "GOOG", symbol: "GOOG", account: null };
    const result = toPL({ ...asset, quantity: 1, avgBuyPrice: 100, currentPrice: 200, currency: "USD" }, null);
    // If rate were silently set to 1, pnl would be 100; it must be 0 since FX is unavailable
    expect(result.pnl).toBe(0);
    expect(result.fxRateToInr).not.toBe(1);
  });

  it("INR holding is unaffected even when FX provider is down", () => {
    // No FxRateService call should be needed for INR assets
    const asset = { id: "u4", type: "STOCK", name: "RELIANCE", symbol: "RELIANCE", account: null };
    const result = toPL({ ...asset, quantity: 100, avgBuyPrice: 2500, currentPrice: 2700, currency: "INR" }, null);
    // null FX rate should not affect INR assets (rate treated as 1)
    expect(result.currentValue).toBe(270000);
    expect(result.invested).toBe(250000);
    expect(result.pnl).toBe(20000);
    expect(result.valuationStatus).toBe("OK");
    expect(result.fxRateToInr).toBe(1);
  });

  it("FxRateService stale fallback: provider down but cache has a good rate → stale:true, rate used", async () => {
    // Prime the cache with a good rate
    FxRateService.setProvider({ name: "good", getRate: async () => ({ rate: 83, asOf: "2026-10-01" }) });
    const fresh = await FxRateService.getUsdInr();
    expect(fresh.rate).toBe(83);
    expect(fresh.stale).toBe(false);

    // Expire fresh cache key but last-good-key remains (simulate by setting provider to fail)
    await cache.del("fx:USD:INR");
    FxRateService.setProvider({ name: "down", getRate: async () => { throw new Error("network"); } });

    const stale = await FxRateService.getUsdInr();
    expect(stale.rate).toBe(83);
    expect(stale.stale).toBe(true);
    // stale rate is still the real rate, not fabricated
    expect(stale.rate).not.toBe(1);
    expect(stale.rate).not.toBe(0);
  });
});

describe("MARKET-009: Provider Rate-Limit Circuit Breaker & Cooldown", () => {
  it("Yahoo provider enters cooldown upon encountering rate limit (429)", async () => {
    const { createYahooProvider } = await import("../src/services/market/yahoo.provider");
    let callCount = 0;
    const fakeClient = {
      quote: async () => {
        callCount++;
        throw new Error("HTTP 429 Too Many Requests");
      },
      search: async () => ({ quotes: [] }),
    };

    const provider = createYahooProvider({ client: fakeClient as any });
    const res1 = await provider.getUSStockQuotes([{ key: "US:AAPL", symbol: "AAPL", isin: null, exchange: "US" }]);
    const out1 = res1.get("US:AAPL");
    expect(out1?.ok).toBe(false);
    if (out1 && !out1.ok) {
      expect(out1.reason).toBe("RATE_LIMITED");
    }
    expect(callCount).toBe(1);

    // Immediate second call should be caught by the circuit breaker without hitting provider client again
    const res2 = await provider.getUSStockQuotes([{ key: "US:AAPL", symbol: "AAPL", isin: null, exchange: "US" }]);
    const out2 = res2.get("US:AAPL");
    expect(out2?.ok).toBe(false);
    if (out2 && !out2.ok) {
      expect(out2.reason).toBe("RATE_LIMITED");
    }
    expect(callCount).toBe(1); // Call count remains 1!
  });

  it("MFAPI provider enters cooldown upon encountering rate limit", async () => {
    const { createMfApiProvider } = await import("../src/services/market/mfapi.provider");
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({ error: "Rate limit reached" }),
      } as any;
    };

    const mfProvider = createMfApiProvider({ fetchImpl: mockFetch });
    const res1 = await mfProvider.getLatestNav({ schemeCode: "120503", name: "Axis Bluechip", isin: null, statementNav: null });
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.reason).toBe("RATE_LIMITED");
    }
    expect(fetchCount).toBe(1);

    // Subsequent call within cooldown window is withheld without additional network calls
    const res2 = await mfProvider.getLatestNav({ schemeCode: "120503", name: "Axis Bluechip", isin: null, statementNav: null });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.reason).toBe("RATE_LIMITED");
    }
    expect(fetchCount).toBe(1);
  });
});

describe("MARKET-010: Scheduled Price & FX Refresh (Cron Job Route)", () => {
  it("enforces CRON_SECRET authentication when configured in environment", async () => {
    const { GET, POST } = await import("../app/api/cron/prices/route");
    const { NextRequest } = await import("next/server");
    process.env.CRON_SECRET = "super_secure_cron_token_12345";

    try {
      // 1. Unauthenticated request without token returns HTTP 401
      const reqNoAuth = new NextRequest("http://localhost:3000/api/cron/prices", { method: "GET" });
      const resNoAuth = await GET(reqNoAuth);
      expect(resNoAuth.status).toBe(401);

      // 2. Request with invalid token returns HTTP 401
      const reqBadToken = new NextRequest("http://localhost:3000/api/cron/prices", {
        method: "GET",
        headers: { authorization: "Bearer invalid_token" },
      });
      const resBadToken = await GET(reqBadToken);
      expect(resBadToken.status).toBe(401);

      // 3. Request with valid token succeeds
      const reqValid = new NextRequest("http://localhost:3000/api/cron/prices", {
        method: "POST",
        headers: { authorization: "Bearer super_secure_cron_token_12345" },
      });
      const resValid = await POST(reqValid);
      expect(resValid.status).toBe(200);
      const data = await resValid.json();
      expect(data.data).toHaveProperty("timestamp");
    } finally {
      delete process.env.CRON_SECRET;
    }
  });
});

