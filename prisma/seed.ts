import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds a demo user with realistic multi-asset holdings, transactions, budgets,
 * goals, liabilities, allocation targets, and 90 days of net-worth snapshots.
 * Safe to re-run — clears previous demo data first.
 */
async function main() {
  console.log("🌱 Seeding FinanceAI demo data…");

  // Reset demo user
  const existing = await prisma.user.findUnique({ where: { email: "demo@financeai.app" } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log("  cleared existing demo user");
  }

  const user = await prisma.user.create({
    data: {
      email: "demo@financeai.app",
      name: "Demo Investor",
      currency: "INR",
      clerkId: "demo_local",
    },
  });
  console.log(`  user: ${user.email}`);

  // ---------- Assets ----------
  const assets = [
    // Stocks
    { type: "STOCK", name: "Reliance Industries", symbol: "RELIANCE", quantity: 25, avgBuyPrice: 2450, currentPrice: 2930, account: "Zerodha" },
    { type: "STOCK", name: "Tata Consultancy Services", symbol: "TCS", quantity: 12, avgBuyPrice: 3600, currentPrice: 4145, account: "Zerodha" },
    { type: "STOCK", name: "Infosys", symbol: "INFY", quantity: 40, avgBuyPrice: 1520, currentPrice: 1810, account: "Groww" },
    { type: "STOCK", name: "HDFC Bank", symbol: "HDFCBANK", quantity: 30, avgBuyPrice: 1520, currentPrice: 1675, account: "Groww" },
    { type: "STOCK", name: "ICICI Bank", symbol: "ICICIBANK", quantity: 50, avgBuyPrice: 980, currentPrice: 1245, account: "Zerodha" },
    { type: "STOCK", name: "ITC Limited", symbol: "ITC", quantity: 100, avgBuyPrice: 420, currentPrice: 465, account: "Zerodha" },

    // Mutual Funds
    { type: "MUTUAL_FUND", name: "Axis Bluechip Fund Direct", symbol: "AXISBLUE", quantity: 1250.45, avgBuyPrice: 52, currentPrice: 58.3, account: "Groww" },
    { type: "MUTUAL_FUND", name: "Parag Parikh Flexi Cap", symbol: "PPFCF", quantity: 420.12, avgBuyPrice: 58, currentPrice: 72.4, account: "Groww" },
    { type: "MUTUAL_FUND", name: "Mirae Asset Large Cap", symbol: "MIRAELC", quantity: 580.3, avgBuyPrice: 88, currentPrice: 95.6, account: "Groww" },
    { type: "MUTUAL_FUND", name: "ICICI Pru Technology Fund", symbol: "ICICITECH", quantity: 150, avgBuyPrice: 165, currentPrice: 182.4, account: "Groww" },

    // Crypto
    { type: "CRYPTO", name: "Bitcoin", symbol: "BTC", quantity: 0.035, avgBuyPrice: 4200000, currentPrice: 5850000, account: "CoinDCX" },
    { type: "CRYPTO", name: "Ethereum", symbol: "ETH", quantity: 0.8, avgBuyPrice: 220000, currentPrice: 342000, account: "CoinDCX" },
    { type: "CRYPTO", name: "Solana", symbol: "SOL", quantity: 12, avgBuyPrice: 12000, currentPrice: 18200, account: "CoinDCX" },

    // Real Estate
    { type: "REAL_ESTATE", name: "2BHK Coimbatore", symbol: null, quantity: 1, avgBuyPrice: 5500000, currentPrice: 6800000, account: "Owned" },

    // Cash / FD
    { type: "CASH", name: "HDFC Savings", symbol: null, quantity: 1, avgBuyPrice: 285000, currentPrice: 285000, account: "HDFC Bank" },
    { type: "CASH", name: "SBI Fixed Deposit", symbol: null, quantity: 1, avgBuyPrice: 400000, currentPrice: 412500, account: "SBI" },
  ];

  for (const a of assets) {
    await prisma.asset.create({
      data: {
        userId: user.id,
        type: a.type,
        name: a.name,
        symbol: a.symbol,
        quantity: a.quantity,
        avgBuyPrice: a.avgBuyPrice,
        currentPrice: a.currentPrice,
        currency: "INR",
        account: a.account,
        importSource: "seed",
      },
    });
  }
  console.log(`  assets: ${assets.length}`);

  // ---------- Liabilities ----------
  const liabilities = [
    { type: "HOME_LOAN", name: "SBI Home Loan", principalAmount: 3500000, outstandingAmount: 2850000, interestRate: 8.4, monthlyEMI: 32500 },
    { type: "CREDIT_CARD", name: "HDFC Infinia", principalAmount: 45000, outstandingAmount: 18500, interestRate: 42, monthlyEMI: 5000 },
  ];
  for (const l of liabilities) {
    await prisma.liability.create({
      data: {
        userId: user.id,
        type: l.type,
        name: l.name,
        principalAmount: l.principalAmount,
        outstandingAmount: l.outstandingAmount,
        interestRate: l.interestRate,
        monthlyEMI: l.monthlyEMI,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`  liabilities: ${liabilities.length}`);

  // ---------- Transactions (last 3 months) ----------
  const categories = {
    INCOME: ["Salary", "Freelance", "Dividend"],
    EXPENSE: ["Food", "Rent", "Transport", "Utilities", "Entertainment", "Shopping", "Healthcare", "SIP"],
  };
  const expenseAmounts: Record<string, [number, number]> = {
    Food: [200, 1200],
    Rent: [22000, 22000],
    Transport: [300, 2500],
    Utilities: [1500, 4500],
    Entertainment: [400, 2500],
    Shopping: [800, 8000],
    Healthcare: [500, 4000],
    SIP: [25000, 25000],
  };

  const now = new Date();
  let txCount = 0;
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    // Salary on 1st
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "INCOME",
        amount: 180000,
        category: "Salary",
        description: "Monthly salary",
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 1),
        account: "HDFC Bank",
        tags: "[]",
      },
    });
    txCount++;

    // Occasional freelance income
    if (monthsAgo !== 1) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: "INCOME",
          amount: 15000 + Math.floor(Math.random() * 20000),
          category: "Freelance",
          description: "Consulting project",
          date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 12),
          account: "HDFC Bank",
          tags: "[]",
        },
      });
      txCount++;
    }

    // Monthly recurring
    for (const cat of ["Rent", "SIP"]) {
      const [lo, hi] = expenseAmounts[cat];
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: "EXPENSE",
          amount: lo + Math.floor(Math.random() * (hi - lo + 1)),
          category: cat,
          description: cat === "SIP" ? "Monthly SIP" : "Rent payment",
          date: new Date(monthStart.getFullYear(), monthStart.getMonth(), cat === "Rent" ? 5 : 10),
          account: "HDFC Bank",
          tags: "[]",
        },
      });
      txCount++;
    }

    // 15-25 variable expenses scattered through the month
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const maxDay = monthsAgo === 0 ? now.getDate() : daysInMonth;
    const variableCount = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < variableCount; i++) {
      const cat = ["Food", "Transport", "Utilities", "Entertainment", "Shopping", "Healthcare"][Math.floor(Math.random() * 6)];
      const [lo, hi] = expenseAmounts[cat];
      const day = 1 + Math.floor(Math.random() * maxDay);
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: "EXPENSE",
          amount: lo + Math.floor(Math.random() * (hi - lo + 1)),
          category: cat,
          description: `${cat} expense`,
          date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
          account: "HDFC Bank",
          tags: "[]",
        },
      });
      txCount++;
    }
  }
  console.log(`  transactions: ${txCount}`);

  // ---------- Budgets (current month) ----------
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const budgets = [
    { category: "Food", monthlyLimit: 20000 },
    { category: "Transport", monthlyLimit: 10000 },
    { category: "Utilities", monthlyLimit: 6000 },
    { category: "Entertainment", monthlyLimit: 8000 },
    { category: "Shopping", monthlyLimit: 15000 },
    { category: "Healthcare", monthlyLimit: 8000 },
  ];
  for (const b of budgets) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        month: currentMonth,
        year: currentYear,
        alertAt80: true,
        alertAt100: true,
      },
    });
  }
  console.log(`  budgets: ${budgets.length}`);

  // ---------- Goals ----------
  const goals = [
    { name: "Emergency Fund (6 months)", targetAmount: 600000, currentAmount: 285000, monthsOut: 12 },
    { name: "Retirement Corpus", targetAmount: 30000000, currentAmount: 2400000, monthsOut: 240 },
    { name: "Down Payment — New Home", targetAmount: 2000000, currentAmount: 450000, monthsOut: 36 },
    { name: "Child's Education", targetAmount: 5000000, currentAmount: 320000, monthsOut: 180 },
    { name: "Dream Vacation (Japan)", targetAmount: 300000, currentAmount: 95000, monthsOut: 10 },
  ];
  for (const g of goals) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + g.monthsOut);
    const monthlyRequired = Math.max(0, (g.targetAmount - g.currentAmount) / g.monthsOut);
    await prisma.goal.create({
      data: {
        userId: user.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate,
        monthlyRequired,
        status: "ACTIVE",
      },
    });
  }
  console.log(`  goals: ${goals.length}`);

  // ---------- Allocation targets ----------
  const targets = [
    { assetType: "STOCK", targetPercent: 40 },
    { assetType: "MUTUAL_FUND", targetPercent: 30 },
    { assetType: "CRYPTO", targetPercent: 5 },
    { assetType: "REAL_ESTATE", targetPercent: 15 },
    { assetType: "CASH", targetPercent: 10 },
  ];
  for (const t of targets) {
    await prisma.allocationTarget.create({
      data: { userId: user.id, assetType: t.assetType, targetPercent: t.targetPercent },
    });
  }
  console.log(`  allocation targets: ${targets.length}`);

  // ---------- Snapshots (last 90 days) ----------
  const liveAssets = await prisma.asset.findMany({ where: { userId: user.id } });
  const liveLiabs = await prisma.liability.findMany({ where: { userId: user.id } });
  const currentAssetValue = liveAssets.reduce((s, a) => s + a.quantity * a.currentPrice, 0);
  const currentLiabValue = liveLiabs.reduce((s, l) => s + l.outstandingAmount, 0);
  const currentNetWorth = currentAssetValue - currentLiabValue;

  // Back-compute a plausible upward-trending history ending at today's net worth
  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);

    // Start ~18% lower 90 days ago, with daily ±1% noise
    const trendFactor = 0.82 + ((89 - daysAgo) / 89) * 0.18;
    const noise = 0.99 + Math.random() * 0.02;
    const netWorth = Math.round(currentNetWorth * trendFactor * noise);
    const totalAssets = Math.round(currentAssetValue * trendFactor * noise);
    const totalLiabilities = Math.round(currentLiabValue * (1.02 - (89 - daysAgo) / 89 * 0.04)); // liabilities shrink slightly

    await prisma.snapshot.create({
      data: {
        userId: user.id,
        date,
        totalAssets,
        totalLiabilities,
        netWorth,
        breakdown: JSON.stringify({
          STOCK: totalAssets * 0.42,
          MUTUAL_FUND: totalAssets * 0.28,
          CRYPTO: totalAssets * 0.04,
          REAL_ESTATE: totalAssets * 0.17,
          CASH: totalAssets * 0.09,
        }),
      },
    });
  }
  console.log(`  snapshots: 90 days`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
