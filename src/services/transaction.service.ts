import { prisma } from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { cache, cacheKey } from "../lib/cache";
import { safeJsonParse } from "../utils/format";

const log = createLogger("TransactionService");

export interface TransactionInput {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  category: string;
  description?: string | null;
  date: Date | string;
  account?: string | null;
  tags?: string[];
}

export const TransactionService = {
  async list(userId: string, opts: { limit?: number; offset?: number; category?: string } = {}) {
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (opts.category) where.category = opts.category;
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: opts.limit ?? 100,
      skip: opts.offset ?? 0,
    });
    return rows.map((r) => ({ ...r, tags: safeJsonParse<string[]>(r.tags, []) }));
  },

  async create(userId: string, input: TransactionInput) {
    const created = await prisma.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: new Date(input.date),
        account: input.account ?? null,
        tags: JSON.stringify(input.tags ?? []),
      },
    });
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("transaction.create", { userId, category: input.category, type: input.type });
    return { ...created, tags: safeJsonParse<string[]>(created.tags, []) };
  },

  async remove(userId: string, id: string) {
    await prisma.transaction.updateMany({
      where: { id, userId },
      data: { deletedAt: new Date() },
    });
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
  },

  /** Aggregates income/expense/net by month for the last N months. */
  async summarizeByMonth(userId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1, 1);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.transaction.findMany({
      where: { userId, deletedAt: null, date: { gte: since } },
      select: { type: true, amount: true, date: true },
    });

    const buckets = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (months - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { income: 0, expense: 0 });
    }

    for (const r of rows) {
      const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets.get(key);
      if (!b) continue;
      if (r.type === "INCOME") b.income += r.amount;
      else if (r.type === "EXPENSE") b.expense += r.amount;
    }

    return Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
  },

  /** Spend breakdown by category for the current month. */
  async categorySplit(userId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const rows = await prisma.transaction.findMany({
      where: { userId, deletedAt: null, type: "EXPENSE", date: { gte: start, lt: end } },
      select: { category: true, amount: true },
    });

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.category, (map.get(r.category) ?? 0) + r.amount);

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  async currentMonthTotals(userId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await prisma.transaction.findMany({
      where: { userId, deletedAt: null, date: { gte: start } },
      select: { type: true, amount: true },
    });
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      if (r.type === "INCOME") income += r.amount;
      else if (r.type === "EXPENSE") expense += r.amount;
    }
    return { income, expense, net: income - expense };
  },
};
