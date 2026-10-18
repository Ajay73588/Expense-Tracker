import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AccountService } from "@/services/account.service";
import { accountSchema, accountUpdateSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/accounts — list all open accounts for the authenticated user. */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const accounts = await AccountService.list(userId);
    return ok({ accounts });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/accounts — create a new account. */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid account data", parsed.error.flatten());
    const account = await AccountService.create(userId, parsed.data);
    return ok(account, 201);
  } catch (err) {
    return handleError(err);
  }
}
