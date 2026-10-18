import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";
import { z } from "zod";
import { assertPrismaMode } from "../../lib/feature-gate";
import { ValidationError, NotFoundError } from "../../lib/errors";
import { createLogger } from "../../lib/logger";
import { generateTransactionFingerprint } from "./import-fingerprint";
import { detectCategoryFromNarration } from "./category-rules";

const log = createLogger("StandardTransactionService");

export interface StandardTransactionRow {
  rowNumber: number;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  currency: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  fromAccount?: string | null;
  toAccount?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  accountId?: string | null;
  notes?: string | null;
  fingerprint: string;
  isDuplicate?: boolean;
  validationError?: string | null;
}

export interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  type?: string;
  debit?: string;
  credit?: string;
  category?: string;
  fromAccount?: string;
  toAccount?: string;
  account?: string;
  notes?: string;
  currency?: string;
}

export interface StandardPreviewResult {
  fileName: string;
  fileKind: "csv" | "tsv" | "xlsx";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columnMapping: ColumnMapping;
  detectedHeaders: string[];
  rows: StandardTransactionRow[];
  canImport: boolean;
}

export interface StandardCommitResult {
  totalProcessed: number;
  importedCount: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  createdTransactionIds: string[];
  importBatchId: string;
}

const DATE_REGEX_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes dates in various standard formats to YYYY-MM-DD */
export function parseDateString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (DATE_REGEX_ISO.test(str)) {
    const d = new Date(str);
    return !isNaN(d.getTime()) ? str : null;
  }

  // Handle Excel serial date numbers
  if (/^\d{5}$/.test(str)) {
    const num = parseInt(str, 10);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + num * 86400000);
    if (!isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(str);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Attempt standard JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** Normalized transaction type */
export function normalizeTransactionType(
  rawType?: string | null,
  amount?: number | null,
  debitAmt?: number | null,
  creditAmt?: number | null
): "INCOME" | "EXPENSE" | "TRANSFER" | null {
  if (rawType) {
    const clean = rawType.trim().toUpperCase();
    if (["IN", "INCOME", "CR", "CREDIT", "DEPOSIT"].includes(clean)) return "INCOME";
    if (["OUT", "EXPENSE", "DR", "DEBIT", "WITHDRAWAL"].includes(clean)) return "EXPENSE";
    if (clean === "TRANSFER") return "TRANSFER";
  }

  if (debitAmt !== null && debitAmt !== undefined && debitAmt > 0) return "EXPENSE";
  if (creditAmt !== null && creditAmt !== undefined && creditAmt > 0) return "INCOME";

  if (amount !== undefined && amount !== null) {
    if (amount < 0) return "EXPENSE";
    if (amount > 0) return "INCOME";
  }

  return null;
}

export const StandardTransactionService = {
  /**
   * Generates the FinanceAI Standard CSV template.
   */
  generateTemplateCsv(): string {
    const headers = [
      "date",
      "description",
      "amount",
      "currency",
      "type",
      "category",
      "from_account",
      "to_account",
      "notes",
    ];

    const sampleRows = [
      ["2026-10-01", "Monthly Salary", "85000", "INR", "INCOME", "Salary", "", "HDFC Salary", "October Payroll"],
      ["2026-10-02", "Supermarket Groceries", "3250", "INR", "EXPENSE", "Food & Dining", "HDFC Salary", "", "Weekly essentials"],
      ["2026-10-05", "Savings Transfer", "15000", "INR", "TRANSFER", "Transfer", "HDFC Salary", "SBI Savings", "Monthly emergency fund"],
      ["2026-10-08", "Airtel Broadband Bill", "1179", "INR", "EXPENSE", "Utilities", "HDFC Salary", "", "Fibre broadband"],
    ];

    return Papa.unparse({
      fields: headers,
      data: sampleRows,
    });
  },

  /**
   * Auto-detect column headers based on aliases.
   */
  detectColumnMapping(headers: string[]): ColumnMapping {
    const map: ColumnMapping = {};
    const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const h of headers) {
      const n = norm(h);
      if (!map.date && (n === "date" || n === "txndate" || n === "transactiondate" || n === "valuedt" || n === "valuedate" || n === "postingdate")) {
        map.date = h;
      } else if (!map.description && (n === "description" || n === "narration" || n === "particulars" || n === "remarks" || n === "details" || n === "memo" || n === "payee")) {
        map.description = h;
      } else if (!map.amount && (n === "amount" || n === "txnamount" || n === "netamount" || n === "total" || n === "transactionamount")) {
        map.amount = h;
      } else if (!map.type && (n === "type" || n === "transactiontype" || n === "drcr" || n === "direction")) {
        map.type = h;
      } else if (!map.debit && (n === "debit" || n === "withdrawal" || n === "withdrawalamt" || n === "dr")) {
        map.debit = h;
      } else if (!map.credit && (n === "credit" || n === "deposit" || n === "depositamt" || n === "cr")) {
        map.credit = h;
      } else if (!map.category && (n === "category" || n === "expensecategory")) {
        map.category = h;
      } else if (!map.fromAccount && (n === "fromaccount" || n === "sourceaccount" || n === "from")) {
        map.fromAccount = h;
      } else if (!map.toAccount && (n === "toaccount" || n === "destinationaccount" || n === "to")) {
        map.toAccount = h;
      } else if (!map.account && (n === "account" || n === "accountname" || n === "bankaccount")) {
        map.account = h;
      } else if (!map.notes && (n === "notes" || n === "note" || n === "reference" || n === "refno" || n === "chqrefno")) {
        map.notes = h;
      } else if (!map.currency && (n === "currency" || n === "ccy")) {
        map.currency = h;
      }
    }

    return map;
  },

  /**
   * Parse tabular bytes (CSV, TSV, XLSX) into structured header and row records.
   */
  readTabularData(fileName: string, bytes: Uint8Array): { kind: "csv" | "tsv" | "xlsx"; headers: string[]; rawRows: Record<string, any>[] } {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "xlsx" || ext === "xls") {
      const wb = XLSX.read(bytes, { type: "array", cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      if (!firstSheet) throw new ValidationError("The Excel workbook contains no sheets.");
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" });
      if (!json.length) throw new ValidationError("The spreadsheet is empty.");
      const headers = Object.keys(json[0] || {});
      return { kind: "xlsx", headers, rawRows: json };
    }

    // CSV or TSV text
    const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: "greedy",
    });

    if (parsed.errors.some((e) => e.type === "Quotes")) {
      throw new ValidationError("Malformed CSV file (unbalanced quotes).");
    }

    if (!parsed.data.length || !parsed.meta.fields) {
      throw new ValidationError("Uploaded file contains no data rows.");
    }

    const kind = ext === "tsv" ? "tsv" : "csv";
    return { kind, headers: parsed.meta.fields, rawRows: parsed.data };
  },

  /**
   * Preview and validate transactions before import.
   * Performs duplicate detection against existing user records in PostgreSQL.
   */
  async preview(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      userAccountId?: string | null;
      customMapping?: ColumnMapping;
    }
  ): Promise<StandardPreviewResult> {
    assertPrismaMode();
    const { kind, headers, rawRows } = this.readTabularData(input.fileName, input.bytes);
    const mapping = { ...this.detectColumnMapping(headers), ...(input.customMapping || {}) };

    if (!mapping.date || (!mapping.amount && !mapping.debit && !mapping.credit)) {
      throw new ValidationError(
        "Could not detect Date and Amount columns. Please map required columns manually."
      );
    }

    const { prisma } = await import("../../lib/prisma");

    // Fetch user's existing accounts for matching
    const userAccounts = await prisma.account.findMany({
      where: { userId, closedAt: null },
    });
    const accountByName = new Map<string, any>(userAccounts.map((a: any) => [a.name.toLowerCase().trim(), a]));
    const defaultAccount: any = userAccounts.find((a: any) => a.isDefault) || userAccounts[0] || null;

    // Validate explicitly provided target account belongs to the user
    if (input.userAccountId) {
      const match = userAccounts.find((a: any) => a.id === input.userAccountId);
      if (!match) {
        const { NotFoundError } = await import("../../lib/errors");
        throw new NotFoundError("Target account");
      }
    }

    // Fetch recent user transactions for duplicate detection
    const existingTx = await prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, date: true, amount: true, type: true, description: true, accountId: true, tags: true },
      take: 2000,
      orderBy: { date: "desc" },
    });

    const existingFingerprints = new Set<string>();
    for (const t of existingTx) {
      const fp = generateTransactionFingerprint({
        userId,
        accountId: t.accountId,
        date: t.date.toISOString(),
        amount: Number(t.amount),
        type: t.type,
        description: t.description || "",
      });
      existingFingerprints.add(fp);
    }

    const rows: StandardTransactionRow[] = [];
    const seenBatchFingerprints = new Set<string>();
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 1;

      // Extract date
      const dateVal = mapping.date ? raw[mapping.date] : null;
      const parsedDate = parseDateString(dateVal);

      // Extract description
      const descVal = mapping.description ? String(raw[mapping.description] || "").trim() : "";

      // Extract amount and direction
      const rawAmt = mapping.amount ? raw[mapping.amount] : null;
      const rawDebit = mapping.debit ? raw[mapping.debit] : null;
      const rawCredit = mapping.credit ? raw[mapping.credit] : null;

      const numAmt = rawAmt !== null && rawAmt !== undefined && rawAmt !== "" ? Math.abs(parseFloat(String(rawAmt).replace(/[,\s]/g, ""))) : null;
      const numDebit = rawDebit !== null && rawDebit !== undefined && rawDebit !== "" ? Math.abs(parseFloat(String(rawDebit).replace(/[,\s]/g, ""))) : null;
      const numCredit = rawCredit !== null && rawCredit !== undefined && rawCredit !== "" ? Math.abs(parseFloat(String(rawCredit).replace(/[,\s]/g, ""))) : null;

      const finalAmount = numAmt ?? numDebit ?? numCredit ?? 0;
      const rawType = mapping.type ? String(raw[mapping.type] || "") : null;
      const normalizedType = normalizeTransactionType(rawType, rawAmt ? parseFloat(String(rawAmt)) : undefined, numDebit, numCredit) || "EXPENSE";

      // Currency
      const currency = mapping.currency ? String(raw[mapping.currency] || "INR").trim().toUpperCase() : "INR";

      // Category detection
      let category = mapping.category ? String(raw[mapping.category] || "").trim() : "";
      if (!category) {
        category = detectCategoryFromNarration(descVal) || (normalizedType === "INCOME" ? "Salary" : "General");
      }

      // Accounts
      let fromAccId: string | null = null;
      let toAccId: string | null = null;
      let targetAccountId: string | null = input.userAccountId || null;

      if (mapping.fromAccount && raw[mapping.fromAccount]) {
        const match = accountByName.get(String(raw[mapping.fromAccount]).toLowerCase().trim());
        if (match) fromAccId = match.id;
      }
      if (mapping.toAccount && raw[mapping.toAccount]) {
        const match = accountByName.get(String(raw[mapping.toAccount]).toLowerCase().trim());
        if (match) toAccId = match.id;
      }
      if (!targetAccountId && mapping.account && raw[mapping.account]) {
        const match = accountByName.get(String(raw[mapping.account]).toLowerCase().trim());
        if (match) targetAccountId = match.id;
      }
      if (!targetAccountId && defaultAccount) {
        targetAccountId = defaultAccount.id;
      }

      const notes = mapping.notes ? String(raw[mapping.notes] || "").trim() : null;

      // Validation
      let validationError: string | null = null;
      if (!parsedDate) {
        validationError = "Invalid or unparseable transaction date.";
      } else if (isNaN(finalAmount) || finalAmount <= 0) {
        validationError = "Amount must be a positive finite number.";
      } else if (normalizedType === "TRANSFER" && (!fromAccId || !toAccId)) {
        validationError = "Internal transfers require both source and destination accounts.";
      }

      const fingerprint = generateTransactionFingerprint({
        userId,
        accountId: targetAccountId,
        date: parsedDate || new Date().toISOString().slice(0, 10),
        amount: finalAmount,
        type: normalizedType,
        description: descVal,
        reference: notes,
      });

      const isDuplicate = existingFingerprints.has(fingerprint) || seenBatchFingerprints.has(fingerprint);
      seenBatchFingerprints.add(fingerprint);

      if (validationError) {
        invalidCount++;
      } else if (isDuplicate) {
        duplicateCount++;
      } else {
        validCount++;
      }

      rows.push({
        rowNumber: rowNum,
        date: parsedDate || "",
        description: descVal || "Transaction",
        amount: finalAmount,
        currency,
        type: normalizedType,
        category,
        fromAccount: mapping.fromAccount ? String(raw[mapping.fromAccount] || "") : null,
        toAccount: mapping.toAccount ? String(raw[mapping.toAccount] || "") : null,
        fromAccountId: fromAccId,
        toAccountId: toAccId,
        accountId: targetAccountId,
        notes,
        fingerprint,
        isDuplicate,
        validationError,
      });
    }

    return {
      fileName: input.fileName,
      fileKind: kind,
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      columnMapping: mapping,
      detectedHeaders: headers,
      rows,
      canImport: validCount > 0,
    };
  },

  /**
   * Atomic commit: validates, deduplicates and persists transactions.
   */
  async commit(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      userAccountId?: string | null;
      customMapping?: ColumnMapping;
      skipDuplicates?: boolean;
    }
  ): Promise<StandardCommitResult> {
    assertPrismaMode();
    const preview = await this.preview(userId, input);
    const { prisma } = await import("../../lib/prisma");

    const batchId = `imp_std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdIds: string[] = [];
    let skippedDuplicates = 0;
    let skippedInvalid = 0;

    const toPersist = preview.rows.filter((r) => {
      if (r.validationError) {
        skippedInvalid++;
        return false;
      }
      if (r.isDuplicate && input.skipDuplicates !== false) {
        skippedDuplicates++;
        return false;
      }
      return true;
    });

    if (toPersist.length === 0) {
      return {
        totalProcessed: preview.totalRows,
        importedCount: 0,
        skippedDuplicates,
        skippedInvalid,
        createdTransactionIds: [],
        importBatchId: batchId,
      };
    }

    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

    await prisma.$transaction(async (tx: Tx) => {
      for (const row of toPersist) {
        if (row.type === "TRANSFER" && row.fromAccountId && row.toAccountId) {
          const transferGroupId = `tr_${batchId}_${row.rowNumber}`;
          const date = new Date(row.date);

          // Debit
          const debit = await tx.transaction.create({
            data: {
              userId,
              type: "TRANSFER",
              amount: row.amount,
              category: "Transfer Out",
              description: row.description || "Transfer Out",
              date,
              accountId: row.fromAccountId,
              transferGroupId,
              tags: JSON.stringify(["import", `batch:${batchId}`, `fp:${row.fingerprint}`]),
            },
          });

          // Credit
          const credit = await tx.transaction.create({
            data: {
              userId,
              type: "TRANSFER",
              amount: row.amount,
              category: "Transfer In",
              description: row.description || "Transfer In",
              date,
              accountId: row.toAccountId,
              transferGroupId,
              tags: JSON.stringify(["import", `batch:${batchId}`, `fp:${row.fingerprint}`]),
            },
          });

          createdIds.push(debit.id, credit.id);
        } else {
          const created = await tx.transaction.create({
            data: {
              userId,
              type: row.type,
              amount: row.amount,
              category: row.category,
              description: row.description,
              date: new Date(row.date),
              accountId: row.accountId || null,
              tags: JSON.stringify(["import", `batch:${batchId}`, `fp:${row.fingerprint}`]),
            },
          });
          createdIds.push(created.id);
        }
      }
    });

    const { cache, cacheKey } = await import("../../lib/cache");
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));

    log.info("import.standard.committed", {
      userId,
      batchId,
      imported: createdIds.length,
      skippedDuplicates,
      skippedInvalid,
    });

    return {
      totalProcessed: preview.totalRows,
      importedCount: toPersist.length,
      skippedDuplicates,
      skippedInvalid,
      createdTransactionIds: createdIds,
      importBatchId: batchId,
    };
  },
};
