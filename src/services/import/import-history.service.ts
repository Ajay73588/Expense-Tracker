import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { assertPrismaMode } from "../../lib/feature-gate";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { createLogger } from "../../lib/logger";

const log = createLogger("ImportHistoryService");

export interface ImportHistoryEntry {
  id: string;
  userId: string;
  importDate: string; // ISO
  source: string; // e.g. "HDFC Bank", "Standard CSV", "Groww", "CAMS CAS"
  fileType: string; // "CSV", "TSV", "XLSX", "PDF"
  fileName: string;
  accountName: string | null;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  finalStatus: "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED" | "ROLLED_BACK";
  errorSummary: string | null;
  recordIds: string[];
  recordType: "TRANSACTION" | "ASSET";
  canRollback: boolean;
}

// In-memory cache + file persistence store
let inMemoryStore: ImportHistoryEntry[] = [];
let isLoaded = false;

const STORAGE_DIR = path.join(process.cwd(), ".cache");
const STORAGE_FILE = path.join(STORAGE_DIR, "import-history.json");

function ensureLoaded() {
  if (isLoaded) return;
  try {
    if (existsSync(STORAGE_FILE)) {
      const data = readFileSync(STORAGE_FILE, "utf-8");
      inMemoryStore = JSON.parse(data);
    }
  } catch (err) {
    log.warn("import_history.load_failed", { error: String(err) });
  }
  isLoaded = true;
}

function persistStore() {
  try {
    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true });
    }
    writeFileSync(STORAGE_FILE, JSON.stringify(inMemoryStore, null, 2), "utf-8");
  } catch (err) {
    log.warn("import_history.persist_failed", { error: String(err) });
  }
}

export const ImportHistoryService = {
  /**
   * Records a new completed or partial import into history.
   */
  record(entry: Omit<ImportHistoryEntry, "id" | "importDate" | "canRollback">): ImportHistoryEntry {
    ensureLoaded();
    const id = `imp_hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEntry: ImportHistoryEntry = {
      id,
      ...entry,
      importDate: new Date().toISOString(),
      canRollback: entry.recordIds.length > 0 && entry.finalStatus !== "FAILED",
    };

    inMemoryStore.unshift(fullEntry);
    persistStore();
    log.info("import_history.recorded", { id, userId: entry.userId, source: entry.source });
    return fullEntry;
  },

  /**
   * List import history for a specific user.
   */
  list(userId: string): ImportHistoryEntry[] {
    ensureLoaded();
    return inMemoryStore.filter((e) => e.userId === userId);
  },

  /**
   * Get a single import history entry.
   */
  get(userId: string, id: string): ImportHistoryEntry | null {
    ensureLoaded();
    const entry = inMemoryStore.find((e) => e.id === id && e.userId === userId);
    return entry || null;
  },

  /**
   * Safely rolls back an import batch.
   * Only deletes records specifically created by this import batch.
   * Never uses wildcard or name-based deletes.
   */
  async rollback(userId: string, id: string): Promise<{ rolledBackCount: number }> {
    assertPrismaMode();
    ensureLoaded();
    const entry = inMemoryStore.find((e) => e.id === id && e.userId === userId);
    if (!entry) {
      throw new NotFoundError("Import history record");
    }

    if (!entry.canRollback || entry.finalStatus === "ROLLED_BACK") {
      throw new BadRequestError("This import cannot be rolled back or has already been rolled back.");
    }

    const { prisma } = await import("../../lib/prisma");
    const { cache, cacheKey } = await import("../../lib/cache");
    let rolledBackCount = 0;

    type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

    if (entry.recordType === "TRANSACTION") {
      await prisma.$transaction(async (tx: Tx) => {
        const result = await tx.transaction.updateMany({
          where: {
            id: { in: entry.recordIds },
            userId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
        rolledBackCount = result.count;
      });

      await cache.delByPrefix(cacheKey("tx", userId));
      await cache.delByPrefix(cacheKey("dashboard", userId));
    } else if (entry.recordType === "ASSET") {
      await prisma.$transaction(async (tx: Tx) => {
        const result = await tx.asset.updateMany({
          where: {
            id: { in: entry.recordIds },
            userId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
          },
        });
        rolledBackCount = result.count;
      });

      await cache.delByPrefix(cacheKey("dashboard", userId));
    }

    entry.finalStatus = "ROLLED_BACK";
    entry.canRollback = false;
    persistStore();

    log.info("import_history.rollback_complete", { id, userId, rolledBackCount });
    return { rolledBackCount };
  },

  /**
   * Test helper to clear store.
   */
  _clearForTest() {
    inMemoryStore = [];
    isLoaded = true;
  },
};
