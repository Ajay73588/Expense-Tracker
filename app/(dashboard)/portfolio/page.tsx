import { getCurrentUserId } from "@/lib/auth";
import { PortfolioService } from "@/services/portfolio.service";
import { AssetService } from "@/services/asset.service";
import { Card, CardHeader, StatCard } from "@/components/cards/Card";
import { AllocationPie } from "@/components/charts/Charts";
import { formatINR, formatPercent } from "@/utils/format";
import Link from "next/link";
import { cn } from "@/utils/cn";
import type { PortfolioAllocation, RebalancePlan } from "@/types";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  STOCK: "bg-brand-600/20 text-brand-300",
  MUTUAL_FUND: "bg-green-600/20 text-green-300",
  CRYPTO: "bg-yellow-600/20 text-yellow-300",
  REAL_ESTATE: "bg-purple-600/20 text-purple-300",
  CASH: "bg-gray-600/20 text-gray-300",
};

export default async function PortfolioPage() {
  const userId = await getCurrentUserId();
  const [assets, allocation, riskScore, summary, rebalance, targets] = await Promise.all([
    AssetService.getPortfolioWithPL(userId),
    PortfolioService.getAllocation(userId),
    PortfolioService.getRiskScore(userId),
    PortfolioService.getPortfolioSummary(userId),
    PortfolioService.getRebalancePlan(userId),
    PortfolioService.getAllocationTargets(userId), // ← service layer, NOT direct prisma call
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Asset holdings, P&amp;L, and allocation analysis.</p>
        </div>
        <Link href="/import" className="btn-secondary text-sm">↥ Import CSV</Link>
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
                    style={{ background: ["#2b73ff","#22c55e","#f59e0b","#a855f7","#06b6d4"][i % 5] }}
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
          <CardHeader title="Rebalance Plan" subtitle={targets.length ? `vs your ${targets.length} targets` : "Set targets to enable"} />
          {rebalance.length > 0 ? (
            <div className="space-y-2">
              {rebalance.map((r: RebalancePlan) => (
                <div key={r.assetType} className="flex items-center justify-between p-3 bg-bg-hover/40 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-200">{r.assetType.replace("_", " ")}</div>
                    <div className="text-xs text-gray-500">
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
            </div>
          ) : (
            <div className="text-sm text-gray-500 p-4 text-center">
              No allocation targets set. All assets are within threshold.
            </div>
          )}
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader title="All Holdings" subtitle={`${assets.length} positions`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                <th className="text-left pb-2 pr-4 font-medium">Name</th>
                <th className="text-left pb-2 pr-4 font-medium">Type</th>
                <th className="text-right pb-2 pr-4 font-medium">Qty</th>
                <th className="text-right pb-2 pr-4 font-medium">Avg Cost</th>
                <th className="text-right pb-2 pr-4 font-medium">CMP</th>
                <th className="text-right pb-2 pr-4 font-medium">Value</th>
                <th className="text-right pb-2 font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a: import("@/types").AssetWithPL) => (
                <tr key={a.id} className="border-b border-bg-border/40 hover:bg-bg-hover/30 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="font-medium text-gray-200">{a.name}</div>
                    {a.symbol && <div className="text-[10px] text-gray-500">{a.symbol}</div>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={cn("pill text-[10px]", TYPE_COLORS[a.type] ?? "bg-bg-hover text-gray-400")}>
                      {a.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-300 tabular-nums">
                    {a.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">
                    {formatINR(a.avgBuyPrice, { compact: true })}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-200 tabular-nums">
                    {formatINR(a.currentPrice, { compact: true })}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium text-gray-100 tabular-nums">
                    {formatINR(a.currentValue, { compact: true })}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <div className={a.pnl >= 0 ? "text-positive" : "text-negative"}>
                      {a.pnl >= 0 ? "+" : ""}{formatINR(a.pnl, { compact: true })}
                    </div>
                    <div className={cn("text-[10px]", a.pnlPercent >= 0 ? "text-positive/70" : "text-negative/70")}>
                      {a.pnlPercent >= 0 ? "+" : ""}{formatPercent(a.pnlPercent)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
