import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { LiabilityService } from "@/services/liability.service";
import { liabilitySchema, liabilityUpdateSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import type { LiabilityType } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/liabilities — retrieves all liabilities and portfolio summary for authenticated user.
 */
export async function GET(_req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const summary = await LiabilityService.getSummary(userId);
    return ok(summary);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/liabilities — creates a new liability with Zod validation.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = liabilitySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid liability data", parsed.error.flatten());
    }

    const created = await LiabilityService.create(userId, {
      ...parsed.data,
      type: parsed.data.type as LiabilityType,
    });
    return ok(created, 201);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/liabilities?id=... — updates liability by query parameter.
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id query parameter is required", "VALIDATION_ERROR", 400);

    const body = await req.json();
    const parsed = liabilityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid liability update data", parsed.error.flatten());
    }

    const updated = await LiabilityService.update(userId, id, parsed.data as any);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/liabilities?id=... — deletes liability by query parameter.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id query parameter is required", "VALIDATION_ERROR", 400);

    const result = await LiabilityService.remove(userId, id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
