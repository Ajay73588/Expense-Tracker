/**
 * FinanceAI — Portfolio Returns Calculation Engine (CAGR & XIRR)
 * 
 * Strict deterministic calculations adhering to Master Architecture §10.6:
 * - CAGR = (End / Start)^(1 / years) - 1 (requires start > 0, years > 0)
 * - XIRR: sum(C_i / (1 + r)^((d_i - d_0) / 365)) = 0
 * - Algorithm: Newton-Raphson with max 100 iterations, |NPV| < 1e-6
 * - Derivative guard < 1e-9 falls back to Bisection search on [-0.99, 5.0]
 * - Requires at least one negative (outflow) and at least one positive (inflow/current value)
 * - Reference vector: -100,000 on 2025-01-01, +115,000 on 2026-01-01 -> 15.00%
 * - On convergence failure or invalid flows, safely returns null + explanation, never crashes.
 */

export interface CashFlow {
  amount: number; // Negative for investments/outflows, positive for redemptions/current valuation
  date: Date | string;
}

export interface XIRRResult {
  rate: number | null; // Annualized rate as decimal, e.g. 0.15 for 15%
  ratePct: number | null; // Percentage formatted e.g. 15.00
  absoluteReturnPct: number | null; // Absolute return fallback
  converged: boolean;
  iterations: number;
  method: "NEWTON_RAPHSON" | "BISECTION" | "NONE";
  error?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365.0;

/**
 * Calculates Compound Annual Growth Rate (CAGR).
 * Formula: CAGR = (endValue / startValue)^(1 / years) - 1
 */
export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): { rate: number; ratePct: number } | null {
  if (startValue <= 0 || endValue <= 0 || years <= 0) {
    return null;
  }

  const rate = Math.pow(endValue / startValue, 1 / years) - 1;
  const ratePct = Math.round(rate * 10000) / 100;
  return { rate, ratePct };
}

/**
 * Calculates Extended Internal Rate of Return (XIRR).
 */
export function calculateXIRR(rawFlows: CashFlow[]): XIRRResult {
  if (!rawFlows || rawFlows.length < 2) {
    return {
      rate: null,
      ratePct: null,
      absoluteReturnPct: null,
      converged: false,
      iterations: 0,
      method: "NONE",
      error: "At least two cash flows are required to compute XIRR.",
    };
  }

  // Normalize and sort by date ascending
  const flows = rawFlows
    .map((f) => ({
      amount: f.amount,
      time: typeof f.date === "string" ? new Date(f.date).getTime() : f.date.getTime(),
    }))
    .filter((f) => !isNaN(f.time) && Number.isFinite(f.amount) && f.amount !== 0)
    .sort((a, b) => a.time - b.time);

  if (flows.length < 2) {
    return {
      rate: null,
      ratePct: null,
      absoluteReturnPct: null,
      converged: false,
      iterations: 0,
      method: "NONE",
      error: "Valid cash flows with non-zero amounts and valid dates are required.",
    };
  }

  // Verify at least one negative and at least one positive flow
  let hasNegative = false;
  let hasPositive = false;
  let totalInvested = 0;
  let totalReturns = 0;

  for (const f of flows) {
    if (f.amount < 0) {
      hasNegative = true;
      totalInvested += Math.abs(f.amount);
    } else {
      hasPositive = true;
      totalReturns += f.amount;
    }
  }

  const absoluteReturnPct =
    totalInvested > 0
      ? Math.round(((totalReturns - totalInvested) / totalInvested) * 10000) / 100
      : null;

  if (!hasNegative || !hasPositive) {
    return {
      rate: null,
      ratePct: null,
      absoluteReturnPct,
      converged: false,
      iterations: 0,
      method: "NONE",
      error: "XIRR requires at least one negative flow (investment) and one positive flow (current value/return).",
    };
  }

  const t0 = flows[0].time;
  const normalizedFlows = flows.map((f) => ({
    amount: f.amount,
    years: (f.time - t0) / (MS_PER_DAY * DAYS_PER_YEAR),
  }));

  // NPV function: sum(C_i / (1 + r)^t_i)
  const npv = (r: number): number => {
    let sum = 0;
    for (const f of normalizedFlows) {
      sum += f.amount / Math.pow(1 + r, f.years);
    }
    return sum;
  };

  // Derivative: sum(-t_i * C_i / (1 + r)^(t_i + 1))
  const dnpv = (r: number): number => {
    let sum = 0;
    for (const f of normalizedFlows) {
      sum += (-f.years * f.amount) / Math.pow(1 + r, f.years + 1);
    }
    return sum;
  };

  const MAX_ITERATIONS = 100;
  const TOLERANCE = 1e-6;
  const DERIVATIVE_GUARD = 1e-9;

  // Initial guess: based on simple annualized return or 0.1 (10%)
  let guess = 0.1;
  const totalYears = normalizedFlows[normalizedFlows.length - 1].years;
  if (totalYears > 0 && totalInvested > 0) {
    const simpleAnnual = (totalReturns / totalInvested) ** (1 / Math.max(0.5, totalYears)) - 1;
    if (Number.isFinite(simpleAnnual) && simpleAnnual > -0.9 && simpleAnnual < 3.0) {
      guess = simpleAnnual;
    }
  }

  // 1. Newton-Raphson Method
  let r = guess;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Keep rate strictly > -1.0 to prevent negative root domain errors
    if (r <= -0.999) r = -0.99;

    const val = npv(r);
    if (Math.abs(val) < TOLERANCE) {
      const ratePct = Math.round(r * 10000) / 100;
      return {
        rate: r,
        ratePct,
        absoluteReturnPct,
        converged: true,
        iterations: i + 1,
        method: "NEWTON_RAPHSON",
      };
    }

    const deriv = dnpv(r);
    if (Math.abs(deriv) < DERIVATIVE_GUARD) {
      // Derivative too flat; break out to Bisection
      break;
    }

    const nextR = r - val / deriv;
    // Guard wild steps outside reasonable financial range [-0.99, 50.0]
    if (nextR <= -0.999 || nextR > 50.0 || isNaN(nextR)) {
      break;
    }

    if (Math.abs(nextR - r) < TOLERANCE) {
      const ratePct = Math.round(nextR * 10000) / 100;
      return {
        rate: nextR,
        ratePct,
        absoluteReturnPct,
        converged: true,
        iterations: i + 1,
        method: "NEWTON_RAPHSON",
      };
    }

    r = nextR;
  }

  // 2. Bisection Fallback on [-0.99, 5.0]
  let low = -0.99;
  let high = 5.0;
  let fLow = npv(low);
  let fHigh = npv(high);

  // If both endpoints have same sign, expand high up to 20.0
  if (fLow * fHigh > 0) {
    high = 20.0;
    fHigh = npv(high);
  }

  if (fLow * fHigh <= 0) {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const mid = (low + high) / 2;
      const fMid = npv(mid);

      if (Math.abs(fMid) < TOLERANCE || (high - low) / 2 < TOLERANCE) {
        const ratePct = Math.round(mid * 10000) / 100;
        return {
          rate: mid,
          ratePct,
          absoluteReturnPct,
          converged: true,
          iterations: i + 1,
          method: "BISECTION",
        };
      }

      if (fMid * fLow <= 0) {
        high = mid;
        fHigh = fMid;
      } else {
        low = mid;
        fLow = fMid;
      }
    }
  }

  // Did not converge within tolerances; safe failure with absolute return
  return {
    rate: null,
    ratePct: null,
    absoluteReturnPct,
    converged: false,
    iterations: MAX_ITERATIONS,
    method: "NONE",
    error: "XIRR root did not converge within 100 iterations. Showing absolute return.",
  };
}
