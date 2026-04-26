import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { BudgetService } from "@/services/budget.service";
import { budgetSchema } from "@/lib/validators";
import { ok, handleError, fail } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const month = Number(req.nextUrl.searchParams.get("month")) || undefined;
    const year = Number(req.nextUrl.searchParams.get("year")) || undefined;
    const usage = await BudgetService.getUsage(userId, month, year);
    return ok(usage);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const result = await BudgetService.upsert(userId, parsed.data);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError("Invalid input", parsed.error.flatten());
    const result = await BudgetService.upsert(userId, parsed.data);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return fail("id required", "VALIDATION_ERROR", 400);
    await BudgetService.remove(userId, id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
