import type { Broker, ImportAdapter, ImportAssetClass } from "./base.adapter";
import { GrowwStockAdapter } from "./groww-stock.adapter";
import { GrowwMutualFundAdapter } from "./groww-mutualfund.adapter";
import { INDmoneyMutualFundAdapter } from "./indmoney-mutualfund.adapter";
import { INDmoneyUSStockAdapter } from "./indmoney-usstock.adapter";

export const ADAPTERS: ImportAdapter[] = [
  GrowwStockAdapter,
  GrowwMutualFundAdapter,
  INDmoneyUSStockAdapter,
  INDmoneyMutualFundAdapter,
];

/**
 * Combinations that exist in the UI but have no adapter, with the honest reason.
 * INDmoney Indian stocks: the only sample available was a PDF depository statement with an empty
 * table. A structured export (CSV/XLS/XLSX) was not provided, and we do not build fragile PDF parsers
 * or guess a layout.
 */
export const UNSUPPORTED: Record<string, string> = {
  "INDMONEY:IN_STOCK":
    "INDmoney only provides Indian-stock holdings as a PDF depository statement. No structured CSV/XLS/XLSX export format is known yet, so this combination is not supported.",
  "GROWW:US_STOCK": "Groww does not offer US stock holdings.",
};

export function getAdapter(broker: Broker, assetClass: ImportAssetClass): ImportAdapter | null {
  return ADAPTERS.find((a) => a.broker === broker && a.assetClass === assetClass) ?? null;
}

export function unsupportedReason(broker: Broker, assetClass: ImportAssetClass): string | null {
  return UNSUPPORTED[`${broker}:${assetClass}`] ?? null;
}

export function supportMatrix() {
  const brokers: Broker[] = ["GROWW", "INDMONEY"];
  const classes: ImportAssetClass[] = ["IN_STOCK", "US_STOCK", "MUTUAL_FUND"];
  return brokers.flatMap((broker) =>
    classes.map((assetClass) => {
      const adapter = getAdapter(broker, assetClass);
      return {
        broker,
        assetClass,
        supported: adapter !== null,
        expectedColumns: adapter?.expectedColumns ?? [],
        reason: adapter ? null : unsupportedReason(broker, assetClass),
      };
    })
  );
}
