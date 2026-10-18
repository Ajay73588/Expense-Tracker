import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { StandardTransactionService } from "@/services/import/standard-transaction.service";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Download the standard FinanceAI transaction CSV template.
 */
export async function GET() {
  try {
    await getCurrentUserId();
    const csvContent = StandardTransactionService.generateTemplateCsv();

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="FinanceAI_Transaction_Template.csv"',
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
