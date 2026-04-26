import { NextRequest } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { NetWorthService } from "@/services/networth.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const days = Number(req.nextUrl.searchParams.get("days")) || 90;
    const [current, history] = await Promise.all([
      NetWorthService.getCurrent(userId),
      NetWorthService.getHistory(userId, days),
    ]);
    return ok({ current, history });
  } catch (err) {
    return handleError(err);
  }
}
