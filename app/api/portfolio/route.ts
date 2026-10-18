import { getCurrentUserId } from "@/lib/auth";
import { PortfolioService } from "@/services/portfolio.service";
import { AssetService } from "@/services/asset.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const [assets, targets] = await Promise.all([
      AssetService.getPortfolioWithPL(userId),
      PortfolioService.getAllocationTargets(userId),
    ]);
    const allocation = await PortfolioService.getAllocation(userId, assets);
    const [riskScore, summary, rebalance] = await Promise.all([
      PortfolioService.getRiskScore(userId, allocation),
      PortfolioService.getPortfolioSummary(userId, assets),
      PortfolioService.getRebalancePlan(userId, 5, { allocation, targets }),
    ]);
    return ok({ allocation, riskScore, summary, rebalance, assets });
  } catch (err) {
    return handleError(err);
  }
}
