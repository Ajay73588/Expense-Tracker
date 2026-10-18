import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { ImportHistoryService } from "@/services/import/import-history.service";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import { assertPrismaMode } from "@/lib/feature-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertPrismaMode();
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));
    const id = body.id || req.nextUrl.searchParams.get("id");

    if (!id) {
      throw new ValidationError("Missing required import ID to roll back.");
    }

    const result = await ImportHistoryService.rollback(userId, id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
