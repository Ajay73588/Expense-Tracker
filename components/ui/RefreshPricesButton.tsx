"use client";

/**
 * RefreshPricesButton — PRICE-007 / PRICE-008
 *
 * A client-side button that calls POST /api/prices/refresh and reports:
 * - loading state (disabled while in-flight)
 * - success with per-asset updated/failed/unsupported counts
 * - partial failure (some updated, some failed)
 * - complete failure (provider down)
 * - unsupported-only result
 *
 * Never re-imports broker files. Never calls on page render.
 * Shows source/freshness of the last refresh timestamp.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RefreshSummary {
  updated: Array<{ id: string; name: string; price: number; currency: string; source: string; asOf: string | null }>;
  failed: Array<{ id: string; name: string; reason: string; message: string }>;
  unsupported: Array<{ id: string; name: string; reason: string }>;
  lastRefreshedAt: string;
  fx: { rate: number; asOf: string; source: string; stale: boolean } | { error: string } | null;
}

type Status = "idle" | "loading" | "success" | "partial" | "failure" | "unsupported_only";

export function RefreshPricesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<RefreshSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setStatus("loading");
    setSummary(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error?.message ?? `Server error (${res.status})`;
        setErrorMsg(msg);
        setStatus("failure");
        return;
      }
      const body = await res.json();
      const data: RefreshSummary = body.data;
      setSummary(data);

      if (data.updated.length === 0 && data.failed.length === 0 && data.unsupported.length > 0) {
        setStatus("unsupported_only");
      } else if (data.updated.length === 0 && data.failed.length > 0) {
        setStatus("failure");
      } else if (data.failed.length > 0) {
        setStatus("partial");
      } else {
        setStatus("success");
      }

      // Refresh the server component data without a full page reload
      if (data.updated.length > 0) {
        router.refresh();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      setStatus("failure");
    }
  }

  const isLoading = status === "loading";

  const statusColor: Record<Status, string> = {
    idle: "text-gray-400",
    loading: "text-brand-400",
    success: "text-positive",
    partial: "text-yellow-400",
    failure: "text-negative",
    unsupported_only: "text-gray-400",
  };

  const statusLabel: Record<Status, string> = {
    idle: "",
    loading: "Refreshing prices…",
    success: `Updated ${summary?.updated.length ?? 0} holding${summary?.updated.length === 1 ? "" : "s"}`,
    partial: `Updated ${summary?.updated.length ?? 0}, ${summary?.failed.length ?? 0} failed`,
    failure: errorMsg ?? `All ${summary?.failed.length ?? 0} lookups failed`,
    unsupported_only: "No priceable holdings (STOCK/MF)",
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        id="refresh-prices-btn"
        onClick={handleRefresh}
        disabled={isLoading}
        className={`
          btn-secondary text-sm min-w-[140px] flex items-center justify-center gap-1.5
          ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
        `}
        aria-label="Refresh market prices for all holdings"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            Refreshing…
          </>
        ) : (
          <>↻ Refresh Prices</>
        )}
      </button>

      {status !== "idle" && (
        <div
          id="refresh-prices-status"
          className={`text-xs ${statusColor[status]}`}
          role="status"
          aria-live="polite"
        >
          {statusLabel[status]}
        </div>
      )}

      {/* Partial failure detail */}
      {status === "partial" && summary && summary.failed.length > 0 && (
        <details className="text-xs text-gray-500 cursor-pointer">
          <summary className="cursor-pointer hover:text-gray-300">Show failed</summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {summary.failed.map((f) => (
              <li key={f.id} className="text-negative/80">{f.name}: {f.reason}</li>
            ))}
          </ul>
        </details>
      )}

      {/* FX rate note for USD holdings */}
      {summary?.fx && "rate" in summary.fx && (
        <div className="text-[10px] text-gray-500">
          USD/INR {summary.fx.rate.toFixed(2)} ({summary.fx.stale ? "stale" : summary.fx.asOf})
          {" · "}{summary.fx.source}
        </div>
      )}
      {summary?.fx && "error" in summary.fx && (
        <div className="text-[10px] text-yellow-600">FX unavailable: {summary.fx.error}</div>
      )}
    </div>
  );
}
