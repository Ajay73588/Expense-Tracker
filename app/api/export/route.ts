import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { DataExportService } from "@/services/data-export.service";
import { handleError, rateLimited } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/export — Generates authenticated user data exports (JSON archive or CSV tables).
 * Enforces strict user isolation, privacy controls, rate limiting, and no-cache headers.
 * Query parameters:
 *  - format: "json" (default) | "csv"
 *  - type: "transactions" (default for CSV) | "holdings"
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    // 1. Rate limit: max 5 exports per minute
    const rateCheck = await checkRateLimit(`export:${userId}`, 5, 60);
    if (!rateCheck.success) {
      return rateLimited(rateCheck.resetInSeconds);
    }

    const format = req.nextUrl.searchParams.get("format")?.toLowerCase() ?? "json";
    const type = req.nextUrl.searchParams.get("type")?.toLowerCase() ?? "transactions";
    const dateStr = new Date().toISOString().split("T")[0];

    // 2. CSV Export
    if (format === "csv") {
      let csvContent = "";
      let filename = "";

      if (type === "holdings") {
        csvContent = await DataExportService.exportHoldingsCsv(userId);
        filename = `financeai-holdings-${dateStr}.csv`;
      } else {
        csvContent = await DataExportService.exportTransactionsCsv(userId);
        filename = `financeai-transactions-${dateStr}.csv`;
      }

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          "Pragma": "no-cache",
        },
      });
    }

    // 3. Complete JSON Archive Export (Default)
    const exportData = await DataExportService.exportUserData(userId);
    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = `financeai-export-${dateStr}.json`;

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
