"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetWithPL, AggregatedAsset } from "@/types";
import { formatINR, formatPercent } from "@/utils/format";
import { cn } from "@/utils/cn";
import { aggregatePortfolioAssets } from "@/services/portfolio-aggregation.service";
import { AssetModal } from "./AssetModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

export const TYPE_COLORS: Record<string, string> = {
  STOCK: "bg-brand-600/20 text-brand-300",
  MUTUAL_FUND: "bg-green-600/20 text-green-300",
  CRYPTO: "bg-yellow-600/20 text-yellow-300",
  REAL_ESTATE: "bg-purple-600/20 text-purple-300",
  CASH: "bg-gray-600/20 text-gray-300",
  GOLD: "bg-amber-500/20 text-amber-300",
  FIXED_DEPOSIT: "bg-blue-600/20 text-blue-300",
  EPF_PPF: "bg-emerald-600/20 text-emerald-300",
};

interface HoldingsTableProps {
  assets: AssetWithPL[];
}

export function HoldingsTable({ assets }: HoldingsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grouped" | "individual">("grouped");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [editingAsset, setEditingAsset] = useState<AssetWithPL | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<AssetWithPL | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);

  function handleDataChanged(msg?: string) {
    if (msg) {
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 4000);
    }
    router.refresh();
  }

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Pre-calculate aggregated investment rows
  const aggregated = useMemo(() => aggregatePortfolioAssets(assets), [assets]);

  // Grouped search and filtering
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aggregated.filter((g) => {
      const matchesType = filterType === "ALL" || g.type === filterType;
      if (!matchesType) return false;
      if (!q) return true;

      const matchesName = g.name.toLowerCase().includes(q);
      const matchesSymbol = g.symbol ? g.symbol.toLowerCase().includes(q) : false;
      const matchesIsin = g.isin ? g.isin.toLowerCase().includes(q) : false;
      const matchesChildren = g.holdings.some(
        (h) =>
          (h.account && h.account.toLowerCase().includes(q)) ||
          (h.folio && h.folio.toLowerCase().includes(q)) ||
          (h.symbol && h.symbol.toLowerCase().includes(q)) ||
          h.name.toLowerCase().includes(q)
      );
      return matchesName || matchesSymbol || matchesIsin || matchesChildren;
    });
  }, [aggregated, search, filterType]);

  // Individual lots search and filtering
  const filteredIndividuals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesType = filterType === "ALL" || a.type === filterType;
      if (!matchesType) return false;
      if (!q) return true;

      const matchesName = a.name.toLowerCase().includes(q);
      const matchesSymbol = a.symbol ? a.symbol.toLowerCase().includes(q) : false;
      const matchesAccount = a.account ? a.account.toLowerCase().includes(q) : false;
      const matchesFolio = a.folio ? a.folio.toLowerCase().includes(q) : false;
      return matchesName || matchesSymbol || matchesAccount || matchesFolio;
    });
  }, [assets, search, filterType]);

  return (
    <div className="space-y-4">
      {/* Feedback Notification */}
      {feedback && (
        <div className="p-3 bg-positive/15 border border-positive/30 rounded-lg text-xs text-positive flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-positive/70 hover:text-positive text-sm leading-none"
            aria-label="Dismiss feedback"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <input
            type="text"
            placeholder="Search investments by name, ticker, folio, or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-xs py-1.5 flex-1"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input text-xs py-1.5 w-36 bg-bg-card"
          >
            <option value="ALL">All Types</option>
            <option value="STOCK">Stock</option>
            <option value="MUTUAL_FUND">Mutual Fund</option>
            <option value="FIXED_DEPOSIT">Fixed Deposit</option>
            <option value="EPF_PPF">EPF / PPF</option>
            <option value="REAL_ESTATE">Real Estate</option>
            <option value="GOLD">Gold</option>
            <option value="CRYPTO">Crypto</option>
            <option value="CASH">Cash</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-bg-border bg-bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium",
                viewMode === "grouped"
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              Grouped ({aggregated.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("individual")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors font-medium",
                viewMode === "individual"
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              All Lots ({assets.length})
            </button>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
              <th className="text-left pb-2 pr-4 font-medium">Investment</th>
              <th className="text-left pb-2 pr-4 font-medium">Type</th>
              <th className="text-right pb-2 pr-4 font-medium">Qty</th>
              <th className="text-right pb-2 pr-4 font-medium">Avg Cost</th>
              <th className="text-right pb-2 pr-4 font-medium">CMP</th>
              <th className="text-left pb-2 pr-4 font-medium hidden md:table-cell">Valuation</th>
              <th className="text-right pb-2 pr-4 font-medium">Value</th>
              <th className="text-right pb-2 pr-4 font-medium">P&amp;L</th>
              <th className="text-right pb-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === "grouped" ? (
              filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-gray-500">
                    {assets.length === 0
                      ? "No assets added yet. Click \"+ Add Asset\" or import a broker statement to get started."
                      : "No investments match your search criteria."}
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => {
                  const isExpanded = expandedKeys.has(g.groupKey);
                  const isMulti = g.holdingsCount > 1;

                  return (
                    <React.Fragment key={g.groupKey}>
                      {/* Aggregated parent row */}
                      <tr
                        className={cn(
                          "border-b border-bg-border/40 hover:bg-bg-hover/30 transition-colors",
                          isExpanded && "bg-bg-hover/20"
                        )}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-start gap-2">
                            {isMulti ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(g.groupKey)}
                                className="mt-0.5 p-1 rounded hover:bg-white/10 text-brand-400 hover:text-white transition-colors"
                                title={isExpanded ? "Collapse tranches" : "Expand tranches"}
                              >
                                <span className="inline-block transform transition-transform text-[10px]">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              </button>
                            ) : (
                              <span className="w-4 inline-block" />
                            )}
                            <div>
                              <div className="font-medium text-gray-200 flex items-center gap-1.5 flex-wrap">
                                <span>{g.name}</span>
                                {isMulti && (
                                  <span className="pill text-[9px] bg-brand-500/15 text-brand-300 font-mono">
                                    {g.type === "MUTUAL_FUND" && g.uniqueFoliosCount > 0
                                      ? `${g.uniqueFoliosCount} ${g.uniqueFoliosCount === 1 ? "folio" : "folios"}`
                                      : `${g.holdingsCount} holdings`}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                                {g.symbol && <span>{g.symbol}</span>}
                                {g.symbol && (g.isin || g.accounts.length > 0) && <span>•</span>}
                                {g.isin && <span className="font-mono">{g.isin}</span>}
                                {g.isin && g.accounts.length > 0 && <span>•</span>}
                                {g.accounts.length === 1 ? (
                                  <span>{g.accounts[0]}</span>
                                ) : g.accounts.length > 1 ? (
                                  <span>{g.accounts.length} accounts ({g.accounts.join(", ")})</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={cn(
                              "pill text-[10px]",
                              TYPE_COLORS[g.type] ?? "bg-bg-hover text-gray-400"
                            )}
                          >
                            {g.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-300 tabular-nums">
                          {g.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">
                          {g.currency !== "INR" && (
                            <span className="text-[10px] text-gray-500 block">
                              {g.currency} {g.avgBuyPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                          )}
                          {formatINR(
                            g.avgBuyPrice * (g.currency === "INR" ? 1 : (g.fxRateToInr ?? 0)),
                            { compact: true }
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-200 tabular-nums">
                          {g.currency !== "INR" && (
                            <span className="text-[10px] text-gray-500 block">
                              {g.currency} {g.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                          )}
                          {formatINR(
                            g.currentPrice * (g.currency === "INR" ? 1 : (g.fxRateToInr ?? 0)),
                            { compact: true }
                          )}
                        </td>
                        <td className="py-2.5 pr-4 hidden md:table-cell">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={cn(
                                "pill text-[9px] w-fit font-medium",
                                g.detailedValuationStatus === "LIVE" && "bg-positive/20 text-positive",
                                g.detailedValuationStatus === "STATEMENT" && "bg-blue-500/20 text-blue-300",
                                g.detailedValuationStatus === "MANUAL" && "bg-bg-hover text-gray-300",
                                g.detailedValuationStatus === "COST_BASIS" && "bg-warning/20 text-warning",
                                g.detailedValuationStatus === "STALE" && "bg-orange-500/20 text-orange-300",
                                g.detailedValuationStatus === "FX_UNAVAILABLE" && "bg-negative/20 text-negative"
                              )}
                            >
                              {g.detailedValuationStatus.replace("_", " ")}
                            </span>
                            {g.priceUpdatedAt && (
                              <span className="text-[9px] text-gray-500">
                                {new Date(g.priceUpdatedAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium text-gray-100 tabular-nums">
                          {g.valuationStatus === "FX_UNAVAILABLE" ? (
                            <span className="text-negative text-xs">FX n/a</span>
                          ) : (
                            formatINR(g.currentValue, { compact: true })
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          <div className={g.pnl >= 0 ? "text-positive" : "text-negative"}>
                            {g.pnl >= 0 ? "+" : ""}
                            {formatINR(g.pnl, { compact: true })}
                          </div>
                          <div
                            className={cn(
                              "text-[10px]",
                              g.pnlPercent >= 0 ? "text-positive/70" : "text-negative/70"
                            )}
                          >
                            {g.pnlPercent >= 0 ? "+" : ""}
                            {formatPercent(g.pnlPercent)}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isMulti ? (
                              <button
                                onClick={() => toggleExpand(g.groupKey)}
                                className="btn-ghost text-xs px-2 py-1 text-brand-300 hover:text-white"
                              >
                                {isExpanded ? "Collapse" : `Details (${g.holdingsCount})`}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingAsset(g.holdings[0])}
                                  className="btn-ghost text-xs px-2 py-1 hover:text-white"
                                  title="Edit holding"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeletingAsset(g.holdings[0])}
                                  className="btn-ghost text-xs px-2 py-1 text-negative/70 hover:text-negative"
                                  title="Delete holding"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Tranches Details */}
                      {isExpanded &&
                        g.holdings.map((child, idx) => {
                          const childDetailed =
                            child.detailedValuationStatus ??
                            (child.valuationStatus === "FX_UNAVAILABLE"
                              ? "FX_UNAVAILABLE"
                              : child.valuationStatus === "NO_MARKET_PRICE"
                              ? "COST_BASIS"
                              : "MANUAL");

                          return (
                            <tr
                              key={child.id}
                              className="bg-bg-card/60 border-b border-bg-border/20 text-xs hover:bg-bg-hover/20 transition-colors"
                            >
                              <td className="py-2 pl-9 pr-4 border-l-2 border-brand-500/50">
                                <div className="text-gray-300 font-medium flex items-center gap-1.5">
                                  <span>Tranche #{idx + 1}</span>
                                  {child.account && (
                                    <span className="text-[10px] text-gray-400 font-normal">
                                      • Account: {child.account}
                                    </span>
                                  )}
                                  {child.folio && (
                                    <span className="text-[10px] text-gray-400 font-mono font-normal">
                                      • Folio: {child.folio}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  Source: {child.importSource ?? child.account ?? "Manual entry"}
                                </div>
                              </td>
                              <td className="py-2 pr-4 text-gray-500 text-[11px]">
                                {child.type.replace("_", " ")}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                                {child.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-400 tabular-nums">
                                {child.currency !== "INR" && (
                                  <span className="text-[10px] text-gray-500 block">
                                    {child.currency} {child.avgBuyPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                                {formatINR(
                                  child.avgBuyPrice * (child.currency === "INR" ? 1 : (child.fxRateToInr ?? 0)),
                                  { compact: true }
                                )}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                                {child.currency !== "INR" && (
                                  <span className="text-[10px] text-gray-500 block">
                                    {child.currency} {child.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                                {formatINR(
                                  child.currentPrice * (child.currency === "INR" ? 1 : (child.fxRateToInr ?? 0)),
                                  { compact: true }
                                )}
                              </td>
                              <td className="py-2 pr-4 hidden md:table-cell">
                                <span
                                  className={cn(
                                    "pill text-[9px] w-fit font-medium",
                                    childDetailed === "LIVE" && "bg-positive/20 text-positive",
                                    childDetailed === "STATEMENT" && "bg-blue-500/20 text-blue-300",
                                    childDetailed === "MANUAL" && "bg-bg-hover text-gray-300",
                                    childDetailed === "COST_BASIS" && "bg-warning/20 text-warning",
                                    childDetailed === "STALE" && "bg-orange-500/20 text-orange-300",
                                    childDetailed === "FX_UNAVAILABLE" && "bg-negative/20 text-negative"
                                  )}
                                >
                                  {childDetailed.replace("_", " ")}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-right font-medium text-gray-200 tabular-nums">
                                {child.valuationStatus === "FX_UNAVAILABLE" ? (
                                  <span className="text-negative text-xs">FX n/a</span>
                                ) : (
                                  formatINR(child.currentValue, { compact: true })
                                )}
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums">
                                <div className={child.pnl >= 0 ? "text-positive" : "text-negative"}>
                                  {child.pnl >= 0 ? "+" : ""}
                                  {formatINR(child.pnl, { compact: true })}
                                </div>
                                <div
                                  className={cn(
                                    "text-[10px]",
                                    child.pnlPercent >= 0 ? "text-positive/70" : "text-negative/70"
                                  )}
                                >
                                  {child.pnlPercent >= 0 ? "+" : ""}
                                  {formatPercent(child.pnlPercent)}
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingAsset(child)}
                                    className="btn-ghost text-xs px-2 py-0.5 hover:text-white"
                                    title="Edit this tranche"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setDeletingAsset(child)}
                                    className="btn-ghost text-xs px-2 py-0.5 text-negative/70 hover:text-negative"
                                    title="Delete this tranche"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )
            ) : filteredIndividuals.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-gray-500">
                  {assets.length === 0
                    ? "No assets added yet."
                    : "No individual holdings match your search criteria."}
                </td>
              </tr>
            ) : (
              filteredIndividuals.map((a) => {
                const detailedStatus =
                  a.detailedValuationStatus ??
                  (a.valuationStatus === "FX_UNAVAILABLE"
                    ? "FX_UNAVAILABLE"
                    : a.valuationStatus === "NO_MARKET_PRICE"
                    ? "COST_BASIS"
                    : "MANUAL");

                return (
                  <tr
                    key={a.id}
                    className="border-b border-bg-border/40 hover:bg-bg-hover/30 transition-colors"
                  >
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-gray-200">{a.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        {a.symbol && <span>{a.symbol}</span>}
                        {a.symbol && a.account && <span>•</span>}
                        {a.account && <span>{a.account}</span>}
                        {a.folio && <span>• Folio: {a.folio}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={cn(
                          "pill text-[10px]",
                          TYPE_COLORS[a.type] ?? "bg-bg-hover text-gray-400"
                        )}
                      >
                        {a.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-300 tabular-nums">
                      {a.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">
                      {a.currency !== "INR" && (
                        <span className="text-[10px] text-gray-500 block">
                          {a.currency} {a.avgBuyPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {formatINR(
                        a.avgBuyPrice * (a.currency === "INR" ? 1 : (a.fxRateToInr ?? 0)),
                        { compact: true }
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-200 tabular-nums">
                      {a.currency !== "INR" && (
                        <span className="text-[10px] text-gray-500 block">
                          {a.currency} {a.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {formatINR(
                        a.currentPrice * (a.currency === "INR" ? 1 : (a.fxRateToInr ?? 0)),
                        { compact: true }
                      )}
                    </td>
                    <td className="py-2.5 pr-4 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "pill text-[9px] w-fit font-medium",
                            detailedStatus === "LIVE" && "bg-positive/20 text-positive",
                            detailedStatus === "STATEMENT" && "bg-blue-500/20 text-blue-300",
                            detailedStatus === "MANUAL" && "bg-bg-hover text-gray-300",
                            detailedStatus === "COST_BASIS" && "bg-warning/20 text-warning",
                            detailedStatus === "STALE" && "bg-orange-500/20 text-orange-300",
                            detailedStatus === "FX_UNAVAILABLE" && "bg-negative/20 text-negative"
                          )}
                        >
                          {detailedStatus.replace("_", " ")}
                        </span>
                        {a.priceUpdatedAt && (
                          <span className="text-[9px] text-gray-500">
                            {new Date(a.priceUpdatedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium text-gray-100 tabular-nums">
                      {a.valuationStatus === "FX_UNAVAILABLE" ? (
                        <span className="text-negative text-xs">FX n/a</span>
                      ) : (
                        formatINR(a.currentValue, { compact: true })
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <div className={a.pnl >= 0 ? "text-positive" : "text-negative"}>
                        {a.pnl >= 0 ? "+" : ""}
                        {formatINR(a.pnl, { compact: true })}
                      </div>
                      <div
                        className={cn(
                          "text-[10px]",
                          a.pnlPercent >= 0 ? "text-positive/70" : "text-negative/70"
                        )}
                      >
                        {a.pnlPercent >= 0 ? "+" : ""}
                        {formatPercent(a.pnlPercent)}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingAsset(a)}
                          className="btn-ghost text-xs px-2 py-1 hover:text-white"
                          title="Edit holding"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingAsset(a)}
                          className="btn-ghost text-xs px-2 py-1 text-negative/70 hover:text-negative"
                          title="Delete holding"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <AssetModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => handleDataChanged("Asset holding added successfully.")}
      />

      <AssetModal
        isOpen={Boolean(editingAsset)}
        assetToEdit={editingAsset}
        onClose={() => setEditingAsset(null)}
        onSuccess={() => handleDataChanged("Asset holding updated successfully.")}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deletingAsset)}
        asset={deletingAsset}
        onClose={() => setDeletingAsset(null)}
        onSuccess={() => handleDataChanged("Asset holding deleted successfully.")}
      />
    </div>
  );
}
