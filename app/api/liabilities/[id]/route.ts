import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { LiabilityService } from "@/services/liability.service";
import { liabilityUpdateSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/liabilities/[id] — get a single liability with its full amortization schedule.
 * Scoped by authenticated user ID (404 on unowned).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const result = await LiabilityService.getById(userId, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/liabilities/[id] — update mutable fields of a liability.
 * Scoped by authenticated user ID (404 on unowned).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = liabilityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid liability update data", parsed.error.flatten());
    }

    const updated = await LiabilityService.update(userId, params.id, parsed.data as any);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/liabilities/[id] — delete a liability.
 * Scoped by authenticated user ID (404 on unowned).
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const result = await LiabilityService.remove(userId, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
