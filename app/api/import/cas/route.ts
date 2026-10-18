import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { CasService } from "@/services/import/cas.service";
import { ImportHistoryService } from "@/services/import/import-history.service";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import { assertPrismaMode } from "@/lib/feature-gate";
import { CAS_MAX_BYTES } from "@/adapters/cas/cas-pdf.adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    if (file.size > CAS_MAX_BYTES) throw new ValidationError("PDF is too large (max 10 MB).");

    const password = (form.get("password") as string) || undefined;
    const confirm = form.get("confirm") === "true";
    const account = (form.get("account") as string) || undefined;
    const replaceMissing = form.get("replaceMissing") === "true";

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!confirm) {
      const preview = await CasService.preview(userId, {
        fileName: file.name,
        bytes,
        password,
        account,
      });
      return ok(preview);
    }

    const commitResult = await CasService.commit(userId, {
      fileName: file.name,
      bytes,
      password,
      account,
      replaceMissing,
    });

    // Record in import history
    ImportHistoryService.record({
      userId,
      source: commitResult.provider === "KFINTECH" ? "KFintech CAS" : "CAMS CAS",
      fileType: "PDF",
      fileName: file.name,
      accountName: account ?? "Mutual Funds",
      totalRows: commitResult.holdingsCount,
      importedCount: commitResult.added + commitResult.updated,
      duplicateCount: 0,
      rejectedCount: 0,
      finalStatus: "COMPLETED",
      errorSummary: null,
      recordIds: [], // Asset records are reconciled via AssetService
      recordType: "ASSET",
    });

    return ok(commitResult);
  } catch (err) {
    return handleError(err);
  }
}
