import type { AssetType } from "../types";

export interface NormalizedHolding {
  type: AssetType;
  name: string;
  symbol: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
  account: string;
  importSource: string;
}

export interface BrokerAdapter {
  source: string;
  /** Returns true if this adapter recognises the CSV headers. */
  detect(headers: string[]): boolean;
  /** Parses raw rows into normalized holdings. Throws on unrecoverable errors. */
  parse(rows: Record<string, string>[]): NormalizedHolding[];
}
