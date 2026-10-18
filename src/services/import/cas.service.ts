import { assertPrismaMode } from "../../lib/feature-gate";
import { ValidationError } from "../../lib/errors";
import { createLogger } from "../../lib/logger";
import { CasPdfAdapter } from "../../adapters/cas/cas-pdf.adapter";
import { CasParseResult } from "../../adapters/cas/cas-types";
import { NormalizedHolding } from "../../adapters/base.adapter";
import { AssetService } from "../asset.service";
import { PriceEngineService } from "../price-engine.service";

const log = createLogger("CasService");

export interface CasPreviewResult {
  fileName: string;
  result: CasParseResult;
  holdings: NormalizedHolding[];
  overlappingHoldings: Array<{
    name: string;
    folio: string | null;
    isin: string | null;
    existingSource: string | null;
  }>;
  summary: {
    totalParsed: number;
    validHoldings: number;
    overlaps: number;
  };
  canImport: boolean;
  notes: string[];
}

export const CasService = {
  /**
   * Previews CAS PDF mutual fund statement.
   * Checks for overlaps with existing Groww and INDmoney holdings to prevent double-counting.
   */
  async preview(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      password?: string;
      account?: string | null;
    }
  ): Promise<CasPreviewResult> {
    assertPrismaMode();
    const parsed = CasPdfAdapter.parse(input);

    const { prisma } = await import("../../lib/prisma");

    // Fetch existing user mutual funds to check for overlapping positions
    const existingAssets = await prisma.asset.findMany({
      where: { userId, type: "MUTUAL_FUND", deletedAt: null },
      select: { id: true, name: true, folio: true, isin: true, importSource: true },
    });

    const accountLabel = input.account || (parsed.provider === "CAMS" ? "CAMS CAS" : "KFintech CAS");
    const normalizedHoldings: NormalizedHolding[] = [];
    const overlapping: CasPreviewResult["overlappingHoldings"] = [];

    for (const h of parsed.holdings) {
      // Check for overlap by folio + ISIN or name
      const overlap = existingAssets.find(
        (ea: any) => (ea.folio && ea.folio === h.folio) || (ea.isin && h.isin && ea.isin === h.isin)
      );

      if (overlap) {
        overlapping.push({
          name: h.schemeName,
          folio: h.folio,
          isin: h.isin,
          existingSource: overlap.importSource || "Existing Broker",
        });
      }

      const importKey = `CAS|MUTUAL_FUND|${accountLabel}|${h.identity}`;

      normalizedHoldings.push({
        type: "MUTUAL_FUND",
        assetClass: "MUTUAL_FUND",
        name: h.schemeName,
        symbol: null,
        isin: h.isin,
        exchange: null,
        folio: h.folio,
        quantity: h.units,
        averagePrice: h.nav ?? 0,
        investedValue: h.investedValue,
        currency: "INR",
        statementPrice: h.nav,
        importKey,
        account: accountLabel,
        sourceBroker: parsed.provider,
        sourceFile: input.fileName,
        sourceRow: h.rowNumber,
        importedAt: new Date().toISOString(),
      });
    }

    const notes: string[] = [...parsed.warnings];
    if (parsed.status === "IMPLEMENTED_UNVERIFIED") {
      notes.push("Encrypted PDF structure parsed; representative fixture required to verify all folio tables.");
    }
    if (overlapping.length > 0) {
      notes.push(
        `${overlapping.length} holding(s) match existing mutual funds from Groww/INDmoney. CAS will update or reconcile without duplicating.`
      );
    }

    return {
      fileName: input.fileName,
      result: parsed,
      holdings: normalizedHoldings,
      overlappingHoldings: overlapping,
      summary: {
        totalParsed: parsed.holdings.length,
        validHoldings: normalizedHoldings.length,
        overlaps: overlapping.length,
      },
      canImport: normalizedHoldings.length > 0,
      notes,
    };
  },

  /**
   * Commit CAS PDF mutual fund holdings to user's portfolio.
   */
  async commit(
    userId: string,
    input: {
      fileName: string;
      bytes: Uint8Array;
      password?: string;
      account?: string | null;
      replaceMissing?: boolean;
    }
  ) {
    assertPrismaMode();
    const preview = await this.preview(userId, input);

    if (preview.holdings.length === 0) {
      throw new ValidationError(
        preview.result.status === "PASSWORD_REQUIRED"
          ? "PDF is encrypted. Please provide the statement password."
          : "No valid mutual fund holdings could be extracted from this CAS PDF."
      );
    }

    const saved = await AssetService.importHoldings(userId, preview.holdings, {
      broker: "GROWW", // Compatible broker persistence mode
      assetClass: "MUTUAL_FUND",
      replaceMissing: input.replaceMissing ?? false,
      account: input.account ?? undefined,
    });

    log.info("import.cas.committed", {
      userId,
      provider: preview.result.provider,
      added: saved.added,
      updated: saved.updated,
    });

    return {
      provider: preview.result.provider,
      added: saved.added,
      updated: saved.updated,
      removed: saved.removed,
      holdingsCount: preview.holdings.length,
    };
  },
};
