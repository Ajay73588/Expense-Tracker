import { getCurrentUserId } from "@/lib/auth";
import { HealthScoreService } from "@/services/healthscore.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const score = await HealthScoreService.compute(userId);
    return ok(score);
  } catch (err) {
    return handleError(err);
  }
}
