import { Prisma } from "@prisma/client";
import type { AssetType } from "../../types";

export type RebalanceMode = "CASH_ONLY" | "ALLOW_SELLS";

export interface RebalanceTargetInput {
  assetType: AssetType;
  targetPercent: number; // e.g. 50 for 50%
}

export interface RebalanceHoldingInput {
  id?: string;
  type: AssetType;
  name?: string;
  currentValue: number | Prisma.Decimal;
  valuationStatus?: "OK" | "FX_UNAVAILABLE" | "NO_MARKET_PRICE" | string;
  detailedValuationStatus?: "LIVE" | "STATEMENT" | "MANUAL" | "COST_BASIS" | "STALE" | "FX_UNAVAILABLE" | string;
  currency?: string;
}

export interface RebalanceOptions {
  mode?: RebalanceMode;
  newCash?: number;
  driftThreshold?: number; // drift band in percentage points (default 5.0)
  minTradeSize?: number;   // minimum trade in INR (default 0)
  excludedAssetIds?: string[];
  excludedAssetTypes?: (AssetType | string)[];
}

export interface RebalanceItem {
  assetType: AssetType;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  action: "BUY" | "SELL" | "HOLD";
  suggestedAmount: number;
}

export interface RebalanceResult {
  ok: boolean;
  error?: "TARGETS_INVALID" | "EMPTY_PORTFOLIO" | string;
  message?: string;
  totalEligibleValue: number;
  totalRebalanceValue: number;
  newCash: number;
  residualCash: number;
  mode: RebalanceMode;
  driftThreshold: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  warnings: string[];
  assumptions: string[];
  items: RebalanceItem[];
}

const DEFAULT_ASSUMPTIONS = [
  "Taxes (STCG/LTCG), exit loads, brokerage fees, and transaction charges are not modeled.",
  "Lot constraints, minimum order quantities, and lock-in periods (e.g., ELSS, PPF) are not modeled.",
  "Rebalancing recommendations are strictly informational and deterministic; verify market conditions and tax implications before executing trades.",
];

/**
 * Pure deterministic portfolio rebalancing algorithm per Master Architecture §13.9.
 *
 * Inputs:
 * - eligible holdings with valuation status
 * - targets (sum = 100% ±0.01 else error TARGETS_INVALID)
 * - optional new cash
 * - mode (CASH_ONLY default | ALLOW_SELLS)
 * - drift band (default 5 pp, configurable)
 * - min trade size (default 0)
 * - excluded assets
 */
export function calculateRebalancePlan(
  holdings: RebalanceHoldingInput[],
  targets: RebalanceTargetInput[],
  options: RebalanceOptions = {}
): RebalanceResult {
  const mode: RebalanceMode = options.mode ?? "CASH_ONLY";
  const driftThreshold = typeof options.driftThreshold === "number" && !isNaN(options.driftThreshold) && options.driftThreshold >= 0
    ? options.driftThreshold
    : 5;
  const newCash = typeof options.newCash === "number" && !isNaN(options.newCash) && options.newCash > 0
    ? options.newCash
    : 0;
  const minTradeSize = typeof options.minTradeSize === "number" && !isNaN(options.minTradeSize) && options.minTradeSize > 0
    ? options.minTradeSize
    : 0;
  const excludedIds = new Set(options.excludedAssetIds ?? []);
  const excludedTypes = new Set(options.excludedAssetTypes ?? []);

  const warnings: string[] = [];
  const assumptions = [...DEFAULT_ASSUMPTIONS];

  // 1. Validate targets
  if (targets.length === 0) {
    return {
      ok: true,
      totalEligibleValue: 0,
      totalRebalanceValue: newCash,
      newCash,
      residualCash: newCash,
      mode,
      driftThreshold,
      confidence: "HIGH",
      warnings: ["No allocation targets set. Add allocation targets to generate a rebalancing plan."],
      assumptions,
      items: [],
    };
  }

  const targetSum = targets.reduce((sum, t) => sum + (Number(t.targetPercent) || 0), 0);
  if (Math.abs(targetSum - 100) > 0.01) {
    return {
      ok: false,
      error: "TARGETS_INVALID",
      message: `Target allocations must sum to 100% ±0.01% (current sum: ${targetSum.toFixed(2)}%).`,
      totalEligibleValue: 0,
      totalRebalanceValue: 0,
      newCash,
      residualCash: newCash,
      mode,
      driftThreshold,
      confidence: "LOW",
      warnings: [`Target allocations sum to ${targetSum.toFixed(2)}%, expected 100%.`],
      assumptions,
      items: [],
    };
  }

  // 2. Filter eligible holdings & flag valuation confidence
  let costBasisOrStaleValue = new Prisma.Decimal(0);
  let fxUnavailableCount = 0;
  const byClass = new Map<AssetType, Prisma.Decimal>();

  for (const h of holdings) {
    if (h.id && excludedIds.has(h.id)) continue;
    if (excludedTypes.has(h.type)) continue;

    // FX_UNAVAILABLE exclusion
    if (h.valuationStatus === "FX_UNAVAILABLE" || h.detailedValuationStatus === "FX_UNAVAILABLE") {
      fxUnavailableCount++;
      warnings.push(`Asset "${h.name || h.type}" excluded: foreign exchange rate unavailable.`);
      continue;
    }

    const val = new Prisma.Decimal(h.currentValue ?? 0);
    if (val.lt(0)) continue;

    // Check cost basis / stale flags
    if (
      h.valuationStatus === "NO_MARKET_PRICE" ||
      h.detailedValuationStatus === "COST_BASIS" ||
      h.detailedValuationStatus === "STALE"
    ) {
      costBasisOrStaleValue = costBasisOrStaleValue.plus(val);
    }

    const cur = byClass.get(h.type) ?? new Prisma.Decimal(0);
    byClass.set(h.type, cur.plus(val));
  }

  // Calculate total eligible value
  let totalEligibleDec = new Prisma.Decimal(0);
  for (const val of byClass.values()) {
    totalEligibleDec = totalEligibleDec.plus(val);
  }

  const totalEligibleValue = totalEligibleDec.toNumber();
  const totalRebalanceDec = totalEligibleDec.plus(new Prisma.Decimal(newCash));
  const totalRebalanceValue = totalRebalanceDec.toNumber();

  // Determine valuation confidence
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  if (totalEligibleValue > 0 && costBasisOrStaleValue.gt(0)) {
    const staleRatio = costBasisOrStaleValue.dividedBy(totalEligibleDec).toNumber();
    if (staleRatio > 0.5) {
      confidence = "LOW";
      warnings.push("Over 50% of eligible assets are valued at cost basis or stale price, significantly reducing confidence.");
    } else {
      confidence = "MEDIUM";
      warnings.push("Some eligible assets are valued at cost basis or stale price, reducing rebalancing confidence.");
    }
  } else if (fxUnavailableCount > 0) {
    confidence = "MEDIUM";
  }

  // 3. Handle empty portfolio with zero cash
  if (totalRebalanceValue === 0) {
    return {
      ok: true,
      totalEligibleValue: 0,
      totalRebalanceValue: 0,
      newCash,
      residualCash: 0,
      mode,
      driftThreshold,
      confidence,
      warnings: ["No eligible asset holdings or cash available to rebalance."],
      assumptions,
      items: targets.map((t) => ({
        assetType: t.assetType,
        currentValue: 0,
        currentPct: 0,
        targetPct: Number(t.targetPercent),
        driftPct: -Number(t.targetPercent),
        action: "HOLD",
        suggestedAmount: 0,
      })),
    };
  }

  // 4. Compute per-class drift and preliminary deltas
  interface ClassDraft {
    assetType: AssetType;
    currentValue: Prisma.Decimal;
    currentPct: number;
    targetPct: number;
    driftPct: number;
    absDrift: number;
    targetValue: Prisma.Decimal;
    delta: Prisma.Decimal; // targetValue - currentValue
    action: "BUY" | "SELL" | "HOLD";
    suggestedAmount: Prisma.Decimal;
  }

  const drafts: ClassDraft[] = [];
  const targetMap = new Map<AssetType, number>(targets.map((t) => [t.assetType, Number(t.targetPercent)]));

  for (const [assetType, targetPct] of targetMap.entries()) {
    const curVal = byClass.get(assetType) ?? new Prisma.Decimal(0);
    const curPct = totalEligibleValue > 0
      ? curVal.dividedBy(totalEligibleDec).times(100).toNumber()
      : 0;
    const driftPct = curPct - targetPct;
    const absDrift = Math.abs(driftPct);
    const targetVal = totalRebalanceDec.times(new Prisma.Decimal(targetPct)).dividedBy(100);
    const delta = targetVal.minus(curVal);

    drafts.push({
      assetType,
      currentValue: curVal,
      currentPct: curPct,
      targetPct,
      driftPct,
      absDrift,
      targetValue: targetVal,
      delta,
      action: "HOLD",
      suggestedAmount: new Prisma.Decimal(0),
    });
  }

  let residualCashDec = new Prisma.Decimal(newCash);

  // 5. Apply rebalancing mode logic
  if (mode === "CASH_ONLY") {
    // Sells are strictly prohibited.
    // Only classes that are underweight beyond the drift band qualify for buying with cash.
    const eligibleUnderweight = drafts.filter(
      (d) => d.driftPct <= -driftThreshold && d.delta.gt(0)
    );

    if (newCash > 0 && eligibleUnderweight.length > 0) {
      let totalUnderweightDelta = new Prisma.Decimal(0);
      for (const d of eligibleUnderweight) {
        totalUnderweightDelta = totalUnderweightDelta.plus(d.delta);
      }

      let allocatedSum = new Prisma.Decimal(0);

      if (totalUnderweightDelta.lte(newCash)) {
        // Cash is sufficient to satisfy all qualifying underweight classes
        for (const d of eligibleUnderweight) {
          let amt = d.delta;
          if (amt.gte(minTradeSize)) {
            d.action = "BUY";
            d.suggestedAmount = amt;
            allocatedSum = allocatedSum.plus(amt);
          } else {
            d.action = "HOLD";
            d.suggestedAmount = new Prisma.Decimal(0);
          }
        }
      } else {
        // Scale proportionally to available cash: suggested_i = newCash * (delta_i / totalUnderweightDelta)
        const newCashDec = new Prisma.Decimal(newCash);
        for (const d of eligibleUnderweight) {
          let amt = newCashDec.times(d.delta).dividedBy(totalUnderweightDelta);
          // Round to 2 decimal places
          amt = new Prisma.Decimal(amt.toFixed(2));
          if (amt.gte(minTradeSize)) {
            d.action = "BUY";
            d.suggestedAmount = amt;
            allocatedSum = allocatedSum.plus(amt);
          } else {
            d.action = "HOLD";
            d.suggestedAmount = new Prisma.Decimal(0);
          }
        }
      }

      residualCashDec = new Prisma.Decimal(newCash).minus(allocatedSum);
      if (residualCashDec.lt(0)) {
        residualCashDec = new Prisma.Decimal(0);
      }
    } else {
      // Zero cash or all underweight within band
      for (const d of drafts) {
        d.action = "HOLD";
        d.suggestedAmount = new Prisma.Decimal(0);
      }
    }
  } else {
    // ALLOW_SELLS mode
    // Overweight beyond drift band -> SELL (|delta|)
    // Underweight beyond drift band -> BUY (delta)
    // Within drift band -> HOLD
    for (const d of drafts) {
      if (d.absDrift < driftThreshold) {
        d.action = "HOLD";
        d.suggestedAmount = new Prisma.Decimal(0);
        continue;
      }

      if (d.delta.gt(0)) {
        // Underweight
        const amt = d.delta;
        if (amt.gte(minTradeSize)) {
          d.action = "BUY";
          d.suggestedAmount = amt;
        } else {
          d.action = "HOLD";
          d.suggestedAmount = new Prisma.Decimal(0);
        }
      } else if (d.delta.lt(0)) {
        // Overweight
        const amt = d.delta.abs();
        if (amt.gte(minTradeSize)) {
          d.action = "SELL";
          d.suggestedAmount = amt;
        } else {
          d.action = "HOLD";
          d.suggestedAmount = new Prisma.Decimal(0);
        }
      } else {
        d.action = "HOLD";
        d.suggestedAmount = new Prisma.Decimal(0);
      }
    }

    // In ALLOW_SELLS mode, net cash required = totalBuys - totalSells
    let totalBuys = new Prisma.Decimal(0);
    let totalSells = new Prisma.Decimal(0);
    for (const d of drafts) {
      if (d.action === "BUY") totalBuys = totalBuys.plus(d.suggestedAmount);
      if (d.action === "SELL") totalSells = totalSells.plus(d.suggestedAmount);
    }
    const netCashOutflow = totalBuys.minus(totalSells);
    residualCashDec = new Prisma.Decimal(newCash).minus(netCashOutflow);
    if (residualCashDec.lt(0)) residualCashDec = new Prisma.Decimal(0);
  }

  const items: RebalanceItem[] = drafts.map((d) => ({
    assetType: d.assetType,
    currentValue: d.currentValue.toNumber(),
    currentPct: Math.round(d.currentPct * 100) / 100,
    targetPct: Math.round(d.targetPct * 100) / 100,
    driftPct: Math.round(d.driftPct * 100) / 100,
    action: d.action,
    suggestedAmount: Math.round(d.suggestedAmount.toNumber() * 100) / 100,
  }));

  return {
    ok: true,
    totalEligibleValue,
    totalRebalanceValue,
    newCash,
    residualCash: Math.round(residualCashDec.toNumber() * 100) / 100,
    mode,
    driftThreshold,
    confidence,
    warnings,
    assumptions,
    items,
  };
}
