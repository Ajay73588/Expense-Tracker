import type { GoalStatus } from "../types";
import { getCollection, createDoc, updateDoc, deleteDoc } from "../lib/firebase";
import { createLogger } from "../lib/logger";
import { NotFoundError } from "../lib/errors";

const log = createLogger("GoalService");
const USE_FIREBASE = process.env.USE_FIREBASE === "true";
const COLLECTION = "goals";
const QUERY_LIMIT = 200;

export interface GoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate: Date | string;
  status?: GoalStatus;
}

function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}

export const GoalService = {
  async list(userId: string) {
    if (USE_FIREBASE) {
      try {
        // Single where(userId) — orderBy(targetDate) removed to avoid composite index
        // Sorted in JS instead
        const db = getCollection(COLLECTION);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        const rows = snapshot.docs
          .map(doc => {
            const d = doc.data();
            return { id: doc.id, ...d, targetDate: d.targetDate?.toDate ? d.targetDate.toDate() : new Date(d.targetDate) };
          })
          .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
        log.info("goal.list.firebase", { userId, count: rows.length });
        return rows;
      } catch (error: any) {
        log.error("goal.list.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty list",
        });
        return [];
      }
    }
    const { prisma } = await import("../lib/prisma");
    const rows = await prisma.goal.findMany({ where: { userId }, orderBy: { targetDate: "asc" } });
    return rows.map((r: any) => ({
      ...r,
      targetAmount: r.targetAmount?.toNumber ? r.targetAmount.toNumber() : Number(r.targetAmount),
      currentAmount: r.currentAmount?.toNumber ? r.currentAmount.toNumber() : Number(r.currentAmount),
      monthlyRequired: r.monthlyRequired?.toNumber ? r.monthlyRequired.toNumber() : Number(r.monthlyRequired),
    }));
  },

  async create(userId: string, input: GoalInput) {
    const current = input.currentAmount ?? 0;
    const targetDate = new Date(input.targetDate);
    const months = monthsBetween(new Date(), targetDate);
    const gap = Math.max(0, input.targetAmount - current);
    const monthlyRequired = months <= 0 ? gap : Math.round((gap / months) * 100) / 100;

    if (USE_FIREBASE) {
      try {
        const data = {
          userId, name: input.name, targetAmount: input.targetAmount,
          currentAmount: current, targetDate, monthlyRequired,
          status: input.status ?? "ACTIVE", createdAt: new Date(), updatedAt: new Date(),
        };
        const id = await createDoc(COLLECTION, data);
        log.info("goal.create.firebase", { userId, name: input.name });
        return { id, ...data };
      } catch (error: any) {
        log.error("goal.create.firebase.failed", { userId, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const created = await prisma.goal.create({
      data: { userId, name: input.name, targetAmount: input.targetAmount, currentAmount: current, targetDate, monthlyRequired, status: input.status ?? "ACTIVE" },
    });
    return {
      ...created,
      targetAmount: created.targetAmount.toNumber(),
      currentAmount: created.currentAmount.toNumber(),
      monthlyRequired: created.monthlyRequired.toNumber(),
    };
  },

  async update(userId: string, id: string, patch: Partial<GoalInput>) {
    let existing: any;
    if (USE_FIREBASE) {
      try {
        const db = getCollection(COLLECTION);
        const doc = await db.doc(id).get();
        if (!doc.exists || doc.data()?.userId !== userId) return null;
        existing = { id: doc.id, ...doc.data(), targetDate: doc.data()?.targetDate?.toDate ? doc.data()?.targetDate.toDate() : new Date(doc.data()?.targetDate) };
      } catch (error: any) {
        log.error("goal.update.fetch.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        return null;
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      existing = await prisma.goal.findFirst({ where: { id, userId } });
    }

    if (!existing) throw new NotFoundError("Goal");
    const targetDate = patch.targetDate ? new Date(patch.targetDate) : (existing.targetDate?.toDate ? existing.targetDate.toDate() : new Date(existing.targetDate));
    const targetAmount = patch.targetAmount !== undefined ? patch.targetAmount : (existing.targetAmount?.toNumber ? existing.targetAmount.toNumber() : Number(existing.targetAmount ?? 0));
    const currentAmount = patch.currentAmount !== undefined ? patch.currentAmount : (existing.currentAmount?.toNumber ? existing.currentAmount.toNumber() : Number(existing.currentAmount ?? 0));
    const months = monthsBetween(new Date(), targetDate);
    const gap = Math.max(0, targetAmount - currentAmount);
    const monthlyRequired = months <= 0 ? gap : Math.round((gap / months) * 100) / 100;

    if (USE_FIREBASE) {
      try {
        const data = {
          ...(patch.name !== undefined && { name: patch.name }),
          targetAmount, currentAmount, targetDate, monthlyRequired,
          ...(patch.status !== undefined && { status: patch.status }),
          updatedAt: new Date(),
        };
        await updateDoc(COLLECTION, id, data);
        log.info("goal.update.firebase", { userId, id });
        return { ...existing, ...data };
      } catch (error: any) {
        log.error("goal.update.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    }

    const { prisma } = await import("../lib/prisma");
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        targetAmount, currentAmount, targetDate, monthlyRequired,
        ...(patch.status !== undefined && { status: patch.status }),
      },
    });
    return {
      ...updated,
      targetAmount: updated.targetAmount.toNumber(),
      currentAmount: updated.currentAmount.toNumber(),
      monthlyRequired: updated.monthlyRequired.toNumber(),
    };
  },

  async remove(userId: string, id: string) {
    if (USE_FIREBASE) {
      try {
        const db = getCollection(COLLECTION);
        const doc = await db.doc(id).get();
        if (!doc.exists || doc.data()?.userId !== userId) throw new NotFoundError("Goal");
        await deleteDoc(COLLECTION, id);
      } catch (error: any) {
        if (error instanceof NotFoundError) throw error;
        log.error("goal.remove.firebase.failed", { userId, id, error: error?.message ?? String(error) });
        throw error;
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      const { count } = await prisma.goal.deleteMany({ where: { id, userId } });
      if (count === 0) throw new NotFoundError("Goal");
    }
  },

  async getAllWithProgress(userId: string) {
    let goals: any[] = [];
    if (USE_FIREBASE) {
      try {
        // Single where(userId) — orderBy removed; sorted in JS
        const db = getCollection(COLLECTION);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        goals = snapshot.docs
          .map(doc => {
            const d = doc.data();
            return { id: doc.id, ...d, targetDate: d.targetDate?.toDate ? d.targetDate.toDate() : new Date(d.targetDate) };
          })
          .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
        log.info("goal.getAllWithProgress.firebase", { userId, count: goals.length });
      } catch (error: any) {
        log.error("goal.getAllWithProgress.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "empty list",
        });
        return [];
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      goals = await prisma.goal.findMany({ where: { userId }, orderBy: { targetDate: "asc" } });
    }

    return goals.map((g: any) => {
      const tgt = g.targetAmount?.toNumber ? g.targetAmount.toNumber() : Number(g.targetAmount);
      const cur = g.currentAmount?.toNumber ? g.currentAmount.toNumber() : Number(g.currentAmount);
      const progress = tgt > 0 ? (cur / tgt) * 100 : 0;
      const months = monthsBetween(new Date(), g.targetDate);
      return {
        ...g,
        targetAmount: tgt,
        currentAmount: cur,
        monthlyRequired: g.monthlyRequired?.toNumber ? g.monthlyRequired.toNumber() : Number(g.monthlyRequired),
        progress: Math.min(100, progress),
        monthsRemaining: months,
        onTrack: progress >= 100 || (months > 0 && cur / tgt >= 1 - months / 120),
      };
    });
  },

  async getAvgProgress(userId: string): Promise<number> {
    let goals: any[] = [];
    if (USE_FIREBASE) {
      try {
        // Single where(userId) — status filtered in JS (was previously causing composite index)
        const db = getCollection(COLLECTION);
        const snapshot = await db.where("userId", "==", userId).limit(QUERY_LIMIT).get();
        goals = snapshot.docs
          .map(doc => doc.data())
          .filter(d => d.status === "ACTIVE");
        log.info("goal.getAvgProgress.firebase", { userId, activeCount: goals.length });
      } catch (error: any) {
        log.error("goal.getAvgProgress.firebase.failed", {
          userId, error: error?.message ?? String(error), fallback: "returning 0",
        });
        return 0;
      }
    } else {
      const { prisma } = await import("../lib/prisma");
      goals = await prisma.goal.findMany({ where: { userId, status: "ACTIVE" } });
    }

    if (goals.length === 0) return 0;
    const sum = goals.reduce(
      (acc: number, g: any) => {
        const tgt = g.targetAmount?.toNumber ? g.targetAmount.toNumber() : Number(g.targetAmount);
        const cur = g.currentAmount?.toNumber ? g.currentAmount.toNumber() : Number(g.currentAmount);
        return acc + (tgt > 0 ? Math.min(1, cur / tgt) : 0);
      },
      0
    );
    return sum / goals.length;
  },
};
