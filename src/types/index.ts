// Shared TS types that mirror the stringly-typed enums stored in SQLite.
// These constants are the source of truth at the application layer.

export const AssetType = {
  STOCK: "STOCK",
  MUTUAL_FUND: "MUTUAL_FUND",
  CRYPTO: "CRYPTO",
  REAL_ESTATE: "REAL_ESTATE",
  CASH: "CASH",
  GOLD: "GOLD",
  FIXED_DEPOSIT: "FIXED_DEPOSIT",
  EPF_PPF: "EPF_PPF",
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];
export const ASSET_TYPES: AssetType[] = Object.values(AssetType);

export const TransactionType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const LiabilityType = {
  HOME_LOAN: "HOME_LOAN",
  CAR_LOAN: "CAR_LOAN",
  PERSONAL_LOAN: "PERSONAL_LOAN",
  EDUCATION_LOAN: "EDUCATION_LOAN",
  CREDIT_CARD: "CREDIT_CARD",
  OTHER: "OTHER",
} as const;
export type LiabilityType = (typeof LiabilityType)[keyof typeof LiabilityType];
export const LIABILITY_TYPES: LiabilityType[] = Object.values(LiabilityType);

export interface LiabilityItem {
  id: string;
  userId: string;
  type: LiabilityType;
  name: string;
  principalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  monthlyEMI: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed helpers
  progressPct?: number;
  estimatedRemainingMonths?: number;
}

export interface LiabilitySummary {
  totalPrincipal: number;
  totalOutstanding: number;
  totalMonthlyEMI: number;
  weightedInterestRate: number;
  liabilitiesCount: number;
  liabilities: LiabilityItem[];
}

export const GoalStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  PAUSED: "PAUSED",
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const AIAction = {
  PORTFOLIO_ANALYSIS: "PORTFOLIO_ANALYSIS",
  SUGGEST_INVESTMENTS: "SUGGEST_INVESTMENTS",
  REBALANCING_ADVICE: "REBALANCING_ADVICE",
  MARKET_INSIGHTS: "MARKET_INSIGHTS",
  FINANCIAL_ROADMAP: "FINANCIAL_ROADMAP",
  CUSTOM_CHAT: "CUSTOM_CHAT",
  MONTHLY_SUMMARY: "MONTHLY_SUMMARY",
} as const;
export type AIAction = (typeof AIAction)[keyof typeof AIAction];

export interface PortfolioAllocation {
  assetType: AssetType;
  value: number;
  percent: number;
  count: number;
}

export interface AssetWithPL {
  id: string;
  type: AssetType;
  name: string;
  symbol: string | null;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  /** Currency of avgBuyPrice / currentPrice (the holding's ORIGINAL currency). */
  currency: string;
  account: string | null;
  /** invested / currentValue / pnl are ALWAYS in INR so portfolio totals can be summed safely. */
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  /** Same figures in the holding's original currency (equal to the INR figures for INR assets). */
  investedNative: number;
  currentValueNative: number;
  pnlNative: number;
  /** INR per 1 unit of `currency`; null when a foreign-currency rate could not be obtained. */
  fxRateToInr: number | null;
  priceSource: string | null;
  priceUpdatedAt: string | null;
  /** OK | FX_UNAVAILABLE (excluded from INR totals) | NO_MARKET_PRICE (price is cost basis / statement). */
  valuationStatus: "OK" | "FX_UNAVAILABLE" | "NO_MARKET_PRICE";
  /** Detailed classification per architecture: LIVE | STATEMENT | MANUAL | COST_BASIS | STALE | FX_UNAVAILABLE */
  detailedValuationStatus?: "LIVE" | "STATEMENT" | "MANUAL" | "COST_BASIS" | "STALE" | "FX_UNAVAILABLE";
  isin: string | null;
  exchange: string | null;
  folio?: string | null;
  importSource?: string | null;
  accountId?: string | null;
}

export interface AggregatedAsset {
  groupKey: string;
  type: AssetType;
  name: string;
  symbol: string | null;
  isin: string | null;
  exchange: string | null;
  currency: string;
  /** Primary reporting totals (in INR) */
  quantity: number;
  avgBuyPrice: number;       // Weighted average buy price
  currentPrice: number;      // Effective current price
  invested: number;          // Total invested in INR
  currentValue: number;      // Total current value in INR
  pnl: number;               // Total unrealized P&L in INR
  pnlPercent: number;        // (total pnl / total invested) * 100
  /** Native values (if all children share the same currency) */
  investedNative: number;
  currentValueNative: number;
  pnlNative: number;
  fxRateToInr: number | null;
  /** Status roll-ups */
  valuationStatus: "OK" | "FX_UNAVAILABLE" | "NO_MARKET_PRICE";
  detailedValuationStatus: "LIVE" | "STATEMENT" | "MANUAL" | "COST_BASIS" | "STALE" | "FX_UNAVAILABLE";
  priceSource: string | null;
  priceUpdatedAt: string | null;
  /** Breakdown metadata */
  holdingsCount: number;
  uniqueAccountsCount: number;
  uniqueFoliosCount: number;
  accounts: string[];
  folios: string[];
  brokers: string[];
  /** Underlying individual holdings (preserved records) */
  holdings: AssetWithPL[];
}

export interface HealthScoreBreakdown {
  savingsRate: { score: number; value: number; label: string };
  debtToIncome: { score: number; value: number; label: string };
  investmentAllocation: { score: number; value: number; label: string };
  goalProgress: { score: number; value: number; label: string };
  diversification: { score: number; value: number; label: string };
}

export interface HealthScore {
  total: number;
  max: number;
  breakdown: HealthScoreBreakdown;
  rating: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_WORK";
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown: Record<string, number>;
  history: { date: string; netWorth: number }[];
}

export interface Insight {
  id: string;
  severity: "INFO" | "WARN" | "ALERT";
  title: string;
  body: string;
  category: string;
}

export interface RebalancePlan {
  assetType: AssetType;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  action: "BUY" | "SELL" | "HOLD";
  suggestedAmount: number;
}
