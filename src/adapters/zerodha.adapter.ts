import type { BrokerAdapter, NormalizedHolding } from "./base.adapter";

/**
 * Zerodha Console holdings export.
 * Expected headers: Instrument, Qty., Avg. cost, LTP
 */
export const ZerodhaAdapter: BrokerAdapter = {
  source: "Zerodha",

  detect(headers) {
    const h = headers.map((x) => x.toLowerCase().trim());
    return (
      h.some((x) => x === "instrument") &&
      h.some((x) => x === "qty." || x === "qty") &&
      h.some((x) => x.includes("avg"))
    );
  },

  parse(rows) {
    const out: NormalizedHolding[] = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const pick = (pred: (k: string) => boolean) =>
        keys.find((k) => pred(k.toLowerCase().trim()));

      const nameKey = pick((k) => k === "instrument") ?? "Instrument";
      const qtyKey = pick((k) => k === "qty." || k === "qty") ?? "Qty.";
      const avgKey = pick((k) => k.includes("avg")) ?? "Avg. cost";

      const name = (row[nameKey] ?? "").trim();
      const qty = parseFloat((row[qtyKey] ?? "0").replace(/,/g, ""));
      const avg = parseFloat((row[avgKey] ?? "0").replace(/[₹,]/g, ""));

      if (!name || !Number.isFinite(qty) || qty <= 0) continue;
      out.push({
        type: "STOCK",
        name,
        symbol: name, // Zerodha instrument IS the symbol (e.g. RELIANCE)
        quantity: qty,
        avgBuyPrice: avg,
        currency: "INR",
        account: "Zerodha",
        importSource: "Zerodha",
      });
    }
    return out;
  },
};
