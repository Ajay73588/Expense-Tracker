import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AssetService } from "@/services/asset.service";
import { assetUpdateSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    const asset = await AssetService.getById(userId, params.id);
    return ok(asset);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = assetUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const updated = await AssetService.update(userId, params.id, parsed.data as any);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    const result = await AssetService.remove(userId, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
