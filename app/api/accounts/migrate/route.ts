import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { AccountService } from "@/services/account.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/accounts/migrate — Backfill flat transaction/asset strings to Accounts (LEDGER-003) */
export async function POST(_req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const result = await AccountService.migrateFlatAccounts(userId);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
