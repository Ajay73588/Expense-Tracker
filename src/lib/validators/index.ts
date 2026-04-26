import { z } from "zod";
import { ASSET_TYPES } from "../../types";

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().positive(),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional().nullable(),
  date: z.string().datetime().or(z.date()),
  account: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

export const assetSchema = z.object({
  type: z.enum(ASSET_TYPES as [string, ...string[]]),
  name: z.string().min(1).max(100),
  symbol: z.string().max(30).optional().nullable(),
  quantity: z.number().positive(),
  avgBuyPrice: z.number().nonnegative(),
  currentPrice: z.number().nonnegative().optional(),
  currency: z.string().default("INR"),
  account: z.string().max(100).optional().nullable(),
});

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
