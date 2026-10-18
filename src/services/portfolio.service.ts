import { AssetService } from "./asset.service";
import type { AssetType, PortfolioAllocation, RebalancePlan, AggregatedAsset } from "../types";
import { ASSET_TYPES } from "../types";
import { aggregatePortfolioAssets } from "./portfolio-aggregation.service";
import { Prisma } from "@prisma/client";
import { getCollection } from "../lib/firebase";
import { createLogger } from "../lib/logger";
import { calculateCAGR, calculateXIRR } from "../lib/finance/returns";
import {
  calculateRebalancePlan,
  type RebalanceOptions,
  type RebalanceResult,
  type RebalanceHoldingInput,
  type RebalanceTargetInput,
} from "../lib/finance/rebalance";

const log = createLogger("PortfolioService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const QUERY_LIMIT = 200;

// Rough equity-volatility weights for a simple risk score (0 = safest, 10 = riskiest).
const RISK_WEIGHTS: Record<AssetType, number> = {
  STOCK: 7,
  MUTUAL_FUND: 5,
  CRYPTO: 10,
  REAL_ESTATE: 4,
  CASH: 0,
  GOLD: 3,
  FIXED_DEPOSIT: 1,
  EPF_PPF: 1,
};

export const PortfolioService = {
  async getAggregatedPortfolio(userId: string, preloadedAssets?: any[]): Promise<AggregatedAsset[]> {
    const assets = preloadedAssets ?? (await AssetService.getPortfolioWithPL(userId));
    return aggregatePortfolioAssets(assets);
  },

  async getAllocation(userId: string, preloadedAssets?: any[]): Promise<PortfolioAllocation[]> {
    const assets = preloadedAssets ?? (await AssetService.getPortfolioWithPL(userId));
    const byType = new Map<AssetType, { value: Prisma.Decimal; count: number }>();
    let total = new Prisma.Decimal(0);
    for (const a of assets) {
      const entry = byType.get(a.type) ?? { value: new Prisma.Decimal(0), count: 0 };
      entry.value = entry.value.plus(a.currentValue);
      entry.count += 1;
      byType.set(a.type, entry);
      total = total.plus(a.currentValue);
    }
    return ASSET_TYPES.map(t => {
      const b = byType.get(t) ?? { value: new Prisma.Decimal(0), count: 0 };
      return { 
        assetType: t, 
        value: b.value.toNumber(), 
        percent: total.gt(0) ? b.value.dividedBy(total).times(100).toNumber() : 0, 
        count: b.count 
      };
    }).filter(r => r.value > 0 || r.count > 0);
  },

  async getRiskScore(userId: string, preloadedAlloc?: PortfolioAllocation[]): Promise<number> {
    const alloc = preloadedAlloc ?? (await PortfolioService.getAllocation(userId));
    const total = alloc.reduce((s: Prisma.Decimal, a: PortfolioAllocation) => s.plus(a.value), new Prisma.Decimal(0));
    if (total.eq(0)) return 0;
    const weighted = alloc.reduce((s: Prisma.Decimal, a: PortfolioAllocation) => 
      s.plus(new Prisma.Decimal(a.value).dividedBy(total).times(RISK_WEIGHTS[a.assetType])), new Prisma.Decimal(0)
    );
    return Math.round(weighted.toNumber() * 10) / 10;
  },

  async getPortfolioSummary(userId: string, preloadedAssets?: any[]) {
    const assets = preloadedAssets ?? (await AssetService.getPortfolioWithPL(userId));
    const investedDec = assets.reduce((s: Prisma.Decimal, a: any) => s.plus(a.invested), new Prisma.Decimal(0));
    const currentValueDec = assets.reduce((s: Prisma.Decimal, a: any) => s.plus(a.currentValue), new Prisma.Decimal(0));
    const pnlDec = currentValueDec.minus(investedDec);
    const pnlPercent = investedDec.gt(0) ? pnlDec.dividedBy(investedDec).times(100).toNumber() : 0;
    const topGainers = [...assets].sort((a: any, b: any) => b.pnlPercent - a.pnlPercent).slice(0, 3);
    const topLosers = [...assets].sort((a: any, b: any) => a.pnlPercent - b.pnlPercent).slice(0, 3);
    const aggregated = aggregatePortfolioAssets(assets);

    // Compute XIRR and CAGR returns
    let xirrResult = null;
    let cagrResult = null;
    if (assets.length > 0 && investedDec.gt(0)) {
      const flows = assets.map((a: any) => ({
        amount: -Number(a.invested),
        date: a.createdAt || new Date(),
      }));
      flows.push({
        amount: currentValueDec.toNumber(),
        date: new Date(),
      });
      xirrResult = calculateXIRR(flows);

      const earliest = assets.reduce((min: number, a: any) => {
        const t = new Date(a.createdAt || Date.now()).getTime();
        return t < min ? t : min;
      }, Date.now());
      const years = (Date.now() - earliest) / (365.0 * 24 * 60 * 60 * 1000);
      if (years >= 0.08) {
        cagrResult = calculateCAGR(investedDec.toNumber(), currentValueDec.toNumber(), years);
      }
    }

    return { 
      invested: investedDec.toNumber(), 
      currentValue: currentValueDec.toNumber(), 
      pnl: pnlDec.toNumber(), 
      pnlPercent, 
      topGainers, 
      topLosers, 
      assetCount: assets.length,
      investmentCount: aggregated.length,
      returns: {
        xirr: xirrResult?.ratePct ?? null,
        cagr: cagrResult?.ratePct ?? null,
        absoluteReturnPct: pnlPercent,
      },
    };
  },

  async getComprehensiveRebalancePlan(
    userId: string,
    options: RebalanceOptions = {},
    preloaded?: { assets?: any[]; targets?: any[] }
  ): Promise<RebalanceResult> {
    let assets: any[] = [];
    let targets: any[] = [];

    if (preloaded?.assets && preloaded?.targets) {
      assets = preloaded.assets;
      targets = preloaded.targets;
    } else {
      const [loadedAssets, loadedTargets] = await Promise.all([
        preloaded?.assets ?? AssetService.getPortfolioWithPL(userId),
        preloaded?.targets ?? PortfolioService.getAllocationTargets(userId),
      ]);
      assets = loadedAssets;
      targets = loadedTargets;
    }

    const holdingsInput: RebalanceHoldingInput[] = assets.map((a: any) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      currentValue: a.currentValue,
      valuationStatus: a.valuationStatus,
      detailedValuationStatus: a.detailedValuationStatus,
      currency: a.currency,
    }));

    const targetsInput: RebalanceTargetInput[] = targets.map((t: any) => ({
      assetType: t.assetType,
      targetPercent: Number(t.targetPercent),
    }));

    return calculateRebalancePlan(holdingsInput, targetsInput, options);
  },

  async getRebalancePlan(
    userId: string,
    driftThreshold = 5,
    preloaded?: { allocation?: PortfolioAllocation[]; targets?: any[]; assets?: any[] },
    options?: Partial<RebalanceOptions>
  ): Promise<RebalancePlan[]> {
    let holdings: RebalanceHoldingInput[] = [];
    let targets = preloaded?.targets;

    if (preloaded?.assets) {
      holdings = preloaded.assets;
    } else if (preloaded?.allocation) {
      holdings = preloaded.allocation.map((a) => ({
        type: a.assetType,
        currentValue: a.value,
        valuationStatus: "OK",
      }));
    } else {
      try {
        holdings = await AssetService.getPortfolioWithPL(userId);
      } catch (err: any) {
        log.warn("portfolio.getRebalancePlan.fetchAssetsFailed", { userId, error: err?.message });
        holdings = [];
      }
    }

    if (!targets) {
      targets = await PortfolioService.getAllocationTargets(userId);
    }

    const targetSum = targets.reduce((sum: number, t: any) => sum + (Number(t.targetPercent) || 0), 0);
    // If targets sum is not 100%, fall back gracefully to the simple delta calculation for backward compatibility with legacy tests
    if (Math.abs(targetSum - 100) > 0.01) {
      const current = preloaded?.allocation ?? (await PortfolioService.getAllocation(userId));
      const totalValue = current.reduce((s: Prisma.Decimal, a: PortfolioAllocation) => s.plus(a.value), new Prisma.Decimal(0)).toNumber();
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
        const targetValue = new Prisma.Decimal(targetPct).dividedBy(100).times(totalValue);
        const currValue = new Prisma.Decimal(currentPct).dividedBy(100).times(totalValue);
        const delta = targetValue.minus(currValue);
        plans.push({
          assetType: assetType as AssetType,
          currentPct,
          targetPct,
          driftPct,
          action: delta.gt(0) ? "BUY" : "SELL",
          suggestedAmount: delta.abs().toNumber(),
        });
      }
      return plans;
    }

    const mode = options?.mode ?? "ALLOW_SELLS";
    const res = calculateRebalancePlan(holdings, targets, {
      mode,
      driftThreshold,
      ...options,
    });

    return res.items.map((i) => ({
      assetType: i.assetType,
      currentPct: i.currentPct,
      targetPct: i.targetPct,
      driftPct: i.driftPct,
      action: i.action,
      suggestedAmount: i.suggestedAmount,
    }));
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
      if (!prisma?.allocationTarget?.findMany) {
        return [];
      }
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
