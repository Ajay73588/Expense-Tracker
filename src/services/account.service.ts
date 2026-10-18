import { createLogger } from "../lib/logger";
import { cache, cacheKey } from "../lib/cache";
import { assertPrismaMode } from "../lib/feature-gate";
import { NotFoundError, BadRequestError, ConflictError } from "../lib/errors";

const log = createLogger("AccountService");

/** Allowed account types */
export const ACCOUNT_TYPES = ["BANK", "BROKER", "CREDIT_CARD", "WALLET", "OTHER"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface AccountInput {
  name: string;
  type?: AccountType;
  currency?: string;
  isDefault?: boolean;
  note?: string | null;
}

export const AccountService = {
  /** List all open (non-closed) accounts for a user, ordered by name. */
  async list(userId: string) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const accounts = await prisma.account.findMany({
      where: { userId, closedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    log.info("account.list", { userId, count: accounts.length });
    return accounts;
  },

  /** Get a single account, enforcing user ownership. Throws 404-like error if not found. */
  async get(userId: string, id: string) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new NotFoundError("Account");
    return account;
  },

  /** Create a new account. If isDefault=true, clears the flag from any existing default first. */
  async create(userId: string, input: AccountInput) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
    const result = await prisma.$transaction(async (tx: Tx) => {
      if (input.isDefault) {
        // Unset previous default for this user
        await tx.account.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.account.create({
        data: {
          userId,
          name: input.name.trim(),
          type: input.type ?? "OTHER",
          currency: input.currency ?? "INR",
          isDefault: input.isDefault ?? false,
          note: input.note ?? null,
        },
      });
    });
    await cache.delByPrefix(cacheKey("account", userId));
    log.info("account.create", { userId, id: result.id, type: result.type });
    return result;
  },

  /** Update mutable fields of an account. Ownership enforced. */
  async update(userId: string, id: string, input: Partial<AccountInput>) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
    const result = await prisma.$transaction(async (tx: Tx) => {
      // Confirm ownership
      const existing = await tx.account.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundError("Account");
      if (input.isDefault && !existing.isDefault) {
        await tx.account.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.account.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.note !== undefined && { note: input.note }),
        },
      });
    });
    await cache.delByPrefix(cacheKey("account", userId));
    log.info("account.update", { userId, id });
    return result;
  },

  /**
   * Soft-close an account. The account's historical transactions and assets are preserved.
   * Re-opening is done via update({ closedAt: null }).
   */
  async close(userId: string, id: string) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundError("Account");
    if (existing.closedAt) throw new BadRequestError("Account already closed", "ALREADY_CLOSED");
    const result = await prisma.account.update({
      where: { id },
      data: { closedAt: new Date(), isDefault: false },
    });
    await cache.delByPrefix(cacheKey("account", userId));
    log.info("account.close", { userId, id });
    return result;
  },

  /**
   * Hard-delete an account only if it has no linked transactions or assets.
   * If linked records exist, close() should be used instead.
   */
  async delete(userId: string, id: string) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");
    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundError("Account");

    // Safety check: refuse delete if linked records exist
    const [txCount, assetCount] = await Promise.all([
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.asset.count({ where: { accountId: id } }),
    ]);
    if (txCount > 0 || assetCount > 0) {
      throw new ConflictError(
        `Cannot delete account with linked records (${txCount} transactions, ${assetCount} assets). Use close() instead.`,
        "ACCOUNT_HAS_RECORDS"
      );
    }
    await prisma.account.delete({ where: { id } });
    await cache.delByPrefix(cacheKey("account", userId));
    log.info("account.delete", { userId, id });
    return { deleted: true };
  },

  /**
   * Migrate existing flat `Transaction.account` and `Asset.account` strings
   * into proper `Account` entities, linking them via `accountId`. (LEDGER-003)
   */
  async migrateFlatAccounts(userId: string) {
    assertPrismaMode();
    const { prisma } = await import("../lib/prisma");

    // Find all distinct non-null flat string accounts
    const txAccounts = await prisma.transaction.findMany({
      where: { userId, accountId: null, account: { not: null } },
      select: { account: true },
      distinct: ["account"],
    });
    
    const assetAccounts = await prisma.asset.findMany({
      where: { userId, accountId: null, account: { not: null } },
      select: { account: true },
      distinct: ["account"],
    });

    const uniqueNames = new Set([
      ...txAccounts.map((r: any) => r.account?.trim() || "Unassigned"),
      ...assetAccounts.map((r: any) => r.account?.trim() || "Unassigned"),
    ]);

    let migratedRecords = 0;

    // Create Account entities and update the records
    for (const name of uniqueNames) {
      if (!name) continue;

      // Upsert the Account entity
      const acc = await prisma.account.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name, type: "OTHER", currency: "INR" },
        update: {},
      });

      // Link transactions matching this exact name (using the flat field)
      const txRes = await prisma.transaction.updateMany({
        where: { userId, accountId: null, account: name },
        data: { accountId: acc.id },
      });

      // Link assets matching this exact name
      const assetRes = await prisma.asset.updateMany({
        where: { userId, accountId: null, account: name },
        data: { accountId: acc.id },
      });

      migratedRecords += txRes.count + assetRes.count;
    }

    if (migratedRecords > 0) {
      await cache.delByPrefix(cacheKey("tx", userId));
      await cache.delByPrefix(cacheKey("dashboard", userId));
      await cache.delByPrefix(cacheKey("account", userId));
    }
    log.info("account.migrateFlatAccounts", { userId, namesFound: uniqueNames.size, migratedRecords });
    return { namesCreated: uniqueNames.size, migratedRecords };
  },
};
