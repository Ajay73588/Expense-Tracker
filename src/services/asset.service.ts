/**
 * AssetService — dual-mode: Prisma (default) or Firestore (USE_FIREBASE=true).
 *
 * Set USE_FIREBASE=true in .env to route through Firestore.
 * Set USE_FIREBASE=false (or leave unset) to keep using Prisma — safe rollback.
 *
 * Return shapes are IDENTICAL in both modes so callers never need to change.
 */

import { safeCache } from "../lib/safe-cache";
import { cache, cacheKey } from "../lib/cache";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";
import { PriceEngineService, type PriceTarget, type PriceUpdate, type RefreshResult } from "./price-engine.service";
import { FxRateService } from "./fx-rate.service";
import { assertPrismaMode } from "../lib/feature-gate";
import type { NormalizedHolding, Broker } from "../adapters/base.adapter";
import { BROKER_LABEL } from "../adapters/base.adapter";
import type { AssetType, AssetWithPL } from "../types";
import { Prisma } from "@prisma/client";

import {
  useFirebase,
  getCollection,
  createDoc,
  queryByUserId,
  updateDoc,
  softDeleteDoc,
} from "../lib/firebase";

const log = createLogger("AssetService");
const COL = "assets";
const QUERY_LIMIT = 500;

export interface AssetInput {
  type: AssetType;
  name: string;
  symbol?: string | null;
  quantity?: number;
  avgBuyPrice: number;
  currentPrice?: number;
  currency?: string;
  account?: string | null;
  accountId?: string | null;
  isin?: string | null;
  exchange?: string | null;
  folio?: string | null;
  priceSource?: string | null;
  importSource?: string | null;
}

interface FirestoreAsset {
  id: string;
  userId: string;
  type: string;
  name: string;
  symbol: string | null;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  account: string | null;
  accountId?: string | null;
  importSource: string | null;
  isin?: string | null;
  exchange?: string | null;
  folio?: string | null;
  priceSource?: string | null;
  priceUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function normaliseAsset(raw: FirestoreAsset) {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : null,
  };
}

interface PLInput {
  id: string; type: string; name: string; symbol: string | null; quantity: number | Prisma.Decimal;
  avgBuyPrice: number | Prisma.Decimal; currentPrice: number | Prisma.Decimal; currency: string; account: string | null;
  isin?: string | null; exchange?: string | null; priceSource?: string | null;
  priceUpdatedAt?: Date | string | null;
  folio?: string | null; importSource?: string | null; accountId?: string | null;
}

/** Pure valuation: native-currency figures + INR figures using `fx` (INR per unit of currency). */
export function toPL(a: PLInput, fx: number | null): AssetWithPL {
  const isQtyValid = a.quantity !== null && a.quantity !== undefined && !Number.isNaN(Number(a.quantity));
  const isAvgValid = a.avgBuyPrice !== null && a.avgBuyPrice !== undefined && !Number.isNaN(Number(a.avgBuyPrice));
  const isCurrValid = a.currentPrice !== null && a.currentPrice !== undefined && !Number.isNaN(Number(a.currentPrice));

  const qty = new Prisma.Decimal(isQtyValid ? a.quantity : 1);
  const avg = new Prisma.Decimal(isAvgValid ? a.avgBuyPrice : 0);
  const curr = new Prisma.Decimal(isCurrValid ? a.currentPrice : (isAvgValid ? a.avgBuyPrice : 0));

  const investedNative = qty.times(avg);
  const currentValueNative = qty.times(curr);
  const pnlNative = currentValueNative.minus(investedNative);
  
  const isINR = (a.currency || "INR").toUpperCase().trim() === "INR";
  const rate = isINR ? 1 : fx;
  const converted = rate !== null && rate !== undefined && rate > 0;
  
  const rateDec = new Prisma.Decimal(converted ? rate : 0);
  const invested = converted ? investedNative.times(rateDec) : new Prisma.Decimal(0);
  const currentValue = converted ? currentValueNative.times(rateDec) : new Prisma.Decimal(0);
  const pnl = currentValue.minus(invested);
  const pnlPercent = invested.gt(0) ? pnl.dividedBy(invested).times(100) : new Prisma.Decimal(0);
  
  const hasNoMarketPrice = !isCurrValid || a.priceSource === "COST_BASIS";

  const valuationStatus: AssetWithPL["valuationStatus"] = !converted
    ? "FX_UNAVAILABLE"
    : hasNoMarketPrice ? "NO_MARKET_PRICE" : "OK";

  let detailedValuationStatus: AssetWithPL["detailedValuationStatus"] = "MANUAL";
  if (!converted) {
    detailedValuationStatus = "FX_UNAVAILABLE";
  } else if (hasNoMarketPrice) {
    detailedValuationStatus = "COST_BASIS";
  } else if (a.priceSource === "STATEMENT") {
    detailedValuationStatus = "STATEMENT";
  } else if (a.priceSource === "MANUAL") {
    detailedValuationStatus = "MANUAL";
  } else if (a.priceSource === "YAHOO" || a.priceSource === "MFAPI") {
    const updatedTime = a.priceUpdatedAt ? new Date(a.priceUpdatedAt).getTime() : 0;
    const now = Date.now();
    const staleThresholdMs = a.priceSource === "YAHOO" ? 3 * 86_400_000 : 5 * 86_400_000;
    if (!updatedTime || now - updatedTime > staleThresholdMs) {
      detailedValuationStatus = "STALE";
    } else {
      detailedValuationStatus = "LIVE";
    }
  }
    
  return {
    id: a.id, type: a.type as AssetType, name: a.name, symbol: a.symbol,
    quantity: qty.toNumber(), avgBuyPrice: avg.toNumber(), currentPrice: curr.toNumber(),
    currency: a.currency, account: a.account, 
    invested: invested.toNumber(), currentValue: currentValue.toNumber(), 
    pnl: pnl.toNumber(), pnlPercent: pnlPercent.toNumber(),
    investedNative: investedNative.toNumber(), currentValueNative: currentValueNative.toNumber(), 
    pnlNative: pnlNative.toNumber(),
    fxRateToInr: converted ? rate : null, priceSource: a.priceSource ?? (hasNoMarketPrice ? "COST_BASIS" : null),
    priceUpdatedAt: a.priceUpdatedAt ? new Date(a.priceUpdatedAt).toISOString() : null,
    valuationStatus, detailedValuationStatus, isin: a.isin ?? null, exchange: a.exchange ?? null,
    folio: a.folio ?? null, importSource: a.importSource ?? null, accountId: a.accountId ?? null,
  };
}

/** One FX lookup per portfolio build (cached + single-flight inside FxRateService). */
async function usdRateIfNeeded(assets: { currency: string }[]): Promise<number | null> {
  if (!assets.some((a) => (a.currency || "").toUpperCase().trim() === "USD")) return null;
  try { return (await FxRateService.getUsdInr()).rate; } catch { return null; }
}

function toTargets(assets: any[]): PriceTarget[] {
  return assets.map((a) => ({
    id: a.id, type: a.type, name: a.name, symbol: a.symbol ?? null, isin: a.isin ?? null,
    exchange: a.exchange ?? null, currency: a.currency,
  }));
}

export const AssetService = {
  async list(userId: string) {
    if (useFirebase()) {
      try {
        const rows = await queryByUserId<FirestoreAsset>(COL, userId, [
          { field: "deletedAt", op: "==", value: null },
        ]);
        rows.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
        log.info("asset.list.firebase", { userId, count: rows.length });
        return rows.map(normaliseAsset);
      } catch (error: any) {
        log.error("asset.list.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty list",
        });
        return [];
      }
    }

    const { prisma } = await import("../lib/prisma");
    return prisma.asset.findMany({ where: { userId, deletedAt: null }, orderBy: { updatedAt: "desc" } });
  },

  async getById(userId: string, id: string) {
    if (useFirebase()) {
      try {
        const docSnap = await getCollection(COL).doc(id).get();
        if (!docSnap.exists) throw new NotFoundError("Asset");
        const data = docSnap.data() as FirestoreAsset;
        if (!data || data.userId !== userId || data.deletedAt) throw new NotFoundError("Asset");
        return normaliseAsset({ ...data, id: docSnap.id });
      } catch (error: any) {
        if (error instanceof NotFoundError) throw error;
        log.error("asset.getById.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const asset = await prisma.asset.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!asset) throw new NotFoundError("Asset");
    return asset;
  },

  async create(userId: string, input: AssetInput) {
    const rawQty = input.quantity !== undefined && input.quantity !== null && !Number.isNaN(Number(input.quantity)) ? input.quantity : 1;
    const rawBuy = input.avgBuyPrice !== undefined && input.avgBuyPrice !== null && !Number.isNaN(Number(input.avgBuyPrice)) ? input.avgBuyPrice : 0;
    const isCurrProvided = input.currentPrice !== undefined && input.currentPrice !== null && !Number.isNaN(Number(input.currentPrice));
    let currentPrice = isCurrProvided ? (input.currentPrice as number) : rawBuy;
    let priceSource = input.priceSource ?? null;
    let priceUpdatedAt: Date | null = null;
    const currency = (input.currency || "INR").toUpperCase().trim();
    const name = input.name.trim();
    const symbol = input.symbol ? input.symbol.trim() : null;
    const account = input.account ? input.account.trim() : null;
    const isin = input.isin ? input.isin.trim() : null;
    const exchange = input.exchange ? input.exchange.trim() : null;
    const folio = input.folio ? input.folio.trim() : null;

    if (symbol && (!input.priceSource || input.priceSource === "YAHOO" || input.priceSource === "MFAPI")) {
      try {
        const res = await PriceEngineService.fetch(input.type, symbol, { currency });
        if (res.price > 0) {
          currentPrice = res.price;
          priceSource = res.source;
          priceUpdatedAt = new Date();
        }
      } catch {
        // failed fetch leaves fallback
      }
    }

    if (!priceSource) {
      if (isCurrProvided) {
        priceSource = "MANUAL";
        priceUpdatedAt = new Date();
      } else if (["FIXED_DEPOSIT", "EPF_PPF", "REAL_ESTATE", "GOLD", "CASH"].includes(input.type)) {
        priceSource = "MANUAL";
        priceUpdatedAt = new Date();
      } else if (currentPrice === rawBuy) {
        priceSource = "COST_BASIS";
        priceUpdatedAt = null;
      } else {
        priceSource = "MANUAL";
        priceUpdatedAt = new Date();
      }
    } else if (!priceUpdatedAt && priceSource === "MANUAL") {
      priceUpdatedAt = new Date();
    }

    if (useFirebase()) {
      try {
        const raw = await createDoc<Omit<FirestoreAsset, "id">>(COL, {
          userId,
          type: input.type,
          name,
          symbol,
          quantity: rawQty,
          avgBuyPrice: rawBuy,
          currentPrice,
          currency,
          account,
          accountId: input.accountId ?? null,
          isin,
          exchange,
          folio,
          priceSource,
          priceUpdatedAt: priceUpdatedAt ? priceUpdatedAt.toISOString() : null,
          importSource: input.importSource ?? null,
          deletedAt: null,
        } as Omit<FirestoreAsset, "id">);
        await cache.delByPrefix(cacheKey("portfolio", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
        log.info("asset.create.firebase", { userId, type: input.type, name });
        return normaliseAsset(raw as FirestoreAsset);
      } catch (error: any) {
        log.error("asset.create.firebase.failed", { userId, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    if (input.accountId) {
      const accountRec = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
      if (!accountRec) throw new NotFoundError("Account");
    }
    const created = await prisma.asset.create({
      data: {
        userId,
        type: input.type,
        name,
        symbol,
        quantity: new Prisma.Decimal(rawQty),
        avgBuyPrice: new Prisma.Decimal(rawBuy),
        currentPrice: new Prisma.Decimal(currentPrice),
        currency,
        account,
        accountId: input.accountId ?? null,
        isin,
        exchange,
        folio,
        priceSource,
        priceUpdatedAt,
        importSource: input.importSource ?? null,
      },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("asset.create.prisma", { userId, type: input.type, name });
    return created;
  },

  async update(userId: string, id: string, patch: Partial<AssetInput>) {
    if (useFirebase()) {
      try {
        const docSnap = await getCollection(COL).doc(id).get();
        if (!docSnap.exists) throw new NotFoundError("Asset");
        const data = docSnap.data() as FirestoreAsset;
        if (!data || data.userId !== userId || data.deletedAt) {
          throw new NotFoundError("Asset");
        }
        const fields: Record<string, unknown> = {};
        if (patch.name !== undefined) fields.name = patch.name.trim();
        if (patch.type !== undefined) fields.type = patch.type;
        if (patch.symbol !== undefined) fields.symbol = patch.symbol ? patch.symbol.trim() : null;
        if (patch.quantity !== undefined) fields.quantity = patch.quantity;
        if (patch.avgBuyPrice !== undefined) fields.avgBuyPrice = patch.avgBuyPrice;
        if (patch.currentPrice !== undefined) {
          fields.currentPrice = patch.currentPrice;
          if (patch.priceSource !== undefined) {
            fields.priceSource = patch.priceSource;
            fields.priceUpdatedAt = new Date().toISOString();
          } else if (patch.currentPrice !== data.currentPrice) {
            fields.priceSource = "MANUAL";
            fields.priceUpdatedAt = new Date().toISOString();
          }
        } else if (data.priceSource === "COST_BASIS" && patch.avgBuyPrice !== undefined) {
          fields.currentPrice = patch.avgBuyPrice;
        } else if (patch.priceSource !== undefined) {
          fields.priceSource = patch.priceSource;
          if (patch.priceSource === "MANUAL") {
            fields.priceUpdatedAt = new Date().toISOString();
          }
        }
        if (patch.currency !== undefined) fields.currency = patch.currency.toUpperCase().trim();
        if (patch.account !== undefined) fields.account = patch.account ? patch.account.trim() : null;
        if (patch.accountId !== undefined) fields.accountId = patch.accountId;
        if (patch.isin !== undefined) fields.isin = patch.isin ? patch.isin.trim() : null;
        if (patch.exchange !== undefined) fields.exchange = patch.exchange ? patch.exchange.trim() : null;
        if (patch.folio !== undefined) fields.folio = patch.folio ? patch.folio.trim() : null;
        await updateDoc(COL, id, fields);
        await cache.delByPrefix(cacheKey("portfolio", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
        log.info("asset.update.firebase", { userId, id });
        const updatedDoc = await getCollection(COL).doc(id).get();
        return normaliseAsset({ ...(updatedDoc.data() as FirestoreAsset), id });
      } catch (error: any) {
        if (error instanceof NotFoundError) throw error;
        log.error("asset.update.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const existing = await prisma.asset.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Asset");

    const data: Prisma.AssetUncheckedUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.symbol !== undefined) data.symbol = patch.symbol ? patch.symbol.trim() : null;
    if (patch.quantity !== undefined) data.quantity = new Prisma.Decimal(patch.quantity);
    if (patch.avgBuyPrice !== undefined) data.avgBuyPrice = new Prisma.Decimal(patch.avgBuyPrice);
    if (patch.currentPrice !== undefined) {
      const newCurrDec = new Prisma.Decimal(patch.currentPrice);
      data.currentPrice = newCurrDec;
      if (patch.priceSource !== undefined) {
        data.priceSource = patch.priceSource;
        data.priceUpdatedAt = new Date();
      } else if (!newCurrDec.equals(existing.currentPrice)) {
        data.priceSource = "MANUAL";
        data.priceUpdatedAt = new Date();
      }
    } else if (existing.priceSource === "COST_BASIS" && patch.avgBuyPrice !== undefined) {
      data.currentPrice = new Prisma.Decimal(patch.avgBuyPrice);
    } else if (patch.priceSource !== undefined) {
      data.priceSource = patch.priceSource;
      if (patch.priceSource === "MANUAL") {
        data.priceUpdatedAt = new Date();
      }
    }
    if (patch.currency !== undefined) data.currency = patch.currency.toUpperCase().trim();
    if (patch.account !== undefined) data.account = patch.account ? patch.account.trim() : null;
    if (patch.accountId !== undefined) {
      if (patch.accountId) {
        const account = await prisma.account.findFirst({ where: { id: patch.accountId, userId } });
        if (!account) throw new NotFoundError("Account");
      }
      data.accountId = patch.accountId;
    }
    if (patch.isin !== undefined) data.isin = patch.isin ? patch.isin.trim() : null;
    if (patch.exchange !== undefined) data.exchange = patch.exchange ? patch.exchange.trim() : null;
    if (patch.folio !== undefined) data.folio = patch.folio ? patch.folio.trim() : null;

    const updated = await prisma.asset.update({
      where: { id: existing.id },
      data,
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    return updated;
  },

  async remove(userId: string, id: string) {
    if (useFirebase()) {
      try {
        const docSnap = await getCollection(COL).doc(id).get();
        if (!docSnap.exists) throw new NotFoundError("Asset");
        const data = docSnap.data() as FirestoreAsset;
        if (!data || data.userId !== userId || data.deletedAt) {
          throw new NotFoundError("Asset");
        }
        await softDeleteDoc(COL, id);
        await cache.delByPrefix(cacheKey("portfolio", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
      } catch (error: any) {
        if (error instanceof NotFoundError) throw error;
        log.error("asset.remove.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
      return { deleted: true };
    }

    const { prisma } = await import("../lib/prisma");
    const existing = await prisma.asset.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Asset");

    await prisma.asset.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    return { deleted: true };
  },

  async delete(userId: string, id: string) {
    return this.remove(userId, id);
  },

  getPortfolioWithPL: safeCache(
    async (userId: string, opts: { refresh?: boolean } = {}): Promise<AssetWithPL[]> => {
      if (useFirebase()) {
        try {
          const rows = await queryByUserId<FirestoreAsset>(COL, userId, [
            { field: "deletedAt", op: "==", value: null },
          ]);
          rows.sort((a, b) => a.type.localeCompare(b.type));
          const assets = rows.map(normaliseAsset);

          if (opts.refresh) {
            const { updates } = await PriceEngineService.refresh(toTargets(assets));
            for (const a of assets) {
              const u = updates.get(a.id);
              if (u && u.price !== a.currentPrice) {
                await updateDoc(COL, a.id, { currentPrice: u.price });
                a.currentPrice = u.price;
              }
            }
          }

          const fx = await usdRateIfNeeded(assets);
          log.info("asset.getPortfolioWithPL.firebase", { userId, count: assets.length });
          return assets.map((a) => toPL(a, fx));
        } catch (error: any) {
          log.error("asset.getPortfolioWithPL.firebase.failed", {
            userId, error: error?.message ?? String(error), fallback: "empty portfolio",
          });
          return [];
        }
      }

      const { prisma } = await import("../lib/prisma");
      const assets = await prisma.asset.findMany({ where: { userId, deletedAt: null }, orderBy: { type: "asc" } });

      if (opts.refresh) {
        const result = await PriceEngineService.refresh(toTargets(assets));
        await AssetService.applyPrices(userId, assets, result);
        for (const a of assets) {
          const u = result.updates.get(a.id);
          if (u) { a.currentPrice = u.price; a.priceSource = u.source; a.priceUpdatedAt = new Date(); }
        }
      }

      const fx = await usdRateIfNeeded(assets);
      return assets.map((a: any) => toPL(a, fx));
    }
  ),

  /**
   * Persists fetched prices in ONE transaction. Only genuine provider results are written;
   * failures leave the last stored price untouched. Also records a resolved ticker/exchange for
   * ISIN-only Indian stocks so later refreshes skip the ISIN lookup.
   */
  async applyPrices(
    userId: string,
    assets: Array<{ id: string; type: string; symbol: string | null; exchange?: string | null; currentPrice: number }>,
    result: Pick<RefreshResult, "updates">
  ) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const ops: any[] = [];
    for (const a of assets) {
      const u: PriceUpdate | undefined = result.updates.get(a.id);
      if (!u) continue;
      ops.push(
        prisma.asset.updateMany({
          where: { id: a.id, userId },
          data: {
            currentPrice: u.price,
            priceSource: u.source,
            priceUpdatedAt: new Date(),
            ...(a.type === "STOCK" && !a.symbol && u.symbol ? { symbol: u.symbol } : {}),
            ...(a.type === "STOCK" && !a.exchange && u.exchange ? { exchange: u.exchange } : {}),
          },
        })
      );
    }
    if (ops.length) await prisma.$transaction(ops);
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    return ops.length;
  },

  /**
   * Idempotent broker-snapshot import (Prisma/PostgreSQL only).
   *
   * Identity = (userId, importKey) where importKey = "<broker>|<assetClass>|<ISIN+folio | ticker | ISIN>".
   *  - key exists (even soft-deleted)  → UPDATE quantity/cost/metadata (never adds quantities together)
   *  - key new                         → INSERT
   *  - replaceMissing                  → soft-delete same broker+assetClass holdings absent from this file
   * Re-importing the same file is therefore a no-op apart from timestamps.
   */
  async importHoldings(
    userId: string,
    holdings: NormalizedHolding[],
    opts: { broker: string; assetClass: string; replaceMissing: boolean; account?: string | null; dryRun?: boolean }
  ) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const keys = holdings.map((h) => h.importKey);
    const existing: Array<{ id: string; importKey: string; priceSource: string | null; deletedAt: Date | null }> =
      keys.length
        ? await prisma.asset.findMany({
            where: { userId, importKey: { in: keys } },
            select: { id: true, importKey: true, priceSource: true, deletedAt: true },
          })
        : [];
    const byKey = new Map(existing.map((e) => [e.importKey, e]));
    const scopePrefix = `${opts.broker}|${opts.assetClass}|${opts.account ?? BROKER_LABEL[opts.broker as Broker]}|`;
    const missingWhere = {
      userId, deletedAt: null,
      importKey: { startsWith: scopePrefix },
      NOT: { importKey: { in: keys } },
    };

    const toAdd = holdings.filter((h) => !byKey.has(h.importKey));
    const toUpdate = holdings.filter((h) => byKey.has(h.importKey));
    if (opts.dryRun) {
      const removedHoldings = opts.replaceMissing
        ? await prisma.asset.findMany({
            where: missingWhere,
            select: { id: true, name: true, folio: true, quantity: true, symbol: true, isin: true, account: true },
          })
        : [];
      return {
        added: toAdd.length,
        updated: toUpdate.length,
        removed: removedHoldings.length,
        removedHoldings: removedHoldings.map((h: any) => ({
          id: h.id,
          name: h.name,
          folio: h.folio ?? null,
          quantity: Number(h.quantity),
          symbol: h.symbol ?? null,
          isin: h.isin ?? null,
          account: h.account ?? null,
        })),
        assets: [] as any[],
      };
    }

    let resolvedAccountId: string | null = null;
    if (opts.account && prisma.account?.findFirst) {
      try {
        const acc = await prisma.account.findFirst({
          where: { userId, OR: [{ id: opts.account }, { name: opts.account }] },
          select: { id: true },
        });
        if (acc) resolvedAccountId = acc.id;
      } catch {
        // Safe fallback if account query fails
      }
    }

    const common = (h: NormalizedHolding) => ({
      type: h.type, name: h.name, quantity: h.quantity, avgBuyPrice: h.averagePrice,
      currency: h.currency, account: h.account ?? h.sourceBroker, importSource: h.sourceBroker,
      isin: h.isin, folio: h.folio, importKey: h.importKey,
      ...(resolvedAccountId ? { accountId: resolvedAccountId } : {}),
    });
    const ops: any[] = [];
    if (toAdd.length) {
      ops.push(
        prisma.asset.createMany({
          data: toAdd.map((h) => ({
            userId, ...common(h),
            symbol: h.symbol, exchange: h.exchange,
            // Provisional price until a market price is fetched. COST_BASIS ⇒ "no market price yet".
            currentPrice: h.statementPrice ?? h.averagePrice,
            priceSource: h.statementPrice ? "STATEMENT" : "COST_BASIS",
          })),
        })
      );
    }
    for (const h of toUpdate) {
      const e = byKey.get(h.importKey)!;
      // D-08 Precedence: Live quotes (YAHOO, MFAPI) and user-entered manual valuations (MANUAL) are preserved.
      // Statement or cost-basis provisional prices are refreshed with the statement's latest values.
      const hasPreservedPrice =
        e.priceSource === "YAHOO" || e.priceSource === "MFAPI" || e.priceSource === "MANUAL";
      ops.push(
        prisma.asset.update({
          where: { id: e.id },
          data: {
            ...common(h),
            deletedAt: null,
            ...(h.symbol ? { symbol: h.symbol } : {}),
            ...(h.exchange ? { exchange: h.exchange } : {}),
            // keep a previously fetched market price or manual valuation; otherwise refresh provisional
            ...(hasPreservedPrice ? {} : {
              currentPrice: h.statementPrice ?? h.averagePrice,
              priceSource: h.statementPrice ? "STATEMENT" : "COST_BASIS",
            }),
          },
        })
      );
    }
    if (opts.replaceMissing) ops.push(prisma.asset.updateMany({ where: missingWhere, data: { deletedAt: new Date() } }));

    const results: any[] = ops.length ? await prisma.$transaction(ops) : [];
    const removed = opts.replaceMissing ? (results[results.length - 1]?.count ?? 0) : 0;

    const assets = keys.length
      ? await prisma.asset.findMany({ where: { userId, importKey: { in: keys }, deletedAt: null } })
      : [];
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("asset.importHoldings", { userId, broker: opts.broker, assetClass: opts.assetClass, added: toAdd.length, updated: toUpdate.length, removed });
    return { added: toAdd.length, updated: toUpdate.length, removed, assets };
  },

  async bulkUpsert(userId: string, holdings: AssetInput[]) {
    let added = 0;
    let updated = 0;

    if (useFirebase()) {
      try {
        // Fetch ALL user assets once — then match in JS.
        // Previously called findFirstByUserId with 4 extra filters per holding
        // which required a 5-field composite index. Now O(n) JS filter instead.
        const db = getCollection(COL);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        const existingAssets = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as FirestoreAsset & { id: string }))
          .filter(a => a.deletedAt === null || a.deletedAt === undefined);

        for (const h of holdings) {
          const existing = existingAssets.find(
            a => a.type === h.type &&
              (a.symbol ?? null) === (h.symbol ?? null) &&
              (a.account ?? null) === (h.account ?? null)
          );

          if (existing) {
            const hQty = h.quantity ?? 1;
            const newQty = existing.quantity + hQty;
            const newAvg = newQty > 0
              ? (existing.quantity * existing.avgBuyPrice + hQty * h.avgBuyPrice) / newQty
              : h.avgBuyPrice;
            await updateDoc(COL, existing.id, { quantity: newQty, avgBuyPrice: newAvg });
            updated++;
          } else {
            await AssetService.create(userId, h);
            added++;
          }
        }

        await cache.delByPrefix(cacheKey("portfolio", userId));
        log.info("asset.bulkUpsert.firebase", { userId, added, updated });
        return { added, updated };
      } catch (error: any) {
        log.error("asset.bulkUpsert.firebase.failed", {
          userId, error: error?.message ?? String(error),
        });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    for (const h of holdings) {
      const existing = await prisma.asset.findFirst({
        where: { userId, type: h.type, symbol: h.symbol ?? null, account: h.account ?? null, deletedAt: null },
      });
      if (existing) {
        const exQty = new Prisma.Decimal(existing.quantity);
        const exAvg = new Prisma.Decimal(existing.avgBuyPrice);
        const hQty = new Prisma.Decimal(h.quantity ?? 1);
        const hAvg = new Prisma.Decimal(h.avgBuyPrice);
        
        const newQty = exQty.plus(hQty);
        const newAvg = newQty.gt(0)
          ? exQty.times(exAvg).plus(hQty.times(hAvg)).dividedBy(newQty)
          : hAvg;
          
        await prisma.asset.update({ 
          where: { id: existing.id }, 
          data: { quantity: newQty, avgBuyPrice: newAvg } 
        });
        updated++;
      } else {
        await AssetService.create(userId, h);
        added++;
      }
    }
    await cache.delByPrefix(cacheKey("portfolio", userId));
    return { added, updated };
  },
};
