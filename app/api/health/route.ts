import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { AIAdvisoryService } from "@/services/ai/ai-advisory.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — System health check for monitoring, uptime probes, and load balancers.
 * Performs cheap, non-destructive dependency probes without exposing internal secrets.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { status: "up" | "down" | "not_configured" | "skipped"; latencyMs?: number; error?: string }> = {};

  // 1. Database Connectivity Probe (Prisma / PostgreSQL)
  try {
    const dbStart = Date.now();
    const { prisma } = await import("@/lib/prisma");
    // Lightweight probe: query user count or fallback
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "up",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    checks.database = {
      status: "down",
      error: err instanceof Error ? err.message : "Database connection failed",
    };
  }

  // 2. Cache Layer Status (Upstash Redis vs In-Memory Map)
  const isUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  try {
    const cacheStart = Date.now();
    await cache.get("health:ping");
    checks.cache = {
      status: "up",
      latencyMs: Date.now() - cacheStart,
    };
  } catch (err) {
    checks.cache = {
      status: "down",
      error: err instanceof Error ? err.message : "Cache unavailable",
    };
  }

  // 3. AI Advisory Provider Configuration Status (No secret leakage)
  try {
    const aiHealth = await AIAdvisoryService.getProviderHealth();
    checks.ai = {
      status: aiHealth.configured ? "up" : "not_configured",
    };
  } catch {
    checks.ai = { status: "not_configured" };
  }

  const allCriticalUp = checks.database.status === "up";
  const overallStatus = allCriticalUp ? "healthy" : "degraded";
  const statusCode = allCriticalUp ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      version: "1.0.0",
      environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        database: { status: checks.database.status, latencyMs: checks.database.latencyMs },
        cache: { status: checks.cache.status, mode: isUpstash ? "upstash_redis" : "in_memory", latencyMs: checks.cache.latencyMs },
        ai: { status: checks.ai.status },
      },
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    }
  );
}
