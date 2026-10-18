import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { LiabilityService } from "@/services/liability.service";
import { prepaymentSimulationSchema } from "@/lib/validators";
import { ok, handleError } from "@/lib/api";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/liabilities/[id]/schedule — simulates prepayment impact on loan tenure and EMI.
 * Scoped by authenticated user ID (404 on unowned).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));
    const parsed = prepaymentSimulationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid prepayment simulation data", parsed.error.flatten());
    }

    const result = await LiabilityService.simulatePrepayment(userId, params.id, parsed.data);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
