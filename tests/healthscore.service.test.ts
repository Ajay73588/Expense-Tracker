import { describe, expect, it, vi, beforeEach } from "vitest";
import { HealthScoreService } from "../src/services/healthscore.service";
import { TransactionService } from "../src/services/transaction.service";
import { NetWorthService } from "../src/services/networth.service";
import { PortfolioService } from "../src/services/portfolio.service";
import { GoalService } from "../src/services/goal.service";

const mockLiabilityFindMany = vi.fn();
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    liability: {
      findMany: (...args: any[]) => mockLiabilityFindMany(...args),
    },
  },
}));

vi.mock("../src/services/transaction.service", () => ({
  TransactionService: {
    summarizeByMonth: vi.fn(),
  }
}));

vi.mock("../src/services/networth.service", () => ({
  NetWorthService: {
    getCurrent: vi.fn(),
  }
}));

vi.mock("../src/services/portfolio.service", () => ({
  PortfolioService: {
    getAllocation: vi.fn(),
    getDiversificationScore: vi.fn(),
  }
}));

vi.mock("../src/services/goal.service", () => ({
  GoalService: {
    getAvgProgress: vi.fn(),
  }
}));

describe("HealthScoreService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set default mocks to "zero" state (worst possible scores typically, except DTI which is 0/best if no income but handled)
    mockLiabilityFindMany.mockResolvedValue([]);
    vi.mocked(TransactionService.summarizeByMonth).mockResolvedValue([]);
    vi.mocked(NetWorthService.getCurrent).mockResolvedValue({ totalAssets: 0, totalLiabilities: 0, netWorth: 0 } as any);
    vi.mocked(PortfolioService.getAllocation).mockResolvedValue([]);
    vi.mocked(PortfolioService.getDiversificationScore).mockResolvedValue(0);
    vi.mocked(GoalService.getAvgProgress).mockResolvedValue(0);
  });

  it("calculates a score of 0 (NEEDS_WORK) when all metrics are at their lowest boundary", async () => {
    // To get 0 points for DTI, we need DTI > 50%.
    vi.mocked(TransactionService.summarizeByMonth).mockResolvedValue([
      { month: "Jan", income: 1000, expense: 1000 } as any // 0% savings
    ]);
    mockLiabilityFindMany.mockResolvedValue([
      { monthlyEMI: 600 } // 60% DTI
    ]);
    const result = await HealthScoreService.compute("u1");
    
    expect(result.total).toBe(0);
    expect(result.rating).toBe("NEEDS_WORK");
  });

  it("calculates a score of 0 (NEEDS_WORK) when DTI is forced > 50%", async () => {
    // Force DTI > 50%
    vi.mocked(TransactionService.summarizeByMonth).mockResolvedValue([
      { month: "Jan", income: 1000, expense: 1000 } as any
    ]);
    mockLiabilityFindMany.mockResolvedValue([
      { monthlyEMI: 600 }
    ]);
    // Savings rate = 0% -> score 0
    // DTI = 60% -> score 0
    
    const result = await HealthScoreService.compute("u1");
    
    expect(result.total).toBe(0);
    expect(result.rating).toBe("NEEDS_WORK");
    expect(result.breakdown.savingsRate.score).toBe(0);
    expect(result.breakdown.debtToIncome.score).toBe(0);
    expect(result.breakdown.investmentAllocation.score).toBe(0);
    expect(result.breakdown.goalProgress.score).toBe(0);
    expect(result.breakdown.diversification.score).toBe(0);
  });

  it("calculates a perfect score of 10 (EXCELLENT) when all metrics are at their highest boundary", async () => {
    vi.mocked(TransactionService.summarizeByMonth).mockResolvedValue([
      { month: "Jan", income: 1000, expense: 700 } as any // 30% savings rate (>20) -> score 2
    ]);
    mockLiabilityFindMany.mockResolvedValue([
      { monthlyEMI: 200 } // 20% DTI (<30) -> score 2
    ]);
    vi.mocked(NetWorthService.getCurrent).mockResolvedValue({ totalAssets: 10000 } as any);
    vi.mocked(PortfolioService.getAllocation).mockResolvedValue([
      { assetType: "STOCK", value: 5000 } as any // 50% invested (>40) -> score 2
    ]);
    vi.mocked(GoalService.getAvgProgress).mockResolvedValue(0.8); // 80% goal (>70) -> score 2
    vi.mocked(PortfolioService.getDiversificationScore).mockResolvedValue(0.9); // 90% div (>80) -> score 2

    const result = await HealthScoreService.compute("u1");
    
    expect(result.total).toBe(10);
    expect(result.rating).toBe("EXCELLENT");
    expect(result.breakdown.savingsRate.score).toBe(2);
    expect(result.breakdown.debtToIncome.score).toBe(2);
    expect(result.breakdown.investmentAllocation.score).toBe(2);
    expect(result.breakdown.goalProgress.score).toBe(2);
    expect(result.breakdown.diversification.score).toBe(2);
  });

  it("calculates middle scores correctly (1 point each)", async () => {
    vi.mocked(TransactionService.summarizeByMonth).mockResolvedValue([
      { month: "Jan", income: 1000, expense: 850 } as any // 15% savings rate (10-20) -> score 1
    ]);
    mockLiabilityFindMany.mockResolvedValue([
      { monthlyEMI: 400 } // 40% DTI (30-50) -> score 1
    ]);
    vi.mocked(NetWorthService.getCurrent).mockResolvedValue({ totalAssets: 10000 } as any);
    vi.mocked(PortfolioService.getAllocation).mockResolvedValue([
      { assetType: "STOCK", value: 3000 } as any // 30% invested (20-40) -> score 1
    ]);
    vi.mocked(GoalService.getAvgProgress).mockResolvedValue(0.5); // 50% goal (40-70) -> score 1
    vi.mocked(PortfolioService.getDiversificationScore).mockResolvedValue(0.6); // 60% div (0.5-0.8) -> score 1

    const result = await HealthScoreService.compute("u1");
    
    expect(result.total).toBe(5);
    expect(result.rating).toBe("FAIR"); // 4-5 is FAIR
    expect(result.breakdown.savingsRate.score).toBe(1);
    expect(result.breakdown.debtToIncome.score).toBe(1);
    expect(result.breakdown.investmentAllocation.score).toBe(1);
    expect(result.breakdown.goalProgress.score).toBe(1);
    expect(result.breakdown.diversification.score).toBe(1);
  });

  it("handles empty arrays/data gracefully", async () => {
    // When no income, savingsRate = 0, DTI = 0 -> score 2 for DTI
    const result = await HealthScoreService.compute("u1");
    
    expect(result.breakdown.savingsRate.value).toBe(0);
    expect(result.breakdown.savingsRate.score).toBe(0);
    
    expect(result.breakdown.debtToIncome.value).toBe(0);
    expect(result.breakdown.debtToIncome.score).toBe(2); // DTI of 0 is < 30, so score is 2
    
    expect(result.breakdown.investmentAllocation.value).toBe(0);
    expect(result.breakdown.investmentAllocation.score).toBe(0);
  });
});
