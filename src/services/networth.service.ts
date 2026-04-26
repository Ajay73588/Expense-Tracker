import { prisma } from "../lib/prisma";
import { AssetService } from "./asset.service";
import type { NetWorthSummary } from "../types";
import { safeJsonParse } from "../utils/format";

export const NetWorthService = {
  async getCurrent(userId: string): Promise<NetWorthSummary> {
    const [assets, liabilities, snapshots] = await Promise.all([
      AssetService.getPortfolioWithPL(userId),
      prisma.liability.findMany({ where: { userId } }),
      prisma.snapshot.findMany({
        where: { userId },
        orderBy: { date: "asc" },
        take: 30,
      }),
    ]);

    const totalAssets = assets.reduce((s, a) => s + a.currentValue, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.outstandingAmount, 0);
    const netWorth = totalAssets - totalLiabilities;

    const breakdown: Record<string, number> = {};
    for (const a of assets) {
      breakdown[a.type] = (breakdown[a.type] ?? 0) + a.currentValue;
    }
    for (const l of liabilities) {
      breakdown[l.type] = (breakdown[l.type] ?? 0) - l.outstandingAmount;
    }

    const history = snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      netWorth: s.netWorth,
    }));

    // Always append today's live value to give the chart a "current" tip
    const todayKey = new Date().toISOString().slice(0, 10);
    if (history.length === 0 || history[history.length - 1].date !== todayKey) {
      history.push({ date: todayKey, netWorth });
    } else {
      history[history.length - 1].netWorth = netWorth;
    }

    return { totalAssets, totalLiabilities, netWorth, breakdown, history };
  },

  async getHistory(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const snapshots = await prisma.snapshot.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "asc" },
    });
    return snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      netWorth: s.netWorth,
      totalAssets: s.totalAssets,
      totalLiabilities: s.totalLiabilities,
      breakdown: safeJsonParse<Record<string, number>>(s.breakdown, {}),
    }));
  },

  /** Creates today's snapshot. Idempotent within a day. */
  async takeSnapshot(userId: string) {
    const summary = await NetWorthService.getCurrent(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return prisma.snapshot.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth,
        breakdown: JSON.stringify(summary.breakdown),
      },
      create: {
        userId,
        date: today,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth,
        breakdown: JSON.stringify(summary.breakdown),
      },
    });
  },
};
