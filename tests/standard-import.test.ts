import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  StandardTransactionService,
  parseDateString,
  normalizeTransactionType,
} from "../src/services/import/standard-transaction.service";

// In-memory Prisma delegate
type Row = Record<string, any>;
const db: { users: Row[]; accounts: Row[]; transactions: Row[]; seq: number } = {
  users: [],
  accounts: [],
  transactions: [],
  seq: 0,
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
  account: {
    findMany: async ({ where }: Row) => db.accounts.filter((r) => match(r, where)).map((r) => ({ ...r })),
    findFirst: async ({ where }: Row) => db.accounts.find((r) => match(r, where)) || null,
  },
  transaction: {
    findMany: async ({ where }: Row) => db.transactions.filter((r) => match(r, where)).map((r) => ({ ...r })),
    findFirst: async ({ where }: Row) => db.transactions.find((r) => match(r, where)) || null,
    create: async ({ data }: Row) => {
      const row = { id: `tx_${++db.seq}`, deletedAt: null, createdAt: new Date(), ...data };
      db.transactions.push(row);
      return row;
    },
    updateMany: async ({ where, data }: Row) => {
      const hits = db.transactions.filter((r) => match(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  },
  $transaction: async (fn: any) => fn(prismaMock),
};

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

describe("Standard Transaction Import Suite", () => {
  const U1 = "user_std_1";
  const U2 = "user_std_2";

  beforeEach(() => {
    db.accounts = [
      { id: "acc_hdfc", userId: U1, name: "HDFC Salary", type: "BANK", isDefault: true, closedAt: null },
      { id: "acc_sbi", userId: U1, name: "SBI Savings", type: "BANK", isDefault: false, closedAt: null },
      { id: "acc_u2", userId: U2, name: "U2 Bank", type: "BANK", isDefault: true, closedAt: null },
    ];
    db.transactions = [];
    db.seq = 0;
  });

  describe("1. Template Generation", () => {
    it("generates a valid CSV template containing standard columns and example rows", () => {
      const csv = StandardTransactionService.generateTemplateCsv();
      expect(csv).toContain("date,description,amount,currency,type,category,from_account,to_account,notes");
      expect(csv).toContain("Monthly Salary");
      expect(csv).toContain("Supermarket Groceries");
      expect(csv).toContain("Savings Transfer");
    });
  });

  describe("2. Date Parsing and Normalization", () => {
    it("parses ISO YYYY-MM-DD", () => {
      expect(parseDateString("2026-10-12")).toBe("2026-10-12");
    });

    it("parses DD/MM/YYYY and DD-MM-YYYY", () => {
      expect(parseDateString("05/10/2026")).toBe("2026-10-05");
      expect(parseDateString("15-08-2026")).toBe("2026-08-15");
    });

    it("returns null for invalid or impossible dates", () => {
      expect(parseDateString("not-a-date")).toBeNull();
      expect(parseDateString("")).toBeNull();
      expect(parseDateString(null)).toBeNull();
    });
  });

  describe("3. Type Normalization", () => {
    it("normalizes income aliases: IN, CR, CREDIT, DEPOSIT -> INCOME", () => {
      expect(normalizeTransactionType("IN")).toBe("INCOME");
      expect(normalizeTransactionType("CR")).toBe("INCOME");
      expect(normalizeTransactionType("credit")).toBe("INCOME");
      expect(normalizeTransactionType("Deposit")).toBe("INCOME");
    });

    it("normalizes expense aliases: OUT, DR, DEBIT, WITHDRAWAL -> EXPENSE", () => {
      expect(normalizeTransactionType("OUT")).toBe("EXPENSE");
      expect(normalizeTransactionType("DR")).toBe("EXPENSE");
      expect(normalizeTransactionType("debit")).toBe("EXPENSE");
      expect(normalizeTransactionType("withdrawal")).toBe("EXPENSE");
    });

    it("normalizes transfer: TRANSFER -> TRANSFER", () => {
      expect(normalizeTransactionType("TRANSFER")).toBe("TRANSFER");
      expect(normalizeTransactionType("transfer")).toBe("TRANSFER");
    });

    it("infers direction from separate debit/credit column amounts", () => {
      expect(normalizeTransactionType(null, null, 500, null)).toBe("EXPENSE");
      expect(normalizeTransactionType(null, null, null, 1200)).toBe("INCOME");
    });

    it("infers direction from negative amounts if unstated", () => {
      expect(normalizeTransactionType(null, -750)).toBe("EXPENSE");
      expect(normalizeTransactionType(null, 1500)).toBe("INCOME");
    });
  });

  describe("4. CSV/TSV Ingestion, Aliases, and Manual Column Mapping", () => {
    it("automatically detects standard and aliased column headers", () => {
      const headers = ["Txn Date", "Particulars", "Net Amount", "Direction", "Expense Category"];
      const map = StandardTransactionService.detectColumnMapping(headers);
      expect(map.date).toBe("Txn Date");
      expect(map.description).toBe("Particulars");
      expect(map.amount).toBe("Net Amount");
      expect(map.type).toBe("Direction");
      expect(map.category).toBe("Expense Category");
    });

    it("parses valid CSV file and previews normalized rows", async () => {
      const csv = `Date,Description,Amount,Type\n2026-10-01,Groceries,1200,EXPENSE\n2026-10-02,Salary,75000,INCOME`;
      const bytes = new TextEncoder().encode(csv);

      const preview = await StandardTransactionService.preview(U1, {
        fileName: "tx.csv",
        bytes,
        userAccountId: "acc_hdfc",
      });

      expect(preview.validRows).toBe(2);
      expect(preview.invalidRows).toBe(0);
      expect(preview.rows[0].description).toBe("Groceries");
      expect(preview.rows[0].amount).toBe(1200);
      expect(preview.rows[0].type).toBe("EXPENSE");
      expect(preview.rows[1].type).toBe("INCOME");
    });

    it("supports TSV (tab-separated) files cleanly", async () => {
      const tsv = "Date\tDescription\tAmount\tType\n2026-10-05\tDinner\t900\tEXPENSE";
      const bytes = new TextEncoder().encode(tsv);

      const preview = await StandardTransactionService.preview(U1, {
        fileName: "tx.tsv",
        bytes,
        userAccountId: "acc_hdfc",
      });

      expect(preview.validRows).toBe(1);
      expect(preview.rows[0].amount).toBe(900);
    });

    it("allows custom manual column mapping override", async () => {
      const csv = `ColA,ColB,ColC\n2026-10-07,Freelance Gig,15000`;
      const bytes = new TextEncoder().encode(csv);

      const preview = await StandardTransactionService.preview(U1, {
        fileName: "custom.csv",
        bytes,
        userAccountId: "acc_hdfc",
        customMapping: {
          date: "ColA",
          description: "ColB",
          amount: "ColC",
        },
      });

      expect(preview.validRows).toBe(1);
      expect(preview.rows[0].description).toBe("Freelance Gig");
      expect(preview.rows[0].amount).toBe(15000);
    });
  });

  describe("5. Validation, Deduplication, and Persistence", () => {
    it("flags invalid rows with invalid dates or non-positive amounts", async () => {
      const csv = `Date,Description,Amount\nbad-date,Invalid Date,1000\n2026-10-08,Zero Amount,0`;
      const bytes = new TextEncoder().encode(csv);

      const preview = await StandardTransactionService.preview(U1, {
        fileName: "invalid.csv",
        bytes,
      });

      expect(preview.invalidRows).toBe(2);
      expect(preview.validRows).toBe(0);
      expect(preview.rows[0].validationError).toBeDefined();
    });

    it("detects duplicates when the same file is uploaded twice", async () => {
      const csv = `Date,Description,Amount,Type\n2026-10-10,Internet Bill,1200,EXPENSE`;
      const bytes = new TextEncoder().encode(csv);

      // First commit
      const res1 = await StandardTransactionService.commit(U1, {
        fileName: "bill.csv",
        bytes,
        userAccountId: "acc_hdfc",
      });
      expect(res1.importedCount).toBe(1);

      // Preview re-upload of identical file
      const preview2 = await StandardTransactionService.preview(U1, {
        fileName: "bill.csv",
        bytes,
        userAccountId: "acc_hdfc",
      });
      expect(preview2.duplicateRows).toBe(1);

      // Commit skips duplicate
      const res2 = await StandardTransactionService.commit(U1, {
        fileName: "bill.csv",
        bytes,
        userAccountId: "acc_hdfc",
        skipDuplicates: true,
      });
      expect(res2.importedCount).toBe(0);
      expect(res2.skippedDuplicates).toBe(1);
    });

    it("correctly handles atomic internal transfers between user accounts", async () => {
      const csv = `Date,Description,Amount,Type,from_account,to_account\n2026-10-10,Monthly Savings,10000,TRANSFER,HDFC Salary,SBI Savings`;
      const bytes = new TextEncoder().encode(csv);

      const res = await StandardTransactionService.commit(U1, {
        fileName: "transfer.csv",
        bytes,
      });

      expect(res.importedCount).toBe(1);
      expect(res.createdTransactionIds).toHaveLength(2); // paired debit and credit

      const saved = db.transactions.filter((t) => t.type === "TRANSFER");
      expect(saved).toHaveLength(2);
      expect(saved[0].transferGroupId).toBe(saved[1].transferGroupId);
    });

    it("isolates different users so duplicates do not cross users", async () => {
      const csv = `Date,Description,Amount,Type\n2026-10-10,Shared Cost,500,EXPENSE`;
      const bytes = new TextEncoder().encode(csv);

      await StandardTransactionService.commit(U1, {
        fileName: "u1.csv",
        bytes,
        userAccountId: "acc_hdfc",
      });

      const previewU2 = await StandardTransactionService.preview(U2, {
        fileName: "u2.csv",
        bytes,
        userAccountId: "acc_u2",
      });

      expect(previewU2.duplicateRows).toBe(0);
      expect(previewU2.validRows).toBe(1);
    });
  });
});
