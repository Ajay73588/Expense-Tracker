import { AssetService } from "./asset.service";
import type { AssetType, PortfolioAllocation, RebalancePlan } from "../types";
import { ASSET_TYPES } from "../types";
import { getCollection } from "../lib/firebase";
import { createLogger } from "../lib/logger";

const log = createLogger("PortfolioService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const QUERY_LIMIT = 200;

// Rough equity-volatility weights for a simple risk score (0 = safest, 10 = riskiest).
const RISK_WEIGHTS: Record<AssetType, number> = {
  STOCK: 7, MUTUAL_FUND: 5, CRYPTO: 10, REAL_ESTATE: 4, CASH: 0,
};

export const PortfolioService = {
  async getAllocation(userId: string): Promise<PortfolioAllocation[]> {
    const assets = await AssetService.getPortfolioWithPL(userId);
    const byType = new Map<AssetType, { value: number; count: number }>();
    let total = 0;
    for (const a of assets) {
      const entry = byType.get(a.type) ?? { value: 0, count: 0 };
      entry.value += a.currentValue;
      entry.count += 1;
      byType.set(a.type, entry);
      total += a.currentValue;
    }
    return ASSET_TYPES.map(t => {
      const b = byType.get(t) ?? { value: 0, count: 0 };
      return { assetType: t, value: b.value, percent: total > 0 ? (b.value / total) * 100 : 0, count: b.count };
    }).filter(r => r.value > 0 || r.count > 0);
  },

  async getRiskScore(userId: string): Promise<number> {
    const alloc = await PortfolioService.getAllocation(userId);
    const total = alloc.reduce((s: number, a: PortfolioAllocation) => s + a.value, 0);
    if (total === 0) return 0;
    const weighted = alloc.reduce((s: number, a: PortfolioAllocation) => s + (a.value / total) * RISK_WEIGHTS[a.assetType], 0);
    return Math.round(weighted * 10) / 10;
  },

  async getPortfolioSummary(userId: string) {
    const assets = await AssetService.getPortfolioWithPL(userId);
    const invested = assets.reduce((s: number, a: any) => s + a.invested, 0);
    const currentValue = assets.reduce((s: number, a: any) => s + a.currentValue, 0);
    const pnl = currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const topGainers = [...assets].sort((a: any, b: any) => b.pnlPercent - a.pnlPercent).slice(0, 3);
    const topLosers = [...assets].sort((a: any, b: any) => a.pnlPercent - b.pnlPercent).slice(0, 3);
    return { invested, currentValue, pnl, pnlPercent, topGainers, topLosers, assetCount: assets.length };
  },

  async getRebalancePlan(userId: string, driftThreshold = 5): Promise<RebalancePlan[]> {
    let current: PortfolioAllocation[] = [];
    let targets: any[] = [];

    if (USE_FIREBASE) {
      try {
        const db = getCollection("allocationTargets");
        [current, targets] = await Promise.all([
          PortfolioService.getAllocation(userId),
          db.where("userId", "==", userId).limit(QUERY_LIMIT).get()
            .then(s => s.docs.map(doc => doc.data())),
        ]);
        log.info("portfolio.getRebalancePlan.firebase", { userId, targetCount: targets.length });
      } catch (error: any) {
        log.error("portfolio.getRebalancePlan.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty plan",
        });
        return [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      [current, targets] = await Promise.all([
        PortfolioService.getAllocation(userId),
        prisma.allocationTarget.findMany({ where: { userId } }),
      ]);
    }

    const totalValue = current.reduce((s: number, a: PortfolioAllocation) => s + a.value, 0);
    if (totalValue === 0 || targets.length === 0) return [];

    const targetMap = new Map<string, number>(targets.map((t: any) => [t.assetType, t.targetPercent]));
    const plans: RebalancePlan[] = [];

    for (const [assetType, targetPct] of targetMap.entries()) {
      const curr = current.find((c: PortfolioAllocation) => c.assetType === assetType);
      const currentPct = curr?.percent ?? 0;
      const driftPct = currentPct - targetPct;
      const absDrift = Math.abs(driftPct);
      if (absDrift < driftThreshold) {
        plans.push({ assetType: assetType as AssetType, currentPct, targetPct, driftPct, action: "HOLD", suggestedAmount: 0 });
        continue;
      }
      const targetValue = (targetPct / 100) * totalValue;
      const currValue = (currentPct / 100) * totalValue;
      const delta = targetValue - currValue;
      plans.push({ assetType: assetType as AssetType, currentPct, targetPct, driftPct, action: delta > 0 ? "BUY" : "SELL", suggestedAmount: Math.abs(delta) });
    }
    return plans;
  },

  /**
   * Returns all allocation targets for a user.
   * Used by portfolio/page.tsx — this is the ONLY approved way to read allocationTargets
   * from UI code. Pages must NOT import prisma directly.
   */
  async getAllocationTargets(userId: string): Promise<{ assetType: string; targetPercent: number }[]> {
    if (USE_FIREBASE) {
      try {
        const db = getCollection("allocationTargets");
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        const targets = snapshot.docs.map(doc => doc.data() as { assetType: string; targetPercent: number });
        log.info("portfolio.getAllocationTargets.firebase", { userId, count: targets.length });
        return targets;
      } catch (error: any) {
        log.error("portfolio.getAllocationTargets.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty targets",
        });
        return [];
      }
    }

    try {
      const { prisma } = await import("../lib/prisma");
      return prisma.allocationTarget.findMany({ where: { userId } });
    } catch (error: any) {
      log.error("portfolio.getAllocationTargets.prisma.failed", {
        userId, error: error?.message ?? String(error), fallback: "empty targets",
      });
      return [];
    }
  },

  async getDiversificationScore(userId: string): Promise<number> {
    let current: PortfolioAllocation[] = [];
    let targets: any[] = [];

    if (USE_FIREBASE) {
      try {
        const db = getCollection("allocationTargets");
        [current, targets] = await Promise.all([
          PortfolioService.getAllocation(userId),
          db.where("userId", "==", userId).limit(QUERY_LIMIT).get()
            .then(s => s.docs.map(doc => doc.data())),
        ]);
        log.info("portfolio.getDiversificationScore.firebase", { userId, targetCount: targets.length });
      } catch (error: any) {
        log.error("portfolio.getDiversificationScore.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "asset-type count method",
        });
        // Fallback: reward users who hold at least 3 asset types
        try {
          current = await PortfolioService.getAllocation(userId);
        } catch {
          return 0;
        }
        const types = new Set(current.filter(c => c.value > 0).map(c => c.assetType));
        return Math.min(types.size / 3, 1);
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      [current, targets] = await Promise.all([
        PortfolioService.getAllocation(userId),
        prisma.allocationTarget.findMany({ where: { userId } }),
      ]);
    }

    if (targets.length === 0) {
      const types = new Set(current.filter((c: PortfolioAllocation) => c.value > 0).map((c: PortfolioAllocation) => c.assetType));
      return Math.min(types.size / 3, 1);
    }

    const targetMap = new Map<string, number>(targets.map((t: any) => [t.assetType, t.targetPercent]));
    let totalDrift = 0;
    for (const [assetType, targetPct] of targetMap.entries()) {
      const curr = current.find((c: PortfolioAllocation) => c.assetType === assetType);
      totalDrift += Math.abs((curr?.percent ?? 0) - targetPct);
    }
    return Math.max(0, 1 - totalDrift / 100);
  },
};
