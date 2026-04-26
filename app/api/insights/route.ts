import { getCurrentUserId } from "@/lib/auth";
import { InsightsService } from "@/services/insights.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const insights = await InsightsService.getLatest(userId);
    return ok(insights);
  } catch (err) {
    return handleError(err);
  }
}
