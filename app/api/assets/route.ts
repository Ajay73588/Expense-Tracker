import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AssetService } from "@/services/asset.service";
import { assetSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";
import type { AssetType } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const refresh = req.nextUrl.searchParams.get("refresh") === "true";
    const assets = await AssetService.getPortfolioWithPL(userId, { refresh });
    return ok(assets);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = assetSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const created = await AssetService.create(userId, {
      ...parsed.data,
      type: parsed.data.type as AssetType,
    });
    return ok(created, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id required", "VALIDATION_ERROR", 400);
    const patch = await req.json();
    await AssetService.update(userId, id, patch);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id required", "VALIDATION_ERROR", 400);
    await AssetService.remove(userId, id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
