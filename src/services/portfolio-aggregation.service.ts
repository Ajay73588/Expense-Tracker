import type { AssetWithPL, AggregatedAsset, AssetType } from "../types";

/**
 * Normalizes stock / crypto tickers:
 * Uppercases, strips spaces, dots, hyphens (e.g. "brk.b" -> "BRKB", "BRK-B" -> "BRKB").
 */
export function normalizeTicker(sym: string | null | undefined): string | null {
  if (!sym) return null;
  const s = sym.toUpperCase().replace(/[\s.\-]+/g, "").trim();
  return s === "" ? null : s;
}

/**
 * Normalizes mutual fund scheme names for aggregation:
 * - Uppercases and cleans punctuation.
 * - Removes noise words ("FUND", "PLAN", "OPTION", "SCHEME").
 * - Normalizes compounded categories ("MIDCAP" -> "MID CAP", "SMALLCAP" -> "SMALL CAP").
 * - Preserves crucial plan/option distinctions ("DIRECT", "REGULAR", "GROWTH", "IDCW").
 */
export function normalizeSchemeKey(name?: string | null): string {
  if (!name || typeof name !== "string") return "";
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\bMIDCAP\b/g, "MID CAP")
    .replace(/\bSMALLCAP\b/g, "SMALL CAP")
    .replace(/\bLARGECAP\b/g, "LARGE CAP")
    .replace(/\bFLEXICAP\b/g, "FLEXI CAP")
    .replace(/\bMULTICAP\b/g, "MULTI CAP")
    .replace(/\b(FUND|FUNDS|PLAN|OPTION|SCHEME|THE|OF)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Produces a stable, category-aware grouping key for an asset.
 *
 * Rules:
 * - STOCK: Group by ISIN if available; else by Currency + Exchange + Normalized Ticker.
 *   Stocks with identical tickers on different exchanges (e.g. INFY NSE vs NYSE) remain separate.
 * - MUTUAL_FUND: Group by ISIN if available; else by Normalized Scheme Name.
 *   Preserves Direct/Regular and Growth/IDCW distinctions while unifying multiple folios.
 * - CRYPTO: Group by Currency + Exchange + Normalized Symbol.
 * - GOLD: Group by Normalized Symbol if it's an ETF/security; manual physical gold stays distinct.
 * - FIXED_DEPOSIT, REAL_ESTATE, EPF_PPF, CASH: Distinct individual assets (keyed by ID)
 *   so different properties, fixed deposits, or bank accounts are never merged.
 */
export function getAssetGroupKey(a: AssetWithPL): string {
  switch (a.type) {
    case "STOCK": {
      if (a.isin && a.isin.trim().length > 0) {
        return `STOCK:ISIN:${a.isin.toUpperCase().trim()}`;
      }
      const ccy = (a.currency || "INR").toUpperCase().trim();
      const ex = (a.exchange || "").toUpperCase().trim();
      const normalizedName = normalizeSchemeKey(a.name);
      const sym = normalizeTicker(a.symbol) ?? (normalizedName.length > 0 ? normalizedName : a.id);
      return `STOCK:SYM:${ccy}:${ex}:${sym}`;
    }

    case "MUTUAL_FUND": {
      if (a.isin && a.isin.trim().length > 0) {
        return `MUTUAL_FUND:ISIN:${a.isin.toUpperCase().trim()}`;
      }
      const normalized = normalizeSchemeKey(a.name);
      return `MUTUAL_FUND:SCHEME:${normalized.length > 0 ? normalized : a.id}`;
    }

    case "CRYPTO": {
      const ccy = (a.currency || "USD").toUpperCase().trim();
      const ex = (a.exchange || "").toUpperCase().trim();
      const normalizedName = normalizeSchemeKey(a.name);
      const sym = normalizeTicker(a.symbol) ?? (normalizedName.length > 0 ? normalizedName : a.id);
      return `CRYPTO:${ccy}:${ex}:${sym}`;
    }

    case "GOLD": {
      if (a.symbol && a.symbol.trim().length > 0) {
        const ccy = (a.currency || "INR").toUpperCase().trim();
        const sym = normalizeTicker(a.symbol);
        return `GOLD:SYM:${ccy}:${sym}`;
      }
      return `GOLD:ID:${a.id}`;
    }

    case "FIXED_DEPOSIT":
    case "EPF_PPF":
    case "REAL_ESTATE":
    case "CASH":
    default:
      return `${a.type}:ID:${a.id}`;
  }
}

/**
 * Aggregates a list of AssetWithPL holdings into unified instrument groups.
 *
 * Underlying records are completely preserved in `group.holdings`.
 * Financial calculations:
 * - quantity = sum of underlying quantities
 * - invested = sum of underlying invested values in reporting currency (INR)
 * - currentValue = sum of valid converted current values in reporting currency (INR)
 * - pnl = currentValue - invested
 * - pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0
 * - avgBuyPrice = weighted average cost (investedNative / quantity)
 * - currentPrice = effective market price (currentValueNative / quantity)
 */
export function aggregatePortfolioAssets(assets: AssetWithPL[]): AggregatedAsset[] {
  const groupsMap = new Map<string, AssetWithPL[]>();

  for (const a of assets) {
    const key = getAssetGroupKey(a);
    const existing = groupsMap.get(key);
    if (existing) {
      existing.push(a);
    } else {
      groupsMap.set(key, [a]);
    }
  }

  const result: AggregatedAsset[] = [];

  for (const [groupKey, items] of groupsMap.entries()) {
    const primary = items[0];
    const type: AssetType = primary.type;

    // Sum reporting currency values (INR)
    let totalQty = 0;
    let totalInvestedInr = 0;
    let totalCurrentValueInr = 0;

    // Check if all children share the same native currency
    const sameCurrency = items.every((i) => i.currency === primary.currency);
    const currency = sameCurrency ? primary.currency : "INR";

    let totalInvestedNative = 0;
    let totalCurrentValueNative = 0;

    for (const item of items) {
      totalQty += item.quantity;
      totalInvestedInr += item.invested;
      totalCurrentValueInr += item.currentValue;

      if (sameCurrency) {
        totalInvestedNative += item.investedNative ?? item.quantity * item.avgBuyPrice;
        totalCurrentValueNative += item.currentValueNative ?? item.quantity * item.currentPrice;
      }
    }

    if (!sameCurrency) {
      totalInvestedNative = totalInvestedInr;
      totalCurrentValueNative = totalCurrentValueInr;
    }

    const totalPnlInr = totalCurrentValueInr - totalInvestedInr;
    const pnlPercent = totalInvestedInr > 0 ? (totalPnlInr / totalInvestedInr) * 100 : 0;
    const totalPnlNative = totalCurrentValueNative - totalInvestedNative;

    // Weighted average cost and effective current price
    const avgBuyPrice = totalQty > 0 ? totalInvestedNative / totalQty : 0;
    const currentPrice = totalQty > 0 ? totalCurrentValueNative / totalQty : 0;

    // Roll up valuation statuses
    let valuationStatus: AggregatedAsset["valuationStatus"] = "OK";
    if (items.some((i) => i.valuationStatus === "FX_UNAVAILABLE")) {
      valuationStatus = "FX_UNAVAILABLE";
    } else if (items.every((i) => i.valuationStatus === "NO_MARKET_PRICE")) {
      valuationStatus = "NO_MARKET_PRICE";
    }

    let detailedValuationStatus: AggregatedAsset["detailedValuationStatus"] = "MANUAL";
    if (items.some((i) => i.detailedValuationStatus === "FX_UNAVAILABLE")) {
      detailedValuationStatus = "FX_UNAVAILABLE";
    } else if (items.some((i) => i.detailedValuationStatus === "STALE")) {
      detailedValuationStatus = "STALE";
    } else if (items.some((i) => i.detailedValuationStatus === "LIVE")) {
      detailedValuationStatus = "LIVE";
    } else if (items.some((i) => i.detailedValuationStatus === "STATEMENT")) {
      detailedValuationStatus = "STATEMENT";
    } else if (items.every((i) => i.detailedValuationStatus === "COST_BASIS")) {
      detailedValuationStatus = "COST_BASIS";
    } else {
      detailedValuationStatus = "MANUAL";
    }

    // Latest price updated timestamp
    let latestUpdated: string | null = null;
    for (const i of items) {
      if (i.priceUpdatedAt) {
        if (!latestUpdated || new Date(i.priceUpdatedAt) > new Date(latestUpdated)) {
          latestUpdated = i.priceUpdatedAt;
        }
      }
    }

    // Unique price sources
    const priceSources = Array.from(new Set(items.map((i) => i.priceSource).filter(Boolean)));
    const priceSource = priceSources.length === 1 ? priceSources[0]! : priceSources.join(", ") || null;

    // Distinct accounts, folios, and brokers
    const accounts = Array.from(new Set(items.map((i) => i.account).filter((x): x is string => Boolean(x))));
    const folios = Array.from(new Set(items.map((i) => i.folio).filter((x): x is string => Boolean(x))));
    const brokers = Array.from(
      new Set(
        items
          .map((i) => i.importSource ?? (i.account ? i.account : null))
          .filter((x): x is string => Boolean(x))
      )
    );

    result.push({
      groupKey,
      type,
      name: primary.name ?? primary.symbol ?? "Unnamed Asset",
      symbol: primary.symbol ?? null,
      isin: primary.isin ?? null,
      exchange: primary.exchange ?? null,
      currency,
      quantity: totalQty,
      avgBuyPrice,
      currentPrice,
      invested: totalInvestedInr,
      currentValue: totalCurrentValueInr,
      pnl: totalPnlInr,
      pnlPercent,
      investedNative: totalInvestedNative,
      currentValueNative: totalCurrentValueNative,
      pnlNative: totalPnlNative,
      fxRateToInr: sameCurrency ? primary.fxRateToInr : 1,
      valuationStatus,
      detailedValuationStatus,
      priceSource,
      priceUpdatedAt: latestUpdated,
      holdingsCount: items.length,
      uniqueAccountsCount: accounts.length,
      uniqueFoliosCount: folios.length,
      accounts,
      folios,
      brokers,
      holdings: items,
    });
  }

  return result;
}
