import { getCurrentUserId } from "@/lib/auth";
import { PortfolioService } from "@/services/portfolio.service";
import { AssetService } from "@/services/asset.service";
import { ok, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const [allocation, riskScore, summary, rebalance, assets] = await Promise.all([
      PortfolioService.getAllocation(userId),
      PortfolioService.getRiskScore(userId),
      PortfolioService.getPortfolioSummary(userId),
      PortfolioService.getRebalancePlan(userId),
      AssetService.getPortfolioWithPL(userId),
    ]);
    return ok({ allocation, riskScore, summary, rebalance, assets });
  } catch (err) {
    return handleError(err);
  }
}
