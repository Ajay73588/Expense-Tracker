import { describe, it, expect, vi } from "vitest";
import { ImportExtractionService } from "../src/services/ai/import-extraction.service";
import { NvidiaClient } from "../src/services/ai/nvidia-client";

describe("AI-Assisted Import Extraction Service Suite (NVIDIA NIM)", () => {
  describe("1. Structured Extraction with Schema Validation", () => {
    it("successfully parses valid JSON response into typed transactions", async () => {
      const mockClient = {
        isConfigured: (feature?: string) => feature === "import",
        complete: vi.fn().mockResolvedValue({
          ok: true,
          text: JSON.stringify({
            bankName: "HDFC Bank",
            accountNumberMasked: "************1234",
            accountType: "SAVINGS",
            transactions: [
              {
                date: "2026-10-01",
                description: "SALARY TECH CORP",
                amount: 85000,
                direction: "CREDIT",
                reference: "REF001",
                category: "Salary",
                balance: 110000,
              },
              {
                date: "2026-10-03",
                description: "SWIGGY BANGALORE",
                amount: 450,
                direction: "DEBIT",
                reference: "REF002",
                category: "Food & Dining",
                balance: 109550,
              },
            ],
          }),
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Dummy text", {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.bankName).toBe("HDFC Bank");
      expect(result.data?.transactions).toHaveLength(2);
      expect(result.data?.transactions[0].amount).toBe(85000);
      expect(result.data?.transactions[0].direction).toBe("CREDIT");
    });

    it("handles reasoning tokens and markdown code blocks in model output", async () => {
      const mockClient = {
        isConfigured: () => true,
        complete: vi.fn().mockResolvedValue({
          ok: true,
          text: `<think>Extracting transactions from statement text...</think>
\`\`\`json
{
  "bankName": "ICICI Bank",
  "transactions": [
    {
      "date": "2026-10-02",
      "description": "UPI TRANSFER",
      "amount": 1200,
      "direction": "DEBIT"
    }
  ]
}
\`\`\``,
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Statement text", {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.bankName).toBe("ICICI Bank");
      expect(result.data?.transactions).toHaveLength(1);
      expect(result.data?.transactions[0].amount).toBe(1200);
    });

    it("handles and rejects malformed JSON responses gracefully", async () => {
      const mockClient = {
        isConfigured: () => true,
        complete: vi.fn().mockResolvedValue({
          ok: true,
          text: "Not a json response at all",
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Statement text", {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("INVALID_OUTPUT");
    });

    it("rejects responses with missing or invalid fields violating schema", async () => {
      const mockClient = {
        isConfigured: () => true,
        complete: vi.fn().mockResolvedValue({
          ok: true,
          text: JSON.stringify({
            transactions: [
              {
                date: "invalid-date",
                description: "test",
                amount: -500, // Invalid negative amount
                direction: "UNKNOWN", // Invalid direction
              },
            ],
          }),
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Statement text", {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("INVALID_OUTPUT");
    });
  });

  describe("2. Provider Failures & Unconfigured Fallback", () => {
    it("returns NOT_CONFIGURED code when NVIDIA NIM Import API key is missing", async () => {
      const unconfiguredClient = {
        isConfigured: (feature?: string) => false,
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Statement text", {
        overrideClient: unconfiguredClient,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("NOT_CONFIGURED");
    });

    it("propagates provider timeouts cleanly", async () => {
      const timingOutClient = {
        isConfigured: () => true,
        complete: vi.fn().mockResolvedValue({
          ok: false,
          error: "NVIDIA NIM API request timed out.",
          code: "TIMEOUT",
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatement("Statement text", {
        overrideClient: timingOutClient,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("TIMEOUT");
    });
  });

  describe("3. Category Suggestion", () => {
    it("suggests valid category for ambiguous transaction", async () => {
      const mockClient = {
        isConfigured: () => true,
        complete: vi.fn().mockResolvedValue({
          ok: true,
          text: "Food & Dining",
        }),
      } as unknown as typeof NvidiaClient;

      const cat = await ImportExtractionService.suggestCategory("Unknown local bistro", {
        overrideClient: mockClient,
      });

      expect(cat).toBe("Food & Dining");
    });
  });

  describe("4. PDF Bank Statement Extraction", () => {
    const createSyntheticPdfBytes = (content: string, encrypted = false): Uint8Array => {
      const header = "%PDF-1.4\n";
      const body = encrypted
        ? `/Encrypt 12 0 R\nstream\n${content}\nendstream\n`
        : `stream\nBT\n(${content})\nET\nendstream\n`;
      const trailer = "%%EOF\n";
      return new TextEncoder().encode(header + body + trailer);
    };

    it("rejects non-PDF byte input", async () => {
      const invalidBytes = new TextEncoder().encode("Not a pdf at all");
      const result = await ImportExtractionService.extractBankStatementPdf(invalidBytes);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("UNSUPPORTED_PDF");
    });

    it("identifies encrypted PDF and requires statement password", async () => {
      const encryptedBytes = createSyntheticPdfBytes("Confidential statement", true);
      const result = await ImportExtractionService.extractBankStatementPdf(encryptedBytes);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("PASSWORD_REQUIRED");
      expect(result.error).toContain("password");
    });

    it("extracts digital text PDF statement successfully via NVIDIA NIM text extraction", async () => {
      // PDF containing extractable text stream (> 150 chars with numbers)
      const meaningfulContent = "STATE BANK OF INDIA STATEMENT FOR ACCOUNT 1234567890 DATE 2026-10-02 DESCRIPTION INDIAN OIL CORP FUEL AMOUNT 2500 DEBIT REF SBI009988 BALANCE 50000 CLOSING BALANCE 50000";
      const digitalPdf = createSyntheticPdfBytes(meaningfulContent);

      const mockClient = {
        isConfigured: (f?: string) => true,
        complete: vi.fn().mockImplementation(async (opts) => {
          expect(opts.feature).toBe("import");
          return {
            ok: true,
            text: JSON.stringify({
              bankName: "State Bank of India",
              accountNumberMasked: "******7890",
              transactions: [
                {
                  date: "2026-10-02",
                  description: "INDIAN OIL CORP FUEL",
                  amount: 2500,
                  direction: "DEBIT",
                  reference: "SBI009988",
                  category: "Transportation",
                },
              ],
            }),
          };
        }),
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatementPdf(digitalPdf, {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.bankName).toBe("State Bank of India");
      expect(result.data?.transactions[0].amount).toBe(2500);
      expect(result.data?.transactions[0].direction).toBe("DEBIT");
    });

    it("fails honestly with UNSUPPORTED_PDF on scanned or image-only PDFs without text streams", async () => {
      // Empty text stream simulates a scanned image-only PDF
      const scannedPdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n%%EOF");

      const mockClient = {
        isConfigured: (f?: string) => true,
      } as unknown as typeof NvidiaClient;

      const result = await ImportExtractionService.extractBankStatementPdf(scannedPdf, {
        overrideClient: mockClient,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("UNSUPPORTED_PDF");
      expect(result.error).toContain("Scanned or image-only PDF statements without text streams are not supported");
    });
  });
});
