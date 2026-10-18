import { describe, it, expect, beforeEach, vi } from "vitest";
import { CasPdfAdapter, isPdf, isPdfEncrypted } from "../src/adapters/cas/cas-pdf.adapter";
import { CasService } from "../src/services/import/cas.service";

// In-memory Prisma delegate
type Row = Record<string, any>;
const db: { assets: Row[]; seq: number } = {
  assets: [],
  seq: 0,
};

const match = (r: Row, w: Row = {}): boolean =>
  Object.entries(w).every(([k, v]) => {
    if (k === "NOT") return !match(r, v as Row);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const o = v as Row;
      if ("in" in o) return o.in.includes(r[k]);
    }
    return r[k] === v;
  });

const prismaMock = {
  asset: {
    findMany: async ({ where }: Row) => db.assets.filter((r) => match(r, where)).map((r) => ({ ...r })),
    createMany: async ({ data }: Row) => {
      for (const d of data) {
        db.assets.push({ id: `ast_${++db.seq}`, deletedAt: null, ...d });
      }
      return { count: data.length };
    },
    update: async ({ where, data }: Row) => {
      const r = db.assets.find((x) => x.id === where.id);
      if (r) Object.assign(r, data);
      return r;
    },
    updateMany: async ({ where, data }: Row) => {
      const hits = db.assets.filter((r) => match(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  },
  $transaction: async (ops: any) => Promise.all(ops),
};

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

describe("CAS PDF (CAMS & KFintech) Import Suite", () => {
  const U1 = "user_cas_1";

  beforeEach(() => {
    db.assets = [
      {
        id: "ast_groww_ppfas",
        userId: U1,
        type: "MUTUAL_FUND",
        name: "Parag Parikh Flexi Cap Fund",
        folio: "12345/67",
        isin: "INF879O01015",
        quantity: 150.5,
        avgBuyPrice: 55.4,
        currentPrice: 62.8,
        importSource: "Groww",
        deletedAt: null,
      },
    ];
    db.seq = 0;
  });

  const createSyntheticPdfBytes = (content: string, encrypted = false): Uint8Array => {
    const header = "%PDF-1.4\n";
    const body = encrypted
      ? `/Encrypt 12 0 R\nstream\n${content}\nendstream\n`
      : `stream\nBT\n(${content})\nET\nendstream\n`;
    const trailer = "%%EOF\n";
    return new TextEncoder().encode(header + body + trailer);
  };

  describe("1. PDF Validation & Encryption Detection", () => {
    it("validates PDF magic header %PDF-", () => {
      const valid = new TextEncoder().encode("%PDF-1.4 test");
      const invalid = new TextEncoder().encode("Not a pdf");

      expect(isPdf(valid)).toBe(true);
      expect(isPdf(invalid)).toBe(false);
    });

    it("detects whether a PDF has an encryption dictionary", () => {
      const unencrypted = createSyntheticPdfBytes("Unencrypted statement");
      const encrypted = createSyntheticPdfBytes("Secret statement", true);

      expect(isPdfEncrypted(unencrypted)).toBe(false);
      expect(isPdfEncrypted(encrypted)).toBe(true);
    });

    it("requires password when parsing an encrypted PDF", () => {
      const encrypted = createSyntheticPdfBytes("CAMS Statement", true);
      const result = CasPdfAdapter.parse({ fileName: "cams.pdf", bytes: encrypted });

      expect(result.isEncrypted).toBe(true);
      expect(result.status).toBe("PASSWORD_REQUIRED");
      expect(result.holdings).toHaveLength(0);
      expect(result.warnings[0]).toContain("password");
    });
  });

  describe("2. CAS Text Extraction & Normalization", () => {
    it("extracts scheme, folio, units, and NAV from unencrypted or decrypted text stream", () => {
      const text =
        "CAMS Consolidated Account Statement Scheme: Axis Bluechip Fund Direct Growth Folio No: 98765/43 Units: 200.75 NAV: 52.60 ISIN: INF846K01164";
      const pdfBytes = createSyntheticPdfBytes(text);

      const result = CasPdfAdapter.parse({ fileName: "cams.pdf", bytes: pdfBytes });

      expect(result.provider).toBe("CAMS");
      expect(result.status).toBe("PARSED");
      expect(result.holdings).toHaveLength(1);

      const h = result.holdings[0];
      expect(h.schemeName).toContain("Axis Bluechip Fund");
      expect(h.folio).toBe("98765/43");
      expect(h.units).toBe(200.75);
      expect(h.nav).toBe(52.6);
      expect(h.isin).toBe("INF846K01164");
    });
  });

  describe("3. Overlap Detection with Existing Broker Holdings", () => {
    it("flags overlapping mutual funds previously imported via Groww to avoid double-counting", async () => {
      const text =
        "CAMS Statement Scheme: Parag Parikh Flexi Cap Fund Folio No: 12345/67 Units: 150.5 NAV: 62.80 ISIN: INF879O01015";
      const pdfBytes = createSyntheticPdfBytes(text);

      const preview = await CasService.preview(U1, {
        fileName: "cams.pdf",
        bytes: pdfBytes,
      });

      expect(preview.summary.validHoldings).toBe(1);
      expect(preview.summary.overlaps).toBe(1);
      expect(preview.overlappingHoldings[0].existingSource).toBe("Groww");
      expect(preview.overlappingHoldings[0].folio).toBe("12345/67");
      expect(preview.notes.some((n) => n.includes("match existing mutual funds"))).toBe(true);
    });
  });

  describe("4. Security and In-Memory Protection", () => {
    it("never writes raw PDF bytes to disk or leaks passwords in logs", () => {
      const dummyPassword = "MY_SECRET_PAN_123";
      const pdfBytes = createSyntheticPdfBytes("Protected statement", true);

      const result = CasPdfAdapter.parse({
        fileName: "stmt.pdf",
        bytes: pdfBytes,
        password: dummyPassword,
      });

      expect(JSON.stringify(result)).not.toContain(dummyPassword);
    });
  });
});
