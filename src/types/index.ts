// Shared TS types that mirror the stringly-typed enums stored in SQLite.
// These constants are the source of truth at the application layer.

export const AssetType = {
  STOCK: "STOCK",
  MUTUAL_FUND: "MUTUAL_FUND",
  CRYPTO: "CRYPTO",
  REAL_ESTATE: "REAL_ESTATE",
  CASH: "CASH",
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
  CREDIT_CARD: "CREDIT_CARD",
  OTHER: "OTHER",
} as const;
export type LiabilityType = (typeof LiabilityType)[keyof typeof LiabilityType];

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
  currency: string;
  account: string | null;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
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
