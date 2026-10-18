import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { PortfolioService } from "@/services/portfolio.service";
import { ok, fail, handleError } from "@/lib/api";
import { rebalanceRequestSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const url = new URL(req.url);

    const modeParam = url.searchParams.get("mode");
    const mode = modeParam === "ALLOW_SELLS" ? "ALLOW_SELLS" : "CASH_ONLY";
    const newCash = parseFloat(url.searchParams.get("newCash") || "0") || 0;
    const driftThreshold = parseFloat(url.searchParams.get("driftThreshold") || "5") || 5;
    const minTradeSize = parseFloat(url.searchParams.get("minTradeSize") || "0") || 0;

    const result = await PortfolioService.getComprehensiveRebalancePlan(userId, {
      mode,
      newCash,
      driftThreshold,
      minTradeSize,
    });

    if (!result.ok) {
      return fail(result.message || "Failed to calculate rebalance plan", result.error || "TARGETS_INVALID", 422);
    }

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));
    const validated = rebalanceRequestSchema.parse(body);

    const result = await PortfolioService.getComprehensiveRebalancePlan(userId, validated);

    if (!result.ok) {
      return fail(result.message || "Failed to calculate rebalance plan", result.error || "TARGETS_INVALID", 422);
    }

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
