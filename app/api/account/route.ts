import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AccountLifecycleService } from "@/services/account-lifecycle.service";
import { ok, fail, handleError, rateLimited } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/account — Permanently purges user account and all financial records.
 * Requires explicit confirmation in the JSON body: { confirmation: "DELETE" }.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Rate limit: max 3 attempts per 5 minutes
    const rateCheck = await checkRateLimit(`account:delete:${user.id}`, 3, 300);
    if (!rateCheck.success) {
      return rateLimited(rateCheck.resetInSeconds);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return fail(
        "Request body must be valid JSON with { confirmation: 'DELETE' }",
        "CONFIRMATION_REQUIRED",
        400
      );
    }

    const confirmation =
      typeof body?.confirmation === "string" ? body.confirmation.trim().toUpperCase() : "";

    if (confirmation !== "DELETE" && confirmation !== "DELETE MY ACCOUNT") {
      return fail(
        "Explicit confirmation 'DELETE' is required to permanently delete your account",
        "CONFIRMATION_REQUIRED",
        400
      );
    }

    const result = await AccountLifecycleService.deleteAccount(user.id, {
      clerkUserId: user.clerkId ?? undefined,
    });

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
