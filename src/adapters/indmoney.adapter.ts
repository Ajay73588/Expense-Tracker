import type { BrokerAdapter, NormalizedHolding } from "./base.adapter";
import { classifyAssetType } from "../utils/format";
import type { AssetType } from "../types";

/**
 * INDmoney multi-asset export.
 * Expected headers: Asset Name, Asset Type, Units, Buy Price, Current Value
 */
export const INDmoneyAdapter: BrokerAdapter = {
  source: "INDmoney",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    return (
      h.some((x) => x.includes("asset name")) &&
      h.some((x) => x.includes("asset type"))
    );
  },

  parse(rows) {
    const out: NormalizedHolding[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const pick = (pred: (k: string) => boolean) =>
        keys.find((k) => pred(k.toLowerCase().trim()));

      const nameKey = pick((k) => k.includes("asset name")) ?? "Asset Name";
      const typeKey = pick((k) => k.includes("asset type")) ?? "Asset Type";
      const qtyKey = pick((k) => k === "units" || k.includes("quantity")) ?? "Units";
      const avgKey = pick((k) => k.includes("buy")) ?? "Buy Price";

      const name = (row[nameKey] ?? "").trim();
      const rawType = (row[typeKey] ?? "").trim().toUpperCase();
      const qty = parseFloat((row[qtyKey] ?? "0").replace(/,/g, ""));
      const avg = parseFloat((row[avgKey] ?? "0").replace(/[₹,]/g, ""));
      if (!name || !Number.isFinite(qty) || qty <= 0) continue;

      const resolved = classifyAssetType(null, rawType) as AssetType;
      out.push({
        type: resolved,
        name,
        symbol: null,
        quantity: qty,
        avgBuyPrice: avg,
        currency: "INR",
        account: "INDmoney",
        importSource: "INDmoney",
      });
    }
    return out;
  },
};

/**
 * Generic fallback adapter when no broker is matched.
 * Looks for columns matching name/symbol/quantity/price in any naming.
 */
export const GenericAdapter: BrokerAdapter = {
  source: "Generic",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    const hasName = h.some((x) => x.includes("name") || x.includes("instrument") || x === "symbol");
    const hasQty = h.some((x) => x.includes("qty") || x.includes("quantity") || x.includes("units"));
    const hasPrice = h.some((x) => x.includes("price") || x.includes("cost") || x.includes("buy"));
    return hasName && hasQty && hasPrice;
  },

  parse(rows) {
    const out: NormalizedHolding[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const pick = (pred: (k: string) => boolean) =>
        keys.find((k) => pred(k.toLowerCase().trim()));

      const nameKey = pick((k) => k.includes("name") || k === "instrument") ?? keys[0];
      const symKey = pick((k) => k === "symbol");
      const qtyKey =
        pick((k) => k.includes("quantity") || k.includes("qty") || k.includes("units")) ?? "";
      const avgKey = pick((k) => k.includes("price") || k.includes("cost") || k.includes("buy")) ?? "";
      const typeKey = pick((k) => k.includes("type"));

      const name = (row[nameKey] ?? "").trim();
      const symbol = symKey ? (row[symKey] ?? "").trim() : null;
      const qty = parseFloat((row[qtyKey] ?? "0").replace(/,/g, ""));
      const avg = parseFloat((row[avgKey] ?? "0").replace(/[₹,]/g, ""));
      if (!name || !Number.isFinite(qty) || qty <= 0) continue;

      const resolved = classifyAssetType(symbol, typeKey ? row[typeKey] : "") as AssetType;
      out.push({
        type: resolved,
        name,
        symbol: symbol || null,
        quantity: qty,
        avgBuyPrice: avg,
        currency: "INR",
        account: "Manual Import",
        importSource: "Generic",
      });
    }
    return out;
  },
};
