import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { StandardTransactionService, ColumnMapping } from "@/services/import/standard-transaction.service";
import { BankStatementService } from "@/services/import/bank-statement.service";
import { ImportHistoryService } from "@/services/import/import-history.service";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import { assertPrismaMode } from "@/lib/feature-gate";
import { safeJsonParse } from "@/utils/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    assertPrismaMode();
    const userId = await getCurrentUserId();

    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new ValidationError("Expected multipart/form-data with a file field.");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("No file uploaded.");
    if (file.size > MAX_BYTES) throw new ValidationError("File is too large (max 10 MB).");

    const sourceType = (form.get("sourceType") as string) || "STANDARD"; // "STANDARD" | "BANK"
    const confirm = form.get("confirm") === "true";
    const accountId = (form.get("accountId") as string) || undefined;
    const password = (form.get("password") as string) || undefined;
    const skipDuplicates = form.get("skipDuplicates") !== "false";
    const customMappingStr = form.get("customMapping") as string;
    const customMapping = customMappingStr ? safeJsonParse<ColumnMapping>(customMappingStr, {}) : undefined;

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (sourceType === "BANK") {
      // Bank statement flow (PDF, CSV, TXT, XLSX)
      if (!confirm) {
        const preview = await BankStatementService.preview(userId, {
          fileName: file.name,
          bytes,
          accountId,
          password,
        });
        return ok(preview);
      }

      if (!accountId) {
        throw new ValidationError("Please select a target account for bank statement import.");
      }

      const previewForMeta = await BankStatementService.preview(userId, {
        fileName: file.name,
        bytes,
        accountId,
        password,
      });

      const commitResult = await BankStatementService.commit(userId, {
        fileName: file.name,
        bytes,
        accountId,
        password,
        skipDuplicates,
      });

      // Record in import history with dynamic detected bank name (never logs passwords)
      ImportHistoryService.record({
        userId,
        source: previewForMeta.detection.detectedBank || "Bank Statement",
        fileType: file.name.split(".").pop()?.toUpperCase() || "CSV",
        fileName: file.name,
        accountName: accountId,
        totalRows: commitResult.totalProcessed,
        importedCount: commitResult.importedCount,
        duplicateCount: commitResult.skippedDuplicates,
        rejectedCount: commitResult.skippedInvalid,
        finalStatus:
          commitResult.importedCount > 0
            ? commitResult.skippedInvalid > 0
              ? "COMPLETED_WITH_WARNINGS"
              : "COMPLETED"
            : commitResult.skippedDuplicates > 0
            ? "COMPLETED"
            : "FAILED",
        errorSummary:
          commitResult.skippedInvalid > 0
            ? `${commitResult.skippedInvalid} invalid rows skipped`
            : commitResult.importedCount === 0 && commitResult.skippedDuplicates > 0
            ? "All transactions were duplicates"
            : commitResult.importedCount === 0
            ? "No valid transactions imported"
            : null,
        recordIds: commitResult.createdTransactionIds,
        recordType: "TRANSACTION",
      });

      return ok(commitResult);
    }


    // Standard transaction import flow
    if (!confirm) {
      const preview = await StandardTransactionService.preview(userId, {
        fileName: file.name,
        bytes,
        userAccountId: accountId,
        customMapping,
      });
      return ok(preview);
    }

    const commitResult = await StandardTransactionService.commit(userId, {
      fileName: file.name,
      bytes,
      userAccountId: accountId,
      customMapping,
      skipDuplicates,
    });

    // Record in import history
    ImportHistoryService.record({
      userId,
      source: "Standard Import",
      fileType: file.name.split(".").pop()?.toUpperCase() || "CSV",
      fileName: file.name,
      accountName: accountId ?? null,
      totalRows: commitResult.totalProcessed,
      importedCount: commitResult.importedCount,
      duplicateCount: commitResult.skippedDuplicates,
      rejectedCount: commitResult.skippedInvalid,
      finalStatus: commitResult.skippedInvalid > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED",
      errorSummary: commitResult.skippedInvalid > 0 ? `${commitResult.skippedInvalid} invalid rows skipped` : null,
      recordIds: commitResult.createdTransactionIds,
      recordType: "TRANSACTION",
    });

    return ok(commitResult);
  } catch (err) {
    return handleError(err);
  }
}
