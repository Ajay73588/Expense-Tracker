import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkRateLimit } from "../src/lib/rate-limit";
import { cache } from "../src/lib/cache";
import { DataExportService } from "../src/services/data-export.service";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: vi.fn().mockResolvedValue("user_alice"),
  getCurrentUser: vi.fn().mockResolvedValue({ id: "user_alice", email: "alice@example.com" }),
}));

// In-memory mock database
type Row = Record<string, any>;
let mockDb: {
  transactions: Row[];
  assets: Row[];
  users: Row[];
} = {
  transactions: [],
  assets: [],
  users: [],
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: Row) =>
        mockDb.users.find((u) => u.id === where.id) ?? {
          id: where.id,
          email: "alice@example.com",
          name: "Alice",
          currency: "INR",
          privacyMode: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ),
    },
    transaction: {
      findMany: vi.fn().mockImplementation(async ({ where }: Row) =>
        mockDb.transactions.filter((t) => t.userId === where.userId && (where.deletedAt === null ? !t.deletedAt : true))
      ),
    },
    asset: {
      findMany: vi.fn().mockImplementation(async ({ where }: Row) =>
        mockDb.assets.filter((a) => a.userId === where.userId && (where.deletedAt === null ? !a.deletedAt : true))
      ),
    },
    account: { findMany: vi.fn().mockResolvedValue([]) },
    liability: { findMany: vi.fn().mockResolvedValue([]) },
    budget: { findMany: vi.fn().mockResolvedValue([]) },
    goal: { findMany: vi.fn().mockResolvedValue([]) },
    snapshot: { findMany: vi.fn().mockResolvedValue([]) },
    allocationTarget: { findMany: vi.fn().mockResolvedValue([]) },
    aIConversation: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("Phase 9: Operations & Production Readiness (OPS-001..OPS-010)", () => {
  beforeEach(async () => {
    mockDb = {
      transactions: [
        {
          id: "tx_1",
          userId: "user_alice",
          type: "EXPENSE",
          category: "Food",
          amount: 500,
          account: "HDFC Savings",
          description: "Lunch, with drinks",
          tags: JSON.stringify(["lunch", "dining"]),
          date: new Date("2026-10-18T12:00:00Z"),
          deletedAt: null,
        },
      ],
      assets: [
        {
          id: "ast_1",
          userId: "user_alice",
          type: "STOCK",
          name: "Tata Motors Ltd",
          symbol: "TATAMOTORS",
          quantity: 50,
          avgBuyPrice: 850,
          currentPrice: 920,
          currency: "INR",
          account: "Zerodha",
          isin: "INE155A01022",
          exchange: "NSE",
          priceSource: "YAHOO",
          deletedAt: null,
        },
      ],
      users: [],
    };
    await cache.clear?.();
  });

  describe("1. System Health Check (/api/health) [OPS-002, OPS-006]", () => {
    it("returns HTTP 200 with status healthy and dependency checks", async () => {
      const { GET: healthRoute } = await import("../app/api/health/route");
      const res = await healthRoute();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("healthy");
      expect(json.checks).toHaveProperty("database");
      expect(json.checks.database.status).toBe("up");
      expect(json.checks).toHaveProperty("cache");
      expect(json.checks).toHaveProperty("ai");
      expect(json).not.toHaveProperty("password");
      expect(json).not.toHaveProperty("secret");
    });
  });

  describe("2. Rate Limiting Utility [OPS-008]", () => {
    it("allows requests under the limit and throttles requests exceeding limit", async () => {
      const key = "test:client:123";

      // 1. First 3 requests succeed (limit = 3)
      const r1 = await checkRateLimit(key, 3, 60);
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = await checkRateLimit(key, 3, 60);
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = await checkRateLimit(key, 3, 60);
      expect(r3.success).toBe(true);
      expect(r3.remaining).toBe(0);

      // 2. 4th request is throttled
      const r4 = await checkRateLimit(key, 3, 60);
      expect(r4.success).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.resetInSeconds).toBeGreaterThan(0);
    });
  });

  describe("3. Data Export Formats (JSON & CSV) & Formula Injection Defense [OPS-003]", () => {
    it("exports transactions to standard RFC 4180 CSV with escaped commas", async () => {
      const csv = await DataExportService.exportTransactionsCsv("user_alice");
      expect(csv).toContain("Date,Type,Category,Amount,Account,Description,Tags");
      expect(csv).toContain("2026-10-18,EXPENSE,Food,500,HDFC Savings,\"Lunch, with drinks\",lunch; dining");
    });

    it("neutralizes spreadsheet formula injection in CSV cells (=, +, -, @, \\t, \\r)", async () => {
      const { sanitizeCsvCell } = await import("../src/services/data-export.service");

      // Formula injection attempts
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell("@SUM(B1:B10)")).toBe("'@SUM(B1:B10)");
      expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(sanitizeCsvCell("-2+3+cmd|' /C calc'!A0")).toBe("'-2+3+cmd|' /C calc'!A0");
      expect(sanitizeCsvCell("\t=1+1")).toBe("'\t=1+1");

      // Valid numbers are NOT modified with single quote
      expect(sanitizeCsvCell("500")).toBe("500");
      expect(sanitizeCsvCell("-1250.75")).toBe("-1250.75");
      expect(sanitizeCsvCell("+42")).toBe("+42");

      // RFC 4180 quoting combined with formula neutralization
      expect(sanitizeCsvCell("=HYPERLINK(\"http://evil.com\", \"Click\")")).toBe(
        "\"'=HYPERLINK(\"\"http://evil.com\"\", \"\"Click\"\")\""
      );
    });

    it("exports holdings to standard RFC 4180 CSV with formula injection defense", async () => {
      mockDb.assets.push({
        id: "ast_injection",
        userId: "user_alice",
        type: "STOCK",
        name: "=cmd|' /C calc'!A0",
        symbol: "@DDE",
        quantity: 10,
        avgBuyPrice: 100,
        currentPrice: 120,
        currency: "INR",
        account: "Zerodha",
        isin: null,
        exchange: "NSE",
        priceSource: "YAHOO",
        deletedAt: null,
      });

      const csv = await DataExportService.exportHoldingsCsv("user_alice");
      expect(csv).toContain("'=cmd|' /C calc'!A0");
      expect(csv).toContain("'@DDE");
    });

    it("GET /api/export handles format=csv query and sets attachment headers", async () => {
      const { GET: exportRoute } = await import("../app/api/export/route");
      const req = new NextRequest("http://localhost:3000/api/export?format=csv");
      const res = await exportRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("financeai-transactions-");
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  describe("4. Secret & Credential Protection in Structured Logs [OPS-001, OPS-006]", () => {
    it("redacts sensitive fields and database passwords from logs", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { createLogger } = await import("../src/lib/logger");
      const logger = createLogger("test-service");

      logger.info("Test log", {
        apiKey: "nvapi-secret12345",
        password: "super_secret_db_pass",
        database_url: "postgresql://postgres:mysecretpass@localhost:5432/financeai",
        safeField: "public_value",
      });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.apiKey).toBe("[REDACTED]");
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.database_url).not.toContain("mysecretpass");
      expect(parsed.database_url).toContain("[REDACTED]");
      expect(parsed.safeField).toBe("public_value");

      consoleSpy.mockRestore();
    });

    it("redacts database credentials and bearer tokens directly inside the message string", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { createLogger } = await import("../src/lib/logger");
      const logger = createLogger("test-service");

      logger.warn("Database failed: postgresql://admin:leaked_pass@cluster.aws.neon.tech/financeai with Bearer sec_tok_998877");

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.message).not.toContain("leaked_pass");
      expect(parsed.message).toContain("[REDACTED]");
      expect(parsed.message).not.toContain("sec_tok_998877");
      expect(parsed.message).toContain("Bearer [REDACTED]");

      consoleSpy.mockRestore();
    });
  });

  describe("5. Cron Authentication & Staging Protection [OPS-005, OPS-008]", () => {
    it("rejects unauthorized cron requests with HTTP 401", async () => {
      const origSecret = process.env.CRON_SECRET;
      process.env.CRON_SECRET = "production_super_secret_key_123456";

      try {
        const { GET: cronRoute } = await import("../app/api/cron/prices/route");
        const req = new NextRequest("http://localhost:3000/api/cron/prices", {
          headers: { Authorization: "Bearer wrong_secret_token" },
        });
        const res = await cronRoute(req);
        expect(res.status).toBe(401);
      } finally {
        process.env.CRON_SECRET = origSecret;
      }
    });

    it("rejects missing secret in production mode with HTTP 500 configuration error", async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.CRON_SECRET;
      (process.env as any).NODE_ENV = "production";
      delete process.env.CRON_SECRET;

      try {
        const { GET: cronRoute } = await import("../app/api/cron/prices/route");
        const req = new NextRequest("http://localhost:3000/api/cron/prices");
        const res = await cronRoute(req);
        expect(res.status).toBe(500);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.CRON_SECRET = origSecret;
      }
    });

    it("rejects missing secret when APP_ENV=staging with HTTP 500 configuration error", async () => {
      const origAppEnv = process.env.APP_ENV;
      const origSecret = process.env.CRON_SECRET;
      process.env.APP_ENV = "staging";
      delete process.env.CRON_SECRET;

      try {
        const { GET: cronRoute } = await import("../app/api/cron/prices/route");
        const req = new NextRequest("http://localhost:3000/api/cron/prices");
        const res = await cronRoute(req);
        expect(res.status).toBe(500);
      } finally {
        process.env.APP_ENV = origAppEnv;
        process.env.CRON_SECRET = origSecret;
      }
    });
  });

  describe("6. Cross-Tenant Authorization & Account Isolation [OPS-008]", () => {
    it("StandardTransactionService rejects foreign account ID with NotFoundError", async () => {
      const { StandardTransactionService } = await import("../src/services/import/standard-transaction.service");
      const csvData = "date,description,amount\n2026-10-18,Test,100";
      const bytes = new TextEncoder().encode(csvData);

      await expect(
        StandardTransactionService.preview("user_alice", {
          fileName: "test.csv",
          bytes,
          userAccountId: "acc_foreign_bob",
        })
      ).rejects.toThrow("Target account");
    });
  });
});
