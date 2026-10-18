import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("data-export");

export interface ExportMetadata {
  version: string;
  exportedAt: string;
  exportId: string;
  entityCounts: {
    accounts: number;
    assets: number;
    transactions: number;
    liabilities: number;
    budgets: number;
    goals: number;
    snapshots: number;
    allocationTargets: number;
    conversations: number;
  };
}

export interface UserProfileExport {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  privacyMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDataExport {
  exportMetadata: ExportMetadata;
  user: UserProfileExport;
  accounts: any[];
  assets: any[];
  transactions: any[];
  liabilities: any[];
  budgets: any[];
  goals: any[];
  snapshots: any[];
  allocationTargets: any[];
  conversations: any[];
}

export class DataExportService {
  /**
   * Generates a complete, GDPR/DPDP-compliant data export for the authenticated user.
   * All queries are strictly scoped to the user ID.
   * Internal secrets, API tokens, and other users' records are strictly excluded.
   */
  static async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        privacyMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Parallel fetch of all user-scoped records
    const [
      accounts,
      assets,
      transactions,
      liabilities,
      budgets,
      goals,
      snapshots,
      allocationTargets,
      conversations,
    ] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.asset.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: "asc" },
      }),
      prisma.liability.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.budget.findMany({
        where: { userId },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      }),
      prisma.goal.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.snapshot.findMany({
        where: { userId },
        orderBy: { date: "asc" },
      }),
      prisma.allocationTarget.findMany({
        where: { userId },
        orderBy: { assetType: "asc" },
      }),
      prisma.aIConversation.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const exportedAt = new Date().toISOString();

    const entityCounts = {
      accounts: accounts.length,
      assets: assets.length,
      transactions: transactions.length,
      liabilities: liabilities.length,
      budgets: budgets.length,
      goals: goals.length,
      snapshots: snapshots.length,
      allocationTargets: allocationTargets.length,
      conversations: conversations.length,
    };

    log.info("Generated user data export", {
      userId,
      exportId,
      entityCounts,
    });

    return {
      exportMetadata: {
        version: "1.0.0",
        exportedAt,
        exportId,
        entityCounts,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        privacyMode: user.privacyMode,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accounts: accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        isDefault: a.isDefault,
        note: a.note,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        closedAt: a.closedAt ? a.closedAt.toISOString() : null,
      })),
      assets: assets.map((a: any) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        symbol: a.symbol,
        quantity: a.quantity?.toString() ?? "0",
        avgBuyPrice: a.avgBuyPrice?.toString() ?? "0",
        currentPrice: a.currentPrice?.toString() ?? "0",
        currency: a.currency,
        account: a.account,
        accountId: a.accountId,
        importSource: a.importSource,
        isin: a.isin,
        exchange: a.exchange,
        folio: a.folio,
        importKey: a.importKey,
        priceSource: a.priceSource,
        priceUpdatedAt: a.priceUpdatedAt ? a.priceUpdatedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
      })),
      transactions: transactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount?.toString() ?? "0",
        category: t.category,
        description: t.description,
        date: t.date.toISOString(),
        account: t.account,
        accountId: t.accountId,
        tags: (() => {
          try {
            return JSON.parse(t.tags);
          } catch {
            return [];
          }
        })(),
        transferGroupId: t.transferGroupId,
        createdAt: t.createdAt.toISOString(),
        deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
      })),
      liabilities: liabilities.map((l: any) => ({
        id: l.id,
        type: l.type,
        name: l.name,
        principalAmount: l.principalAmount?.toString() ?? "0",
        outstandingAmount: l.outstandingAmount?.toString() ?? "0",
        interestRate: l.interestRate,
        monthlyEMI: l.monthlyEMI?.toString() ?? null,
        dueDate: l.dueDate ? l.dueDate.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      })),
      budgets: budgets.map((b: any) => ({
        id: b.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit?.toString() ?? "0",
        month: b.month,
        year: b.year,
        alertAt80: b.alertAt80,
        alertAt100: b.alertAt100,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      goals: goals.map((g: any) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount?.toString() ?? "0",
        currentAmount: g.currentAmount?.toString() ?? "0",
        targetDate: g.targetDate.toISOString(),
        monthlyRequired: g.monthlyRequired?.toString() ?? "0",
        status: g.status,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
      snapshots: snapshots.map((s: any) => ({
        id: s.id,
        date: s.date.toISOString(),
        totalAssets: s.totalAssets?.toString() ?? "0",
        totalLiabilities: s.totalLiabilities?.toString() ?? "0",
        netWorth: s.netWorth?.toString() ?? "0",
        breakdown: (() => {
          try {
            return JSON.parse(s.breakdown);
          } catch {
            return {};
          }
        })(),
        createdAt: s.createdAt.toISOString(),
      })),
      allocationTargets: allocationTargets.map((at: any) => ({
        id: at.id,
        assetType: at.assetType,
        targetPercent: at.targetPercent,
      })),
      conversations: conversations.map((c: any) => ({
        id: c.id,
        action: c.action,
        messages: (() => {
          try {
            return JSON.parse(c.messages);
          } catch {
            return [];
          }
        })(),
        contextSnapshot: (() => {
          try {
            return JSON.parse(c.contextSnapshot);
          } catch {
            return {};
          }
        })(),
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Generates a standard RFC 4180 CSV export of all user transactions.
   * Protects against CSV spreadsheet formula injection (=, +, -, @, \t, \r).
   */
  static async exportTransactionsCsv(userId: string): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      orderBy: { date: "desc" },
    });

    const headers = ["Date", "Type", "Category", "Amount", "Account", "Description", "Tags"];
    const rows = transactions.map((t: any) => {
      const date = t.date ? new Date(t.date).toISOString().slice(0, 10) : "";
      const tags = (() => {
        try {
          return JSON.parse(t.tags).join("; ");
        } catch {
          return "";
        }
      })();
      return [
        date,
        t.type,
        t.category,
        t.amount?.toString() ?? "0",
        t.account ?? "",
        t.description ?? "",
        tags,
      ].map(sanitizeCsvCell).join(",");
    });

    return [headers.join(","), ...rows].join("\r\n");
  }

  /**
   * Generates a standard RFC 4180 CSV export of all active user portfolio holdings.
   * Protects against CSV spreadsheet formula injection (=, +, -, @, \t, \r).
   */
  static async exportHoldingsCsv(userId: string): Promise<string> {
    const assets = await prisma.asset.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const headers = [
      "Type",
      "Name",
      "Symbol",
      "Quantity",
      "AvgBuyPrice",
      "CurrentPrice",
      "Currency",
      "Account",
      "ISIN",
      "Exchange",
      "PriceSource",
    ];

    const rows = assets.map((a: any) => {
      return [
        a.type,
        a.name,
        a.symbol ?? "",
        a.quantity?.toString() ?? "0",
        a.avgBuyPrice?.toString() ?? "0",
        a.currentPrice?.toString() ?? "0",
        a.currency,
        a.account ?? "",
        a.isin ?? "",
        a.exchange ?? "",
        a.priceSource ?? "",
      ].map(sanitizeCsvCell).join(",");
    });

    return [headers.join(","), ...rows].join("\r\n");
  }
}

/**
 * RFC 4180 compliant CSV cell sanitizer with spreadsheet formula injection protection.
 * If a cell string starts with =, +, -, @, \t, or \r and is not a pure numeric value,
 * it is prepended with a single quote (') to force spreadsheet processors (Excel, Sheets)
 * to evaluate the cell strictly as plain text instead of executable formulas.
 */
export function sanitizeCsvCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  let str = String(cell);

  const trimmed = str.trim();
  // Valid numeric expressions (e.g. 500, -1250.50, +42) are kept as numbers
  const isPureNumber = /^[+\-]?\d+(\.\d+)?$/.test(trimmed);

  if (!isPureNumber && /^[=+\-@\t\r]/.test(trimmed)) {
    str = `'${str}`;
  }

  // RFC 4180 standard escaping for delimiters, line breaks, and quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

