export interface CasHoldingCandidate {
  rowNumber: number;
  amc: string;
  schemeName: string;
  folio: string;
  isin: string | null;
  units: number;
  nav: number | null;
  investedValue: number;
  currentValue: number;
  advisor?: string | null;
  identity: string; // ISIN+folio or scheme+folio
}

export interface CasParseResult {
  provider: "CAMS" | "KFINTECH" | "UNKNOWN";
  isEncrypted: boolean;
  status: "PARSED" | "PASSWORD_REQUIRED" | "IMPLEMENTED_UNVERIFIED" | "BLOCKED_BY_SAMPLE_FILES";
  accountMasked?: string | null;
  statementPeriod?: string | null;
  holdings: CasHoldingCandidate[];
  warnings: string[];
  errorMessage?: string;
}
