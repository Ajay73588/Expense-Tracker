import { createLogger } from "../lib/logger";
import { ValidationError } from "../lib/errors";
import { envInt, withTimeout } from "../lib/http";
import { assertPrismaMode } from "../lib/feature-gate";
import { readSheets } from "../adapters/sheet-reader";
import { ADAPTERS, getAdapter, unsupportedReason } from "../adapters/registry";
import { ASSET_CLASS_LABEL, BROKER_LABEL, type Broker, type ImportAssetClass, type NormalizedHolding, type RowIssue } from "../adapters/base.adapter";
import { validateCandidates } from "../lib/validators/import";
import { AssetService } from "./asset.service";
import { PriceEngineService } from "./price-engine.service";
import { FxRateService } from "./fx-rate.service";

const log = createLogger("ImportService");

export interface ParseOutcome {
  broker: Broker;
  assetClass: ImportAssetClass;
  fileName: string;
  sheetName: string;
  fileKind: string;
  totalRows: number;
  holdings: NormalizedHolding[];
  issues: RowIssue[];
  /** Shown when the file looks like a different broker/asset-type export. */
  hint: string | null;
}

export interface ImportPreview {
  broker: Broker;
  assetClass: ImportAssetClass;
  fileName: string;
  sheetName: string;
  fileKind: string;
  summary: { totalRows: number; validRows: number; invalidRows: number; warnings: number };
  holdings: NormalizedHolding[];
  issues: RowIssue[];
  plan: { toAdd: number; toUpdate: number; toRemove: number };
  holdingsToRemove: Array<{ id: string; name: string; folio: string | null; quantity: number; symbol: string | null; isin: string | null; account: string | null }>;
  /** Why removals are disabled for this import (e.g. some rows were invalid), else null. */
  removalNote: string | null;
  hint: string | null;
  canImport: boolean;
}

export interface ImportReport {
  added: number;
  updated: number;
  removed: number;
  skippedInvalidRows: number;
  warnings: RowIssue[];
  priceEnrichment: {
    updated: number;
    failed: Array<{ name: string; reason: string; message: string }>;
    unsupported: number;
    timedOut: boolean;
    provider: string;
  };
  fx: { rate: number; asOf: string; source: string; stale: boolean } | { error: string } | null;
}

/** Strip any path, control chars; only used for display + extension detection, never for file access. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "upload";
}

/**
 * Pure (no DB, no network): bytes → validated normalized holdings + row-level issues.
 * This is the unit-testable heart of the import.
 */
export function parseUpload(input: {
  broker: Broker;
  assetClass: ImportAssetClass;
  fileName: string;
  bytes: Uint8Array;
  now?: Date;
  account?: string | null;
}): ParseOutcome {
  const { broker, assetClass, account } = input;
  const fileName = safeFileName(input.fileName);
  const reason = unsupportedReason(broker, assetClass);
  const adapter = getAdapter(broker, assetClass);
  if (!adapter) throw new ValidationError(reason ?? "This broker / asset-type combination is not supported.");

  const { kind, sheets } = readSheets(fileName, input.bytes);
  const result = adapter.parse(sheets, { sourceFile: fileName });
  const importedAt = (input.now ?? new Date()).toISOString();

  let hint: string | null = null;
  if (result.fatal.length) {
    const other = ADAPTERS.find((a) => a.id !== adapter.id && a.matches(sheets));
    if (other) {
      hint = `This file looks like a ${BROKER_LABEL[other.broker]} ${ASSET_CLASS_LABEL[other.assetClass]} export. Change the selection above and try again.`;
    }
  }

  const { holdings, issues } = validateCandidates(result.rows, { broker, assetClass, sourceFile: fileName, importedAt, account });
  return {
    broker, assetClass, fileName, sheetName: result.sheetName, fileKind: kind,
    totalRows: result.rows.length,
    holdings,
    issues: [...result.fatal, ...issues, ...result.warnings],
    hint,
  };
}

const errorsOf = (i: RowIssue[]) => i.filter((x) => x.severity === "error");

export const ImportService = {
  /** STEP 4–5: parse + validate + show what would change. Writes nothing. */
  async preview(
    userId: string,
    input: Parameters<typeof parseUpload>[0] & { replaceMissing?: boolean }
  ): Promise<ImportPreview> {
    assertPrismaMode();
    const out = parseUpload(input);
    const errs = errorsOf(out.issues);
    const fatalErr = errs.some((e) => e.row === null);
    const invalidRows = new Set(errs.filter((e) => e.row !== null).map((e) => e.row)).size;

    let plan = { toAdd: 0, toUpdate: 0, toRemove: 0 };
    let holdingsToRemove: ImportPreview["holdingsToRemove"] = [];
    let removalNote: string | null = null;
    if (!fatalErr && out.holdings.length) {
      const wantReplace = input.replaceMissing ?? false;
      const replace = wantReplace && invalidRows === 0;
      if (invalidRows > 0) {
        removalNote = "Because some rows are invalid, holdings missing from this file will NOT be removed.";
      }
      const d = await AssetService.importHoldings(userId, out.holdings, {
        broker: out.broker, assetClass: out.assetClass, replaceMissing: replace, dryRun: true, account: input.account
      });
      plan = { toAdd: d.added, toUpdate: d.updated, toRemove: d.removed };
      holdingsToRemove = (d as any).removedHoldings ?? [];
    }
    return {
      broker: out.broker, assetClass: out.assetClass, fileName: out.fileName, sheetName: out.sheetName, fileKind: out.fileKind,
      summary: {
        totalRows: out.totalRows, validRows: out.holdings.length, invalidRows,
        warnings: out.issues.filter((i) => i.severity === "warning").length,
      },
      holdings: out.holdings, issues: out.issues, plan, holdingsToRemove, removalNote, hint: out.hint,
      canImport: !fatalErr && out.holdings.length > 0,
    };
  },

  /**
   * STEP 6–8: re-parses and re-validates the uploaded file on the server (never trusts client rows),
   * persists, then tries to enrich prices. Price/FX failures NEVER fail or roll back the import.
   */
  async commit(userId: string, input: Parameters<typeof parseUpload>[0] & { replaceMissing: boolean }): Promise<ImportReport> {
    assertPrismaMode();
    const out = parseUpload(input);
    const errs = errorsOf(out.issues);
    if (errs.some((e) => e.row === null) || out.holdings.length === 0) {
      throw new ValidationError(
        errs.find((e) => e.row === null)?.message ?? "No valid holdings to import.",
        out.issues
      );
    }
    const invalidRows = new Set(errs.filter((e) => e.row !== null).map((e) => e.row)).size;

    // 1) persist — one transaction, idempotent on (userId, importKey)
    const saved = await AssetService.importHoldings(userId, out.holdings, {
      broker: out.broker, assetClass: out.assetClass,
      replaceMissing: input.replaceMissing && invalidRows === 0,
      account: input.account,
    });

    // 2) best-effort enrichment (bounded; never throws)
    const report: ImportReport = {
      added: saved.added, updated: saved.updated, removed: saved.removed,
      skippedInvalidRows: invalidRows,
      warnings: out.issues.filter((i) => i.severity === "warning"),
      priceEnrichment: { updated: 0, failed: [], unsupported: 0, timedOut: false, provider: "yahoo-finance2 / mfapi.in" },
      fx: null,
    };

    const stmtByKey = new Map(out.holdings.map((h) => [h.importKey, h.statementPrice]));
    const targets = saved.assets.map((a: any) => ({
      id: a.id, type: a.type, name: a.name, symbol: a.symbol, isin: a.isin, exchange: a.exchange,
      currency: a.currency, statementPrice: stmtByKey.get(a.importKey) ?? null,
    }));
    try {
      const result = await withTimeout(PriceEngineService.refresh(targets), envInt("ENRICH_TIMEOUT_MS", 25000), "Price enrichment");
      await AssetService.applyPrices(userId, saved.assets, result);
      report.priceEnrichment.updated = result.updates.size;
      report.priceEnrichment.unsupported = result.unsupported.length;
      const nameById = new Map<string, string>(saved.assets.map((a: any) => [a.id, a.name]));
      for (const [id, f] of result.failures) {
        report.priceEnrichment.failed.push({ name: nameById.get(id) ?? "Unknown", reason: f.reason, message: f.message });
      }
    } catch (err) {
      report.priceEnrichment.timedOut = true;
      log.warn("import.enrichment.failed", { error: err instanceof Error ? err.message : "unknown" });
    }

    if (out.holdings.some((h) => h.currency === "USD")) {
      try {
        const fx = await FxRateService.getUsdInr();
        report.fx = { rate: fx.rate, asOf: fx.asOf, source: fx.source, stale: fx.stale };
      } catch (err) {
        report.fx = { error: err instanceof Error ? err.message : "FX unavailable" };
      }
    }

    log.info("import.complete", {
      userId, broker: out.broker, assetClass: out.assetClass,
      added: report.added, updated: report.updated, removed: report.removed,
      priced: report.priceEnrichment.updated, priceFailed: report.priceEnrichment.failed.length,
    });
    return report;
  },
};
