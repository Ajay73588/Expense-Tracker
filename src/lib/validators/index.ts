import { z } from "zod";
import { ASSET_TYPES } from "../../types";

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().positive(),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional().nullable(),
  date: z.string().datetime().or(z.date()),
  account: z.string().max(100).optional().nullable(),
  accountId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export const transactionUpdateSchema = transactionSchema.partial();

export const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Source account is required"),
    toAccountId: z.string().min(1, "Destination account is required"),
    amount: z.number().positive("Transfer amount must be positive"),
    date: z.string().datetime().or(z.date()),
    description: z.string().max(500).optional().nullable(),
    tags: z.array(z.string()).optional().default(["transfer"]),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Source and destination accounts must be different",
    path: ["toAccountId"],
  });


export const assetSchema = z.object({
  type: z.enum(ASSET_TYPES as [string, ...string[]]),
  name: z.string().trim().min(1, "Name is required").max(100),
  symbol: z.string().trim().max(30).optional().nullable(),
  quantity: z.number().positive("Quantity must be positive").default(1),
  avgBuyPrice: z.number().nonnegative("Purchase price / invested amount must be zero or positive"),
  currentPrice: z.number().nonnegative("Current price / valuation must be zero or positive").optional(),
  currency: z.string().trim().min(3).max(5).toUpperCase().default("INR"),
  account: z.string().trim().max(100).optional().nullable(),
  accountId: z.string().optional().nullable(),
  isin: z.string().trim().max(20).optional().nullable(),
  exchange: z.string().trim().max(10).optional().nullable(),
  folio: z.string().trim().max(50).optional().nullable(),
  priceSource: z.enum(["YAHOO", "MFAPI", "STATEMENT", "MANUAL", "COST_BASIS"]).optional(),
});

export const assetUpdateSchema = assetSchema.partial();

export const budgetSchema = z.object({
  category: z.string().min(1).max(50),
  monthlyLimit: z.number().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  alertAt80: z.boolean().optional().default(true),
  alertAt100: z.boolean().optional().default(true),
});

export const goalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  currentAmount: z.number().nonnegative().optional().default(0),
  targetDate: z.string().datetime().or(z.date()),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED"]).optional().default("ACTIVE"),
});

export const ACCOUNT_TYPES = ["BANK", "BROKER", "CREDIT_CARD", "WALLET", "OTHER"] as const;

export const accountSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  type: z.enum(ACCOUNT_TYPES).optional().default("OTHER"),
  currency: z.string().min(3).max(3).toUpperCase().optional().default("INR"),
  isDefault: z.boolean().optional().default(false),
  note: z.string().max(500).optional().nullable(),
});

export const accountUpdateSchema = accountSchema.partial();

export const aiRequestSchema = z.object({
  action: z.enum([
    "PORTFOLIO_ANALYSIS",
    "SUGGEST_INVESTMENTS",
    "REBALANCING_ADVICE",
    "MARKET_INSIGHTS",
    "FINANCIAL_ROADMAP",
    "CUSTOM_CHAT",
    "MONTHLY_SUMMARY",
  ]),
  message: z.string().max(2000).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

export const liabilitySchema = z.object({
  name: z.string().min(1, "Liability name is required").max(100),
  type: z.enum([
    "HOME_LOAN",
    "CAR_LOAN",
    "PERSONAL_LOAN",
    "EDUCATION_LOAN",
    "CREDIT_CARD",
    "OTHER",
  ]),
  principalAmount: z.number().positive("Principal amount must be positive"),
  outstandingAmount: z.number().nonnegative("Outstanding amount must be non-negative"),
  interestRate: z
    .number()
    .min(0, "Interest rate cannot be negative")
    .max(100, "Interest rate cannot exceed 100%"),
  monthlyEMI: z.number().nonnegative("EMI must be non-negative").optional().nullable(),
  tenureMonths: z.number().int().positive("Tenure must be positive months").optional().nullable(),
  dueDate: z.string().datetime().or(z.date()).optional().nullable(),
});

export const liabilityUpdateSchema = liabilitySchema.partial();

export const prepaymentSimulationSchema = z.object({
  lumpSums: z
    .array(
      z.object({
        month: z.number().int().positive(),
        amount: z.number().positive(),
      })
    )
    .optional(),
  monthlyExtra: z.number().nonnegative().optional(),
  strategy: z.enum(["REDUCE_TENURE", "REDUCE_EMI"]).optional().default("REDUCE_TENURE"),
});

export const rebalanceRequestSchema = z.object({
  mode: z.enum(["CASH_ONLY", "ALLOW_SELLS"]).optional().default("CASH_ONLY"),
  newCash: z.number().nonnegative().optional().default(0),
  driftThreshold: z.number().min(0).max(50).optional().default(5),
  minTradeSize: z.number().nonnegative().optional().default(0),
  excludedAssetIds: z.array(z.string()).optional().default([]),
  excludedAssetTypes: z.array(z.enum(ASSET_TYPES as [string, ...string[]])).optional().default([]),
});

