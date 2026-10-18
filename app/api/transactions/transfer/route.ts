import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { TransactionService } from "@/services/transaction.service";
import { transferSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues[0]?.message || "Invalid transfer input";
      throw new ValidationError(issueMsg, parsed.error.flatten());
    }
    const result = await TransactionService.createTransfer(userId, parsed.data);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
