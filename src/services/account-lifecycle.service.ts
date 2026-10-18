import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const log = createLogger("account-lifecycle");

export interface AccountDeletionResult {
  success: boolean;
  userId: string;
  dbPurged: boolean;
  idpDeleted: boolean;
  idpWarning?: string;
  purgedAt: string;
  deletedCounts: {
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

export interface AccountDeletionOptions {
  clerkUserId?: string | null;
  bypassIdp?: boolean;
  _testFailBeforeCommit?: boolean;
}

export class AccountLifecycleService {
  /**
   * Permanently and completely purges a user account and all associated financial records.
   * Uses an atomic database transaction to guarantee no orphaned records or partial deletes.
   * If the database transaction succeeds, securely attempts external identity provider cleanup.
   */
  static async deleteAccount(
    userId: string,
    options?: AccountDeletionOptions
  ): Promise<AccountDeletionResult> {
    // 1. Verify user existence
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const clerkId = options?.clerkUserId ?? user.clerkId;

    // 2. Atomic database purge
    const deletedCounts = await prisma.$transaction(async (tx: any) => {
      // Delete child records in dependency order
      const conversations = await tx.aIConversation.deleteMany({ where: { userId } });
      const snapshots = await tx.snapshot.deleteMany({ where: { userId } });
      const allocationTargets = await tx.allocationTarget.deleteMany({ where: { userId } });
      const budgets = await tx.budget.deleteMany({ where: { userId } });
      const goals = await tx.goal.deleteMany({ where: { userId } });
      const liabilities = await tx.liability.deleteMany({ where: { userId } });
      const transactions = await tx.transaction.deleteMany({ where: { userId } });
      const assets = await tx.asset.deleteMany({ where: { userId } });
      const accounts = await tx.account.deleteMany({ where: { userId } });

      if (options?._testFailBeforeCommit) {
        throw new Error("Simulated database failure before commit");
      }

      // Delete parent user entity
      await tx.user.delete({ where: { id: userId } });

      return {
        accounts: accounts.count,
        assets: assets.count,
        transactions: transactions.count,
        liabilities: liabilities.count,
        budgets: budgets.count,
        goals: goals.count,
        snapshots: snapshots.count,
        allocationTargets: allocationTargets.count,
        conversations: conversations.count,
      };
    });

    log.info("Successfully purged user database records", {
      userId,
      deletedCounts,
    });

    // 3. Identity Provider Deletion (Clerk)
    let idpDeleted = false;
    let idpWarning: string | undefined = undefined;

    if (clerkId && !options?.bypassIdp) {
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const client = await clerkClient();
        await client.users.deleteUser(clerkId);
        idpDeleted = true;
        log.info("Successfully deleted user from Clerk identity provider", {
          userId,
          clerkId,
        });
      } catch (err: any) {
        log.warn("Failed to delete user in Clerk identity provider", {
          userId,
          clerkId,
          error: err?.message,
        });
        idpWarning = `Database records purged successfully, but identity provider deletion failed: ${err?.message || "Unknown error"}`;
      }
    }

    return {
      success: true,
      userId,
      dbPurged: true,
      idpDeleted,
      ...(idpWarning ? { idpWarning } : {}),
      purgedAt: new Date().toISOString(),
      deletedCounts,
    };
  }
}
