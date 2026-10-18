import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";
import { BankStatementAdapter, BankTransactionCandidate } from "./base-bank.adapter";
import { parseDateString } from "../../services/import/standard-transaction.service";
import { detectCategoryFromNarration } from "../../services/import/category-rules";
import { ValidationError } from "../../lib/errors";

const HDFC_SIGNATURES = [
  "hdfc bank",
  "hdfc bank limited",
  "chq./ref.no.",
  "withdrawal amt.",
  "deposit amt.",
  "closing balance",
];

function cleanNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).replace(/[,\s]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.abs(num);
}

export const HdfcBankAdapter: BankStatementAdapter = {
  bankId: "HDFC",
  bankName: "HDFC Bank",
  supportedFormats: ["csv", "txt", "xlsx"],

  matches(linesOrHeaders: string[]): boolean {
    const combined = linesOrHeaders.join(" ").toLowerCase();
    const matchCount = HDFC_SIGNATURES.filter((sig) => combined.includes(sig)).length;
    return matchCount >= 2;
  },

  parse(input: { fileName: string; bytes: Uint8Array }) {
    const ext = input.fileName.toLowerCase().split(".").pop();
    let rows: any[][] = [];
    let text = "";

    if (ext === "xlsx" || ext === "xls") {
      const wb = XLSX.read(input.bytes, { type: "array", cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      if (!firstSheet) throw new ValidationError("The Excel workbook contains no sheets.");
      rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, defval: "" });
    } else {
      text = new TextDecoder("utf-8").decode(input.bytes).replace(/^\uFEFF/, "");
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: false,
      });
      rows = parsed.data;
    }

    // Extract masked account number from header lines
    let accountMasked: string | null = null;
    const accRegex = /account\s*(?:no|number)?\s*[:.\-]?\s*([x*0-9]+)/i;

    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const lineStr = rows[i].join(" ");
      const accMatch = accRegex.exec(lineStr);
      if (accMatch && accMatch[1].length >= 4) {
        accountMasked = accMatch[1].trim();
        break;
      }
    }

    // Find table header row
    let headerRowIdx = -1;
    let colIndices = {
      date: -1,
      narration: -1,
      ref: -1,
      valueDate: -1,
      withdrawal: -1,
      deposit: -1,
      balance: -1,
    };

    for (let r = 0; r < rows.length; r++) {
      let row = rows[r].map((cell) => String(cell || "").trim().toLowerCase());
      if (row.length === 1 && row[0].includes(",")) {
        rows[r] = rows[r][0].split(",").map((c: string) => c.trim());
        row = rows[r].map((cell: string) => cell.toLowerCase());
      }
      const hasDate = row.some((c) => c === "date" || c === "txn date");
      const hasNarration = row.some((c) => c.includes("narration") || c.includes("particulars"));
      const hasWithdrawal = row.some((c) => c.includes("withdrawal") || c.includes("debit"));

      if (hasDate && (hasNarration || hasWithdrawal)) {
        headerRowIdx = r;
        colIndices = {
          date: row.findIndex((c) => c === "date" || c === "txn date"),
          narration: row.findIndex((c) => c.includes("narration") || c.includes("particulars")),
          ref: row.findIndex((c) => c.includes("chq") || c.includes("ref")),
          valueDate: row.findIndex((c) => c.includes("value dt") || c.includes("value date")),
          withdrawal: row.findIndex((c) => c.includes("withdrawal") || c.includes("debit")),
          deposit: row.findIndex((c) => c.includes("deposit") || c.includes("credit")),
          balance: row.findIndex((c) => c.includes("balance")),
        };
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new ValidationError(
        "Could not detect HDFC Bank transaction header row. Expected columns: Date, Narration, Withdrawal, Deposit."
      );
    }

    const transactions: BankTransactionCandidate[] = [];
    const warnings: string[] = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawDate = colIndices.date >= 0 ? row[colIndices.date] : null;
      const parsedDate = parseDateString(rawDate);
      if (!parsedDate) continue; // Skip non-transaction rows, empty rows, or footer totals

      const narration = colIndices.narration >= 0 ? String(row[colIndices.narration] || "").trim() : "";
      const ref = colIndices.ref >= 0 ? String(row[colIndices.ref] || "").trim() : null;
      const rawValDate = colIndices.valueDate >= 0 ? row[colIndices.valueDate] : null;
      const valueDate = parseDateString(rawValDate);

      const withdrawal = colIndices.withdrawal >= 0 ? cleanNumber(row[colIndices.withdrawal]) : null;
      const deposit = colIndices.deposit >= 0 ? cleanNumber(row[colIndices.deposit]) : null;
      const balance = colIndices.balance >= 0 ? cleanNumber(row[colIndices.balance]) : null;

      let direction: "DEBIT" | "CREDIT" = "DEBIT";
      let amount = 0;

      if (withdrawal !== null && withdrawal > 0) {
        direction = "DEBIT";
        amount = withdrawal;
      } else if (deposit !== null && deposit > 0) {
        direction = "CREDIT";
        amount = deposit;
      } else {
        continue; // Skip zero or empty balance lines
      }

      const categorySuggestion = detectCategoryFromNarration(narration);
      const isTransferCandidate = /TRANSFER|NEFT|RTGS|IMPS|OWN A\/C/i.test(narration);

      transactions.push({
        rowNumber: r + 1,
        date: parsedDate,
        valueDate,
        narration: narration || "Bank Transaction",
        reference: ref,
        withdrawalAmount: withdrawal,
        depositAmount: deposit,
        direction,
        amount,
        balance,
        categorySuggestion,
        accountMasked,
        isTransferCandidate,
      });
    }

    if (transactions.length === 0) {
      warnings.push("Statement structure recognized, but zero valid transaction rows were extracted.");
    }

    return {
      accountMasked,
      accountType: "SAVINGS",
      transactions,
      warnings,
    };
  },
};
