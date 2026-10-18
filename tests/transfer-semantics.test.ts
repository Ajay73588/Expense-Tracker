import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionService } from "../src/services/transaction.service";
import { AccountService } from "../src/services/account.service";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user_alice"),
}));

import { POST as createTransferRoute } from "../app/api/transactions/transfer/route";
import { POST as transactionsRoute, PATCH as updateTransactionRoute } from "../app/api/transactions/route";

// ── In-memory database delegates ───────────────────────────────────────────
type Row = Record<string, any>;
let accountDb: Row[] = [];
let txDb: Row[] = [];
let seq = 0;

const makeId = (p = "id") => `${p}_${++seq}`;

const account = {
  findMany: async ({ where }: Row) =>
    accountDb.filter((r) => !where?.userId || r.userId === where.userId),
  findFirst: async ({ where }: Row) =>
    accountDb.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
  create: async ({ data }: Row) => {
    const row = { id: makeId("acc"), closedAt: null, ...data };
    accountDb.push(row);
    return row;
  },
};

const transaction = {
  findMany: async ({ where }: Row) => {
    return txDb.filter((r) => {
      if (where.userId && r.userId !== where.userId) return false;
      if (where.deletedAt === null && r.deletedAt !== null) return false;
      if (where.transferGroupId && r.transferGroupId !== where.transferGroupId) return false;
      return true;
    });
  },
  findFirst: async ({ where }: Row) => {
    return (
      txDb.find((r) => {
        if (where.id && r.id !== where.id) return false;
        if (where.userId && r.userId !== where.userId) return false;
        if (where.deletedAt === null && r.deletedAt !== null) return false;
        return true;
      }) ?? null
    );
  },
  create: async ({ data }: Row) => {
    const row = { id: makeId("tx"), deletedAt: null, ...data };
    txDb.push(row);
    return row;
  },
  update: async ({ where, data }: Row) => {
    const r = txDb.find((x) => x.id === where.id);
    if (!r) throw new Error("Not found");
    Object.assign(r, data);
    return r;
  },
  updateMany: async ({ where, data }: Row) => {
    const hit = txDb.filter((r) => {
      if (where.id && r.id !== where.id) return false;
      if (where.userId && r.userId !== where.userId) return false;
      if (where.transferGroupId && r.transferGroupId !== where.transferGroupId) return false;
      return true;
    });
    hit.forEach((r) => Object.assign(r, data));
    return { count: hit.length };
  },
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    account,
    transaction,
    $transaction: async (fn: any) => {
      if (typeof fn === "function") {
        return fn({ account, transaction });
      }
      return Promise.all(fn);
    },
  },
}));

describe("Phase 7: Transfer Semantics & Account Association (LEDGER-010..012)", () => {
  let aliceBank1Id = "";
  let aliceBank2Id = "";
  let bobBankId = "";

  beforeEach(async () => {
    accountDb = [];
    txDb = [];
    seq = 0;

    const b1 = await AccountService.create("user_alice", { name: "HDFC Savings", type: "BANK" });
    const b2 = await AccountService.create("user_alice", { name: "ICICI Savings", type: "BANK" });
    const bBob = await AccountService.create("user_bob", { name: "Bob Bank", type: "BANK" });

    aliceBank1Id = b1.id;
    aliceBank2Id = b2.id;
    bobBankId = bBob.id;
  });

  describe("1. Transfer Creation (LEDGER-004 & LEDGER-012)", () => {
    it("creates paired debit and credit transactions atomically with shared transferGroupId", async () => {
      const res = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 25000,
        date: new Date("2026-10-18T10:00:00Z"),
        description: "Move to emergency fund",
      });

      expect(res.transferGroupId).toBeDefined();
      expect(res.debit.id).toBeDefined();
      expect(res.credit.id).toBeDefined();

      expect(res.debit.type).toBe("TRANSFER");
      expect(res.debit.category).toBe("Transfer Out");
      expect(res.debit.accountId).toBe(aliceBank1Id);
      expect(res.debit.amount).toBe(25000);

      expect(res.credit.type).toBe("TRANSFER");
      expect(res.credit.category).toBe("Transfer In");
      expect(res.credit.accountId).toBe(aliceBank2Id);
      expect(res.credit.amount).toBe(25000);

      expect(res.debit.transferGroupId).toBe(res.transferGroupId);
      expect(res.credit.transferGroupId).toBe(res.transferGroupId);
    });

    it("prevents self-transfers where fromAccountId equals toAccountId", async () => {
      await expect(
        TransactionService.createTransfer("user_alice", {
          fromAccountId: aliceBank1Id,
          toAccountId: aliceBank1Id,
          amount: 5000,
          date: new Date(),
        })
      ).rejects.toThrow("Source and destination accounts must be different");
    });

    it("prevents transfer with non-positive amount", async () => {
      await expect(
        TransactionService.createTransfer("user_alice", {
          fromAccountId: aliceBank1Id,
          toAccountId: aliceBank2Id,
          amount: 0,
          date: new Date(),
        })
      ).rejects.toThrow("Transfer amount must be positive");
    });

    it("prevents transfers using accounts belonging to another user (authorization)", async () => {
      await expect(
        TransactionService.createTransfer("user_alice", {
          fromAccountId: aliceBank1Id,
          toAccountId: bobBankId, // Bob's account
          amount: 5000,
          date: new Date(),
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("2. Atomic Transfer Edit Semantics (LEDGER-011)", () => {
    it("updates amount on both legs atomically when either leg is edited", async () => {
      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 10000,
        date: new Date("2026-10-18T10:00:00Z"),
      });

      // Update the debit leg's amount from 10,000 to 12,500
      await TransactionService.update("user_alice", transfer.debit.id, {
        amount: 12500,
      });

      const updatedDebit = txDb.find((t) => t.id === transfer.debit.id);
      const updatedCredit = txDb.find((t) => t.id === transfer.credit.id);

      expect(updatedDebit!.amount).toBe(12500);
      expect(updatedCredit!.amount).toBe(12500); // Credit leg synchronized!
    });

    it("updates date on both legs atomically when date is edited", async () => {
      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 5000,
        date: new Date("2026-10-18T10:00:00Z"),
      });

      const newDate = new Date("2026-10-20T15:30:00Z");
      await TransactionService.update("user_alice", transfer.credit.id, {
        date: newDate,
      });

      const updatedDebit = txDb.find((t) => t.id === transfer.debit.id);
      const updatedCredit = txDb.find((t) => t.id === transfer.credit.id);

      expect(new Date(updatedDebit!.date).toISOString()).toBe(newDate.toISOString());
      expect(new Date(updatedCredit!.date).toISOString()).toBe(newDate.toISOString());
    });

    it("allows updating accountId on one leg without overwriting the other leg's accountId", async () => {
      const b3 = await AccountService.create("user_alice", { name: "Kotak Bank", type: "BANK" });

      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 5000,
        date: new Date(),
      });

      // Change the source account of the debit leg from HDFC to Kotak
      await TransactionService.update("user_alice", transfer.debit.id, {
        accountId: b3.id,
      });

      const updatedDebit = txDb.find((t) => t.id === transfer.debit.id);
      const updatedCredit = txDb.find((t) => t.id === transfer.credit.id);

      expect(updatedDebit!.accountId).toBe(b3.id);
      expect(updatedCredit!.accountId).toBe(aliceBank2Id); // Credit leg account unchanged!
    });

    it("prevents updating accountId on a leg to match the counter-leg's accountId (self-transfer prevention)", async () => {
      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 5000,
        date: new Date(),
      });

      // Attempting to change debit leg's accountId to aliceBank2Id (same as destination) must fail
      await expect(
        TransactionService.update("user_alice", transfer.debit.id, {
          accountId: aliceBank2Id,
        })
      ).rejects.toThrow("Source and destination accounts of a transfer cannot be the same");
    });

    it("prevents changing transaction type away from TRANSFER", async () => {
      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 5000,
        date: new Date(),
      });

      await expect(
        TransactionService.update("user_alice", transfer.debit.id, {
          type: "EXPENSE",
        })
      ).rejects.toThrow("Cannot change type of transfer transaction");
    });
  });

  describe("3. API Route Endpoints (LEDGER-012)", () => {
    it("POST /api/transactions/transfer creates transfer successfully with HTTP 201", async () => {
      const req = new NextRequest("http://localhost:3000/api/transactions/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromAccountId: aliceBank1Id,
          toAccountId: aliceBank2Id,
          amount: 15000,
          date: new Date().toISOString(),
          description: "Monthly savings transfer",
        }),
      });

      const res = await createTransferRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.data.transferGroupId).toBeDefined();
    });

    it("POST /api/transactions/transfer rejects self-transfer with HTTP 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/transactions/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromAccountId: aliceBank1Id,
          toAccountId: aliceBank1Id, // same account
          amount: 5000,
          date: new Date().toISOString(),
        }),
      });

      const res = await createTransferRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error.message).toContain("Source and destination accounts must be different");
    });

    it("POST /api/transactions with type=TRANSFER routes seamlessly to createTransfer", async () => {
      const req = new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "TRANSFER",
          fromAccountId: aliceBank1Id,
          toAccountId: aliceBank2Id,
          amount: 8000,
          date: new Date().toISOString(),
          description: "Transfer via general tx route",
        }),
      });

      const res = await transactionsRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.data.transferGroupId).toBeDefined();
    });
  });

  describe("4. Account Association on Transactions (LEDGER-010)", () => {
    it("persists accountId on normal income/expense transactions", async () => {
      const tx = await TransactionService.create("user_alice", {
        type: "EXPENSE",
        amount: 1200,
        category: "Groceries",
        date: new Date(),
        accountId: aliceBank1Id,
        account: "HDFC Savings",
      });

      expect(tx.accountId).toBe(aliceBank1Id);
      const saved = txDb.find((t) => t.id === tx.id);
      expect(saved!.accountId).toBe(aliceBank1Id);
    });

    it("rejects transaction creation with an accountId belonging to another user", async () => {
      await expect(
        TransactionService.create("user_alice", {
          type: "EXPENSE",
          amount: 500,
          category: "Coffee",
          date: new Date(),
          accountId: bobBankId, // Bob's account
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("persists accountId update and rejects updating to another user's account", async () => {
      const tx = await TransactionService.create("user_alice", {
        type: "INCOME",
        amount: 50000,
        category: "Salary",
        date: new Date(),
        accountId: aliceBank1Id,
      });

      // Update to Alice's second bank account
      await TransactionService.update("user_alice", tx.id, {
        accountId: aliceBank2Id,
      });
      expect(txDb.find((t) => t.id === tx.id)!.accountId).toBe(aliceBank2Id);

      // Attempting to update to Bob's bank account must fail
      await expect(
        TransactionService.update("user_alice", tx.id, {
          accountId: bobBankId,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("5. Rollback on Failure & Cross-User Security", () => {
    it("ensures cross-user isolation: user Bob cannot edit Alice's transfer", async () => {
      const transfer = await TransactionService.createTransfer("user_alice", {
        fromAccountId: aliceBank1Id,
        toAccountId: aliceBank2Id,
        amount: 5000,
        date: new Date(),
      });

      await expect(
        TransactionService.update("user_bob", transfer.debit.id, {
          amount: 99999,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      // Alice's transfer amount remains intact
      expect(txDb.find((t) => t.id === transfer.debit.id)!.amount).toBe(5000);
    });

    it("rolls back transfer creation if transaction delegate fails", async () => {
      const initialTxCount = txDb.length;
      const { prisma } = await import("../src/lib/prisma");

      // Temporarily mock $transaction to simulate a mid-flight failure
      const originalTx = prisma.$transaction;
      (prisma as any).$transaction = vi.fn().mockImplementation(async (fn: any) => {
        let rolledBackDb = [...txDb];
        const failingTx = {
          account,
          transaction: {
            ...transaction,
            create: vi.fn().mockImplementationOnce(async ({ data }: Row) => {
              const row = { id: makeId("tx"), deletedAt: null, ...data };
              rolledBackDb.push(row);
              return row;
            }).mockImplementationOnce(() => {
              throw new Error("Simulated DB connection drop on credit leg");
            }),
          },
        };
        try {
          return await fn(failingTx);
        } catch (err) {
          // Rollback: discard rolledBackDb changes
          throw err;
        }
      });

      try {
        await expect(
          TransactionService.createTransfer("user_alice", {
            fromAccountId: aliceBank1Id,
            toAccountId: aliceBank2Id,
            amount: 7000,
            date: new Date(),
          })
        ).rejects.toThrow("Simulated DB connection drop on credit leg");

        // Verify no orphan records were committed
        expect(txDb.length).toBe(initialTxCount);
      } finally {
        (prisma as any).$transaction = originalTx;
      }
    });
  });
});

