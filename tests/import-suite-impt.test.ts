import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import { promises as fsp } from "fs";

// ── In-memory stand-in for Prisma asset and account delegates ─────────────────
type Row = Record<string, any>;
const db: { assets: Row[]; accounts: Row[]; seq: number } = { assets: [], accounts: [], seq: 0 };

const match = (r: Row, w: Row = {}): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (k === "NOT") return !match(r, v as Row);
    if (k === "OR" && Array.isArray(v)) return v.some((sub) => match(r, sub));
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Row;
      if ("in" in o) return o.in.includes(r[k]);
      if ("startsWith" in o) return typeof r[k] === "string" && r[k].startsWith(o.startsWith);
    }
    return r[k] === v;
  });

const asset = {
  findMany: async ({ where, select }: Row = {}) => {
    const rows = db.assets.filter((r) => match(r, where)).map((r) => ({ ...r }));
    if (!select) return rows;
    return rows.map((r) => {
      const out: Row = {};
      for (const k of Object.keys(select)) if (select[k]) out[k] = r[k];
      return out;
    });
  },
  findFirst: async ({ where }: Row = {}) => {
    const hit = db.assets.find((r) => match(r, where));
    return hit ? { ...hit } : null;
  },
  count: async ({ where }: Row = {}) => db.assets.filter((r) => match(r, where)).length,
  createMany: async ({ data }: { data: Row[] }) => {
    for (const d of data) {
      db.assets.push({
        id: `ast_${++db.seq}`,
        deletedAt: null,
        priceUpdatedAt: null,
        exchange: null,
        symbol: null,
        isin: null,
        folio: null,
        accountId: null,
        ...d,
      });
    }
    return { count: data.length };
  },
  update: async ({ where, data }: { where: Row; data: Row }) => {
    const r = db.assets.find((x) => x.id === where.id);
    if (!r) throw new Error("Asset not found for update");
    Object.assign(r, data);
    return { ...r };
  },
  updateMany: async ({ where, data }: { where: Row; data: Row }) => {
    const hits = db.assets.filter((r) => match(r, where));
    hits.forEach((r) => Object.assign(r, data));
    return { count: hits.length };
  },
};

const account = {
  findFirst: async ({ where, select }: Row = {}) => {
    const hit = db.accounts.find((r) => match(r, where));
    if (!hit) return null;
    if (!select) return { ...hit };
    const out: Row = {};
    for (const k of Object.keys(select)) if (select[k]) out[k] = hit[k];
    return out;
  },
  findMany: async ({ where }: Row = {}) => db.accounts.filter((r) => match(r, where)).map((r) => ({ ...r })),
  create: async ({ data }: { data: Row }) => {
    const row = { id: `acc_${++db.seq}`, ...data };
    db.accounts.push(row);
    return { ...row };
  },
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    asset,
    account,
    $transaction: async (ops: any) => {
      if (typeof ops === "function") {
        return ops({ asset, account });
      }
      // Simulate transactional atomicity: snapshot DB before executing batch
      const snapshot = JSON.stringify(db.assets);
      try {
        const results = [];
        for (const op of ops) {
          results.push(await op);
        }
        return results;
      } catch (err) {
        db.assets = JSON.parse(snapshot);
        throw err;
      }
    },
  },
}));

import { cache } from "../src/lib/cache";
import { ImportService } from "../src/services/import.service";
import { AssetService } from "../src/services/asset.service";
import { PriceEngineService } from "../src/services/price-engine.service";
import { FxRateService } from "../src/services/fx-rate.service";
import { ADAPTERS, getAdapter } from "../src/adapters/registry";
import {
  GROWW_MF_DATA,
  GROWW_STOCK_DATA,
  IND_MF_DATA,
  IND_US_DATA,
  growwMfRows,
  growwStockRows,
  indMfRows,
  indUsRows,
  makeWorkbook,
} from "./helpers/workbook";

const USER_ALICE = "user_alice_impt";
const USER_BOB = "user_bob_impt";

const liveAssets = (userId = USER_ALICE) =>
  db.assets.filter((r) => r.userId === userId && r.deletedAt === null);

const downProviders = () => {
  PriceEngineService.setProviders({
    stock: {
      name: "down",
      getUSStockQuotes: async () => { throw new Error("provider down"); },
      getIndianStockQuotes: async () => { throw new Error("provider down"); },
    },
    mf: {
      name: "down",
      getLatestNav: async () => ({ ok: false, reason: "TIMEOUT", message: "down" }),
    },
  });
  FxRateService.setProvider({
    name: "down",
    getRate: async () => { throw new Error("fx down"); },
  });
};

beforeEach(async () => {
  db.assets = [];
  db.accounts = [];
  db.seq = 0;
  await cache.clear();
  downProviders();
});

describe("Phase 3: Duplicate-Safe Imports and Reconciliation (IMP-T1 through IMP-T12)", () => {
  // ── IMP-T1: Repeated identical import ─────────────────────────────────────────
  it("IMP-T1: repeated identical import results in 0 new rows, identical quantities, and no duplication", async () => {
    const file = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "groww_mf_statement.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };

    const first = await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });
    expect(first.added).toBe(3);
    expect(first.updated).toBe(0);
    expect(first.removed).toBe(0);
    expect(liveAssets()).toHaveLength(3);

    const initialQuantities = liveAssets().map((a) => a.quantity);
    const initialInvested = liveAssets().map((a) => a.invested);

    // Repeat identical import
    const second = await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });
    expect(second.added).toBe(0);
    expect(second.updated).toBe(3);
    expect(second.removed).toBe(0);
    expect(liveAssets()).toHaveLength(3);
    expect(liveAssets().map((a) => a.quantity)).toEqual(initialQuantities);
    expect(liveAssets().map((a) => a.invested)).toEqual(initialInvested);
  });

  // ── IMP-T2: Overlapping imports (superset / subset file) ──────────────────────
  it("IMP-T2: overlapping imports: subset without replaceMissing retains all, with replaceMissing soft-deletes, superset revives", async () => {
    const fullFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "full.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };
    const subsetFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "subset.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA.slice(0, 2)) }),
    };

    // 1. Full import (3 holdings)
    await ImportService.commit(USER_ALICE, { ...fullFile, replaceMissing: true });
    expect(liveAssets()).toHaveLength(3);

    // 2. Subset with replaceMissing=false retains absent holding
    const rNoReplace = await ImportService.commit(USER_ALICE, { ...subsetFile, replaceMissing: false });
    expect(rNoReplace.removed).toBe(0);
    expect(liveAssets()).toHaveLength(3);

    // 3. Subset with replaceMissing=true soft-deletes absent holding (1 removed)
    const rReplace = await ImportService.commit(USER_ALICE, { ...subsetFile, replaceMissing: true });
    expect(rReplace.removed).toBe(1);
    expect(liveAssets()).toHaveLength(2);
    expect(db.assets).toHaveLength(3); // Soft delete keeps audit record

    // 4. Re-import superset revives the soft-deleted holding
    const rRevive = await ImportService.commit(USER_ALICE, { ...fullFile, replaceMissing: true });
    expect(rRevive.updated).toBe(3);
    expect(liveAssets()).toHaveLength(3);
    expect(liveAssets().every((a) => a.deletedAt === null)).toBe(true);
  });

  // ── IMP-T3: Same ISIN in two folios → two positions ──────────────────────────
  it("IMP-T3: same ISIN under two different folios creates two distinct positions", async () => {
    const multiFolioRows = [
      ["HDFC Top 100 Fund", "INF179K01BE2", "50.00", "5000.00", "5500.00", "FOLIO_A"],
      ["HDFC Top 100 Fund", "INF179K01BE2", "75.00", "7500.00", "8250.00", "FOLIO_B"],
    ];
    const file = {
      broker: "INDMONEY" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "ind_mf_two_folios.xlsx",
      bytes: makeWorkbook({ Sheet1: indMfRows(multiFolioRows) }),
    };

    const report = await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });
    expect(report.added).toBe(2);
    expect(liveAssets()).toHaveLength(2);

    const posA = liveAssets().find((a) => a.folio === "FOLIO_A");
    const posB = liveAssets().find((a) => a.folio === "FOLIO_B");
    expect(posA).toBeDefined();
    expect(posB).toBeDefined();
    expect(posA!.importKey).not.toEqual(posB!.importKey);
    expect(posA!.quantity).toBe(50);
    expect(posB!.quantity).toBe(75);
  });

  // ── IMP-T4: Same instrument in two accounts → two positions ──────────────────
  it("IMP-T4: same instrument imported across two accounts creates two separate positions without collision", async () => {
    const stockRow = [
      ["Reliance Industries", "INE002A01018", 10, 2500, 25000, 2600, 26000, 1000],
    ];
    const fileAcc1 = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "groww_stocks_acc1.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(stockRow) }),
      account: "Groww Primary",
    };
    const fileAcc2 = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "groww_stocks_acc2.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(stockRow) }),
      account: "Groww Secondary",
    };

    await ImportService.commit(USER_ALICE, { ...fileAcc1, replaceMissing: true });
    await ImportService.commit(USER_ALICE, { ...fileAcc2, replaceMissing: true });

    expect(liveAssets()).toHaveLength(2);
    const acc1Pos = liveAssets().find((a) => a.account === "Groww Primary");
    const acc2Pos = liveAssets().find((a) => a.account === "Groww Secondary");

    expect(acc1Pos).toBeDefined();
    expect(acc2Pos).toBeDefined();
    expect(acc1Pos!.importKey).toBe("GROWW|IN_STOCK|Groww Primary|INE002A01018");
    expect(acc2Pos!.importKey).toBe("GROWW|IN_STOCK|Groww Secondary|INE002A01018");
    expect(acc1Pos!.quantity).toBe(10);
    expect(acc2Pos!.quantity).toBe(10);
  });

  // ── IMP-T5: Same display name, different ISIN → distinct ─────────────────────
  it("IMP-T5: instruments with identical display names but different ISINs remain distinct", async () => {
    const stockRows = [
      ["Tata Power Ltd (Series A)", "INE245A01021", 10, 200, 2000, 210, 2100, 100],
      ["Tata Power Ltd (Series B)", "INE999B01099", 20, 150, 3000, 160, 3200, 200],
    ];
    const file = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "tata_stocks.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(stockRows) }),
    };

    const report = await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });
    expect(report.added).toBe(2);
    expect(liveAssets()).toHaveLength(2);

    const isins = liveAssets().map((a) => a.isin);
    expect(isins).toContain("INE245A01021");
    expect(isins).toContain("INE999B01099");
  });

  // ── IMP-T6: Malformed rows → row errors, deletion pass disabled ──────────────
  it("IMP-T6: malformed rows produce row-level errors and disable the deletion pass", async () => {
    // 1. Establish initial portfolio with 3 holdings
    const validFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "valid.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };
    await ImportService.commit(USER_ALICE, { ...validFile, replaceMissing: true });
    expect(liveAssets()).toHaveLength(3);

    // 2. Upload file with 1 valid row and 1 malformed row (units = "not_a_number")
    const brokenRows = [
      GROWW_MF_DATA[0],
      [...GROWW_MF_DATA[1].slice(0, 6), "not_a_number", "5000", "4500", 0, "0%"],
    ];
    const brokenFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "broken.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(brokenRows as any) }),
    };

    // Preview surfaces invalid row and notes deletion cancellation
    const preview = await ImportService.preview(USER_ALICE, { ...brokenFile, replaceMissing: true });
    expect(preview.summary.invalidRows).toBe(1);
    expect(preview.removalNote).toMatch(/will NOT be removed/);

    // Commit skips invalid row and does NOT remove missing holdings
    const report = await ImportService.commit(USER_ALICE, { ...brokenFile, replaceMissing: true });
    expect(report.skippedInvalidRows).toBe(1);
    expect(report.removed).toBe(0);
    expect(liveAssets()).toHaveLength(3); // All 3 original holdings preserved!
  });

  // ── IMP-T7: Partial DB failure → full rollback ───────────────────────────────
  it("IMP-T7: simulated database transaction error triggers full rollback with zero partial writes", async () => {
    const stockRows = [
      ["Infosys", "INE009A01021", 10, 1400, 14000, 1500, 15000, 1000],
    ];
    const file = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "stocks.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(stockRows) }),
    };

    // Temporarily cause asset.createMany to throw
    const originalCreateMany = asset.createMany;
    asset.createMany = async () => {
      throw new Error("DB_CONNECTION_FAILURE");
    };

    try {
      await expect(
        ImportService.commit(USER_ALICE, { ...file, replaceMissing: true })
      ).rejects.toThrow("DB_CONNECTION_FAILURE");

      // Verify no records were persisted
      expect(liveAssets()).toHaveLength(0);
    } finally {
      asset.createMany = originalCreateMany;
    }
  });

  // ── IMP-T8: Duplicate row in one file ─────────────────────────────────────────
  it("IMP-T8: duplicate row in one file: stocks reject duplicate row; mutual funds consolidate multiple tranches with warning", async () => {
    // A. Stock file with duplicate ticker
    const dupStockRows = [
      ["AAPL", "26 Mar 2025, 09:31 PM", 5, 180, 900],
      ["AAPL", "26 Mar 2025, 09:35 PM", 3, 190, 570], // Duplicate of AAPL
    ];
    const stockFile = {
      broker: "INDMONEY" as const,
      assetClass: "US_STOCK" as const,
      fileName: "dup_stocks.xls",
      bytes: makeWorkbook({ HOLDINGS_BOOK: indUsRows(dupStockRows) }, "biff8"),
    };

    const stockPreview = await ImportService.preview(USER_ALICE, stockFile);
    expect(stockPreview.issues.some((i) => i.severity === "error" && i.message.includes("Duplicate"))).toBe(true);
    expect(stockPreview.holdings).toHaveLength(1);
    expect(stockPreview.holdings[0].quantity).toBe(5);

    // B. Mutual fund file with multiple purchases under same scheme + folio
    const dupMfRows = [
      ["Quant Mid Cap Fund Direct Growth", "Quant MF", "Equity", "Mid Cap", "FOLIO99", "Groww", 100, "5000.00", "6000.00", 1000, "20%"],
      ["Quant Mid Cap Fund Direct Growth", "Quant MF", "Equity", "Mid Cap", "FOLIO99", "Groww", 50, "3000.00", "3000.00", 0, "0%"],
    ];
    const mfFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "dup_mf.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(dupMfRows) }),
    };

    const mfPreview = await ImportService.preview(USER_ALICE, mfFile);
    expect(mfPreview.holdings).toHaveLength(1);
    expect(mfPreview.holdings[0].quantity).toBe(150); // 100 + 50
    expect(mfPreview.holdings[0].investedValue).toBe(8000); // 5000 + 3000
    expect(mfPreview.issues.some((i) => i.severity === "warning" && i.message.includes("Consolidated"))).toBe(true);
  });

  // ── IMP-T9: Corrected statement updates quantity without doubling ────────────
  it("IMP-T9: corrected statement sets updated quantity and does not double or accumulate units", async () => {
    const file1 = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "mf_statement_v1.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };
    await ImportService.commit(USER_ALICE, { ...file1, replaceMissing: true });

    const holding1 = liveAssets().find((a) => a.folio === "1001")!;
    expect(holding1.quantity).toBe(100.5);

    // Corrected statement arrives where units changed to 150 (e.g. additional units or correction)
    const correctedData = GROWW_MF_DATA.map((r, i) =>
      i === 0 ? [...r.slice(0, 6), 150, "15000.00", "16500.00", 1500, "10%"] : r
    );
    const file2 = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "mf_statement_v2.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(correctedData as any) }),
    };

    await ImportService.commit(USER_ALICE, { ...file2, replaceMissing: true });

    const updatedHolding = liveAssets().find((a) => a.folio === "1001")!;
    expect(updatedHolding.quantity).toBe(150); // Snapshot update: 150, NOT 100.5 + 150
  });

  // ── IMP-T10: Zero disk writes ────────────────────────────────────────────────
  it("IMP-T10: upload parsing, previewing, and committing perform zero filesystem write calls", async () => {
    const writeSpy = vi.spyOn(fs, "writeFile");
    const writeSyncSpy = vi.spyOn(fs, "writeFileSync");
    const writeStreamSpy = vi.spyOn(fs, "createWriteStream");
    const fspWriteSpy = vi.spyOn(fsp, "writeFile");

    const file = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "in_memory_only.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };

    await ImportService.preview(USER_ALICE, file);
    await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });

    expect(writeSpy).not.toHaveBeenCalled();
    expect(writeSyncSpy).not.toHaveBeenCalled();
    expect(writeStreamSpy).not.toHaveBeenCalled();
    expect(fspWriteSpy).not.toHaveBeenCalled();

    writeSpy.mockRestore();
    writeSyncSpy.mockRestore();
    writeStreamSpy.mockRestore();
    fspWriteSpy.mockRestore();
  });

  // ── IMP-T11: Import then manual edit then re-import (D-08 precedence) ────────
  it("IMP-T11: import then manual edit then re-import updates quantity/avg cost but preserves MANUAL price and live quotes (D-08)", async () => {
    const file1 = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "stocks_initial.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(GROWW_STOCK_DATA) }),
    };

    // 1. Initial import
    await ImportService.commit(USER_ALICE, { ...file1, replaceMissing: true });
    const alphaStock = liveAssets().find((a) => a.isin === "INE000A01010")!;
    expect(alphaStock.currentPrice).toBe(2100);
    expect(alphaStock.priceSource).toBe("STATEMENT");

    // 2. User manually enters a custom valuation
    await AssetService.update(USER_ALICE, alphaStock.id, {
      currentPrice: 2450,
      priceSource: "MANUAL",
    });
    const editedStock = liveAssets().find((a) => a.id === alphaStock.id)!;
    expect(Number(editedStock.currentPrice)).toBe(2450);
    expect(editedStock.priceSource).toBe("MANUAL");

    // 3. User also has a position with live market quote (YAHOO)
    const betaStock = liveAssets().find((a) => a.isin === "INE000B01011")!;
    Object.assign(betaStock, { currentPrice: 1650, priceSource: "YAHOO" });

    // 4. Re-import statement with changed quantity and statement price
    const updatedStockData = [
      ["Alpha Industries", "INE000A01010", 25, 2050, 51250, 2200, 55000, 3750], // Qty changed 10 → 25, Stmt price 2200
      ["Beta Bank", "INE000B01011", 10, 1500, 15000, 1420, 14200, -800],        // Qty changed 5 → 10
    ];
    const file2 = {
      broker: "GROWW" as const,
      assetClass: "IN_STOCK" as const,
      fileName: "stocks_v2.xlsx",
      bytes: makeWorkbook({ Sheet1: growwStockRows(updatedStockData) }),
    };

    await ImportService.commit(USER_ALICE, { ...file2, replaceMissing: true });

    const reimportedAlpha = liveAssets().find((a) => a.isin === "INE000A01010")!;
    const reimportedBeta = liveAssets().find((a) => a.isin === "INE000B01011")!;

    // Statement overwrites quantity and avgBuyPrice
    expect(reimportedAlpha.quantity).toBe(25);
    expect(reimportedAlpha.avgBuyPrice).toBe(2050);

    // D-08 PRECEDENCE: Manual valuation is retained! (Statement price 2200 did NOT clobber manual price 2450)
    expect(Number(reimportedAlpha.currentPrice)).toBe(2450);
    expect(reimportedAlpha.priceSource).toBe("MANUAL");

    // Live quote is also preserved!
    expect(reimportedBeta.quantity).toBe(10);
    expect(Number(reimportedBeta.currentPrice)).toBe(1650);
    expect(reimportedBeta.priceSource).toBe("YAHOO");
  });

  // ── IMP-T12: Existing adapter suite remains green and unchanged ───────────────
  it("IMP-T12: all 4 supported broker adapters exist, match sample signatures, and preserve interface contracts", () => {
    expect(ADAPTERS).toHaveLength(4);

    const growwStock = getAdapter("GROWW", "IN_STOCK");
    const growwMf = getAdapter("GROWW", "MUTUAL_FUND");
    const indUs = getAdapter("INDMONEY", "US_STOCK");
    const indMf = getAdapter("INDMONEY", "MUTUAL_FUND");

    expect(growwStock).toBeDefined();
    expect(growwMf).toBeDefined();
    expect(indUs).toBeDefined();
    expect(indMf).toBeDefined();

    // Verify sheet matcher behavior when valid headers are present
    expect(growwStock!.matches([{ name: "Sheet1", rows: growwStockRows([]) }])).toBe(true);
    expect(growwMf!.matches([{ name: "Holdings", rows: growwMfRows([]) }])).toBe(true);
    expect(indUs!.matches([{ name: "HOLDINGS_BOOK", rows: indUsRows([]) }])).toBe(true);
    expect(indMf!.matches([{ name: "Sheet1", rows: indMfRows([]) }])).toBe(true);
  });

  // ── Cross-User and Account Isolation ──────────────────────────────────────────
  it("IMP-CROSS-USER: operations are strictly scoped to the requesting user and prevent cross-user mutations", async () => {
    // Alice imports holdings
    const file = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "alice_holdings.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA) }),
    };
    await ImportService.commit(USER_ALICE, { ...file, replaceMissing: true });

    // Bob imports identical holdings file
    await ImportService.commit(USER_BOB, { ...file, replaceMissing: true });

    expect(liveAssets(USER_ALICE)).toHaveLength(3);
    expect(liveAssets(USER_BOB)).toHaveLength(3);
    expect(db.assets).toHaveLength(6);

    // Alice importing with replaceMissing=true for a subset NEVER removes Bob's assets
    const subsetFile = {
      broker: "GROWW" as const,
      assetClass: "MUTUAL_FUND" as const,
      fileName: "alice_subset.xlsx",
      bytes: makeWorkbook({ Holdings: growwMfRows(GROWW_MF_DATA.slice(0, 1)) }),
    };
    await ImportService.commit(USER_ALICE, { ...subsetFile, replaceMissing: true });

    expect(liveAssets(USER_ALICE)).toHaveLength(1);
    expect(liveAssets(USER_BOB)).toHaveLength(3); // Bob's assets remain completely intact!
  });
});
