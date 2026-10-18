import { beforeEach, describe, expect, it, vi } from "vitest";

// ── in-memory stand-in for the Prisma `asset` delegate (semantics used by AssetService) ─────────────
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
  findMany: async ({ where }: Row) => db.rows.filter((r) => match(r, where)).map((r) => ({ ...r })),
  count: async ({ where }: Row) => db.rows.filter((r) => match(r, where)).length,
  createMany: async ({ data }: Row) => { for (const d of data) db.rows.push({ id: `a${++db.seq}`, deletedAt: null, priceUpdatedAt: null, exchange: null, symbol: null, ...d }); return { count: data.length }; },
  update: async ({ where, data }: Row) => { const r = db.rows.find((x) => x.id === where.id)!; Object.assign(r, data); return r; },
  updateMany: async ({ where, data }: Row) => { const hit = db.rows.filter((r) => match(r, where)); hit.forEach((r) => Object.assign(r, data)); return { count: hit.length }; },
};
vi.mock("../src/lib/prisma", () => ({ prisma: { asset, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } }));

import { cache } from "../src/lib/cache";
import { ImportService } from "../src/services/import.service";
import { PriceEngineService } from "../src/services/price-engine.service";
import { FxRateService } from "../src/services/fx-rate.service";
import {
  GROWW_MF_DATA, IND_MF_DATA, IND_US_DATA, growwMfRows, indMfRows, indUsRows, makeWorkbook,
} from "./helpers/workbook";

const U = "user1";
const growwMf = (rows = GROWW_MF_DATA) => ({ broker: "GROWW" as const, assetClass: "MUTUAL_FUND" as const, fileName: "h.xlsx", bytes: makeWorkbook({ Holdings: growwMfRows(rows) }) });
const indMf = () => ({ broker: "INDMONEY" as const, assetClass: "MUTUAL_FUND" as const, fileName: "m.xlsx", bytes: makeWorkbook({ Sheet1: indMfRows(IND_MF_DATA) }) });
const indUs = (data = IND_US_DATA) => ({ broker: "INDMONEY" as const, assetClass: "US_STOCK" as const, fileName: "u.xls", bytes: makeWorkbook({ HOLDINGS_BOOK: indUsRows(data) }, "biff8") });
const live = () => db.rows.filter((r) => r.deletedAt === null);

const downProviders = () => PriceEngineService.setProviders({
  stock: { name: "down", getUSStockQuotes: async () => { throw new Error("provider down"); }, getIndianStockQuotes: async () => { throw new Error("provider down"); } },
  mf: { name: "down", getLatestNav: async () => ({ ok: false, reason: "TIMEOUT", message: "timed out" }) },
});
const fxDown = () => FxRateService.setProvider({ name: "down", getRate: async () => { throw new Error("fx down"); } });

beforeEach(async () => { db.rows = []; db.seq = 0; await cache.clear(); downProviders(); fxDown(); });

describe("H. re-import / duplicate handling (idempotent snapshot)", () => {
  it("importing the same file twice does NOT duplicate or double quantities", async () => {
    const r1 = await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const qty1 = live().map((r) => r.quantity);
    const r2 = await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    expect([r1.added, r1.updated]).toEqual([3, 0]);
    expect([r2.added, r2.updated, r2.removed]).toEqual([0, 3, 0]);
    expect(live()).toHaveLength(3);
    expect(live().map((r) => r.quantity)).toEqual(qty1);
  });
  it("changed units in a later export UPDATE the holding (not added to the old units)", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const changed = GROWW_MF_DATA.map((r, i) => (i === 0 ? [...r.slice(0, 6), 200, "20000.00", "22101.00", 0, "0%"] : r));
    await ImportService.commit(U, { ...growwMf(changed as any), replaceMissing: true });
    expect(live().find((r) => r.folio === "1001")!.quantity).toBe(200);
  });
  it("positions missing from a fresh full snapshot are soft-deleted; re-appearing ones are revived", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const r = await ImportService.commit(U, { ...growwMf(GROWW_MF_DATA.slice(0, 2)), replaceMissing: true });
    expect(r.removed).toBe(1);
    expect(live()).toHaveLength(2);
    expect(db.rows).toHaveLength(3); // soft delete: history kept
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    expect(live()).toHaveLength(3);
  });
  it("replaceMissing=false keeps absent holdings", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const r = await ImportService.commit(U, { ...growwMf(GROWW_MF_DATA.slice(0, 1)), replaceMissing: false });
    expect(r.removed).toBe(0);
    expect(live()).toHaveLength(3);
  });
  it("snapshots are scoped per broker + asset type (Groww MF import never removes INDmoney MF or US stocks)", async () => {
    await ImportService.commit(U, { ...indMf(), replaceMissing: true });
    await ImportService.commit(U, { ...indUs(), replaceMissing: true });
    await ImportService.commit(U, { ...growwMf(GROWW_MF_DATA.slice(0, 1)), replaceMissing: true });
    expect(live().filter((r) => r.importSource === "INDmoney")).toHaveLength(3 + 3);
  });
  it("different users never collide", async () => {
    await ImportService.commit("u1", { ...growwMf(), replaceMissing: true });
    await ImportService.commit("u2", { ...growwMf(), replaceMissing: true });
    expect(live()).toHaveLength(6);
  });
  it("if ANY row is invalid, nothing is removed (a bad row must not look like a sale)", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const broken = [GROWW_MF_DATA[0], [...GROWW_MF_DATA[1].slice(0, 6), "oops", "5000", "4500", 0, "0%"]];
    const r = await ImportService.commit(U, { ...growwMf(broken as any), replaceMissing: true });
    expect(r.skippedInvalidRows).toBe(1);
    expect(r.removed).toBe(0);
    expect(live()).toHaveLength(3);
  });
  it("keeps a previously fetched market price on re-import", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    Object.assign(live()[0], { currentPrice: 999, priceSource: "MFAPI" });
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    expect(live()[0]).toMatchObject({ currentPrice: 999, priceSource: "MFAPI" });
  });
});

describe("persistence of US stocks", () => {
  it("stores USD, original qty/avg price untouched, exchange US, provisional price = cost basis flagged", async () => {
    await ImportService.commit(U, { ...indUs(), replaceMissing: true });
    const aapl = live().find((r) => r.symbol === "AAPL")!;
    expect(aapl).toMatchObject({
      type: "STOCK", currency: "USD", quantity: 5, avgBuyPrice: 180, exchange: "US",
      importSource: "INDmoney", importKey: "INDMONEY|US_STOCK|INDmoney|AAPL", currentPrice: 180, priceSource: "COST_BASIS",
    });
  });
  it("market price fills in after import and is persisted with its source", async () => {
    PriceEngineService.setProviders({
      stock: { name: "fake", getIndianStockQuotes: async () => new Map(), getUSStockQuotes: async (reqs) => new Map(reqs.map((r) => [r.key, { ok: true as const, quote: { price: 210, currency: "USD", symbol: r.symbol!, exchange: "US", asOf: null } }])) },
      mf: { name: "x", getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "-" }) },
    });
    FxRateService.setProvider({ name: "fake", getRate: async () => ({ rate: 83, asOf: "2026-10-06" }) });
    const r = await ImportService.commit(U, { ...indUs(), replaceMissing: true });
    expect(r.priceEnrichment).toMatchObject({ updated: 3, failed: [] });
    expect(r.fx).toMatchObject({ rate: 83, source: "fake", stale: false });
    expect(live().find((x) => x.symbol === "MSFT")).toMatchObject({ currentPrice: 210, priceSource: "YAHOO" });
  });
});

describe("L/M. external failures never lose the import", () => {
  it("all providers + FX down → every holding still imported; failures reported per holding", async () => {
    const r = await ImportService.commit(U, { ...indUs(), replaceMissing: true });
    expect(r.added).toBe(3);
    expect(live()).toHaveLength(3);
    expect(r.priceEnrichment.updated).toBe(0);
    expect(r.priceEnrichment.failed).toHaveLength(3);
    expect(r.fx).toEqual({ error: expect.any(String) });
    expect(live().every((x) => x.priceSource === "COST_BASIS")).toBe(true); // flagged, not faked
  });
  it("mutual funds keep the statement-derived NAV when mfapi is down", async () => {
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const a = live().find((r) => r.folio === "1001")!;
    expect(a.priceSource).toBe("STATEMENT");
    expect(a.currentPrice).toBeCloseTo(11050.5 / 100.5, 8);
  });
  it("enrichment that hangs is cut off by the time budget and reported, import still succeeds", async () => {
    process.env.ENRICH_TIMEOUT_MS = "30";
    PriceEngineService.setProviders({
      stock: { name: "slow", getIndianStockQuotes: async () => new Promise(() => {}), getUSStockQuotes: async () => new Promise(() => {}) },
      mf: { name: "x", getLatestNav: async () => ({ ok: false, reason: "NOT_FOUND", message: "-" }) },
    });
    try {
      const r = await ImportService.commit(U, { ...indUs(), replaceMissing: true });
      expect(r.priceEnrichment.timedOut).toBe(true);
      expect(live()).toHaveLength(3);
    } finally { delete process.env.ENRICH_TIMEOUT_MS; }
  });
});

describe("preview / confirm gate", () => {
  it("preview writes nothing and reports the plan", async () => {
    const p = await ImportService.preview(U, growwMf());
    expect(db.rows).toHaveLength(0);
    expect(p).toMatchObject({ canImport: true, summary: { validRows: 3, invalidRows: 0 }, plan: { toAdd: 3, toUpdate: 0, toRemove: 0 } });
    await ImportService.commit(U, { ...growwMf(), replaceMissing: true });
    const again = await ImportService.preview(U, growwMf());
    expect(again.plan).toEqual({ toAdd: 0, toUpdate: 3, toRemove: 0 });
  });
  it("preview of a file with bad rows disables removals and counts invalid rows", async () => {
    const p = await ImportService.preview(U, indUs([["AAPL", "x", 5, 180, 900], ["MSFT", "x", 0, 400, 0]]));
    expect(p.summary).toMatchObject({ validRows: 1, invalidRows: 1 });
    expect(p.removalNote).toMatch(/will NOT be removed/);
  });
  it("commit refuses a file with a fatal problem and writes nothing", async () => {
    const bad = { broker: "GROWW" as const, assetClass: "MUTUAL_FUND" as const, fileName: "x.xlsx", bytes: makeWorkbook({ S: [["foo", "bar"]] }) };
    await expect(ImportService.commit(U, { ...bad, replaceMissing: true })).rejects.toThrow(/Could not find a Groww holdings table/);
    expect(db.rows).toHaveLength(0);
  });
  it("an empty (zero-holdings) statement cannot be confirmed", async () => {
    const empty = { broker: "GROWW" as const, assetClass: "MUTUAL_FUND" as const, fileName: "x.xlsx", bytes: makeWorkbook({ Holdings: growwMfRows([]) }) };
    expect((await ImportService.preview(U, empty)).canImport).toBe(false);
    await expect(ImportService.commit(U, { ...empty, replaceMissing: true })).rejects.toThrow();
  });
  it("Firebase mode: preview and commit are rejected with the unsupported error", async () => {
    process.env.USE_FIREBASE = "true";
    try {
      await expect(ImportService.preview(U, growwMf())).rejects.toMatchObject({ code: "UNSUPPORTED_IN_FIREBASE_MODE", status: 501 });
      await expect(ImportService.commit(U, { ...growwMf(), replaceMissing: true })).rejects.toMatchObject({ status: 501 });
    } finally { delete process.env.USE_FIREBASE; }
  });
});
