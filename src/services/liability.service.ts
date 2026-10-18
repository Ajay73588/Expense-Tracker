import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "../lib/errors";
import { createLogger } from "../lib/logger";
import {
  calculateEMI,
  calculateTenure,
  generateAmortizationSchedule,
  simulatePrepayment,
  round2,
  AmortizationSchedule,
  PrepaymentSimulationResult,
  PrepaymentSimulationOptions,
} from "../lib/finance/amortization";
import { LiabilityItem, LiabilitySummary, LiabilityType } from "../types";

const log = createLogger("LiabilityService");

export interface CreateLiabilityInput {
  name: string;
  type: LiabilityType;
  principalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  monthlyEMI?: number | null;
  tenureMonths?: number | null;
  dueDate?: Date | string | null;
}

export interface UpdateLiabilityInput {
  name?: string;
  type?: LiabilityType;
  principalAmount?: number;
  outstandingAmount?: number;
  interestRate?: number;
  monthlyEMI?: number | null;
  tenureMonths?: number | null;
  dueDate?: Date | string | null;
}

export class LiabilityService {
  /**
   * Maps a Prisma Liability model record to a clean, JSON-serializable LiabilityItem.
   */
  private static toItem(record: any): LiabilityItem {
    const principal = Number(record.principalAmount);
    const outstanding = Number(record.outstandingAmount);
    const emi = record.monthlyEMI ? Number(record.monthlyEMI) : null;
    const rate = Number(record.interestRate);

    // Calculate progress percentage: (principal - outstanding) / principal
    let progressPct = 0;
    if (principal > 0) {
      progressPct = Math.min(100, Math.max(0, round2(((principal - outstanding) / principal) * 100)));
    }

    // Estimate remaining months if EMI and outstanding are known
    let estimatedRemainingMonths: number | undefined;
    if (outstanding > 0 && emi && emi > 0) {
      const tenure = calculateTenure(outstanding, rate, emi);
      if (Number.isFinite(tenure)) {
        estimatedRemainingMonths = tenure;
      }
    }

    return {
      id: record.id,
      userId: record.userId,
      type: record.type as LiabilityType,
      name: record.name,
      principalAmount: principal,
      outstandingAmount: outstanding,
      interestRate: rate,
      monthlyEMI: emi,
      dueDate: record.dueDate ? new Date(record.dueDate).toISOString() : null,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
      progressPct,
      estimatedRemainingMonths,
    };
  }

  /**
   * Retrieves all liabilities for a user with calculated progress and tenure.
   */
  static async getAll(userId: string): Promise<LiabilityItem[]> {
    const records = await prisma.liability.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(this.toItem);
  }

  /**
   * Computes portfolio-level summary of all user liabilities:
   * Total debt, monthly payments, weighted average interest rate.
   */
  static async getSummary(userId: string): Promise<LiabilitySummary> {
    const items = await this.getAll(userId);

    let totalPrincipal = 0;
    let totalOutstanding = 0;
    let totalMonthlyEMI = 0;
    let weightedRateNumerator = 0;

    for (const item of items) {
      totalPrincipal = round2(totalPrincipal + item.principalAmount);
      totalOutstanding = round2(totalOutstanding + item.outstandingAmount);
      if (item.monthlyEMI) {
        totalMonthlyEMI = round2(totalMonthlyEMI + item.monthlyEMI);
      }
      weightedRateNumerator += item.outstandingAmount * item.interestRate;
    }

    const weightedInterestRate =
      totalOutstanding > 0 ? round2(weightedRateNumerator / totalOutstanding) : 0;

    return {
      totalPrincipal,
      totalOutstanding,
      totalMonthlyEMI,
      weightedInterestRate,
      liabilitiesCount: items.length,
      liabilities: items,
    };
  }

  /**
   * Retrieves a single liability by ID, strictly enforcing user ownership (throws 404 if unowned).
   */
  static async getById(
    userId: string,
    id: string
  ): Promise<{ liability: LiabilityItem; schedule: AmortizationSchedule }> {
    const record = await prisma.liability.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundError("Liability");
    }

    const item = this.toItem(record);
    const schedule = await this.getSchedule(userId, id);

    return {
      liability: item,
      schedule,
    };
  }

  /**
   * Creates a new liability for the user.
   * Automatically calculates EMI if tenure is supplied without an explicit EMI.
   */
  static async create(userId: string, input: CreateLiabilityInput): Promise<LiabilityItem> {
    if (input.principalAmount <= 0) {
      throw new ValidationError("Principal amount must be positive");
    }
    if (input.outstandingAmount < 0) {
      throw new ValidationError("Outstanding amount cannot be negative");
    }
    if (input.interestRate < 0) {
      throw new ValidationError("Interest rate cannot be negative");
    }

    let calculatedEMI = input.monthlyEMI;
    if ((!calculatedEMI || calculatedEMI <= 0) && input.tenureMonths && input.tenureMonths > 0) {
      calculatedEMI = calculateEMI(input.principalAmount, input.interestRate, input.tenureMonths);
    }

    const created = await prisma.liability.create({
      data: {
        userId,
        name: input.name.trim(),
        type: input.type,
        principalAmount: new Prisma.Decimal(input.principalAmount),
        outstandingAmount: new Prisma.Decimal(input.outstandingAmount),
        interestRate: input.interestRate,
        monthlyEMI: calculatedEMI != null ? new Prisma.Decimal(calculatedEMI) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
    });

    log.info("liability.create", { userId, id: created.id, type: created.type });
    return this.toItem(created);
  }

  /**
   * Updates an existing liability, strictly scoped by user ID (404 on unowned).
   */
  static async update(userId: string, id: string, input: UpdateLiabilityInput): Promise<LiabilityItem> {
    const existing = await prisma.liability.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError("Liability");
    }

    const data: Prisma.LiabilityUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.type !== undefined) data.type = input.type;
    if (input.principalAmount !== undefined) data.principalAmount = new Prisma.Decimal(input.principalAmount);
    if (input.outstandingAmount !== undefined) data.outstandingAmount = new Prisma.Decimal(input.outstandingAmount);
    if (input.interestRate !== undefined) data.interestRate = input.interestRate;
    if (input.monthlyEMI !== undefined) {
      data.monthlyEMI = input.monthlyEMI != null ? new Prisma.Decimal(input.monthlyEMI) : null;
    }
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    const updated = await prisma.liability.update({
      where: { id },
      data,
    });

    log.info("liability.update", { userId, id });
    return this.toItem(updated);
  }

  /**
   * Deletes a liability, strictly enforcing ownership (404 on unowned).
   */
  static async remove(userId: string, id: string): Promise<{ success: boolean; id: string }> {
    const existing = await prisma.liability.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundError("Liability");
    }

    await prisma.liability.delete({
      where: { id },
    });

    log.info("liability.delete", { userId, id });
    return { success: true, id };
  }

  /**
   * Generates the amortization schedule for a liability.
   */
  static async getSchedule(
    userId: string,
    id: string,
    overrideTenureMonths?: number
  ): Promise<AmortizationSchedule> {
    const record = await prisma.liability.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundError("Liability");
    }

    const principal = Number(record.outstandingAmount);
    const rate = Number(record.interestRate);
    const emi = record.monthlyEMI ? Number(record.monthlyEMI) : null;

    let tenure = overrideTenureMonths;
    if (!tenure || tenure <= 0) {
      if (emi && emi > 0) {
        tenure = calculateTenure(principal, rate, emi);
        if (!Number.isFinite(tenure) || tenure <= 0) {
          tenure = 120; // Default fallback to 10 years if uncomputable
        }
      } else {
        tenure = 60; // Default 5 years
      }
    }

    return generateAmortizationSchedule({
      principal,
      annualRatePct: rate,
      tenureMonths: tenure,
      startDate: record.dueDate || record.createdAt,
    });
  }

  /**
   * Simulates prepayment scenarios on a user's liability.
   */
  static async simulatePrepayment(
    userId: string,
    id: string,
    options: Omit<PrepaymentSimulationOptions, "principal" | "annualRatePct" | "tenureMonths"> & {
      tenureMonths?: number;
    }
  ): Promise<PrepaymentSimulationResult> {
    const record = await prisma.liability.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundError("Liability");
    }

    const principal = Number(record.outstandingAmount);
    const rate = Number(record.interestRate);
    const emi = record.monthlyEMI ? Number(record.monthlyEMI) : null;

    let tenure = options.tenureMonths;
    if (!tenure || tenure <= 0) {
      if (emi && emi > 0) {
        tenure = calculateTenure(principal, rate, emi);
        if (!Number.isFinite(tenure) || tenure <= 0) {
          tenure = 120;
        }
      } else {
        tenure = 60;
      }
    }

    return simulatePrepayment({
      principal,
      annualRatePct: rate,
      tenureMonths: tenure,
      lumpSums: options.lumpSums,
      monthlyExtra: options.monthlyExtra,
      strategy: options.strategy,
      startDate: record.dueDate || record.createdAt,
    });
  }
}
