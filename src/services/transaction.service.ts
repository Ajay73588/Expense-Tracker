import { createLogger } from "../lib/logger";
import { cache, cacheKey } from "../lib/cache";
import { safeJsonParse } from "../utils/format";
import { getCollection, createDoc, updateDoc, softDeleteDoc } from "../lib/firebase";
import { NotFoundError } from "../lib/errors";

const log = createLogger("TransactionService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const COLLECTION = "transactions";
const QUERY_LIMIT = 500; // Safety cap — prevents massive unbounded reads

export interface TransactionInput {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  category: string;
  description?: string | null;
  date: Date | string;
  account?: string | null;
  accountId?: string | null;
  transferGroupId?: string | null;
  tags?: string[];
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date | string;
  description?: string | null;
  tags?: string[];
}

export const TransactionService = {
  async list(userId: string, opts: { limit?: number; offset?: number; category?: string } = {}) {
    if (USE_FIREBASE) {
      try {
        // SINGLE where(userId) only — avoids composite index requirement.
        // Secondary filters (deletedAt, category, sort, pagination) handled in JS.
        const db = getCollection(COLLECTION);
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        let rows = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
            tags: Array.isArray(data.tags) ? data.tags : safeJsonParse<string[]>(data.tags, []),
          } as any;
        });

        // In-memory filtering (no index needed)
        rows = rows.filter((r: any) => r.deletedAt === null || r.deletedAt === undefined);
        if (opts.category) rows = rows.filter((r: any) => r.category === opts.category);

        // Sort by date desc
        rows.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

        // Pagination in JS
        const offset = opts.offset ?? 0;
        const limit = opts.limit ?? 100;
        return rows.slice(offset, offset + limit);
      } catch (error: any) {
        log.error("transaction.list.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
          fallback: "returning empty array",
        });
        return [];
      }
    }

    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (opts.category) where.category = opts.category;
    const { prisma } = await import("../lib/prisma");
    const rows = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: opts.limit ?? 100,
      skip: opts.offset ?? 0,
    });
    return rows.map((r: any) => ({ ...r, tags: safeJsonParse<string[]>(r.tags, []) }));
  },

  async create(userId: string, input: TransactionInput) {
    if (input.type === "TRANSFER") {
      throw new Error("One-sided transfers are not allowed. Use createTransfer() instead.");
    }

    if (USE_FIREBASE) {
      const data = {
        userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: new Date(input.date),
        account: input.account ?? null,
        tags: input.tags ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      try {
        const id = await createDoc(COLLECTION, data);
        await cache.delByPrefix(cacheKey("tx", userId));
        await cache.delByPrefix(cacheKey("dashboard", userId));
        log.info("transaction.create.firebase", { userId, category: input.category });
        return { id, ...data };
      } catch (error: any) {
        log.error("transaction.create.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
        });
        throw error; // Write failures must propagate — don't silently swallow
      }
    }

    const { prisma } = await import("../lib/prisma");
    if (input.accountId) {
      const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
      if (!account) throw new NotFoundError("Account");
    }
    const created = await prisma.transaction.create({
      data: {
        userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: new Date(input.date),
        account: input.account ?? null,
        accountId: input.accountId ?? null,
        transferGroupId: input.transferGroupId ?? null,
        tags: JSON.stringify(input.tags ?? []),
      },
    });
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("transaction.create", { userId, category: input.category, type: input.type });
    return { ...created, tags: safeJsonParse<string[]>(created.tags, []) };
  },

  async remove(userId: string, id: string) {
    if (USE_FIREBASE) {
      try {
        const db = getCollection(COLLECTION);
        const doc = await db.doc(id).get();
        if (!doc.exists || doc.data()?.userId !== userId || doc.data()?.deletedAt) {
          throw new NotFoundError("Transaction");
        }
        await softDeleteDoc(COLLECTION, id);
      } catch (error: any) {
        if (error instanceof NotFoundError) throw error;
        log.error("transaction.remove.firebase.failed", {
          userId,
          id,
          error: error?.message ?? String(error),
        });
        throw error;
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      // Find the transaction to check if it's part of a transfer (LEDGER-005)
      const tx = await prisma.transaction.findFirst({ where: { id, userId, deletedAt: null } });
      if (!tx) {
        throw new NotFoundError("Transaction");
      }
      if (tx.transferGroupId) {
        await prisma.transaction.updateMany({
          where: { transferGroupId: tx.transferGroupId, userId },
          data: { deletedAt: new Date() },
        });
      } else {
        await prisma.transaction.updateMany({
          where: { id, userId },
          data: { deletedAt: new Date() },
        });
      }
    }
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
  },

  async update(userId: string, id: string, patch: Partial<TransactionInput>) {
    if (patch.type === "TRANSFER") {
      throw new Error("Cannot change transaction type to TRANSFER directly. Use createTransfer() instead.");
    }

    if (USE_FIREBASE) {
      const db = getCollection(COLLECTION);
      const doc = await db.doc(id).get();
      if (!doc.exists || doc.data()?.userId !== userId || doc.data()?.deletedAt) {
        throw new NotFoundError("Transaction");
      }
      const existing = doc.data() as any;
      if (existing.transferGroupId && patch.type && patch.type !== existing.type) {
        throw new Error("Cannot change type of transfer transaction");
      }

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (patch.type !== undefined) updateData.type = patch.type;
      if (patch.amount !== undefined) updateData.amount = patch.amount;
      if (patch.category !== undefined) updateData.category = patch.category;
      if (patch.description !== undefined) updateData.description = patch.description ?? null;
      if (patch.date !== undefined) updateData.date = new Date(patch.date);
      if (patch.account !== undefined) updateData.account = patch.account ?? null;
      if (patch.tags !== undefined) updateData.tags = patch.tags;

      await updateDoc(COLLECTION, id, updateData);
      await cache.delByPrefix(cacheKey("tx", userId));
      await cache.delByPrefix(cacheKey("dashboard", userId));
      log.info("transaction.update.firebase", { userId, id });
      return { id, ...existing, ...updateData };
    }

    const { prisma } = await import("../lib/prisma");
    const existing = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError("Transaction");
    }

    if (existing.transferGroupId && patch.type && patch.type !== existing.type) {
      throw new Error("Cannot change type of transfer transaction");
    }

    if (patch.amount !== undefined && patch.amount <= 0) {
      throw new Error("Transaction amount must be positive");
    }

    if (patch.accountId) {
      const account = await prisma.account.findFirst({ where: { id: patch.accountId, userId } });
      if (!account) throw new NotFoundError("Account");
    }

    // LEDGER-011: Transfer edit semantics.
    // If this transaction is part of a transfer group, synchronize amount, date, and description
    // across both legs atomically in a $transaction while preventing self-transfers.
    if (existing.transferGroupId) {
      const transferLegs = await prisma.transaction.findMany({
        where: { transferGroupId: existing.transferGroupId, userId, deletedAt: null },
      });
      const counterLeg = transferLegs.find((l: any) => l.id !== existing.id);

      // Validate self-transfer prevention if accountId is being changed
      if (patch.accountId && counterLeg && patch.accountId === counterLeg.accountId) {
        throw new Error("Source and destination accounts of a transfer cannot be the same");
      }

      type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
      const [updated] = await prisma.$transaction(async (tx: Tx) => {
        // 1. Update targeted leg
        const leg1 = await tx.transaction.update({
          where: { id },
          data: {
            ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
            ...(patch.date !== undefined ? { date: new Date(patch.date) } : {}),
            ...(patch.account !== undefined ? { account: patch.account ?? null } : {}),
            ...(patch.accountId !== undefined ? { accountId: patch.accountId ?? null } : {}),
            ...(patch.tags !== undefined ? { tags: JSON.stringify(patch.tags) } : {}),
          },
        });

        // 2. Synchronize paired counter leg
        if (counterLeg) {
          await tx.transaction.update({
            where: { id: counterLeg.id },
            data: {
              ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
              ...(patch.date !== undefined ? { date: new Date(patch.date) } : {}),
              ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
            },
          });
        }

        return [leg1];
      });

      await cache.delByPrefix(cacheKey("tx", userId));
      await cache.delByPrefix(cacheKey("dashboard", userId));
      log.info("transaction.update.transferGroup", { userId, id, transferGroupId: existing.transferGroupId });
      return { ...updated, tags: safeJsonParse<string[]>(updated.tags, []) };
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
        ...(patch.date !== undefined ? { date: new Date(patch.date) } : {}),
        ...(patch.account !== undefined ? { account: patch.account ?? null } : {}),
        ...(patch.accountId !== undefined ? { accountId: patch.accountId ?? null } : {}),
        ...(patch.tags !== undefined ? { tags: JSON.stringify(patch.tags) } : {}),
      },
    });

    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("transaction.update", { userId, id });
    return { ...updated, tags: safeJsonParse<string[]>(updated.tags, []) };
  },

  /** 
   * LEDGER-004: Atomic transfer creation.
   * Creates a paired EXPENSE and INCOME transaction wrapped in a single transfer group.
   */
  async createTransfer(userId: string, input: TransferInput) {
    if (USE_FIREBASE) throw new Error("Transfers not supported in Firebase mode");
    if (input.fromAccountId === input.toAccountId) {
      throw new Error("Source and destination accounts must be different");
    }
    if (input.amount <= 0) {
      throw new Error("Transfer amount must be positive");
    }

    const { prisma } = await import("../lib/prisma");
    
    // Generate a unique group ID
    const transferGroupId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const date = new Date(input.date);
    
    // Verify both accounts exist and belong to userId
    const [fromAcc, toAcc] = await Promise.all([
      prisma.account.findFirst({ where: { id: input.fromAccountId, userId } }),
      prisma.account.findFirst({ where: { id: input.toAccountId, userId } }),
    ]);
    if (!fromAcc || !toAcc) throw new NotFoundError("Account");

    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
    const result = await prisma.$transaction(async (tx: Tx) => {
      // 1. Debit leg (Expense)
      const debit = await tx.transaction.create({
        data: {
          userId,
          type: "TRANSFER",
          amount: input.amount,
          category: "Transfer Out",
          description: input.description ?? "Transfer Out",
          date,
          accountId: input.fromAccountId,
          transferGroupId,
          tags: JSON.stringify(input.tags ?? ["transfer"]),
        }
      });
      
      // 2. Credit leg (Income)
      const credit = await tx.transaction.create({
        data: {
          userId,
          type: "TRANSFER",
          amount: input.amount,
          category: "Transfer In",
          description: input.description ?? "Transfer In",
          date,
          accountId: input.toAccountId,
          transferGroupId,
          tags: JSON.stringify(input.tags ?? ["transfer"]),
        }
      });
      
      return { transferGroupId, debit, credit };
    });
    
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));
    log.info("transaction.transfer.create", { userId, transferGroupId, amount: input.amount });
    return result;
  },

  /** Aggregates income/expense/net by month for the last N months. */
  async summarizeByMonth(userId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1, 1);
    since.setHours(0, 0, 0, 0);

    let rows: any[] = [];
    if (USE_FIREBASE) {
      try {
        // SINGLE where(userId) — date filtering done in JS below
        const db = getCollection(COLLECTION);
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        rows = snapshot.docs
          .map(doc => {
            const d = doc.data() as any;
            return {
              ...d,
              date: d.date?.toDate ? d.date.toDate() : new Date(d.date),
            } as any;
          })
          // In-memory filter: not deleted + within date window
          .filter((d: any) => (d.deletedAt === null || d.deletedAt === undefined) && d.date >= since);

        log.info("transaction.summarizeByMonth.firebase", { userId, months, rowCount: rows.length });
      } catch (error: any) {
        log.error("transaction.summarizeByMonth.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
          fallback: "returning empty month buckets",
        });
        rows = [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      rows = await prisma.transaction.findMany({
        where: { userId, deletedAt: null, date: { gte: since } },
        select: { type: true, amount: true, date: true },
      });
    }

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
      const amt = r.amount?.toNumber ? r.amount.toNumber() : Number(r.amount);
      if (r.type === "INCOME") b.income += amt;
      else if (r.type === "EXPENSE") b.expense += amt;
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

    let rows: any[] = [];
    if (USE_FIREBASE) {
      try {
        // SINGLE where(userId) — was previously 5 chained .where() clauses
        // type, deletedAt, and date range all filtered in JS below
        const db = getCollection(COLLECTION);
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        rows = snapshot.docs
          .map(doc => doc.data())
          .filter(d => {
            const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
            return (
              (d.deletedAt === null || d.deletedAt === undefined) &&
              d.type === "EXPENSE" &&
              date >= start &&
              date < end
            );
          });

        log.info("transaction.categorySplit.firebase", { userId, month: m, year: y, rowCount: rows.length });
      } catch (error: any) {
        log.error("transaction.categorySplit.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
          fallback: "returning empty category split",
        });
        rows = [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      rows = await prisma.transaction.findMany({
        where: { userId, deletedAt: null, type: "EXPENSE", date: { gte: start, lt: end } },
        select: { category: true, amount: true },
      });
    }

    const map = new Map<string, number>();
    for (const r of rows) {
      const amt = r.amount?.toNumber ? r.amount.toNumber() : Number(r.amount);
      map.set(r.category, (map.get(r.category) ?? 0) + amt);
    }

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

    let rows: any[] = [];
    if (USE_FIREBASE) {
      try {
        // SINGLE where(userId) — date and deletedAt filtered in JS
        const db = getCollection(COLLECTION);
        const snapshot = await db
          .where("userId", "==", userId)
          .limit(QUERY_LIMIT)
          .get();

        rows = snapshot.docs
          .map(doc => doc.data())
          .filter(d => {
            const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
            return (d.deletedAt === null || d.deletedAt === undefined) && date >= start;
          });

        log.info("transaction.currentMonthTotals.firebase", { userId, rowCount: rows.length });
      } catch (error: any) {
        log.error("transaction.currentMonthTotals.firebase.failed", {
          userId,
          error: error?.message ?? String(error),
          fallback: "returning zero totals",
        });
        // Safe fallback: return zero totals so dashboard doesn't crash
        return { income: 0, expense: 0, net: 0 };
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      rows = await prisma.transaction.findMany({
        where: { userId, deletedAt: null, date: { gte: start } },
        select: { type: true, amount: true },
      });
    }

    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const amt = r.amount?.toNumber ? r.amount.toNumber() : Number(r.amount);
      if (r.type === "INCOME") income += amt;
      else if (r.type === "EXPENSE") expense += amt;
    }
    return { income, expense, net: income - expense };
  },
};
