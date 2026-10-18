import { describe, it, expect, beforeEach, vi } from "vitest";
import { ImportHistoryService } from "../src/services/import/import-history.service";

// In-memory Prisma delegate
type Row = Record<string, any>;
const db: { transactions: Row[]; assets: Row[] } = {
  transactions: [],
  assets: [],
};

const match = (r: Row, w: Row = {}): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (k === "NOT") return !match(r, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Row;
      if ("in" in o) return o.in.includes(r[k]);
    }
    return r[k] === v;
  });

const prismaMock = {
  transaction: {
    findMany: async ({ where }: Row) => db.transactions.filter((r) => match(r, where)),
    updateMany: async ({ where, data }: Row) => {
      const hits = db.transactions.filter((r) => match(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  },
  asset: {
    updateMany: async ({ where, data }: Row) => {
      const hits = db.assets.filter((r) => match(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  },
  $transaction: async (fn: any) => fn(prismaMock),
};

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

describe("Import History & Safe Rollback Suite", () => {
  const U1 = "user_hist_1";
  const U2 = "user_hist_2";

  beforeEach(() => {
    ImportHistoryService._clearForTest();
    db.transactions = [
      { id: "tx_1", userId: U1, amount: 500, deletedAt: null },
      { id: "tx_2", userId: U1, amount: 1500, deletedAt: null },
      { id: "tx_bob", userId: U2, amount: 2000, deletedAt: null },
    ];
    db.assets = [];
  });

  describe("1. Recording and Listing Import History", () => {
    it("records a new import event with summary metadata and makes it retrievable", () => {
      const entry = ImportHistoryService.record({
        userId: U1,
        source: "HDFC Bank",
        fileType: "CSV",
        fileName: "oct_statement.csv",
        accountName: "HDFC Savings",
        totalRows: 10,
        importedCount: 8,
        duplicateCount: 2,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_1", "tx_2"],
        recordType: "TRANSACTION",
      });

      expect(entry.id).toBeDefined();
      expect(entry.canRollback).toBe(true);

      const list = ImportHistoryService.list(U1);
      expect(list).toHaveLength(1);
      expect(list[0].source).toBe("HDFC Bank");
      expect(list[0].importedCount).toBe(8);
    });

    it("enforces strict user isolation: User 1 cannot see User 2 history", () => {
      ImportHistoryService.record({
        userId: U1,
        source: "Standard CSV",
        fileType: "CSV",
        fileName: "u1.csv",
        accountName: "Acc1",
        totalRows: 5,
        importedCount: 5,
        duplicateCount: 0,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_1"],
        recordType: "TRANSACTION",
      });

      ImportHistoryService.record({
        userId: U2,
        source: "INDmoney",
        fileType: "XLS",
        fileName: "u2.xls",
        accountName: "Acc2",
        totalRows: 10,
        importedCount: 10,
        duplicateCount: 0,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_bob"],
        recordType: "TRANSACTION",
      });

      const list1 = ImportHistoryService.list(U1);
      const list2 = ImportHistoryService.list(U2);

      expect(list1).toHaveLength(1);
      expect(list1[0].fileName).toBe("u1.csv");
      expect(list2).toHaveLength(1);
      expect(list2[0].fileName).toBe("u2.xls");
    });
  });

  describe("2. Safe Transactional Rollback", () => {
    it("safely soft-deletes only records belonging to the target batch", async () => {
      const entry = ImportHistoryService.record({
        userId: U1,
        source: "Standard CSV",
        fileType: "CSV",
        fileName: "batch.csv",
        accountName: "HDFC",
        totalRows: 2,
        importedCount: 2,
        duplicateCount: 0,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_1", "tx_2"],
        recordType: "TRANSACTION",
      });

      const result = await ImportHistoryService.rollback(U1, entry.id);
      expect(result.rolledBackCount).toBe(2);

      // Verify records are soft-deleted
      const tx1 = db.transactions.find((t) => t.id === "tx_1");
      const tx2 = db.transactions.find((t) => t.id === "tx_2");
      const txBob = db.transactions.find((t) => t.id === "tx_bob");

      expect(tx1?.deletedAt).toBeInstanceOf(Date);
      expect(tx2?.deletedAt).toBeInstanceOf(Date);
      expect(txBob?.deletedAt).toBeNull(); // Bob's transaction untouched

      // History status updated
      const updated = ImportHistoryService.get(U1, entry.id);
      expect(updated?.finalStatus).toBe("ROLLED_BACK");
      expect(updated?.canRollback).toBe(false);
    });

    it("prevents double rollback on an already rolled back batch", async () => {
      const entry = ImportHistoryService.record({
        userId: U1,
        source: "Standard CSV",
        fileType: "CSV",
        fileName: "batch.csv",
        accountName: "HDFC",
        totalRows: 1,
        importedCount: 1,
        duplicateCount: 0,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_1"],
        recordType: "TRANSACTION",
      });

      await ImportHistoryService.rollback(U1, entry.id);

      await expect(ImportHistoryService.rollback(U1, entry.id)).rejects.toThrow(/already been rolled back/i);
    });

    it("rejects rollback attempt by unauthorized user", async () => {
      const entry = ImportHistoryService.record({
        userId: U1,
        source: "Standard CSV",
        fileType: "CSV",
        fileName: "batch.csv",
        accountName: "HDFC",
        totalRows: 1,
        importedCount: 1,
        duplicateCount: 0,
        rejectedCount: 0,
        finalStatus: "COMPLETED",
        errorSummary: null,
        recordIds: ["tx_1"],
        recordType: "TRANSACTION",
      });

      // User 2 tries to rollback User 1's batch
      await expect(ImportHistoryService.rollback(U2, entry.id)).rejects.toThrow(/not found/i);
    });
  });
});
