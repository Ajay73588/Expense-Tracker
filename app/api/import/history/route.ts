import { getCurrentUserId } from "@/lib/auth";
import { ImportHistoryService } from "@/services/import/import-history.service";
import { ok, handleError } from "@/lib/api";
import { assertPrismaMode } from "@/lib/feature-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    assertPrismaMode();
    const userId = await getCurrentUserId();
    const history = ImportHistoryService.list(userId);
    return ok(history);
  } catch (err) {
    return handleError(err);
  }
}
