import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AccountService } from "@/services/account.service";
import { accountUpdateSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/accounts/[id] — get a single account (user-scoped). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const account = await AccountService.get(userId, params.id);
    return ok(account);
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH /api/accounts/[id] — update mutable fields (name, type, currency, isDefault, note). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = accountUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid account data", parsed.error.flatten());
    const account = await AccountService.update(userId, params.id, parsed.data);
    return ok(account);
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/accounts/[id] — hard-delete if no linked records, otherwise 409. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const result = await AccountService.delete(userId, params.id);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/accounts/[id]/close — soft-close an account (history preserved). */
// Note: this is handled in the separate [id]/close/route.ts
