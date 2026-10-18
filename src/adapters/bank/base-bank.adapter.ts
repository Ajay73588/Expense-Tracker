export interface BankTransactionCandidate {
  rowNumber: number;
  date: string; // YYYY-MM-DD
  valueDate?: string | null;
  narration: string;
  reference?: string | null;
  withdrawalAmount?: number | null;
  depositAmount?: number | null;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  currency?: string | null;
  balance?: number | null;
  balanceWarning?: string | null;
  categorySuggestion?: string | null;
  accountMasked?: string | null;
  counterparty?: string | null;
  sourcePage?: number | null;
  isTransferCandidate?: boolean;
  validationError?: string | null;
  warnings?: string[];
}

export interface BankDetectionResult {
  detectedBank: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  format: "CSV" | "TXT" | "XLSX" | "PDF";
  accountMasked?: string | null;
  evidence: string[];
  extractor?: "DETERMINISTIC_ADAPTER" | "AI_NVIDIA_NIM_UNIVERSAL" | "AI_GEMINI_UNIVERSAL";
  isEncrypted?: boolean;
  requiresPassword?: boolean;
}

export interface BankStatementAdapter {
  bankId: string;
  bankName: string;
  supportedFormats: ("csv" | "txt" | "xlsx" | "pdf")[];
  matches(textOrHeaders: string[]): boolean;
  parse(input: {
    fileName: string;
    bytes: Uint8Array;
    password?: string;
  }): {
    accountMasked?: string | null;
    accountType?: string | null;
    transactions: BankTransactionCandidate[];
    warnings: string[];
  };
}

