import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AIAdvisoryService } from "@/services/ai/ai-advisory.service";
import { aiRequestSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import type { AIAction } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = aiRequestSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());

    const result = await AIAdvisoryService.runAction(
      userId,
      parsed.data.action as AIAction,
      { message: parsed.data.message, history: parsed.data.history }
    );
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const history = await AIAdvisoryService.getHistory(userId);
    return ok(history);
  } catch (err) {
    return handleError(err);
  }
}
