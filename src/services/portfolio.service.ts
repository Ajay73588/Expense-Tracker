import { prisma } from "../lib/prisma";
import { AssetService } from "./asset.service";
import type { AssetType, PortfolioAllocation, RebalancePlan } from "../types";
import { ASSET_TYPES } from "../types";

// Rough equity-volatility weights for a simple risk score (0 = safest, 10 = riskiest).
const RISK_WEIGHTS: Record<AssetType, number> = {
  STOCK: 7,
  MUTUAL_FUND: 5,
  CRYPTO: 10,
  REAL_ESTATE: 4,
  CASH: 0,
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
    return ASSET_TYPES.map((t) => {
      const b = byType.get(t) ?? { value: 0, count: 0 };
      return {
        assetType: t,
        value: b.value,
        percent: total > 0 ? (b.value / total) * 100 : 0,
        count: b.count,
      };
    }).filter((r) => r.value > 0 || r.count > 0);
  },

  /** 0–10 risk score, weighted by current value per asset type. */
  async getRiskScore(userId: string): Promise<number> {
    const alloc = await PortfolioService.getAllocation(userId);
    const total = alloc.reduce((s, a) => s + a.value, 0);
    if (total === 0) return 0;
    const weighted = alloc.reduce((s, a) => s + (a.value / total) * RISK_WEIGHTS[a.assetType], 0);
    return Math.round(weighted * 10) / 10;
  },

  async getPortfolioSummary(userId: string) {
    const assets = await AssetService.getPortfolioWithPL(userId);
    const invested = assets.reduce((s, a) => s + a.invested, 0);
    const currentValue = assets.reduce((s, a) => s + a.currentValue, 0);
    const pnl = currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
    const topGainers = [...assets].sort((a, b) => b.pnlPercent - a.pnlPercent).slice(0, 3);
    const topLosers = [...assets].sort((a, b) => a.pnlPercent - b.pnlPercent).slice(0, 3);
    return {
      invested,
      currentValue,
      pnl,
      pnlPercent,
      topGainers,
      topLosers,
      assetCount: assets.length,
    };
  },

  async getRebalancePlan(userId: string, driftThreshold = 5): Promise<RebalancePlan[]> {
    const [current, targets] = await Promise.all([
      PortfolioService.getAllocation(userId),
      prisma.allocationTarget.findMany({ where: { userId } }),
    ]);
    const totalValue = current.reduce((s, a) => s + a.value, 0);
    if (totalValue === 0 || targets.length === 0) return [];

    const targetMap = new Map(targets.map((t) => [t.assetType, t.targetPercent]));
    const plans: RebalancePlan[] = [];

    for (const [assetType, targetPct] of targetMap.entries()) {
      const curr = current.find((c) => c.assetType === assetType);
      const currentPct = curr?.percent ?? 0;
      const driftPct = currentPct - targetPct;
      const absDrift = Math.abs(driftPct);
      if (absDrift < driftThreshold) {
        plans.push({
          assetType: assetType as AssetType,
          currentPct,
          targetPct,
          driftPct,
          action: "HOLD",
          suggestedAmount: 0,
        });
        continue;
      }
      const targetValue = (targetPct / 100) * totalValue;
      const currentValue = (currentPct / 100) * totalValue;
      const delta = targetValue - currentValue;
      plans.push({
        assetType: assetType as AssetType,
        currentPct,
        targetPct,
        driftPct,
        action: delta > 0 ? "BUY" : "SELL",
        suggestedAmount: Math.abs(delta),
      });
    }
    return plans;
  },

  /** Allocation-target fit 0..1 for the health score. */
  async getDiversificationScore(userId: string): Promise<number> {
    const [current, targets] = await Promise.all([
      PortfolioService.getAllocation(userId),
      prisma.allocationTarget.findMany({ where: { userId } }),
    ]);
    if (targets.length === 0) {
      // Fallback: reward users who hold at least 3 asset types.
      const types = new Set(current.filter((c) => c.value > 0).map((c) => c.assetType));
      return Math.min(types.size / 3, 1);
    }
    const targetMap = new Map(targets.map((t) => [t.assetType, t.targetPercent]));
    let totalDrift = 0;
    for (const [assetType, targetPct] of targetMap.entries()) {
      const curr = current.find((c) => c.assetType === assetType);
      totalDrift += Math.abs((curr?.percent ?? 0) - targetPct);
    }
    // Drift of 0 -> score 1.  Drift of 100+ -> score 0.
    return Math.max(0, 1 - totalDrift / 100);
  },
};
