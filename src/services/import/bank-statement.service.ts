import { assertPrismaMode } from "../../lib/feature-gate";
import { ValidationError, NotFoundError } from "../../lib/errors";
import { createLogger } from "../../lib/logger";
import { BankDetectionResult, BankTransactionCandidate } from "../../adapters/bank/base-bank.adapter";
import { HdfcBankAdapter } from "../../adapters/bank/hdfc.adapter";
import { generateTransactionFingerprint } from "./import-fingerprint";
import { ImportExtractionService } from "../ai/import-extraction.service";
import { isPdf, isPdfEncrypted } from "../../utils/pdf";
import { detectCategoryFromNarration } from "./category-rules";
import { parseDateString } from "./standard-transaction.service";

const log = createLogger("BankStatementService");

export interface BankStatementPreviewRow {
  rowNumber: number;
  date: string;
  valueDate?: string | null;
  narration: string;
  reference?: string | null;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  balance?: number | null;
  balanceWarning?: string | null;
  suggestedCategory: string;
  isTransferCandidate: boolean;
  fingerprint: string;
  isDuplicate: boolean;
  validationError?: string | null;
  warnings?: string[];
}

export interface BankStatementPreview {
  fileName: string;
  detection: BankDetectionResult;
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  rows: BankStatementPreviewRow[];
  warnings: string[];
  canImport: boolean;
  extractor: "DETERMINISTIC_ADAPTER" | "AI_NVIDIA_NIM_UNIVERSAL" | "AI_GEMINI_UNIVERSAL";
}

export interface BankStatementCommitResult {
  totalProcessed: number;
  importedCount: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  createdTransactionIds: string[];
  importBatchId: string;
}

export const BankStatementService = {
  /**
   * Detects bank and statement format from uploaded file (PDF, CSV, TXT, XLSX).
   */
  detectBank(fileName: string, bytes: Uint8Array): BankDetectionResult {
    const isPdfDoc = isPdf(bytes) || fileName.toLowerCase().endsWith(".pdf");
    const ext = (fileName.toLowerCase().split(".").pop() || "csv") as "csv" | "txt" | "xlsx" | "pdf";

    if (isPdfDoc) {
      const encrypted = isPdfEncrypted(bytes);
      const latinText = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.byteLength, 32768)));
      const lower = latinText.toLowerCase();

      let detectedBank = "Universal Bank Statement";
      let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
      const evidence: string[] = ["PDF document layout"];

      let accountMasked: string | undefined;
      const accMatch = /account\s*(?:no|number)?\s*[:.\-]?\s*([x*0-9]{4,})/i.exec(latinText);
      if (accMatch) accountMasked = accMatch[1].trim();

      if (lower.includes("hdfc bank")) {
        detectedBank = "HDFC Bank";
        confidence = "HIGH";
        evidence.push("Matched HDFC Bank signatures");
      } else if (lower.includes("icici bank")) {
        detectedBank = "ICICI Bank";
        confidence = "HIGH";
        evidence.push("Matched ICICI Bank signatures");
      } else if (lower.includes("state bank of india") || lower.includes("sbi")) {
        detectedBank = "State Bank of India";
        confidence = "HIGH";
        evidence.push("Matched SBI signatures");
      } else if (lower.includes("axis bank")) {
        detectedBank = "Axis Bank";
        confidence = "HIGH";
        evidence.push("Matched Axis Bank signatures");
      } else if (lower.includes("kotak")) {
        detectedBank = "Kotak Mahindra Bank";
        confidence = "HIGH";
        evidence.push("Matched Kotak signatures");
      } else {
        confidence = "LOW";
        evidence.push("Unfamiliar statement layout - will use AI Universal Extractor");
      }

      return {
        detectedBank,
        confidence,
        format: "PDF",
        accountMasked,
        evidence,
        extractor: "AI_NVIDIA_NIM_UNIVERSAL",
        isEncrypted: encrypted,
        requiresPassword: encrypted,
      };
    }

    const textSnippet = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.subarray(0, Math.min(bytes.byteLength, 15000)))
      .replace(/^\uFEFF/, "");
    const lines = textSnippet.split(/\r?\n/).slice(0, 30);

    // Test HDFC deterministic signatures
    if (HdfcBankAdapter.matches(lines)) {
      const accMatch = /account\s*(?:no|number)?\s*[:.\-]?\s*([x*0-9]+)/i.exec(textSnippet);
      return {
        detectedBank: "HDFC Bank",
        confidence: "HIGH",
        format: ext === "xlsx" ? "XLSX" : ext === "txt" ? "TXT" : "CSV",
        accountMasked: accMatch ? accMatch[1].trim() : undefined,
        evidence: ["Matched HDFC header signatures", "NetBanking table format"],
        extractor: "DETERMINISTIC_ADAPTER",
      };
    }

    return {
      detectedBank: "Unknown Bank",
      confidence: "LOW",
      format: ext === "xlsx" ? "XLSX" : ext === "txt" ? "TXT" : "CSV",
      evidence: ["Unrecognized bank format"],
      extractor: "DETERMINISTIC_ADAPTER",
    };
  },

  /**
   * Preview a bank statement.
   * Supports deterministic adapters (HDFC CSV/TXT/XLSX) and AI-assisted universal PDF extraction.
   * Executes deterministic financial validation, running balance consistency checks,
   * account suggestion, and SHA-256 duplicate detection.
   */
  async preview(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      bankId?: string;
      accountId?: string;
      password?: string;
    }
  ): Promise<BankStatementPreview> {
    assertPrismaMode();
    const detection = this.detectBank(input.fileName, input.bytes);
    const warnings: string[] = [];
    let candidates: BankTransactionCandidate[] = [];
    let parsedAccountMasked: string | null = detection.accountMasked ?? null;

    if (detection.format === "PDF") {
      // PDF statement extraction path
      if (detection.isEncrypted && !input.password) {
        return {
          fileName: input.fileName,
          detection,
          suggestedAccountId: null,
          suggestedAccountName: null,
          totalRows: 0,
          validRows: 0,
          duplicateRows: 0,
          invalidRows: 0,
          rows: [],
          warnings: [
            "This statement PDF is password-protected. Please provide your statement password to preview transactions.",
          ],
          canImport: false,
          extractor: "AI_NVIDIA_NIM_UNIVERSAL",
        };
      }

      const aiResult = await ImportExtractionService.extractBankStatementPdf(input.bytes, {
        fileName: input.fileName,
        password: input.password,
      });

      if (!aiResult.ok || !aiResult.data) {
        return {
          fileName: input.fileName,
          detection,
          suggestedAccountId: null,
          suggestedAccountName: null,
          totalRows: 0,
          validRows: 0,
          duplicateRows: 0,
          invalidRows: 0,
          rows: [],
          warnings: [aiResult.error || "Unable to extract transactions from PDF statement."],
          canImport: false,
          extractor: "AI_NVIDIA_NIM_UNIVERSAL",
        };
      }

      if (aiResult.data.bankName) {
        detection.detectedBank = aiResult.data.bankName;
      }
      if (aiResult.data.accountNumberMasked) {
        parsedAccountMasked = aiResult.data.accountNumberMasked;
        detection.accountMasked = aiResult.data.accountNumberMasked;
      }

      candidates = aiResult.data.transactions.map((t, idx) => {
        const cleanNarration = t.description.trim();
        const detCategory = detectCategoryFromNarration(cleanNarration);
        const categorySuggestion =
          detCategory !== "Other"
            ? detCategory
            : t.category || (t.direction === "CREDIT" ? "Income" : "General");

        // Flag potential internal transfers only if explicit evidence exists
        const isTransfer =
          /own\s*a\/?c|self\s*transfer|transfer\s*to\s*self|to\s*linked\s*account/i.test(cleanNarration);

        return {
          rowNumber: idx + 1,
          date: t.date,
          valueDate: t.valueDate,
          narration: cleanNarration,
          reference: t.reference || null,
          withdrawalAmount: t.debitAmount ?? (t.direction === "DEBIT" ? t.amount : null),
          depositAmount: t.creditAmount ?? (t.direction === "CREDIT" ? t.amount : null),
          direction: t.direction,
          amount: t.amount,
          balance: t.balance ?? null,
          currency: t.currency || "INR",
          counterparty: t.counterparty || null,
          sourcePage: t.sourcePage || null,
          categorySuggestion,
          isTransferCandidate: isTransfer,
          warnings: t.warning ? [t.warning] : [],
        };
      });
    } else {
      // Deterministic CSV/TXT/XLSX path (HDFC verified target)
      const adapter = HdfcBankAdapter;
      const parsed = adapter.parse({ fileName: input.fileName, bytes: input.bytes });
      candidates = parsed.transactions;
      parsedAccountMasked = parsed.accountMasked ?? detection.accountMasked ?? null;
      warnings.push(...parsed.warnings);
    }

    // Deterministic Running Balance Consistency Arithmetic Check
    for (let i = 1; i < candidates.length; i++) {
      const prev = candidates[i - 1];
      const curr = candidates[i];
      if (typeof prev.balance === "number" && typeof curr.balance === "number" && curr.amount > 0) {
        const expectedBalance =
          curr.direction === "DEBIT"
            ? prev.balance - curr.amount
            : prev.balance + curr.amount;
        const diff = Math.abs(expectedBalance - curr.balance);
        if (diff > 0.10) {
          curr.balanceWarning = `Running balance mismatch: expected ₹${expectedBalance.toFixed(2)} based on prior row (₹${prev.balance.toFixed(2)}), but statement shows ₹${curr.balance.toFixed(2)}.`;
          if (!curr.warnings) curr.warnings = [];
          curr.warnings.push(curr.balanceWarning);
        }
      }
    }

    const { prisma } = await import("../../lib/prisma");

    // Fetch user's existing accounts
    const userAccounts = await prisma.account.findMany({
      where: { userId, closedAt: null },
    });

    // Account suggestion: Match user specified account, masked account digits, bank name, or default account
    let suggestedAccount = userAccounts.find((a: any) => a.id === input.accountId) || null;

    if (!suggestedAccount && parsedAccountMasked) {
      const lastDigits = parsedAccountMasked.slice(-4);
      suggestedAccount =
        userAccounts.find((a: any) => a.name.includes(lastDigits) || (a.note && a.note.includes(lastDigits))) ||
        null;
    }

    if (!suggestedAccount && detection.detectedBank) {
      const bankKeyword = detection.detectedBank.split(" ")[0].toLowerCase();
      suggestedAccount =
        userAccounts.find((a: any) => a.type === "BANK" && a.name.toLowerCase().includes(bankKeyword)) ||
        null;
    }

    if (!suggestedAccount) {
      suggestedAccount =
        userAccounts.find((a: any) => a.isDefault && a.type === "BANK") ||
        userAccounts.find((a: any) => a.type === "BANK") ||
        userAccounts[0] ||
        null;
    }

    // Existing transaction fingerprints for deduplication
    const existingTx = await prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, date: true, amount: true, type: true, description: true, accountId: true, tags: true },
      take: 2000,
      orderBy: { date: "desc" },
    });

    const existingFingerprints = new Set<string>();
    for (const t of existingTx) {
      if (t.tags) {
        const tagStr = typeof t.tags === "string" ? t.tags : JSON.stringify(t.tags);
        const matchFp = /fp:([a-f0-9]{64})/.exec(tagStr);
        if (matchFp) {
          existingFingerprints.add(matchFp[1]);
        }
      }
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

    const seenBatchFingerprints = new Set<string>();
    const previewRows: BankStatementPreviewRow[] = [];
    let validCount = 0;
    let dupCount = 0;
    let invalidCount = 0;

    for (const c of candidates) {
      const type = c.direction === "DEBIT" ? "EXPENSE" : "INCOME";
      const fingerprint = generateTransactionFingerprint({
        userId,
        accountId: suggestedAccount?.id ?? null,
        date: c.date,
        amount: c.amount,
        type,
        description: c.narration,
        reference: c.reference,
      });

      const fingerprintNoRef = generateTransactionFingerprint({
        userId,
        accountId: suggestedAccount?.id ?? null,
        date: c.date,
        amount: c.amount,
        type,
        description: c.narration,
      });

      const isDuplicate =
        existingFingerprints.has(fingerprint) ||
        existingFingerprints.has(fingerprintNoRef) ||
        seenBatchFingerprints.has(fingerprint) ||
        seenBatchFingerprints.has(fingerprintNoRef);
      seenBatchFingerprints.add(fingerprint);
      seenBatchFingerprints.add(fingerprintNoRef);

      let validationError: string | null = null;
      if (!c.date) {
        validationError = "Missing or invalid transaction date";
      } else {
        const parsedDt = parseDateString(c.date);
        if (!parsedDt) {
          validationError = `Invalid date format: ${c.date}`;
        }
      }

      if (!validationError && (c.amount <= 0 || isNaN(c.amount))) {
        validationError = "Transaction amount must be a positive finite number";
      }

      // Check for conflicting withdrawal and deposit
      if (!validationError && c.withdrawalAmount && c.depositAmount && c.withdrawalAmount > 0 && c.depositAmount > 0) {
        validationError = "Ambiguous transaction: both debit and credit amounts are populated";
      }

      if (validationError) invalidCount++;
      else if (isDuplicate) dupCount++;
      else validCount++;

      previewRows.push({
        rowNumber: c.rowNumber,
        date: c.date,
        valueDate: c.valueDate,
        narration: c.narration,
        reference: c.reference,
        direction: c.direction,
        amount: c.amount,
        balance: c.balance,
        balanceWarning: c.balanceWarning ?? null,
        suggestedCategory: c.categorySuggestion || (c.direction === "CREDIT" ? "Income" : "General"),
        isTransferCandidate: !!c.isTransferCandidate,
        fingerprint,
        isDuplicate,
        validationError,
        warnings: c.warnings,
      });
    }

    return {
      fileName: input.fileName,
      detection,
      suggestedAccountId: suggestedAccount?.id ?? null,
      suggestedAccountName: suggestedAccount?.name ?? null,
      totalRows: previewRows.length,
      validRows: validCount,
      duplicateRows: dupCount,
      invalidRows: invalidCount,
      rows: previewRows,
      warnings,
      canImport: validCount > 0,
      extractor: detection.extractor || "DETERMINISTIC_ADAPTER",
    };
  },

  /**
   * Atomic commit for bank statement transactions.
   */
  async commit(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      accountId: string;
      password?: string;
      skipDuplicates?: boolean;
      customCategories?: Record<number, string>;
      transferSelections?: Record<number, { toAccountId: string }>;
    }
  ): Promise<BankStatementCommitResult> {
    assertPrismaMode();
    const { prisma } = await import("../../lib/prisma");

    // Validate account belongs to authenticated user
    const userAccount = await prisma.account.findFirst({
      where: { id: input.accountId, userId },
    });
    if (!userAccount) {
      throw new NotFoundError("Destination account");
    }

    const preview = await this.preview(userId, {
      fileName: input.fileName,
      bytes: input.bytes,
      accountId: input.accountId,
      password: input.password,
    });

    if (preview.totalRows === 0) {
      throw new ValidationError(
        preview.warnings.length > 0
          ? `Cannot import statement: ${preview.warnings.join("; ")}`
          : "Cannot import statement: no valid transactions found."
      );
    }

    const batchId = `imp_bank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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

    const bankTag = `bank:${preview.detection.detectedBank.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

    await prisma.$transaction(async (tx: Tx) => {
      for (const row of toPersist) {
        const category = input.customCategories?.[row.rowNumber] || row.suggestedCategory;
        const transferSel = input.transferSelections?.[row.rowNumber];

        if (transferSel && transferSel.toAccountId) {
          // Verified internal transfer: verify destination account ownership
          const toAcc = await tx.account.findFirst({ where: { id: transferSel.toAccountId, userId } });
          if (toAcc) {
            const transferGroupId = `tr_${batchId}_${row.rowNumber}`;
            const parsedStr = parseDateString(row.date) || row.date;
            const date = new Date(parsedStr);

            const debit = await tx.transaction.create({
              data: {
                userId,
                type: "TRANSFER",
                amount: row.amount,
                category: "Transfer Out",
                description: row.narration,
                date,
                accountId: input.accountId,
                transferGroupId,
                tags: JSON.stringify(["import", bankTag, `batch:${batchId}`, `fp:${row.fingerprint}`]),
              },
            });

            const credit = await tx.transaction.create({
              data: {
                userId,
                type: "TRANSFER",
                amount: row.amount,
                category: "Transfer In",
                description: row.narration,
                date,
                accountId: transferSel.toAccountId,
                transferGroupId,
                tags: JSON.stringify(["import", bankTag, `batch:${batchId}`, `fp:${row.fingerprint}`]),
              },
            });

            createdIds.push(debit.id, credit.id);
            continue;
          }
        }

        // Standard income / expense
        const txType = row.direction === "DEBIT" ? "EXPENSE" : "INCOME";
        const parsedStr = parseDateString(row.date) || row.date;
        const date = new Date(parsedStr);

        const created = await tx.transaction.create({
          data: {
            userId,
            type: txType,
            amount: row.amount,
            category,
            description: row.narration,
            date,
            accountId: input.accountId,
            tags: JSON.stringify(["import", bankTag, `batch:${batchId}`, `fp:${row.fingerprint}`]),
          },
        });
        createdIds.push(created.id);
      }
    });

    const { cache, cacheKey } = await import("../../lib/cache");
    await cache.delByPrefix(cacheKey("tx", userId));
    await cache.delByPrefix(cacheKey("dashboard", userId));

    log.info("import.bank.committed", {
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

