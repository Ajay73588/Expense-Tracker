/**
 * POST /api/prices/refresh
 *
 * Authenticated, user-scoped market-price refresh endpoint.
 *
 * Fetches live prices for all eligible holdings (STOCK, MUTUAL_FUND) belonging to the
 * authenticated user via PriceEngineService, persists only successful positive results,
 * and returns a per-holding summary. Failed lookups NEVER overwrite the last stored price.
 *
 * Does NOT re-import broker files; does NOT run on every portfolio render.
 */

import { assertPrismaMode } from "@/lib/feature-gate";
import { getCurrentUserId } from "@/lib/auth";
import { AssetService } from "@/services/asset.service";
import { PriceEngineService } from "@/services/price-engine.service";
import { FxRateService } from "@/services/fx-rate.service";
import { ok, handleError, rateLimited } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("prices.refresh");

export async function POST() {
  try {
    assertPrismaMode();
    const userId = await getCurrentUserId();

    const rateCheck = await checkRateLimit(`prices:refresh:${userId}`, 10, 60);
    if (!rateCheck.success) {
      return rateLimited(rateCheck.resetInSeconds);
    }

    // 1. Load the current user's active holdings (Prisma mode)
    const { prisma } = await import("@/lib/prisma");
    type AssetRow = {
      id: string; type: string; name: string; symbol: string | null;
      isin: string | null; exchange: string | null; currency: string;
      currentPrice: number; priceSource: string | null; priceUpdatedAt: Date | null;
    };
    const assets: AssetRow[] = await prisma.asset.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true, type: true, name: true, symbol: true,
        isin: true, exchange: true, currency: true,
        currentPrice: true, priceSource: true, priceUpdatedAt: true,
      },
    });

    // 2. Build targets for price-eligible types (STOCK and MUTUAL_FUND only)
    const targets = assets
      .filter((a: AssetRow) => a.type === "STOCK" || a.type === "MUTUAL_FUND")
      .map((a: AssetRow) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        symbol: a.symbol ?? null,
        isin: a.isin ?? null,
        exchange: a.exchange ?? null,
        currency: a.currency,
      }));

    const unsupportedIds = new Set(
      assets
        .filter((a: AssetRow) => a.type !== "STOCK" && a.type !== "MUTUAL_FUND")
        .map((a: AssetRow) => a.id)
    );

    if (targets.length === 0 && unsupportedIds.size === 0) {
      return ok({
        updated: [],
        failed: [],
        unsupported: [],
        skipped: [],
        lastRefreshedAt: new Date().toISOString(),
        fx: null,
      });
    }

    // 3. Fetch prices via the existing PriceEngineService (cache-first, bounded concurrency)
    const result = targets.length > 0
      ? await PriceEngineService.refresh(targets)
      : { updates: new Map(), failures: new Map(), unsupported: [] };

    // 4. Persist only successful positive results (NEVER overwrite with zero/NaN/null)
    const persistedCount = targets.length > 0
      ? await AssetService.applyPrices(userId, assets as any, result)
      : 0;

    // 5. Build per-asset name lookup for the response
    const nameById = new Map(assets.map((a: AssetRow) => [a.id, a.name]));

    // 6. Assemble response summary
    const updatedAssets = [...result.updates.entries()].map(([id, u]) => ({
      id,
      name: nameById.get(id) ?? "Unknown",
      price: u.price,
      currency: u.currency,
      source: u.source,
      asOf: u.asOf,
    }));

    const failedAssets = [...result.failures.entries()].map(([id, f]) => ({
      id,
      name: nameById.get(id) ?? "Unknown",
      reason: f.reason,
      message: f.message,
    }));

    const unsupportedFromEngine = result.unsupported.map((id) => ({
      id,
      name: nameById.get(id) ?? "Unknown",
      reason: "UNSUPPORTED_TYPE",
    }));
    const unsupportedOther = [...unsupportedIds].map((id) => ({
      id,
      name: nameById.get(id) ?? "Unknown",
      reason: "UNSUPPORTED_TYPE",
    }));
    const allUnsupported = [...unsupportedFromEngine, ...unsupportedOther];

    // 7. Fetch FX rate if any USD holdings are present
    const hasUsd = assets.some((a: AssetRow) => a.currency === "USD");
    let fx: { rate: number; asOf: string; source: string; stale: boolean } | { error: string } | null = null;
    if (hasUsd) {
      try {
        const fxData = await FxRateService.getUsdInr();
        fx = { rate: fxData.rate, asOf: fxData.asOf, source: fxData.source, stale: fxData.stale };
      } catch (err) {
        fx = { error: err instanceof Error ? err.message : "FX unavailable" };
      }
    }

    log.info("prices.refresh.complete", {
      userId,
      total: assets.length,
      targets: targets.length,
      updated: result.updates.size,
      failed: result.failures.size,
      unsupported: allUnsupported.length,
      persisted: persistedCount,
    });

    return ok({
      updated: updatedAssets,
      failed: failedAssets,
      unsupported: allUnsupported,
      skipped: [],
      lastRefreshedAt: new Date().toISOString(),
      fx,
    });
  } catch (err) {
    return handleError(err);
  }
}
