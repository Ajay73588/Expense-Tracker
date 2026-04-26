import { prisma } from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("BudgetService");

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
    return prisma.budget.findMany({
      where: { userId, month: m, year: y },
      orderBy: { category: "asc" },
    });
  },

  async upsert(userId: string, input: BudgetInput) {
    const result = await prisma.budget.upsert({
      where: {
        userId_category_month_year: {
          userId,
          category: input.category,
          month: input.month,
          year: input.year,
        },
      },
      update: {
        monthlyLimit: input.monthlyLimit,
        alertAt80: input.alertAt80 ?? true,
        alertAt100: input.alertAt100 ?? true,
      },
      create: {
        userId,
        category: input.category,
        monthlyLimit: input.monthlyLimit,
        month: input.month,
        year: input.year,
        alertAt80: input.alertAt80 ?? true,
        alertAt100: input.alertAt100 ?? true,
      },
    });
    log.info("budget.upsert", { userId, category: input.category });
    return result;
  },

  async remove(userId: string, id: string) {
    await prisma.budget.deleteMany({ where: { id, userId } });
  },

  /** Returns budgets enriched with current month spend + status. */
  async getUsage(userId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const [budgets, txs] = await Promise.all([
      prisma.budget.findMany({ where: { userId, month: m, year: y } }),
      prisma.transaction.findMany({
        where: { userId, deletedAt: null, type: "EXPENSE", date: { gte: start, lt: end } },
        select: { category: true, amount: true },
      }),
    ]);

    const spendByCategory = new Map<string, number>();
    for (const t of txs) spendByCategory.set(t.category, (spendByCategory.get(t.category) ?? 0) + t.amount);

    return budgets.map((b) => {
      const spent = spendByCategory.get(b.category) ?? 0;
      const used = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      let status: "OK" | "WARN" | "EXCEEDED" = "OK";
      if (spent >= b.monthlyLimit) status = "EXCEEDED";
      else if (used >= 80) status = "WARN";
      return {
        id: b.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent,
        remaining: Math.max(0, b.monthlyLimit - spent),
        usedPercent: used,
        status,
        month: b.month,
        year: b.year,
      };
    });
  },
};
