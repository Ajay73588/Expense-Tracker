import { NextRequest } from "next/server";
import { assertPrismaMode } from "@/lib/feature-gate";
import { PriceEngineService, type PriceTarget } from "@/services/price-engine.service";
import { FxRateService } from "@/services/fx-rate.service";
import { ok, fail, handleError } from "@/lib/api";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("cron.prices");

/**
 * GET/POST /api/cron/prices
 *
 * Background scheduled job (Vercel Cron / QStash) to refresh EOD stock quotes,
 * mutual-fund NAVs, and USD/INR FX rates across all platform holdings.
 *
 * Authenticated via Authorization: Bearer <CRON_SECRET>.
 * Bounded, idempotent, retry-safe.
 */
export async function GET(req: NextRequest) {
  return handleCronRefresh(req);
}

export async function POST(req: NextRequest) {
  return handleCronRefresh(req);
}

import crypto from "crypto";

function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

async function handleCronRefresh(req: NextRequest) {
  try {
    assertPrismaMode();

    // 1. Authenticate cron trigger
    const cronSecret = process.env.CRON_SECRET;
    const isProdOrStaging =
      process.env.NODE_ENV === "production" ||
      process.env.APP_ENV === "staging" ||
      process.env.APP_ENV === "production";
    if (isProdOrStaging && !cronSecret) {
      log.error("cron.prices.unconfigured", { message: "CRON_SECRET must be configured in production/staging" });
      return fail("CRON_SECRET must be configured in production/staging", "CONFIGURATION_ERROR", 500);
    }

    if (cronSecret) {
      const authHeader = req.headers.get("authorization") ?? "";
      const expected = `Bearer ${cronSecret}`;
      if (!constantTimeEqual(authHeader, expected)) {
        log.warn("cron.prices.unauthorized", { ip: req.ip ?? "unknown" });
        return fail("Unauthorized cron request", "UNAUTHORIZED", 401);
      }
    }

    const { prisma } = await import("@/lib/prisma");

    // 2. Load all active stock and mutual fund holdings across all users
    type AssetHolding = {
      id: string;
      userId: string;
      type: string;
      name: string;
      symbol: string | null;
      isin: string | null;
      exchange: string | null;
      currency: string;
      currentPrice: number;
    };

    const assets: AssetHolding[] = await prisma.asset.findMany({
      where: {
        deletedAt: null,
        type: { in: ["STOCK", "MUTUAL_FUND"] },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        name: true,
        symbol: true,
        isin: true,
        exchange: true,
        currency: true,
        currentPrice: true,
      },
    });

    if (assets.length === 0) {
      // Still refresh FX rate
      let fxReport: any = null;
      try {
        const fx = await FxRateService.getUsdInr();
        fxReport = { rate: fx.rate, asOf: fx.asOf, source: fx.source, stale: fx.stale };
      } catch (err) {
        fxReport = { error: err instanceof Error ? err.message : "FX unavailable" };
      }

      return ok({
        message: "No active holdings to refresh",
        priced: 0,
        updatedHoldings: 0,
        failures: 0,
        fx: fxReport,
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Deduplicate targets for provider batching
    const targets: PriceTarget[] = assets.map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      symbol: a.symbol,
      isin: a.isin,
      exchange: a.exchange,
      currency: a.currency,
    }));

    const result = await PriceEngineService.refresh(targets);

    // 4. Group assets by user and apply updates
    const assetsByUser = new Map<string, AssetHolding[]>();
    for (const a of assets) {
      const list = assetsByUser.get(a.userId) ?? [];
      list.push(a);
      assetsByUser.set(a.userId, list);
    }

    const { AssetService } = await import("@/services/asset.service");
    let totalUpdated = 0;
    for (const [userId, userAssets] of assetsByUser) {
      const count = await AssetService.applyPrices(userId, userAssets as any, result);
      totalUpdated += count;
    }

    // 5. Refresh FX rate
    let fxReport: any = null;
    try {
      const fx = await FxRateService.getUsdInr();
      fxReport = { rate: fx.rate, asOf: fx.asOf, source: fx.source, stale: fx.stale };
    } catch (err) {
      fxReport = { error: err instanceof Error ? err.message : "FX unavailable" };
    }

    log.info("cron.prices.complete", {
      totalHoldings: assets.length,
      usersUpdated: assetsByUser.size,
      updatedHoldings: totalUpdated,
      priced: result.updates.size,
      failed: result.failures.size,
    });

    return ok({
      ok: true,
      totalHoldings: assets.length,
      priced: result.updates.size,
      updatedHoldings: totalUpdated,
      failures: result.failures.size,
      fx: fxReport,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
