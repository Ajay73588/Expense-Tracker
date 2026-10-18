import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { ImportService } from "@/services/import.service";
import { ok, handleError, rateLimited } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { assertPrismaMode } from "@/lib/feature-gate";
import { importRequestSchema } from "@/lib/validators/import";
import { IMPORT_LIMITS } from "@/adapters/sheet-reader";
import { supportMatrix } from "@/adapters/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Which broker / asset-type combinations exist (drives the wizard) + upload limits. */
export async function GET() {
  try {
    assertPrismaMode();
    await getCurrentUserId();
    return ok({ matrix: supportMatrix(), limits: { maxBytes: IMPORT_LIMITS.maxBytes, maxRows: IMPORT_LIMITS.maxRows }, accept: [".csv", ".xls", ".xlsx"] });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * multipart/form-data: file, broker, assetClass, confirm ("true" persists), replaceMissing.
 * confirm=false → preview only. confirm=true → the server re-parses/validates the same file.
 * The file is processed in memory and never written to disk.
 */
export async function POST(req: NextRequest) {
  try {
    assertPrismaMode();
    const userId = await getCurrentUserId();

    const rateCheck = await checkRateLimit(`import:${userId}`, 15, 60);
    if (!rateCheck.success) {
      return rateLimited(rateCheck.resetInSeconds);
    }

    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new ValidationError("Expected multipart/form-data with a file field.");
    }
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > IMPORT_LIMITS.maxBytes + 64 * 1024) throw new ValidationError("File is too large (max 5 MB).");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("No file uploaded.");
    if (file.size > IMPORT_LIMITS.maxBytes) throw new ValidationError("File is too large (max 5 MB).");

    const parsed = importRequestSchema.safeParse({
      broker: form.get("broker"),
      assetClass: form.get("assetClass"),
      confirm: form.get("confirm") === "true",
      replaceMissing: form.get("replaceMissing") === "true",
      account: form.get("account") || undefined,
    });
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request", parsed.error.issues);

    if (parsed.data.account) {
      const { prisma } = await import("@/lib/prisma");
      if (prisma.account?.findFirst) {
        const foreignAccount = await prisma.account.findFirst({
          where: { id: parsed.data.account, NOT: { userId } },
          select: { id: true },
        });
        if (foreignAccount) {
          throw new NotFoundError("Account");
        }
      }
    }

    const input = {
      broker: parsed.data.broker,
      assetClass: parsed.data.assetClass,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      account: parsed.data.account,
      replaceMissing: parsed.data.replaceMissing,
    };

    if (!parsed.data.confirm) return ok(await ImportService.preview(userId, input));
    const result = await ImportService.commit(userId, input);
    try {
      const { ImportHistoryService } = await import("@/services/import/import-history.service");
      ImportHistoryService.record({
        userId,
        source: parsed.data.broker === "GROWW" ? "Groww" : "INDmoney",
        fileType: file.name.split(".").pop()?.toUpperCase() || "XLSX",
        fileName: file.name,
        accountName: parsed.data.account ?? (parsed.data.broker === "GROWW" ? "Groww" : "INDmoney"),
        totalRows: result.added + result.updated + result.skippedInvalidRows,
        importedCount: result.added + result.updated,
        duplicateCount: 0,
        rejectedCount: result.skippedInvalidRows,
        finalStatus: result.skippedInvalidRows > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
        errorSummary: result.skippedInvalidRows > 0 ? `${result.skippedInvalidRows} invalid rows skipped` : null,
        recordIds: [],
        recordType: "ASSET",
      });
    } catch {
      // Non-blocking history record
    }
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
