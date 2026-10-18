import { describe, it, expect, beforeEach, vi } from "vitest";
import { BankStatementService } from "../src/services/import/bank-statement.service";
import { HdfcBankAdapter } from "../src/adapters/bank/hdfc.adapter";
import * as XLSX from "@e965/xlsx";

// In-memory Prisma delegate
type Row = Record<string, any>;
const db: { accounts: Row[]; transactions: Row[]; seq: number } = {
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
    create: async ({ data }: Row) => {
      const row = { id: `tx_b_${++db.seq}`, deletedAt: null, createdAt: new Date(), ...data };
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

describe("Bank Statement Import Suite (HDFC Verified Target)", () => {
  const U1 = "user_bank_1";
  const U2 = "user_bank_2";

  beforeEach(() => {
    db.accounts = [
      { id: "acc_hdfc_savings", userId: U1, name: "HDFC Savings 1234", type: "BANK", isDefault: true, note: "A/C ending in 1234", closedAt: null },
      { id: "acc_hdfc_salary", userId: U1, name: "HDFC Salary 5678", type: "BANK", isDefault: false, note: "Salary", closedAt: null },
      { id: "acc_bob", userId: U2, name: "Bob Bank", type: "BANK", isDefault: true, closedAt: null },
    ];
    db.transactions = [];
    db.seq = 0;
  });

  const sampleHdfcCsv = `HDFC BANK LIMITED
Account Statement for Account No : ************1234
From Date: 01/10/2026 To Date: 12/10/2026

Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/10/26,SALARY CREDIT FROM TECH CORP,00000000001,01/10/26,,85000.00,110420.50
03/10/26,UPI/SWIGGY/4283749/BANGALORE,00000000002,03/10/26,450.00,,109970.50
05/10/26,ATM WDL CASH HDFC ATM KORAMANGALA,00000000003,05/10/26,5000.00,,104970.50
07/10/26,TRANSFER TO OWN A/C 5678,00000000004,07/10/26,10000.00,,94970.50
`;

  describe("1. Bank & Format Detection", () => {
    it("detects HDFC Bank statement and identifies format and masked account number", () => {
      const bytes = new TextEncoder().encode(sampleHdfcCsv);
      const detection = BankStatementService.detectBank("hdfc_oct.csv", bytes);

      expect(detection.detectedBank).toBe("HDFC Bank");
      expect(detection.confidence).toBe("HIGH");
      expect(detection.format).toBe("CSV");
      expect(detection.accountMasked).toBe("************1234");
    });

    it("returns LOW confidence for unknown file layouts", () => {
      const bytes = new TextEncoder().encode("Random,Header,Line\n1,2,3");
      const detection = BankStatementService.detectBank("random.csv", bytes);

      expect(detection.detectedBank).toBe("Unknown Bank");
      expect(detection.confidence).toBe("LOW");
    });
  });

  describe("2. HDFC Adapter Parsing", () => {
    it("parses CSV lines into structured candidates with debit and credit amounts", () => {
      const bytes = new TextEncoder().encode(sampleHdfcCsv);
      const result = HdfcBankAdapter.parse({ fileName: "stmt.csv", bytes });

      expect(result.transactions).toHaveLength(4);
      expect(result.accountMasked).toBe("************1234");

      // Check Salary (Deposit -> Credit)
      const salary = result.transactions[0];
      expect(salary.narration).toContain("SALARY CREDIT");
      expect(salary.direction).toBe("CREDIT");
      expect(salary.amount).toBe(85000);
      expect(salary.categorySuggestion).toBe("Salary");

      // Check Swiggy (Withdrawal -> Debit)
      const swiggy = result.transactions[1];
      expect(swiggy.direction).toBe("DEBIT");
      expect(swiggy.amount).toBe(450);
      expect(swiggy.categorySuggestion).toBe("Food & Dining");

      // Check Transfer candidate
      const transfer = result.transactions[3];
      expect(transfer.isTransferCandidate).toBe(true);
    });

    it("supports HDFC statements formatted as XLSX workbooks", () => {
      const wb = XLSX.utils.book_new();
      const rows = [
        ["HDFC BANK LIMITED"],
        ["Account No : ************1234"],
        [],
        ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
        ["10/10/2026", "UBER RIDE BANGALORE", "REF001", "10/10/2026", 320, null, 50000],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Statement");
      const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));

      const result = HdfcBankAdapter.parse({ fileName: "stmt.xlsx", bytes });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].narration).toBe("UBER RIDE BANGALORE");
      expect(result.transactions[0].amount).toBe(320);
      expect(result.transactions[0].categorySuggestion).toBe("Transportation");
    });
  });

  describe("3. Account Matching & Destination Resolution", () => {
    it("suggests user account matching the masked account number in the statement header", async () => {
      const bytes = new TextEncoder().encode(sampleHdfcCsv);
      const preview = await BankStatementService.preview(U1, {
        fileName: "stmt.csv",
        bytes,
      });

      expect(preview.suggestedAccountId).toBe("acc_hdfc_savings");
      expect(preview.suggestedAccountName).toBe("HDFC Savings 1234");
    });

    it("rejects commit when target account belongs to a different user", async () => {
      const bytes = new TextEncoder().encode(sampleHdfcCsv);

      await expect(
        BankStatementService.commit(U1, {
          fileName: "stmt.csv",
          bytes,
          accountId: "acc_bob", // Bob's account (User 2)
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("4. Deduplication & Persistence", () => {
    it("imports transactions and detects duplicates on re-upload", async () => {
      const bytes = new TextEncoder().encode(sampleHdfcCsv);

      // 1. Initial import
      const commitRes = await BankStatementService.commit(U1, {
        fileName: "stmt.csv",
        bytes,
        accountId: "acc_hdfc_savings",
      });

      expect(commitRes.importedCount).toBe(4);
      expect(db.transactions).toHaveLength(4);

      // 2. Preview re-upload of the same statement
      const preview2 = await BankStatementService.preview(U1, {
        fileName: "stmt.csv",
        bytes,
        accountId: "acc_hdfc_savings",
      });

      expect(preview2.duplicateRows).toBe(4);
      expect(preview2.validRows).toBe(0);

      // 3. Second commit with skipDuplicates=true skips all duplicate rows
      const commitRes2 = await BankStatementService.commit(U1, {
        fileName: "stmt.csv",
        bytes,
        accountId: "acc_hdfc_savings",
        skipDuplicates: true,
      });

      expect(commitRes2.importedCount).toBe(0);
      expect(commitRes2.skippedDuplicates).toBe(4);
      expect(db.transactions).toHaveLength(4); // zero added
    });
  });

  describe("5. Universal Bank PDF Detection & AI Extraction", () => {
    const createSyntheticPdf = (content: string, encrypted = false): Uint8Array => {
      const header = "%PDF-1.4\n";
      const body = encrypted
        ? `/Encrypt 12 0 R\nstream\n${content}\nendstream\n`
        : `stream\nBT\n(${content})\nET\nendstream\n`;
      const trailer = "%%EOF\n";
      return new TextEncoder().encode(header + body + trailer);
    };

    it("detects bank from PDF header metadata (e.g. ICICI Bank, SBI, or unfamiliar)", () => {
      const iciciPdf = createSyntheticPdf("ICICI BANK STATEMENT Account No: *******9876");
      const detectionIcici = BankStatementService.detectBank("icici_stmt.pdf", iciciPdf);
      expect(detectionIcici.detectedBank).toBe("ICICI Bank");
      expect(detectionIcici.format).toBe("PDF");
      expect(detectionIcici.extractor).toBe("AI_NVIDIA_NIM_UNIVERSAL");

      const unfamiliarPdf = createSyntheticPdf("RANDOM REGIONAL COOPERATIVE BANK");
      const detectionUnfamiliar = BankStatementService.detectBank("statement.pdf", unfamiliarPdf);
      expect(detectionUnfamiliar.detectedBank).toBe("Universal Bank Statement");
      expect(detectionUnfamiliar.format).toBe("PDF");
      expect(detectionUnfamiliar.extractor).toBe("AI_NVIDIA_NIM_UNIVERSAL");
    });

    it("detects encrypted PDF and prompts for statement password", async () => {
      const encryptedPdf = createSyntheticPdf("Encrypted statement contents", true);
      const detection = BankStatementService.detectBank("locked.pdf", encryptedPdf);
      expect(detection.isEncrypted).toBe(true);

      const preview = await BankStatementService.preview(U1, {
        fileName: "locked.pdf",
        bytes: encryptedPdf,
      });

      expect(preview.canImport).toBe(false);
      expect(preview.warnings[0]).toContain("password-protected");
    });

    it("extracts unfamiliar bank PDF via AI and performs running balance arithmetic validation", async () => {
      const pdfBytes = createSyntheticPdf("Unfamiliar Bank Statement Text");

      // Mock ImportExtractionService.extractBankStatementPdf
      const extractSpy = vi.spyOn(
        (await import("../src/services/ai/import-extraction.service")).ImportExtractionService,
        "extractBankStatementPdf"
      ).mockResolvedValueOnce({
        ok: true,
        data: {
          bankName: "Kotak Mahindra Bank",
          accountNumberMasked: "******5678",
          accountType: "SAVINGS",
          transactions: [
            {
              date: "2026-10-01",
              description: "SALARY TECH LABS",
              amount: 50000,
              direction: "CREDIT",
              reference: "REF101",
              balance: 100000, // Initial balance
            },
            {
              date: "2026-10-02",
              description: "UPI/SWIGGY/FOOD ORDER",
              amount: 500,
              direction: "DEBIT",
              reference: "REF102",
              category: "Miscellaneous", // AI suggested weak category
              balance: 99500, // Correct: 100000 - 500 = 99500
            },
            {
              date: "2026-10-03",
              description: "TRANSFER TO OWN A/C 1234",
              amount: 10000,
              direction: "DEBIT",
              reference: "REF103",
              balance: 85000, // Mismatch! Expected 99500 - 10000 = 89500, but statement has 85000
            },
          ],
        },
      });

      const preview = await BankStatementService.preview(U1, {
        fileName: "unfamiliar_stmt.pdf",
        bytes: pdfBytes,
      });

      expect(extractSpy).toHaveBeenCalled();
      expect(preview.detection.detectedBank).toBe("Kotak Mahindra Bank");
      expect(preview.rows).toHaveLength(3);

      // 1. Check deterministic category precedence:
      // Swiggy must be categorized as "Food & Dining" despite AI suggesting "Miscellaneous"
      expect(preview.rows[1].suggestedCategory).toBe("Food & Dining");

      // 2. Check running balance mismatch detection:
      // Row 3 should have a running balance warning
      expect(preview.rows[2].balanceWarning).toContain("Running balance mismatch");
      // Amount must NOT be altered silently
      expect(preview.rows[2].amount).toBe(10000);

      // 3. Check transfer classification:
      // Row 3 ("OWN A/C") is flagged as transfer candidate
      expect(preview.rows[2].isTransferCandidate).toBe(true);
      // Row 2 (UPI SWIGGY) is NOT flagged as transfer candidate
      expect(preview.rows[1].isTransferCandidate).toBe(false);

      expect(preview.canImport).toBe(true);
      expect(preview.validRows).toBe(3);
    });

    it("flags conflicting transactions where both debit and credit amounts are populated", async () => {
      const pdfBytes = createSyntheticPdf("Bank Statement");

      vi.spyOn(
        (await import("../src/services/ai/import-extraction.service")).ImportExtractionService,
        "extractBankStatementPdf"
      ).mockResolvedValueOnce({
        ok: true,
        data: {
          bankName: "ICICI Bank",
          accountNumberMasked: "******4321",
          accountType: "CURRENT",
          transactions: [
            {
              date: "2026-10-05",
              description: "AMBIGUOUS REVERSAL",
              debitAmount: 1200,
              creditAmount: 1200,
              amount: 1200,
              direction: "DEBIT",
            },
          ],
        },
      });

      const preview = await BankStatementService.preview(U1, {
        fileName: "icici.pdf",
        bytes: pdfBytes,
      });

      expect(preview.rows[0].validationError).toContain("both debit and credit");
      expect(preview.invalidRows).toBe(1);
      expect(preview.validRows).toBe(0);
    });
  });
});
