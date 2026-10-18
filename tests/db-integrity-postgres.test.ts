import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, Prisma } from "@prisma/client";

const DISPOSABLE_DB_URL =
  process.env.DISPOSABLE_DATABASE_URL ||
  "postgresql://postgres:ajay2312@localhost:5432/financeai_disposable_test";

describe("STAB-005: PostgreSQL Database Integrity & Concurrency Integration", () => {
  let db: PrismaClient;
  let testUserId: string;

  beforeAll(async () => {
    db = new PrismaClient({
      datasources: {
        db: {
          url: DISPOSABLE_DB_URL,
        },
      },
    });

    // 1. SAFETY ASSERTION: Verify connection is strictly pointing to the disposable DB
    const dbInfo = await db.$queryRawUnsafe<any[]>(
      "SELECT current_database() as db_name, current_user as user_name;"
    );
    expect(dbInfo).toBeDefined();
    expect(dbInfo.length).toBe(1);
    expect(dbInfo[0].db_name).toBe("financeai_disposable_test");

    // 2. Create dedicated isolated user for integrity tests
    const timestamp = Date.now() + "_" + Math.random().toString(36).substring(7);
    const user = await db.user.create({
      data: {
        clerkId: `integrity_user_${timestamp}`,
        email: `integrity_${timestamp}@example.com`,
        name: "DB Integrity Tester",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (db) {
      await db.$disconnect();
    }
  });

  describe("1. Unique Constraints Enforced by PostgreSQL Schema", () => {
    it("enforces unique constraint on Asset(userId, importKey) preventing duplicates", async () => {
      const importKey = `GROWW|MUTUAL_FUND|Zerodha Demat|12345678_${Date.now()}`;

      // First insertion succeeds
      const first = await db.asset.create({
        data: {
          userId: testUserId,
          type: "MUTUAL_FUND",
          name: "Parag Parikh Flexi Cap",
          quantity: new Prisma.Decimal("150.500000"),
          avgBuyPrice: new Prisma.Decimal("55.2500"),
          currentPrice: new Prisma.Decimal("62.8000"),
          importKey,
        },
      });
      expect(first.id).toBeDefined();

      // Second insertion with identical (userId, importKey) MUST fail with PostgreSQL unique violation
      await expect(
        db.asset.create({
          data: {
            userId: testUserId,
            type: "MUTUAL_FUND",
            name: "Parag Parikh Flexi Cap Duplicate",
            quantity: new Prisma.Decimal("100.000000"),
            avgBuyPrice: new Prisma.Decimal("50.0000"),
            currentPrice: new Prisma.Decimal("60.0000"),
            importKey,
          },
        })
      ).rejects.toThrowError(/Unique constraint failed on the fields: \(`userId`,`importKey`\)/);
    });

    it("enforces unique constraint on Account(userId, name)", async () => {
      const accountName = `HDFC Salary Account ${Date.now()}`;

      const firstAcc = await db.account.create({
        data: {
          userId: testUserId,
          name: accountName,
          type: "BANK",
        },
      });
      expect(firstAcc.id).toBeDefined();

      await expect(
        db.account.create({
          data: {
            userId: testUserId,
            name: accountName,
            type: "BANK",
          },
        })
      ).rejects.toThrowError(/Unique constraint failed on the fields: \(`userId`,`name`\)/);
    });

    it("enforces unique constraint on Budget(userId, category, month, year)", async () => {
      const category = `Dining_${Date.now()}`;
      const month = 10;
      const year = 2026;

      const firstBudget = await db.budget.create({
        data: {
          userId: testUserId,
          category,
          month,
          year,
          monthlyLimit: new Prisma.Decimal("12000.0000"),
        },
      });
      expect(firstBudget.id).toBeDefined();

      await expect(
        db.budget.create({
          data: {
            userId: testUserId,
            category,
            month,
            year,
            monthlyLimit: new Prisma.Decimal("15000.0000"),
          },
        })
      ).rejects.toThrowError(/Unique constraint failed on the fields: \(`userId`,`category`,`month`,`year`\)/);
    });

    it("enforces unique constraint on Snapshot(userId, date)", async () => {
      const snapshotDate = new Date("2026-10-12T00:00:00.000Z");

      const firstSnapshot = await db.snapshot.create({
        data: {
          userId: testUserId,
          date: snapshotDate,
          totalAssets: new Prisma.Decimal("100000.0000"),
          totalLiabilities: new Prisma.Decimal("20000.0000"),
          netWorth: new Prisma.Decimal("80000.0000"),
          breakdown: "{}",
        },
      });
      expect(firstSnapshot.id).toBeDefined();

      await expect(
        db.snapshot.create({
          data: {
            userId: testUserId,
            date: snapshotDate,
            totalAssets: new Prisma.Decimal("110000.0000"),
            totalLiabilities: new Prisma.Decimal("20000.0000"),
            netWorth: new Prisma.Decimal("90000.0000"),
            breakdown: "{}",
          },
        })
      ).rejects.toThrowError(/Unique constraint failed on the fields: \(`userId`,`date`\)/);
    });
  });

  describe("2. Atomic Transfers Commit & Rollback (Paired Transactions)", () => {
    it("atomically commits both debit and credit legs of a transfer in a single transaction", async () => {
      const fromAcc = await db.account.create({
        data: { userId: testUserId, name: `Savings_${Date.now()}`, type: "BANK" },
      });
      const toAcc = await db.account.create({
        data: { userId: testUserId, name: `Brokerage_${Date.now()}`, type: "BROKER" },
      });

      const transferGroupId = `tr_test_${Date.now()}`;
      const amount = new Prisma.Decimal("25000.0000");

      const result = await db.$transaction(async (tx) => {
        const debit = await tx.transaction.create({
          data: {
            userId: testUserId,
            type: "TRANSFER",
            amount,
            category: "Transfer Out",
            description: "Move to brokerage",
            date: new Date(),
            accountId: fromAcc.id,
            transferGroupId,
            tags: JSON.stringify(["transfer", "investment"]),
          },
        });

        const credit = await tx.transaction.create({
          data: {
            userId: testUserId,
            type: "TRANSFER",
            amount,
            category: "Transfer In",
            description: "Received from savings",
            date: new Date(),
            accountId: toAcc.id,
            transferGroupId,
            tags: JSON.stringify(["transfer", "investment"]),
          },
        });

        return { debit, credit };
      });

      expect(result.debit.id).toBeDefined();
      expect(result.credit.id).toBeDefined();

      // Verify both legs exist in PostgreSQL
      const persisted = await db.transaction.findMany({
        where: { transferGroupId, userId: testUserId },
      });
      expect(persisted.length).toBe(2);
      expect(persisted.find((t) => t.category === "Transfer Out")?.amount.toString()).toBe("25000");
      expect(persisted.find((t) => t.category === "Transfer In")?.amount.toString()).toBe("25000");
    });

    it("atomically rolls back both legs when a step fails (zero partial ledger records)", async () => {
      const fromAcc = await db.account.create({
        data: { userId: testUserId, name: `Rollback_From_${Date.now()}`, type: "BANK" },
      });

      const transferGroupId = `tr_fail_${Date.now()}`;
      const amount = new Prisma.Decimal("10000.0000");

      let caughtError: any = null;
      try {
        await db.$transaction(async (tx) => {
          // 1. Create debit leg
          await tx.transaction.create({
            data: {
              userId: testUserId,
              type: "TRANSFER",
              amount,
              category: "Transfer Out",
              description: "Move funds",
              date: new Date(),
              accountId: fromAcc.id,
              transferGroupId,
            },
          });

          // 2. Simulated sudden failure (e.g., downstream crash or validation failure)
          throw new Error("Simulated transfer failure during credit leg");
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain("Simulated transfer failure");

      // Verify ZERO records remain in PostgreSQL for this transfer group
      const orphaned = await db.transaction.findMany({
        where: { transferGroupId, userId: testUserId },
      });
      expect(orphaned.length).toBe(0);
    });
  });

  describe("3. Multi-Row Transaction Failure Leaves Zero Partial Data", () => {
    it("rolls back all rows when an operation in a batch transaction fails", async () => {
      const uniqueBatchMarker = `batch_${Date.now()}`;

      let txError: any = null;
      try {
        await db.$transaction(async (tx) => {
          // 1. Insert first transaction
          await tx.transaction.create({
            data: {
              userId: testUserId,
              type: "EXPENSE",
              amount: new Prisma.Decimal("100.0000"),
              category: "Utilities",
              description: `${uniqueBatchMarker}_1`,
              date: new Date(),
            },
          });

          // 2. Insert second transaction
          await tx.transaction.create({
            data: {
              userId: testUserId,
              type: "EXPENSE",
              amount: new Prisma.Decimal("200.0000"),
              category: "Utilities",
              description: `${uniqueBatchMarker}_2`,
              date: new Date(),
            },
          });

          // 3. Deliberately violate foreign key constraint or throw
          throw new Error("Database transaction aborted midway");
        });
      } catch (e) {
        txError = e;
      }

      expect(txError).toBeDefined();

      // Verify that neither transaction 1 nor transaction 2 were persisted
      const written = await db.transaction.findMany({
        where: {
          userId: testUserId,
          description: { startsWith: uniqueBatchMarker },
        },
      });
      expect(written.length).toBe(0);
    });
  });

  describe("4. Concurrent Repeated Imports Do Not Create Duplicates", () => {
    it("concurrently importing the same holding results in exactly 1 persisted record", async () => {
      const concurrentImportKey = `CONCURRENT_TEST|MUTUAL_FUND|Default|FOLIO_${Date.now()}`;
      const holdingName = "Nippon India Small Cap Fund";

      // Emulate 5 concurrent workers attempting to insert/upsert the exact same holding simultaneously
      const workerCount = 5;
      const workerPromises = Array.from({ length: workerCount }).map(async (_, idx) => {
        try {
          return await db.$transaction(async (tx) => {
            const existing = await tx.asset.findFirst({
              where: { userId: testUserId, importKey: concurrentImportKey },
            });
            if (existing) {
              return await tx.asset.update({
                where: { id: existing.id },
                data: {
                  quantity: new Prisma.Decimal((100 + idx).toString()),
                  currentPrice: new Prisma.Decimal((80 + idx).toString()),
                  updatedAt: new Date(),
                },
              });
            } else {
              return await tx.asset.create({
                data: {
                  userId: testUserId,
                  type: "MUTUAL_FUND",
                  name: holdingName,
                  quantity: new Prisma.Decimal("100.000000"),
                  avgBuyPrice: new Prisma.Decimal("75.0000"),
                  currentPrice: new Prisma.Decimal("80.0000"),
                  importKey: concurrentImportKey,
                },
              });
            }
          });
        } catch (err: any) {
          // If a concurrent race hits the PostgreSQL unique constraint (P2002),
          // handle it idempotently by updating the newly created record
          if (err.code === "P2002") {
            return await db.asset.update({
              where: {
                userId_importKey: {
                  userId: testUserId,
                  importKey: concurrentImportKey,
                },
              },
              data: {
                quantity: new Prisma.Decimal((100 + idx).toString()),
              },
            });
          }
          throw err;
        }
      });

      const results = await Promise.all(workerPromises);
      expect(results.length).toBe(workerCount);

      // Verify PostgreSQL database state: exactly ONE row exists
      const persistedHoldings = await db.asset.findMany({
        where: { userId: testUserId, importKey: concurrentImportKey },
      });
      expect(persistedHoldings.length).toBe(1);
      expect(persistedHoldings[0].name).toBe(holdingName);
    });
  });

  describe("5. Soft-Deleted Records Behavior and Resurrect Lifecycle", () => {
    it("soft-deleted transactions remain in DB for audit but are filtered from active queries", async () => {
      const tx = await db.transaction.create({
        data: {
          userId: testUserId,
          type: "EXPENSE",
          amount: new Prisma.Decimal("750.0000"),
          category: "Groceries",
          date: new Date(),
        },
      });

      // Soft delete
      const deletedAt = new Date();
      await db.transaction.update({
        where: { id: tx.id },
        data: { deletedAt },
      });

      // 1. Raw lookup confirms physical row remains with deletedAt timestamp
      const physicalRow = await db.transaction.findUnique({
        where: { id: tx.id },
      });
      expect(physicalRow).not.toBeNull();
      expect(physicalRow?.deletedAt).not.toBeNull();

      // 2. Active ledger queries (deletedAt: null) exclude it
      const activeQuery = await db.transaction.findMany({
        where: { userId: testUserId, id: tx.id, deletedAt: null },
      });
      expect(activeQuery.length).toBe(0);
    });

    it("soft-deleting a transfer group marks both legs deleted atomically", async () => {
      const transferGroupId = `tr_soft_del_${Date.now()}`;
      await db.transaction.createMany({
        data: [
          {
            userId: testUserId,
            type: "TRANSFER",
            amount: new Prisma.Decimal("5000.0000"),
            category: "Transfer Out",
            date: new Date(),
            transferGroupId,
          },
          {
            userId: testUserId,
            type: "TRANSFER",
            amount: new Prisma.Decimal("5000.0000"),
            category: "Transfer In",
            date: new Date(),
            transferGroupId,
          },
        ],
      });

      // Soft-delete the entire transfer group
      const updateResult = await db.transaction.updateMany({
        where: { userId: testUserId, transferGroupId },
        data: { deletedAt: new Date() },
      });
      expect(updateResult.count).toBe(2);

      // Verify active queries see neither leg
      const activeLegs = await db.transaction.findMany({
        where: { userId: testUserId, transferGroupId, deletedAt: null },
      });
      expect(activeLegs.length).toBe(0);
    });

    it("re-importing a previously soft-deleted asset resurrects it without constraint violation", async () => {
      const importKey = `GROWW|STOCK|Zerodha|INFY_${Date.now()}`;

      // 1. Initial creation
      const asset = await db.asset.create({
        data: {
          userId: testUserId,
          type: "STOCK",
          name: "Infosys Ltd",
          symbol: "INFY",
          quantity: new Prisma.Decimal("50.000000"),
          avgBuyPrice: new Prisma.Decimal("1400.0000"),
          currentPrice: new Prisma.Decimal("1500.0000"),
          importKey,
        },
      });

      // 2. User deletes or replaces snapshot (soft-delete)
      await db.asset.update({
        where: { id: asset.id },
        data: { deletedAt: new Date() },
      });

      const softDeleted = await db.asset.findUnique({ where: { id: asset.id } });
      expect(softDeleted?.deletedAt).not.toBeNull();

      // 3. Next import includes this holding again: AssetService resurrects by setting deletedAt: null
      const resurrected = await db.asset.update({
        where: { id: asset.id },
        data: {
          quantity: new Prisma.Decimal("60.000000"),
          currentPrice: new Prisma.Decimal("1550.0000"),
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

      expect(resurrected.deletedAt).toBeNull();
      expect(resurrected.quantity.toString()).toBe("60");

      // Verify active query now includes the asset again
      const activeAssets = await db.asset.findMany({
        where: { userId: testUserId, importKey, deletedAt: null },
      });
      expect(activeAssets.length).toBe(1);
      expect(activeAssets[0].id).toBe(asset.id);
    });
  });
});
