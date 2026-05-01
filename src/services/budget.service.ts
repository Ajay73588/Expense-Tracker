import { createLogger } from "../lib/logger";
import { getCollection, createDoc, updateDoc, deleteDoc } from "../lib/firebase";

const log = createLogger("BudgetService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const COLLECTION = "budgets";
const QUERY_LIMIT = 500;

export interface BudgetInput {
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
  alertAt80?: boolean;
  alertAt100?: boolean;
}

export const BudgetService = {
  async list(userId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    if (USE_FIREBASE) {
      try {
        // Single where(userId) — month/year filtered in JS to avoid composite index
        const db = getCollection(COLLECTION);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        const rows = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((d: any) => d.month === m && d.year === y)
          .sort((a: any, b: any) => (a.category ?? "").localeCompare(b.category ?? ""));
        log.info("budget.list.firebase", { userId, month: m, year: y, count: rows.length });
        return rows;
      } catch (error: any) {
        log.error("budget.list.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty list",
        });
        return [];
      }
    }

    const { prisma } = await import("../lib/prisma");
    return prisma.budget.findMany({
      where: { userId, month: m, year: y },
      orderBy: { category: "asc" },
    });
  },

  async upsert(userId: string, input: BudgetInput) {
    if (USE_FIREBASE) {
      try {
        // Single where(userId) — category/month/year matched in JS
        const db = getCollection(COLLECTION);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        const existing = snapshot.docs.find(doc => {
          const d = doc.data();
          return d.category === input.category && d.month === input.month && d.year === input.year;
        });
        const data = {
          userId, category: input.category, monthlyLimit: input.monthlyLimit,
          month: input.month, year: input.year,
          alertAt80: input.alertAt80 ?? true, alertAt100: input.alertAt100 ?? true,
          updatedAt: new Date(),
        };
        if (existing) {
          await updateDoc(COLLECTION, existing.id, data);
          log.info("budget.upsert.firebase.update", { userId, category: input.category });
          return { id: existing.id, ...data };
        } else {
          const id = await createDoc(COLLECTION, { ...data, createdAt: new Date() });
          log.info("budget.upsert.firebase.create", { userId, category: input.category });
          return { id, ...data };
        }
      } catch (error: any) {
        log.error("budget.upsert.firebase.failed", {
          userId, error: error?.message ?? String(error),
        });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const result = await prisma.budget.upsert({
      where: { userId_category_month_year: { userId, category: input.category, month: input.month, year: input.year } },
      update: { monthlyLimit: input.monthlyLimit, alertAt80: input.alertAt80 ?? true, alertAt100: input.alertAt100 ?? true },
      create: { userId, category: input.category, monthlyLimit: input.monthlyLimit, month: input.month, year: input.year, alertAt80: input.alertAt80 ?? true, alertAt100: input.alertAt100 ?? true },
    });
    log.info("budget.upsert", { userId, category: input.category });
    return result;
  },

  async remove(userId: string, id: string) {
    if (USE_FIREBASE) {
      try {
        await deleteDoc(COLLECTION, id);
      } catch (error: any) {
        log.error("budget.remove.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      await prisma.budget.deleteMany({ where: { id, userId } });
    }
  },

  async getUsage(userId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    let budgets: any[] = [];
    let txs: any[] = [];

    if (USE_FIREBASE) {
      try {
        const bDb = getCollection(COLLECTION);
        const tDb = getCollection("transactions");

        // Both queries: single where(userId) — all secondary filters in JS.
        // Previously transaction query had 5 chained .where() clauses causing FAILED_PRECONDITION.
        const [bSnap, tSnap] = await Promise.all([
          bDb.where("userId", "==", userId).limit(QUERY_LIMIT).get(),
          tDb.where("userId", "==", userId).limit(QUERY_LIMIT).get(),
        ]);

        budgets = bSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((d: any) => d.month === m && d.year === y);

        txs = tSnap.docs.map(doc => doc.data()).filter(d => {
          const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
          return (
            (d.deletedAt === null || d.deletedAt === undefined) &&
            d.type === "EXPENSE" &&
            date >= start &&
            date < end
          );
        });

        log.info("budget.getUsage.firebase", { userId, month: m, year: y, budgetCount: budgets.length, txCount: txs.length });
      } catch (error: any) {
        log.error("budget.getUsage.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty usage",
        });
        return [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      [budgets, txs] = await Promise.all([
        prisma.budget.findMany({ where: { userId, month: m, year: y } }),
        prisma.transaction.findMany({
          where: { userId, deletedAt: null, type: "EXPENSE", date: { gte: start, lt: end } },
          select: { category: true, amount: true },
        }),
      ]);
    }

    const spendByCategory = new Map<string, number>();
    for (const t of txs) spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) + t.amount);

    return budgets.map((b: any) => {
      const spent = spendByCategory.get(b.category) ?? 0;
      const used = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      let status: "OK" | "WARN" | "EXCEEDED" = "OK";
      if (spent >= b.monthlyLimit) status = "EXCEEDED";
      else if (used >= 80) status = "WARN";
      return {
        id: b.id, category: b.category, monthlyLimit: b.monthlyLimit,
        spent, remaining: Math.max(0, b.monthlyLimit - spent),
        usedPercent: used, status, month: b.month, year: b.year,
      };
    });
  },
};
