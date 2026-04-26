import Papa from "papaparse";
import { AssetService } from "./asset.service";
import { createLogger } from "../lib/logger";
import { GrowwAdapter } from "../adapters/groww.adapter";
import { ZerodhaAdapter } from "../adapters/zerodha.adapter";
import { INDmoneyAdapter, GenericAdapter } from "../adapters/indmoney.adapter";
import type { BrokerAdapter, NormalizedHolding } from "../adapters/base.adapter";

const log = createLogger("ImportService");
const ADAPTERS: BrokerAdapter[] = [GrowwAdapter, ZerodhaAdapter, INDmoneyAdapter, GenericAdapter];

export interface ImportReport {
  source: string;
  added: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
  preview: NormalizedHolding[];
}

function detectAdapter(headers: string[]): BrokerAdapter | null {
  for (const a of ADAPTERS) if (a.detect(headers)) return a;
  return null;
}

export const ImportService = {
  /** Parses without persisting — for the preview UI. */
  async preview(csvText: string): Promise<{ adapter: BrokerAdapter | null; rows: NormalizedHolding[] }> {
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const headers = parsed.meta.fields ?? [];
    const adapter = detectAdapter(headers);
    if (!adapter) return { adapter: null, rows: [] };
    return { adapter, rows: adapter.parse(parsed.data) };
  },

  /** Full process: parse, normalize, upsert. */
  async processFile(userId: string, csvText: string): Promise<ImportReport> {
    const errors: string[] = [];
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    const headers = parsed.meta.fields ?? [];
    const adapter = detectAdapter(headers);
    if (!adapter) {
      return {
        source: "UNKNOWN",
        added: 0,
        updated: 0,
        skipped: 0,
        total: 0,
        errors: ["Could not detect CSV format. Expected columns like Name, Symbol, Quantity, Avg Price."],
        preview: [],
      };
    }

    let holdings: NormalizedHolding[] = [];
    try {
      holdings = adapter.parse(parsed.data);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Parse error");
    }

    const skipped = parsed.data.length - holdings.length;
    const { added, updated } = await AssetService.bulkUpsert(userId, holdings);

    log.info("import.complete", {
      userId,
      source: adapter.source,
      added,
      updated,
      skipped,
    });

    return {
      source: adapter.source,
      added,
      updated,
      skipped,
      total: holdings.length,
      errors,
      preview: holdings.slice(0, 10),
    };
  },
};
