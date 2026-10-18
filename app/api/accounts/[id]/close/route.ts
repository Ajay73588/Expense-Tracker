import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AccountService } from "@/services/account.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/accounts/[id]/close — soft-close an account (preserves historical data). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const account = await AccountService.close(userId, params.id);
    return ok(account);
  } catch (err) {
    return handleError(err);
  }
}
