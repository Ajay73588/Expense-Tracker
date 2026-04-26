import { prisma } from "../lib/prisma";
import type { GoalStatus } from "../types";

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
  return Math.max(1, months);
}

export const GoalService = {
  async list(userId: string) {
    return prisma.goal.findMany({
      where: { userId },
      orderBy: { targetDate: "asc" },
    });
  },

  async create(userId: string, input: GoalInput) {
    const targetDate = new Date(input.targetDate);
    const current = input.currentAmount ?? 0;
    const months = monthsBetween(new Date(), targetDate);
    const monthlyRequired = Math.max(0, (input.targetAmount - current) / months);
    return prisma.goal.create({
      data: {
        userId,
        name: input.name,
        targetAmount: input.targetAmount,
        currentAmount: current,
        targetDate,
        monthlyRequired,
        status: input.status ?? "ACTIVE",
      },
    });
  },

  async update(userId: string, id: string, patch: Partial<GoalInput>) {
    const existing = await prisma.goal.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const targetDate = patch.targetDate ? new Date(patch.targetDate) : existing.targetDate;
    const targetAmount = patch.targetAmount ?? existing.targetAmount;
    const currentAmount = patch.currentAmount ?? existing.currentAmount;
    const months = monthsBetween(new Date(), targetDate);
    const monthlyRequired = Math.max(0, (targetAmount - currentAmount) / months);
    return prisma.goal.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        targetAmount,
        currentAmount,
        targetDate,
        monthlyRequired,
        ...(patch.status !== undefined && { status: patch.status }),
      },
    });
  },

  async remove(userId: string, id: string) {
    await prisma.goal.deleteMany({ where: { id, userId } });
  },

  async getAllWithProgress(userId: string) {
    const goals = await prisma.goal.findMany({ where: { userId }, orderBy: { targetDate: "asc" } });
    return goals.map((g) => {
      const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
      const months = monthsBetween(new Date(), g.targetDate);
      return {
        ...g,
        progress: Math.min(100, progress),
        monthsRemaining: months,
        onTrack: progress >= 100 || g.currentAmount / g.targetAmount >= 1 - months / 120,
      };
    });
  },

  /** Avg progress across active goals, 0..1. */
  async getAvgProgress(userId: string): Promise<number> {
    const goals = await prisma.goal.findMany({ where: { userId, status: "ACTIVE" } });
    if (goals.length === 0) return 0;
    const sum = goals.reduce(
      (acc, g) => acc + (g.targetAmount > 0 ? Math.min(1, g.currentAmount / g.targetAmount) : 0),
      0
    );
    return sum / goals.length;
  },
};
