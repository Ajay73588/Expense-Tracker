import { getCurrentUserId } from "@/lib/auth";
import { PortfolioService } from "@/services/portfolio.service";
import { AssetService } from "@/services/asset.service";
import { Card, CardHeader, StatCard } from "@/components/cards/Card";
import { AllocationPie } from "@/components/charts/Charts";
import { formatINR, formatPercent } from "@/utils/format";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { HoldingsTable, TYPE_COLORS } from "@/components/portfolio/HoldingsTable";
import Link from "next/link";
import { cn } from "@/utils/cn";
import type { PortfolioAllocation, RebalancePlan } from "@/types";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const userId = await getCurrentUserId();
  const [assets, targets] = await Promise.all([
    AssetService.getPortfolioWithPL(userId),
    PortfolioService.getAllocationTargets(userId),
  ]);

  const allocation = await PortfolioService.getAllocation(userId, assets);
  const [riskScore, summary, rebalance] = await Promise.all([
    PortfolioService.getRiskScore(userId, allocation),
    PortfolioService.getPortfolioSummary(userId, assets),
    PortfolioService.getRebalancePlan(userId, 5, { allocation, targets }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Asset holdings, P&amp;L, and allocation analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshPricesButton />
          <Link href="/import" className="btn-secondary text-sm">↥ Import CSV</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Invested" value={formatINR(summary.invested, { compact: true })} />
        <StatCard
          label="Current Value"
          value={formatINR(summary.currentValue, { compact: true })}
          change={`${summary.pnl >= 0 ? "▲" : "▼"} ${formatINR(Math.abs(summary.pnl), { compact: true })}`}
          tone={summary.pnl >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Total P&L"
          value={`${summary.pnlPercent >= 0 ? "+" : ""}${formatPercent(summary.pnlPercent)}`}
          tone={summary.pnl >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Risk Score"
          value={`${riskScore}/10`}
          hint={riskScore <= 4 ? "Conservative" : riskScore <= 7 ? "Moderate" : "Aggressive"}
          tone={riskScore <= 4 ? "positive" : riskScore <= 7 ? "neutral" : "negative"}
        />
      </div>

      {/* Allocation + Rebalance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Asset Allocation" subtitle={`${assets.length} holdings`} />
          <AllocationPie data={allocation} />
          <div className="mt-3 space-y-1.5">
            {allocation.map((a: PortfolioAllocation, i: number) => (
              <div key={a.assetType} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: ["#2b73ff","#22c55e","#f59e0b","#a855f7","#06b6d4","#eab308","#3b82f6","#10b981"][i % 8] }}
                  />
                  <span className="text-gray-300">{a.assetType.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">{formatINR(a.value, { compact: true })}</span>
                  <span className="tabular-nums text-white font-medium w-12 text-right">{formatPercent(a.percent)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Rebalance Plan"
            subtitle={targets.length ? `vs your ${targets.length} targets (5% drift threshold)` : "Set targets to enable"}
          />
          {rebalance.length > 0 ? (
            <div className="space-y-2">
              {rebalance.map((r: RebalancePlan) => (
                <div key={r.assetType} className="flex items-center justify-between p-3 bg-bg-hover/40 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{r.assetType.replace("_", " ")}</span>
                      {r.driftPct !== 0 && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium",
                            r.driftPct > 0 ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
                          )}
                        >
                          {r.driftPct > 0 ? `+${formatPercent(r.driftPct)}` : formatPercent(r.driftPct)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatPercent(r.currentPct)} → {formatPercent(r.targetPct)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn("pill text-xs font-semibold",
                        r.action === "BUY" ? "bg-positive/15 text-positive" :
                        r.action === "SELL" ? "bg-negative/15 text-negative" :
                        "bg-bg-hover text-gray-400"
                      )}
                    >
                      {r.action}
                    </span>
                    {r.suggestedAmount > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatINR(r.suggestedAmount, { compact: true })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-gray-500 pt-2 border-t border-border/40">
                Rule engine evaluation. Taxes, brokerage charges, and lot constraints are not modeled.
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 p-4 text-center">
              {targets.length > 0
                ? "All asset classes are within the 5% drift threshold."
                : "No allocation targets set. Configure targets to generate rebalancing recommendations."}
            </div>
          )}
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader
          title="All Holdings"
          subtitle={
            summary.investmentCount !== assets.length
              ? `${summary.investmentCount} investments · ${assets.length} holdings`
              : `${assets.length} positions`
          }
        />
        <HoldingsTable assets={assets} />
      </Card>

      {/* Top movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Top Gainers" />
          <div className="space-y-2">
            {summary.topGainers.filter((a: import("@/types").AssetWithPL) => a.pnl > 0).map((a: import("@/types").AssetWithPL) => (
              <div key={a.id} className="flex items-center justify-between">
                <div className="text-sm text-gray-300">{a.name}</div>
                <span className="pill-positive tabular-nums">+{formatPercent(a.pnlPercent)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Top Losers" />
          <div className="space-y-2">
            {summary.topLosers.filter((a: import("@/types").AssetWithPL) => a.pnl < 0).map((a: import("@/types").AssetWithPL) => (
              <div key={a.id} className="flex items-center justify-between">
                <div className="text-sm text-gray-300">{a.name}</div>
                <span className="pill-negative tabular-nums">{formatPercent(a.pnlPercent)}</span>
              </div>
            ))}
            {summary.topLosers.filter((a: import("@/types").AssetWithPL) => a.pnl < 0).length === 0 && (
              <div className="text-xs text-gray-500 py-4 text-center">No losing positions 🎉</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
