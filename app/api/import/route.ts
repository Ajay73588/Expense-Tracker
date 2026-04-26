import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { ImportService } from "@/services/import.service";
import { ok, handleError, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const contentType = req.headers.get("content-type") ?? "";

    let csvText: string;
    let previewOnly = false;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      previewOnly = form.get("preview") === "true";
      if (!(file instanceof File)) return fail("No file uploaded", "VALIDATION_ERROR", 400);
      csvText = await file.text();
    } else {
      const body = await req.json();
      csvText = body.csv;
      previewOnly = body.preview === true;
      if (!csvText) return fail("csv field required", "VALIDATION_ERROR", 400);
    }

    if (previewOnly) {
      const preview = await ImportService.preview(csvText);
      return ok({
        source: preview.adapter?.source ?? null,
        rows: preview.rows,
        total: preview.rows.length,
      });
    }

    const report = await ImportService.processFile(userId, csvText);
    return ok(report);
  } catch (err) {
    return handleError(err);
  }
}
