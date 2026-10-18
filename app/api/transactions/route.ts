import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { TransactionService } from "@/services/transaction.service";
import { transactionSchema, transactionUpdateSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const category = req.nextUrl.searchParams.get("category") ?? undefined;
    const [list, summary, currentMonth, split] = await Promise.all([
      TransactionService.list(userId, { limit, category }),
      TransactionService.summarizeByMonth(userId, 6),
      TransactionService.currentMonthTotals(userId),
      TransactionService.categorySplit(userId),
    ]);
    return ok({ list, summary, currentMonth, split });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();

    if (body.type === "TRANSFER") {
      const { transferSchema } = await import("@/lib/validators");
      const parsedTransfer = transferSchema.safeParse(body);
      if (!parsedTransfer.success) {
        const issueMsg = parsedTransfer.error.issues[0]?.message || "Invalid transfer input";
        throw new ValidationError(issueMsg, parsedTransfer.error.flatten());
      }
      const created = await TransactionService.createTransfer(userId, parsedTransfer.data);
      return ok(created, 201);
    }

    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const created = await TransactionService.create(userId, parsed.data);
    return ok(created, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const id = req.nextUrl.searchParams.get("id") || body.id;
    if (!id) return fail("id required", "VALIDATION_ERROR", 400);
    const parsed = transactionUpdateSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const updated = await TransactionService.update(userId, id, parsed.data);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id required", "VALIDATION_ERROR", 400);
    await TransactionService.remove(userId, id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}

