import type { BrokerAdapter, NormalizedHolding } from "./base.adapter";

/**
 * Groww portfolio export.
 * Expected headers (case-insensitive): Stock Name, Symbol, Quantity, Average Price
 * Groww may include additional columns — we only use the ones we need.
 */
export const GrowwAdapter: BrokerAdapter = {
  source: "Groww",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    return (
      h.some((x) => x.includes("stock name") || x === "name") &&
      h.some((x) => x === "symbol" || x === "isin") &&
      h.some((x) => x.includes("quantity") || x === "qty") &&
      h.some((x) => x.includes("average"))
    );
  },

  parse(rows) {
    const out: NormalizedHolding[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const pick = (pred: (k: string) => boolean) =>
        keys.find((k) => pred(k.toLowerCase().trim()));

      const nameKey = pick((k) => k.includes("stock name") || k === "name") ?? "Name";
      const symKey = pick((k) => k === "symbol") ?? "Symbol";
      const qtyKey = pick((k) => k.includes("quantity") || k === "qty") ?? "Quantity";
      const avgKey = pick((k) => k.includes("average")) ?? "Average Price";

      const name = (row[nameKey] ?? "").trim();
      const symbol = (row[symKey] ?? "").trim();
      const qty = parseFloat((row[qtyKey] ?? "0").replace(/,/g, ""));
      const avg = parseFloat((row[avgKey] ?? "0").replace(/[₹,]/g, ""));

      if (!name || !Number.isFinite(qty) || qty <= 0) continue;
      out.push({
        type: "STOCK",
        name,
        symbol: symbol || null,
        quantity: qty,
        avgBuyPrice: avg,
        currency: "INR",
        account: "Groww",
        importSource: "Groww",
      });
    }
    return out;
  },
};
