/**
 * FinanceAI — Loan Amortization & Debt Prepayment Calculation Engine
 * 
 * Strict deterministic financial mathematics adhering to Master Architecture §10.7:
 * - Monthly interest rate: r = annualRate / 12 / 100
 * - If r = 0: EMI = P / n
 * - If r > 0: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * - Month t:
 *     interest_t = balance_{t-1} * r
 *     principal_t = EMI - interest_t
 *     balance_t = balance_{t-1} - principal_t
 * - Cent-level rounding (±0.01) with final installment adjustment to ensure closing balance = 0.
 * - Prepayment modeling:
 *     Strategy 1: REDUCE_TENURE (keeps EMI constant, accelerates debt-free date)
 *     Strategy 2: REDUCE_EMI (re-amortizes remaining balance over remaining tenure)
 */

export interface AmortizationOptions {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  startDate?: Date | string;
}

export interface AmortizationInstallment {
  month: number;
  date: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
  prepayment?: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
}

export interface AmortizationSchedule {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  monthlyEMI: number;
  totalPayment: number;
  totalInterest: number;
  schedule: AmortizationInstallment[];
}

export type PrepaymentStrategy = "REDUCE_TENURE" | "REDUCE_EMI";

export interface LumpSumPrepayment {
  month: number;
  amount: number;
}

export interface PrepaymentSimulationOptions extends AmortizationOptions {
  lumpSums?: LumpSumPrepayment[];
  monthlyExtra?: number;
  strategy?: PrepaymentStrategy;
}

export interface PrepaymentSimulationResult {
  original: {
    tenureMonths: number;
    monthlyEMI: number;
    totalInterest: number;
    totalPayment: number;
  };
  revised: {
    tenureMonths: number;
    monthlyEMI: number;
    totalInterest: number;
    totalPayment: number;
    totalPrepayments: number;
  };
  savings: {
    interestSaved: number;
    monthsSaved: number;
    percentageSaved: number;
  };
  schedule: AmortizationInstallment[];
}

/** Round a number half-up to 2 decimal places (cent/paisa precision) */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates standard Equated Monthly Installment (EMI).
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 */
export function calculateEMI(principal: number, annualRatePct: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRatePct <= 0) {
    return round2(principal / tenureMonths);
  }

  const r = annualRatePct / 12 / 100;
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * factor) / (factor - 1);
  return round2(emi);
}

/**
 * Calculates remaining tenure (months) given principal, interest rate, and EMI.
 * Formula: n = ln(EMI / (EMI - P * r)) / ln(1 + r)
 */
export function calculateTenure(principal: number, annualRatePct: number, emi: number): number {
  if (principal <= 0 || emi <= 0) return 0;
  if (annualRatePct <= 0) {
    return Math.ceil(principal / emi);
  }

  const r = annualRatePct / 12 / 100;
  const interestPerMonth = principal * r;
  if (emi <= interestPerMonth) {
    // EMI does not even cover monthly interest; loan would never be repaid
    return Infinity;
  }

  const n = Math.log(emi / (emi - interestPerMonth)) / Math.log(1 + r);
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.05) {
    return rounded;
  }
  return Math.ceil(n);
}

/**
 * Helper to generate an ISO date string (YYYY-MM) shifted by months.
 */
function getInstallmentDate(startDate: Date, monthOffset: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * Generates standard month-by-month loan amortization schedule.
 * Automatically adjusts final month installment so balance reaches exactly 0.00.
 */
export function generateAmortizationSchedule(options: AmortizationOptions): AmortizationSchedule {
  const { principal, annualRatePct, tenureMonths } = options;
  const startDate = options.startDate ? new Date(options.startDate) : new Date();

  if (principal <= 0 || tenureMonths <= 0) {
    return {
      principal: 0,
      annualRatePct,
      tenureMonths: 0,
      monthlyEMI: 0,
      totalPayment: 0,
      totalInterest: 0,
      schedule: [],
    };
  }

  const emi = calculateEMI(principal, annualRatePct, tenureMonths);
  const r = annualRatePct > 0 ? annualRatePct / 12 / 100 : 0;

  const schedule: AmortizationInstallment[] = [];
  let currentBalance = round2(principal);
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;

  for (let m = 1; m <= tenureMonths; m++) {
    if (currentBalance <= 0) break;

    const opening = currentBalance;
    const interest = round2(opening * r);
    let principalPaid = round2(emi - interest);
    let currentEmi = emi;

    // Last month or balance exhaustion adjustment
    if (m === tenureMonths || principalPaid >= opening) {
      principalPaid = opening;
      currentEmi = round2(principalPaid + interest);
      currentBalance = 0;
    } else {
      currentBalance = round2(opening - principalPaid);
    }

    totalPrincipalPaid = round2(totalPrincipalPaid + principalPaid);
    totalInterestPaid = round2(totalInterestPaid + interest);

    schedule.push({
      month: m,
      date: getInstallmentDate(startDate, m - 1),
      openingBalance: opening,
      emi: currentEmi,
      principal: principalPaid,
      interest,
      closingBalance: currentBalance,
      totalPrincipalPaid,
      totalInterestPaid,
    });
  }

  const totalPayment = round2(totalPrincipalPaid + totalInterestPaid);

  return {
    principal,
    annualRatePct,
    tenureMonths: schedule.length,
    monthlyEMI: emi,
    totalPayment,
    totalInterest: totalInterestPaid,
    schedule,
  };
}

/**
 * Simulates the impact of prepayments on loan tenure, monthly EMI, and total interest.
 */
export function simulatePrepayment(options: PrepaymentSimulationOptions): PrepaymentSimulationResult {
  const {
    principal,
    annualRatePct,
    tenureMonths,
    lumpSums = [],
    monthlyExtra = 0,
    strategy = "REDUCE_TENURE",
  } = options;
  const startDate = options.startDate ? new Date(options.startDate) : new Date();

  const standard = generateAmortizationSchedule(options);

  if (principal <= 0 || tenureMonths <= 0) {
    return {
      original: {
        tenureMonths: 0,
        monthlyEMI: 0,
        totalInterest: 0,
        totalPayment: 0,
      },
      revised: {
        tenureMonths: 0,
        monthlyEMI: 0,
        totalInterest: 0,
        totalPayment: 0,
        totalPrepayments: 0,
      },
      savings: {
        interestSaved: 0,
        monthsSaved: 0,
        percentageSaved: 0,
      },
      schedule: [],
    };
  }

  const lumpSumMap = new Map<number, number>();
  for (const ls of lumpSums) {
    if (ls.month > 0 && ls.amount > 0) {
      lumpSumMap.set(ls.month, (lumpSumMap.get(ls.month) || 0) + ls.amount);
    }
  }

  const r = annualRatePct > 0 ? annualRatePct / 12 / 100 : 0;
  let activeEmi = standard.monthlyEMI;
  let currentBalance = round2(principal);
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalPrepayments = 0;
  const schedule: AmortizationInstallment[] = [];

  let month = 1;
  const maxMonths = tenureMonths * 2; // safety guard

  while (currentBalance > 0 && month <= maxMonths) {
    const opening = currentBalance;
    const interest = round2(opening * r);
    const extra = round2((monthlyExtra > 0 ? monthlyExtra : 0) + (lumpSumMap.get(month) || 0));

    let principalPaid = round2(activeEmi - interest);
    let installmentEmi = activeEmi;

    if (principalPaid + extra >= opening) {
      // Final payoff
      principalPaid = opening;
      const actualPrepayment = Math.max(0, round2(opening - (activeEmi - interest)));
      installmentEmi = round2(opening + interest);
      totalPrepayments = round2(totalPrepayments + actualPrepayment);
      currentBalance = 0;
    } else {
      principalPaid = round2(principalPaid + extra);
      totalPrepayments = round2(totalPrepayments + extra);
      currentBalance = round2(opening - principalPaid);
    }

    totalPrincipalPaid = round2(totalPrincipalPaid + principalPaid);
    totalInterestPaid = round2(totalInterestPaid + interest);

    schedule.push({
      month,
      date: getInstallmentDate(startDate, month - 1),
      openingBalance: opening,
      emi: installmentEmi,
      principal: principalPaid,
      interest,
      closingBalance: currentBalance,
      prepayment: extra > 0 ? extra : undefined,
      totalPrincipalPaid,
      totalInterestPaid,
    });

    if (currentBalance <= 0) break;

    // Strategy 2: REDUCE_EMI
    // Recalculate EMI for remaining months if prepayments occurred and strategy is REDUCE_EMI
    if (strategy === "REDUCE_EMI" && extra > 0) {
      const remainingMonths = tenureMonths - month;
      if (remainingMonths > 0) {
        activeEmi = calculateEMI(currentBalance, annualRatePct, remainingMonths);
      }
    }

    month++;
  }

  const revisedTotalPayment = round2(totalPrincipalPaid + totalInterestPaid);
  const interestSaved = round2(Math.max(0, standard.totalInterest - totalInterestPaid));
  const monthsSaved = Math.max(0, standard.tenureMonths - schedule.length);
  const percentageSaved = standard.totalInterest > 0
    ? round2((interestSaved / standard.totalInterest) * 100)
    : 0;

  return {
    original: {
      tenureMonths: standard.tenureMonths,
      monthlyEMI: standard.monthlyEMI,
      totalInterest: standard.totalInterest,
      totalPayment: standard.totalPayment,
    },
    revised: {
      tenureMonths: schedule.length,
      monthlyEMI: strategy === "REDUCE_EMI" ? activeEmi : standard.monthlyEMI,
      totalInterest: totalInterestPaid,
      totalPayment: revisedTotalPayment,
      totalPrepayments,
    },
    savings: {
      interestSaved,
      monthsSaved,
      percentageSaved,
    },
    schedule,
  };
}
