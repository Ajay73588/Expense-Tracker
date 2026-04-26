import { prisma } from "../lib/prisma";
import { cache, cacheKey } from "../lib/cache";
import { createLogger } from "../lib/logger";
import { PriceEngineService } from "./price-engine.service";
import type { AssetType, AssetWithPL } from "../types";

const log = createLogger("AssetService");

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

export const AssetService = {
  async list(userId: string) {
    return prisma.asset.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  },

  async create(userId: string, input: AssetInput) {
    let currentPrice = input.currentPrice ?? input.avgBuyPrice;
    if (input.symbol) {
      const res = await PriceEngineService.fetch(input.type, input.symbol);
      if (res.price > 0) currentPrice = res.price;
    }
    const created = await prisma.asset.create({
      data: {
        userId,
        type: input.type,
        name: input.name,
        symbol: input.symbol ?? null,
        quantity: input.quantity,
        avgBuyPrice: input.avgBuyPrice,
        currentPrice,
        currency: input.currency ?? "INR",
        account: input.account ?? null,
        importSource: input.importSource ?? null,
      },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("asset.create", { userId, type: input.type, name: input.name });
    return created;
  },

  async update(userId: string, id: string, patch: Partial<AssetInput>) {
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
    await prisma.asset.updateMany({
      where: { id, userId },
      data: { deletedAt: new Date() },
    });
    await cache.delByPrefix(cacheKey("portfolio", userId));
  },

  /** Returns assets with P&L injected; optionally refreshes live prices first. */
  async getPortfolioWithPL(userId: string, opts: { refresh?: boolean } = {}): Promise<AssetWithPL[]> {
    const assets = await prisma.asset.findMany({
      where: { userId, deletedAt: null },
      orderBy: { type: "asc" },
    });

    if (opts.refresh) {
      const priceMap = await PriceEngineService.refreshForAssets(
        assets.map((a) => ({ id: a.id, type: a.type, symbol: a.symbol }))
      );
      for (const a of assets) {
        const newPrice = priceMap.get(a.id);
        if (newPrice && newPrice !== a.currentPrice) {
          await prisma.asset.update({ where: { id: a.id }, data: { currentPrice: newPrice } });
          a.currentPrice = newPrice;
        }
      }
    }

    return assets.map((a) => {
      const invested = a.quantity * a.avgBuyPrice;
      const currentValue = a.quantity * a.currentPrice;
      const pnl = currentValue - invested;
      const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
      return {
        id: a.id,
        type: a.type as AssetType,
        name: a.name,
        symbol: a.symbol,
        quantity: a.quantity,
        avgBuyPrice: a.avgBuyPrice,
        currentPrice: a.currentPrice,
        currency: a.currency,
        account: a.account,
        invested,
        currentValue,
        pnl,
        pnlPercent,
      };
    });
  },

  /** Bulk upsert used by the importer. Matches on (userId, type, symbol, account). */
  async bulkUpsert(userId: string, holdings: AssetInput[]) {
    let added = 0;
    let updated = 0;
    for (const h of holdings) {
      const existing = await prisma.asset.findFirst({
        where: {
          userId,
          type: h.type,
          symbol: h.symbol ?? null,
          account: h.account ?? null,
          deletedAt: null,
        },
      });
      if (existing) {
        // Merge: weighted avg price, summed qty.
        const newQty = existing.quantity + h.quantity;
        const newAvg =
          newQty > 0
            ? (existing.quantity * existing.avgBuyPrice + h.quantity * h.avgBuyPrice) / newQty
            : h.avgBuyPrice;
        await prisma.asset.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgBuyPrice: newAvg },
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
