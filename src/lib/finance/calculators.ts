/**
 * FinanceAI — Financial Planning Calculators Suite (F-15 / CALC-001..003)
 * 
 * Pure, deterministic mathematical calculation engine for:
 * 1. Systematic Investment Plan (SIP)
 * 2. Step-Up (Top-Up) SIP
 * 3. Lumpsum Compound Growth
 * 4. Financial Independence, Retire Early (FIRE) Planning
 * 
 * Safe handling of zero values, negative numbers, division by zero, extreme horizons,
 * and standard rounding to paisa (2 decimal places).
 */

import { calculateXIRR } from "./returns";

export interface YearlyBreakdown {
  year: number;
  invested: number;
  returns: number;
  totalValue: number;
  annualContribution?: number;
  monthlyContribution?: number;
}

// ---------------------------------------------------------------------------
// 1. SIP Calculator
// ---------------------------------------------------------------------------

export interface SIPInput {
  monthlyInvestment: number;
  annualReturnPct: number;
  durationYears: number;
}

export interface SIPResult {
  totalInvested: number;
  estimatedReturns: number;
  finalCorpus: number;
  breakdown: YearlyBreakdown[];
}

/** Round half-up to 2 decimal places */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates Systematic Investment Plan (SIP) growth.
 * Standard industry formula (Annuity Due):
 * M = P * ((1 + i)^n - 1) / i * (1 + i)
 * where P = monthly amount, i = annualRate / 12 / 100, n = duration * 12
 */
export function calculateSIP(input: SIPInput): SIPResult {
  const P = Math.max(0, Number(input.monthlyInvestment) || 0);
  const R = Math.max(0, Number(input.annualReturnPct) || 0);
  const years = Math.min(60, Math.max(0, Math.floor(Number(input.durationYears) || 0)));

  if (P === 0 || years === 0) {
    return {
      totalInvested: 0,
      estimatedReturns: 0,
      finalCorpus: 0,
      breakdown: [],
    };
  }

  const i = R / 12 / 100;
  const breakdown: YearlyBreakdown[] = [];

  for (let y = 1; y <= years; y++) {
    const months = y * 12;
    const invested = round2(P * months);
    let corpus = invested;

    if (i > 0) {
      const factor = Math.pow(1 + i, months);
      corpus = round2(P * ((factor - 1) / i) * (1 + i));
    }

    const returns = round2(Math.max(0, corpus - invested));

    breakdown.push({
      year: y,
      invested,
      returns,
      totalValue: corpus,
      annualContribution: round2(P * 12),
      monthlyContribution: P,
    });
  }

  const finalYear = breakdown[breakdown.length - 1];

  return {
    totalInvested: finalYear.invested,
    estimatedReturns: finalYear.returns,
    finalCorpus: finalYear.totalValue,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 2. Step-Up SIP Calculator
// ---------------------------------------------------------------------------

export interface StepUpSIPInput {
  initialMonthlySIP: number;
  annualStepUpPct: number;
  annualReturnPct: number;
  durationYears: number;
}

export interface StepUpSIPResult {
  totalInvested: number;
  estimatedReturns: number;
  finalCorpus: number;
  breakdown: YearlyBreakdown[];
}

/**
 * Calculates Step-Up SIP growth.
 * 
 * Convention:
 * - In Year 1 (Months 1–12): Monthly installment is P_1.
 * - In Year 2 (Months 13–24): Monthly installment increases by s% to P_2 = P_1 * (1 + s/100).
 * - In Year y: Monthly installment is P_y = P_1 * (1 + s/100)^(y - 1).
 * Increase takes effect at the start of each new investment year (Month 13, 25, etc.).
 * Each monthly contribution compounds for the remaining duration.
 */
export function calculateStepUpSIP(input: StepUpSIPInput): StepUpSIPResult {
  const P1 = Math.max(0, Number(input.initialMonthlySIP) || 0);
  const stepUpPct = Math.max(0, Number(input.annualStepUpPct) || 0);
  const R = Math.max(0, Number(input.annualReturnPct) || 0);
  const years = Math.min(60, Math.max(0, Math.floor(Number(input.durationYears) || 0)));

  if (P1 === 0 || years === 0) {
    return {
      totalInvested: 0,
      estimatedReturns: 0,
      finalCorpus: 0,
      breakdown: [],
    };
  }

  const i = R / 12 / 100;
  const breakdown: YearlyBreakdown[] = [];
  let cumulativeInvested = 0;

  // Monthly installments array for all months
  const monthlyAmounts: number[] = [];
  for (let y = 1; y <= years; y++) {
    const monthlyForYear = round2(P1 * Math.pow(1 + stepUpPct / 100, y - 1));
    for (let m = 0; m < 12; m++) {
      monthlyAmounts.push(monthlyForYear);
    }
  }

  for (let y = 1; y <= years; y++) {
    const monthsElapsed = y * 12;
    const monthlyForThisYear = round2(P1 * Math.pow(1 + stepUpPct / 100, y - 1));
    const annualContrib = round2(monthlyForThisYear * 12);
    cumulativeInvested = round2(cumulativeInvested + annualContrib);

    // Calculate future value of all installments up to month y*12
    let corpus = 0;
    if (i === 0) {
      corpus = cumulativeInvested;
    } else {
      for (let m = 1; m <= monthsElapsed; m++) {
        const installment = monthlyAmounts[m - 1];
        const monthsRemaining = monthsElapsed - m + 1;
        corpus += installment * Math.pow(1 + i, monthsRemaining);
      }
      corpus = round2(corpus);
    }

    const returns = round2(Math.max(0, corpus - cumulativeInvested));

    breakdown.push({
      year: y,
      invested: cumulativeInvested,
      returns,
      totalValue: corpus,
      annualContribution: annualContrib,
      monthlyContribution: monthlyForThisYear,
    });
  }

  const finalYear = breakdown[breakdown.length - 1];

  return {
    totalInvested: finalYear.invested,
    estimatedReturns: finalYear.returns,
    finalCorpus: finalYear.totalValue,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 3. Lumpsum Calculator
// ---------------------------------------------------------------------------

export interface LumpsumInput {
  initialInvestment: number;
  annualReturnPct: number;
  durationYears: number;
}

export interface LumpsumResult {
  investedPrincipal: number;
  estimatedGains: number;
  finalValue: number;
  breakdown: YearlyBreakdown[];
}

/**
 * Calculates compound growth of a one-time lumpsum investment.
 * Formula: A = P * (1 + R/100)^t
 */
export function calculateLumpsum(input: LumpsumInput): LumpsumResult {
  const P = Math.max(0, Number(input.initialInvestment) || 0);
  const R = Math.max(0, Number(input.annualReturnPct) || 0);
  const years = Math.min(60, Math.max(0, Math.floor(Number(input.durationYears) || 0)));

  if (P === 0 || years === 0) {
    return {
      investedPrincipal: P,
      estimatedGains: 0,
      finalValue: P,
      breakdown: [],
    };
  }

  const breakdown: YearlyBreakdown[] = [];

  for (let y = 1; y <= years; y++) {
    const totalValue = round2(P * Math.pow(1 + R / 100, y));
    const returns = round2(Math.max(0, totalValue - P));

    breakdown.push({
      year: y,
      invested: P,
      returns,
      totalValue,
      annualContribution: 0,
      monthlyContribution: 0,
    });
  }

  const finalYear = breakdown[breakdown.length - 1];

  return {
    investedPrincipal: P,
    estimatedGains: finalYear.returns,
    finalValue: finalYear.totalValue,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 4. FIRE Calculator (Financial Independence, Retire Early)
// ---------------------------------------------------------------------------

export interface FIREInput {
  currentMonthlyExpenses: number;
  expectedInflationPct?: number; // default 6%
  safeWithdrawalRatePct?: number; // default 4% (25x)
  currentSavings?: number; // default 0
  yearsToRetirement?: number; // default 15
  expectedPreRetirementReturnPct?: number; // default 12%
}

export interface FIREResult {
  currentAnnualExpenses: number;
  futureAnnualExpenses: number;
  futureMonthlyExpenses: number;
  targetCorpus: number;
  corpusMultiplier: number;
  projectedExistingSavings: number;
  savingsGap: number;
  monthlyInvestmentRequired: number;
  yearsOfExpensesCovered: number;
  leanFIRECorpus: number;
  fatFIRECorpus: number;
  isAlreadyIndependent: boolean;
  assumptions: {
    inflationPct: number;
    withdrawalRatePct: number;
    preRetirementReturnPct: number;
    yearsToRetirement: number;
  };
}

/**
 * Calculates Financial Independence & Retire Early (FIRE) requirements.
 * 
 * Formulas:
 * 1. Future Annual Expenses = Current Expenses * (1 + inf)^years
 * 2. Target Corpus = Future Annual Expenses / (SWR / 100)
 * 3. Future Value of Existing Savings = Current Savings * (1 + return)^years
 * 4. Corpus Gap = max(0, Target Corpus - Future Savings)
 * 5. Monthly Investment Required = Gap / AnnuityDueFactor(return, years)
 */
export function calculateFIRE(input: FIREInput): FIREResult {
  const monthlyExpenses = Math.max(0, Number(input.currentMonthlyExpenses) || 0);
  const currentAnnualExpenses = round2(monthlyExpenses * 12);

  const inflationPct = input.expectedInflationPct !== undefined
    ? Math.max(0, Number(input.expectedInflationPct) || 0)
    : 6.0;

  const swrPct = input.safeWithdrawalRatePct && Number(input.safeWithdrawalRatePct) > 0
    ? Math.max(0.5, Math.min(15, Number(input.safeWithdrawalRatePct)))
    : 4.0;

  const currentSavings = Math.max(0, Number(input.currentSavings) || 0);
  const years = Math.max(1, Math.min(50, Math.floor(Number(input.yearsToRetirement) || 15)));
  const preReturnPct = input.expectedPreRetirementReturnPct !== undefined
    ? Math.max(0, Number(input.expectedPreRetirementReturnPct) || 0)
    : 12.0;

  // 1. Inflation-adjusted expenses at retirement
  const futureAnnualExpenses = round2(currentAnnualExpenses * Math.pow(1 + inflationPct / 100, years));
  const futureMonthlyExpenses = round2(futureAnnualExpenses / 12);

  // 2. Target retirement corpus
  const corpusMultiplier = round2(100 / swrPct);
  const targetCorpus = round2((futureAnnualExpenses / (swrPct / 100)));

  // Lean and Fat FIRE variants
  const leanFIRECorpus = round2(targetCorpus * 0.75); // 75% essential expenses
  const fatFIRECorpus = round2(targetCorpus * 1.25); // 125% luxury buffer

  // 3. Projected growth of existing savings
  const projectedExistingSavings = round2(currentSavings * Math.pow(1 + preReturnPct / 100, years));

  // 4. Corpus gap
  const savingsGap = round2(Math.max(0, targetCorpus - projectedExistingSavings));
  const isAlreadyIndependent = projectedExistingSavings >= targetCorpus;

  // 5. Monthly investment required to bridge gap
  let monthlyInvestmentRequired = 0;
  if (savingsGap > 0) {
    const totalMonths = years * 12;
    const monthlyRate = preReturnPct / 12 / 100;

    if (monthlyRate === 0) {
      monthlyInvestmentRequired = round2(savingsGap / totalMonths);
    } else {
      const factor = Math.pow(1 + monthlyRate, totalMonths);
      const annuityDueFactor = ((factor - 1) / monthlyRate) * (1 + monthlyRate);
      monthlyInvestmentRequired = round2(savingsGap / annuityDueFactor);
    }
  }

  // 6. Current runway (years of expenses covered by current savings today)
  const yearsOfExpensesCovered = currentAnnualExpenses > 0
    ? round2(currentSavings / currentAnnualExpenses)
    : 0;

  return {
    currentAnnualExpenses,
    futureAnnualExpenses,
    futureMonthlyExpenses,
    targetCorpus,
    corpusMultiplier,
    projectedExistingSavings,
    savingsGap,
    monthlyInvestmentRequired,
    yearsOfExpensesCovered,
    leanFIRECorpus,
    fatFIRECorpus,
    isAlreadyIndependent,
    assumptions: {
      inflationPct,
      withdrawalRatePct: swrPct,
      preRetirementReturnPct: preReturnPct,
      yearsToRetirement: years,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Loan EMI Calculator
// ---------------------------------------------------------------------------

export interface EMIInput {
  principalAmount: number;
  annualInterestRatePct: number;
  tenureYears: number;
}

export interface EMIYearlyBreakdown {
  year: number;
  openingBalance: number;
  annualEMI: number;
  principalPaid: number;
  interestPaid: number;
  closingBalance: number;
}

export interface EMIResult {
  monthlyEMI: number;
  principalAmount: number;
  totalInterestPayable: number;
  totalPayment: number;
  interestToPrincipalRatioPct: number;
  breakdown: EMIYearlyBreakdown[];
}

/**
 * Calculates Equated Monthly Installment (EMI) for loans.
 * Standard industry formula:
 * EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where P = principal, r = annualRate / 12 / 100, n = tenureYears * 12
 */
export function calculateEMI(input: EMIInput): EMIResult {
  const P = Math.max(0, Number(input.principalAmount) || 0);
  const R = Math.max(0, Number(input.annualInterestRatePct) || 0);
  const years = Math.min(40, Math.max(1, Math.floor(Number(input.tenureYears) || 1)));
  const n = years * 12;

  if (P === 0) {
    return {
      monthlyEMI: 0,
      principalAmount: 0,
      totalInterestPayable: 0,
      totalPayment: 0,
      interestToPrincipalRatioPct: 0,
      breakdown: [],
    };
  }

  const r = R / 12 / 100;
  let emi = 0;
  if (r === 0) {
    emi = round2(P / n);
  } else {
    const factor = Math.pow(1 + r, n);
    emi = round2((P * r * factor) / (factor - 1));
  }

  const totalPayment = round2(emi * n);
  const totalInterestPayable = round2(Math.max(0, totalPayment - P));
  const interestToPrincipalRatioPct = P > 0 ? round2((totalInterestPayable / P) * 100) : 0;

  const breakdown: EMIYearlyBreakdown[] = [];
  let balance = P;

  for (let y = 1; y <= years; y++) {
    const openingBalance = balance;
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;

    for (let m = 1; m <= 12; m++) {
      if (balance <= 0) break;
      const monthInterest = r > 0 ? round2(balance * r) : 0;
      const monthPrincipal = round2(Math.min(balance, emi - monthInterest));
      yearlyInterest = round2(yearlyInterest + monthInterest);
      yearlyPrincipal = round2(yearlyPrincipal + monthPrincipal);
      balance = round2(Math.max(0, balance - monthPrincipal));
    }

    breakdown.push({
      year: y,
      openingBalance,
      annualEMI: round2(yearlyPrincipal + yearlyInterest),
      principalPaid: yearlyPrincipal,
      interestPaid: yearlyInterest,
      closingBalance: balance,
    });
  }

  return {
    monthlyEMI: emi,
    principalAmount: P,
    totalInterestPayable,
    totalPayment,
    interestToPrincipalRatioPct,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 6. Fixed Deposit (FD) Calculator
// ---------------------------------------------------------------------------

export type FDCompoundingFrequency = "QUARTERLY" | "MONTHLY" | "HALF_YEARLY" | "ANNUALLY" | "SIMPLE";

export interface FDInput {
  depositAmount: number;
  annualInterestRatePct: number;
  durationYears: number;
  compoundingFrequency?: FDCompoundingFrequency;
}

export interface FDResult {
  investedDeposit: number;
  totalInterestEarned: number;
  maturityValue: number;
  compoundingFrequency: FDCompoundingFrequency;
  breakdown: YearlyBreakdown[];
}

/**
 * Calculates Fixed Deposit growth with Indian bank standard quarterly compounding,
 * monthly, half-yearly, annual, or simple interest.
 */
export function calculateFD(input: FDInput): FDResult {
  const P = Math.max(0, Number(input.depositAmount) || 0);
  const R = Math.max(0, Number(input.annualInterestRatePct) || 0);
  const years = Math.min(30, Math.max(0, Math.floor(Number(input.durationYears) || 0)));
  const freq: FDCompoundingFrequency = input.compoundingFrequency ?? "QUARTERLY";

  if (P === 0 || years === 0) {
    return {
      investedDeposit: P,
      totalInterestEarned: 0,
      maturityValue: P,
      compoundingFrequency: freq,
      breakdown: [],
    };
  }

  const n = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "HALF_YEARLY" ? 2 : 1;
  const breakdown: YearlyBreakdown[] = [];

  for (let y = 1; y <= years; y++) {
    let maturityAtYear = 0;
    if (freq === "SIMPLE") {
      maturityAtYear = round2(P * (1 + (R * y) / 100));
    } else {
      maturityAtYear = round2(P * Math.pow(1 + R / (n * 100), n * y));
    }
    const interestAtYear = round2(Math.max(0, maturityAtYear - P));

    breakdown.push({
      year: y,
      invested: P,
      returns: interestAtYear,
      totalValue: maturityAtYear,
      annualContribution: 0,
    });
  }

  const finalYear = breakdown[breakdown.length - 1];

  return {
    investedDeposit: P,
    totalInterestEarned: finalYear.returns,
    maturityValue: finalYear.totalValue,
    compoundingFrequency: freq,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 7. Compound Annual Growth Rate (CAGR) Calculator
// ---------------------------------------------------------------------------

export interface CAGRInput {
  initialInvestment: number;
  finalInvestment: number;
  durationYears: number;
}

export interface CAGRResult {
  initialInvestment: number;
  finalInvestment: number;
  durationYears: number;
  cagrPct: number;
  totalGain: number;
  absoluteReturnPct: number;
  breakdown: YearlyBreakdown[];
}

/**
 * Calculates Compound Annual Growth Rate (CAGR).
 * Formula: CAGR = (Vt / V0)^(1 / t) - 1
 */
export function calculateCAGR(input: CAGRInput): CAGRResult {
  const V0 = Math.max(0, Number(input.initialInvestment) || 0);
  const Vt = Math.max(0, Number(input.finalInvestment) || 0);
  const years = Math.max(0.01, Number(input.durationYears) || 0);

  if (V0 === 0) {
    return {
      initialInvestment: 0,
      finalInvestment: Vt,
      durationYears: years,
      cagrPct: 0,
      totalGain: Vt,
      absoluteReturnPct: 0,
      breakdown: [],
    };
  }

  const cagr = Math.pow(Vt / V0, 1 / years) - 1;
  const cagrPct = round2(cagr * 100);
  const totalGain = round2(Vt - V0);
  const absoluteReturnPct = round2(((Vt - V0) / V0) * 100);

  const breakdown: YearlyBreakdown[] = [];
  const wholeYears = Math.min(50, Math.max(1, Math.floor(years)));

  for (let y = 1; y <= wholeYears; y++) {
    const valAtYear = round2(V0 * Math.pow(1 + cagr, y));
    const gainAtYear = round2(valAtYear - V0);
    breakdown.push({
      year: y,
      invested: V0,
      returns: gainAtYear,
      totalValue: valAtYear,
      annualContribution: 0,
    });
  }

  return {
    initialInvestment: V0,
    finalInvestment: Vt,
    durationYears: years,
    cagrPct,
    totalGain,
    absoluteReturnPct,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// 8. Extended Internal Rate of Return (XIRR) Calculator
// ---------------------------------------------------------------------------

export interface XIRRCashflowEntry {
  date: string; // YYYY-MM-DD
  amount: number; // Negative for investment, positive for returns/current value
}

export interface XIRRCalculatorInput {
  cashflows: XIRRCashflowEntry[];
}

export interface XIRRCalculatorResult {
  xirrPct: number | null;
  totalInvested: number;
  totalWithdrawnOrCurrent: number;
  netProfit: number;
  absoluteReturnPct: number;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Calculates Extended Internal Rate of Return for irregular cash flow series.
 */
export function calculateXIRRCalculator(input: XIRRCalculatorInput): XIRRCalculatorResult {
  const flows = (input.cashflows || []).map((cf) => ({
    date: new Date(cf.date),
    amount: Number(cf.amount) || 0,
  }));

  const hasNegative = flows.some((f) => f.amount < 0);
  const hasPositive = flows.some((f) => f.amount > 0);

  if (!hasNegative || !hasPositive || flows.length < 2) {
    return {
      xirrPct: null,
      totalInvested: 0,
      totalWithdrawnOrCurrent: 0,
      netProfit: 0,
      absoluteReturnPct: 0,
      isValid: false,
      errorMessage: "XIRR requires at least one investment (negative cash flow) and one return (positive cash flow).",
    };
  }

  const totalInvested = round2(
    Math.abs(flows.filter((f) => f.amount < 0).reduce((acc, f) => acc + f.amount, 0))
  );
  const totalWithdrawnOrCurrent = round2(
    flows.filter((f) => f.amount > 0).reduce((acc, f) => acc + f.amount, 0)
  );
  const netProfit = round2(totalWithdrawnOrCurrent - totalInvested);
  const absoluteReturnPct = totalInvested > 0 ? round2((netProfit / totalInvested) * 100) : 0;

  const result = calculateXIRR(flows);
  const xirrPct = result.ratePct;

  return {
    xirrPct,
    totalInvested,
    totalWithdrawnOrCurrent,
    netProfit,
    absoluteReturnPct,
    isValid: xirrPct !== null,
    errorMessage: xirrPct === null ? (result.error || "Could not converge to a valid XIRR rate.") : undefined,
  };
}

