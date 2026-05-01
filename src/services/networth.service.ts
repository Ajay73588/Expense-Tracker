import { AssetService } from "./asset.service";
import type { NetWorthSummary } from "../types";
import { safeJsonParse } from "../utils/format";
import { cache } from "react";
import { getCollection, createDoc, updateDoc } from "../lib/firebase";
import { createLogger } from "../lib/logger";

const log = createLogger("NetWorthService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const QUERY_LIMIT = 200;

export const NetWorthService = {
  getCurrent: cache(async (userId: string): Promise<NetWorthSummary> => {
    let assets: any[] = [];
    let liabilities: any[] = [];
    let snapshots: any[] = [];

    if (USE_FIREBASE) {
      try {
        const lDb = getCollection("liabilities");
        const sDb = getCollection("snapshots");

        // Single where(userId) for all queries — no composite indexes needed
        const [liabSnap, snapSnap] = await Promise.all([
          lDb.where("userId", "==", userId).limit(QUERY_LIMIT).get(),
          sDb.where("userId", "==", userId).limit(30).get(),
        ]);

        [assets, liabilities, snapshots] = await Promise.all([
          AssetService.getPortfolioWithPL(userId),
          Promise.resolve(liabSnap.docs.map(doc => doc.data())),
          Promise.resolve(
            snapSnap.docs
              .map(doc => {
                const d = doc.data();
                return { ...d, date: d.date?.toDate ? d.date.toDate() : new Date(d.date) };
              })
              // Sort by date asc in JS (removed orderBy from query)
              .sort((a, b) => a.date.getTime() - b.date.getTime())
          ),
        ]);

        log.info("networth.getCurrent.firebase", {
          userId, assetCount: assets.length, liabCount: liabilities.length,
        });
      } catch (error: any) {
        log.error("networth.getCurrent.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "zero net worth",
        });
        // Return safe zero-state so dashboard doesn't crash
        return {
          totalAssets: 0, totalLiabilities: 0, netWorth: 0,
          breakdown: {}, history: [{ date: new Date().toISOString().slice(0, 10), netWorth: 0 }],
        };
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      [assets, liabilities, snapshots] = await Promise.all([
        AssetService.getPortfolioWithPL(userId),
        prisma.liability.findMany({ where: { userId } }),
        prisma.snapshot.findMany({ where: { userId }, orderBy: { date: "asc" }, take: 30 }),
      ]);
    }

    const totalAssets = assets.reduce((s: number, a: any) => s + a.currentValue, 0);
    const totalLiabilities = liabilities.reduce((s: number, l: any) => s + l.outstandingAmount, 0);
    const netWorth = totalAssets - totalLiabilities;

    const breakdown: Record<string, number> = {};
    for (const a of assets) breakdown[a.type] = (breakdown[a.type] ?? 0) + a.currentValue;
    for (const l of liabilities) breakdown[l.type] = (breakdown[l.type] ?? 0) - l.outstandingAmount;

    const history = snapshots.map((s: any) => ({
      date: s.date.toISOString().slice(0, 10),
      netWorth: s.netWorth,
    }));

    const todayKey = new Date().toISOString().slice(0, 10);
    if (history.length === 0 || history[history.length - 1].date !== todayKey) {
      history.push({ date: todayKey, netWorth });
    } else {
      history[history.length - 1].netWorth = netWorth;
    }

    return { totalAssets, totalLiabilities, netWorth, breakdown, history };
  }),

  async getHistory(userId: string, days = 90) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let snapshots: any[] = [];
    if (USE_FIREBASE) {
      try {
        // Single where(userId) — date range filtered in JS
        const db = getCollection("snapshots");
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        snapshots = snapshot.docs
          .map(doc => {
            const d = doc.data();
            return { ...d, date: d.date?.toDate ? d.date.toDate() : new Date(d.date) };
          })
          // Filter by since date and sort in JS
          .filter(d => d.date >= since)
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        log.info("networth.getHistory.firebase", { userId, days, count: snapshots.length });
      } catch (error: any) {
        log.error("networth.getHistory.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty history",
        });
        return [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      snapshots = await prisma.snapshot.findMany({
        where: { userId, date: { gte: since } },
        orderBy: { date: "asc" },
      });
    }

    return snapshots.map((s: any) => ({
      date: s.date.toISOString().slice(0, 10),
      netWorth: s.netWorth,
      totalAssets: s.totalAssets,
      totalLiabilities: s.totalLiabilities,
      breakdown: safeJsonParse<Record<string, number>>(s.breakdown, {}),
    }));
  },

  async takeSnapshot(userId: string) {
    const summary = await NetWorthService.getCurrent(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (USE_FIREBASE) {
      try {
        // Single where(userId) — date equality checked in JS
        const db = getCollection("snapshots");
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        const existing = snapshot.docs.find(doc => {
          const d = doc.data();
          const docDate = d.date?.toDate ? d.date.toDate() : new Date(d.date);
          return docDate.getTime() === today.getTime();
        });

        const data = {
          userId, date: today,
          totalAssets: summary.totalAssets, totalLiabilities: summary.totalLiabilities,
          netWorth: summary.netWorth, breakdown: JSON.stringify(summary.breakdown),
          updatedAt: new Date(),
        };

        if (existing) {
          await updateDoc("snapshots", existing.id, data);
          log.info("networth.takeSnapshot.firebase.update", { userId });
          return { id: existing.id, ...data };
        } else {
          const id = await createDoc("snapshots", { ...data, createdAt: new Date() });
          log.info("networth.takeSnapshot.firebase.create", { userId });
          return { id, ...data };
        }
      } catch (error: any) {
        log.error("networth.takeSnapshot.firebase.failed", {
          userId, error: error?.message ?? String(error),
        });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    return prisma.snapshot.upsert({
      where: { userId_date: { userId, date: today } },
      update: {
        totalAssets: summary.totalAssets, totalLiabilities: summary.totalLiabilities,
        netWorth: summary.netWorth, breakdown: JSON.stringify(summary.breakdown),
      },
      create: {
        userId, date: today, totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities, netWorth: summary.netWorth,
        breakdown: JSON.stringify(summary.breakdown),
      },
    });
  },
};
