/**
 * AssetService — dual-mode: Prisma (default) or Firestore (USE_FIREBASE=true).
 *
 * Set USE_FIREBASE=true in .env to route through Firestore.
 * Set USE_FIREBASE=false (or leave unset) to keep using Prisma — safe rollback.
 *
 * Return shapes are IDENTICAL in both modes so callers never need to change.
 */

import { cache as reactCache } from "react";
import { cache, cacheKey } from "../lib/cache";
import { createLogger } from "../lib/logger";
import { PriceEngineService } from "./price-engine.service";
import type { AssetType, AssetWithPL } from "../types";

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
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  currency?: string;
  account?: string | null;
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
  importSource: string | null;
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

function withPL(a: ReturnType<typeof normaliseAsset>): AssetWithPL {
  const invested = a.quantity * a.avgBuyPrice;
  const currentValue = a.quantity * a.currentPrice;
  const pnl = currentValue - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
  return {
    id: a.id, type: a.type as AssetType, name: a.name, symbol: a.symbol,
    quantity: a.quantity, avgBuyPrice: a.avgBuyPrice, currentPrice: a.currentPrice,
    currency: a.currency, account: a.account, invested, currentValue, pnl, pnlPercent,
  };
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

  async create(userId: string, input: AssetInput) {
    let currentPrice = input.currentPrice ?? input.avgBuyPrice;
    if (input.symbol) {
      const res = await PriceEngineService.fetch(input.type, input.symbol);
      if (res.price > 0) currentPrice = res.price;
    }

    if (useFirebase()) {
      try {
        const raw = await createDoc<Omit<FirestoreAsset, "id">>(COL, {
          userId, type: input.type, name: input.name,
          symbol: input.symbol ?? null, quantity: input.quantity,
          avgBuyPrice: input.avgBuyPrice, currentPrice,
          currency: input.currency ?? "INR", account: input.account ?? null,
          importSource: input.importSource ?? null, deletedAt: null,
        } as Omit<FirestoreAsset, "id">);
        await cache.delByPrefix(cacheKey("portfolio", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
        log.info("asset.create.firebase", { userId, type: input.type, name: input.name });
        return normaliseAsset(raw as FirestoreAsset);
      } catch (error: any) {
        log.error("asset.create.firebase.failed", { userId, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const created = await prisma.asset.create({
      data: {
        userId, type: input.type, name: input.name, symbol: input.symbol ?? null,
        quantity: input.quantity, avgBuyPrice: input.avgBuyPrice, currentPrice,
        currency: input.currency ?? "INR", account: input.account ?? null,
        importSource: input.importSource ?? null,
      },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("asset.create.prisma", { userId, type: input.type, name: input.name });
    return created;
  },

  async update(userId: string, id: string, patch: Partial<AssetInput>) {
    if (useFirebase()) {
      try {
        const docSnap = await getCollection(COL).doc(id).get();
        if (!docSnap.exists || docSnap.data()?.userId !== userId) {
          return { count: 0 };
        }
        const fields: Record<string, unknown> = {};
        if (patch.name !== undefined) fields.name = patch.name;
        if (patch.symbol !== undefined) fields.symbol = patch.symbol;
        if (patch.quantity !== undefined) fields.quantity = patch.quantity;
        if (patch.avgBuyPrice !== undefined) fields.avgBuyPrice = patch.avgBuyPrice;
        if (patch.currentPrice !== undefined) fields.currentPrice = patch.currentPrice;
        if (patch.account !== undefined) fields.account = patch.account;
        await updateDoc(COL, id, fields);
        await cache.delByPrefix(cacheKey("portfolio", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
        log.info("asset.update.firebase", { userId, id });
        return { count: 1 };
      } catch (error: any) {
        log.error("asset.update.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const updated = await prisma.asset.updateMany({
      where: { id, userId, deletedAt: null },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.symbol !== undefined && { symbol: patch.symbol }),
        ...(patch.quantity !== undefined && { quantity: patch.quantity }),
        ...(patch.avgBuyPrice !== undefined && { avgBuyPrice: patch.avgBuyPrice }),
        ...(patch.currentPrice !== undefined && { currentPrice: patch.currentPrice }),
        ...(patch.account !== undefined && { account: patch.account }),
      },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    return updated;
  },

  async remove(userId: string, id: string) {
    if (useFirebase()) {
      try {
        const docSnap = await getCollection(COL).doc(id).get();
        if (docSnap.exists && docSnap.data()?.userId === userId) {
          await softDeleteDoc(COL, id);
        }
        await cache.delByPrefix(cacheKey("portfolio", userId));
      } catch (error: any) {
        log.error("asset.remove.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
      return;
    }

    const { prisma } = await import("../lib/prisma");
    await prisma.asset.updateMany({ where: { id, userId }, data: { deletedAt: new Date() } });
    await cache.delByPrefix(cacheKey("portfolio", userId));
  },

  getPortfolioWithPL: reactCache(
    async (userId: string, opts: { refresh?: boolean } = {}): Promise<AssetWithPL[]> => {
      if (useFirebase()) {
        try {
          const rows = await queryByUserId<FirestoreAsset>(COL, userId, [
            { field: "deletedAt", op: "==", value: null },
          ]);
          rows.sort((a, b) => a.type.localeCompare(b.type));
          const assets = rows.map(normaliseAsset);

          if (opts.refresh) {
            const priceMap = await PriceEngineService.refreshForAssets(
              assets.map(a => ({ id: a.id, type: a.type, symbol: a.symbol }))
            );
            for (const a of assets) {
              const newPrice = priceMap.get(a.id);
              if (newPrice && newPrice !== a.currentPrice) {
                await updateDoc(COL, a.id, { currentPrice: newPrice });
                a.currentPrice = newPrice;
              }
            }
          }

          log.info("asset.getPortfolioWithPL.firebase", { userId, count: assets.length });
          return assets.map(withPL);
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
        const priceMap = await PriceEngineService.refreshForAssets(
          assets.map((a: { id: string; type: string; symbol: string | null }) => ({ id: a.id, type: a.type, symbol: a.symbol }))
        );
        for (const a of assets) {
          const newPrice = priceMap.get(a.id);
          if (newPrice && newPrice !== a.currentPrice) {
            await prisma.asset.update({ where: { id: a.id }, data: { currentPrice: newPrice } });
            a.currentPrice = newPrice;
          }
        }
      }

      return assets.map((a: any) => {
        const invested = a.quantity * a.avgBuyPrice;
        const currentValue = a.quantity * a.currentPrice;
        const pnl = currentValue - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
        return {
          id: a.id, type: a.type as AssetType, name: a.name, symbol: a.symbol,
          quantity: a.quantity, avgBuyPrice: a.avgBuyPrice, currentPrice: a.currentPrice,
          currency: a.currency, account: a.account, invested, currentValue, pnl, pnlPercent,
        };
      });
    }
  ),

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
            const newQty = existing.quantity + h.quantity;
            const newAvg = newQty > 0
              ? (existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice) / newQty
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
        const newQty = existing.quantity + h.quantity;
        const newAvg = newQty > 0
          ? (existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice) / newQty
          : h.avgBuyPrice;
        await prisma.asset.update({ where: { id: existing.id }, data: { quantity: newQty, avgBuyPrice: newAvg } });
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
