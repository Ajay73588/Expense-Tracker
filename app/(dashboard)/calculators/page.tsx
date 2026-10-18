"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, StatCard } from "@/components/cards/Card";
import { formatINR, formatPercent } from "@/utils/format";
import { cn } from "@/utils/cn";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  calculateSIP,
  calculateStepUpSIP,
  calculateLumpsum,
  calculateFIRE,
  calculateEMI,
  calculateFD,
  calculateCAGR,
  calculateXIRRCalculator,
  round2,
  FDCompoundingFrequency,
  XIRRCashflowEntry,
} from "@/lib/finance/calculators";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type CalculatorTab = "SIP" | "STEP_UP" | "LUMPSUM" | "EMI" | "FD" | "CAGR" | "XIRR" | "FIRE";

const TABS: { id: CalculatorTab; label: string; icon: string; description: string }[] = [
  { id: "SIP", label: "SIP", icon: "📈", description: "Regular monthly systematic investments" },
  { id: "STEP_UP", label: "Step-Up SIP", icon: "🚀", description: "Annual contribution top-up with salary growth" },
  { id: "LUMPSUM", label: "Lumpsum", icon: "💰", description: "One-time compound wealth accumulation" },
  { id: "EMI", label: "Loan EMI", icon: "⚖️", description: "Equated monthly installments & loan amortization" },
  { id: "FD", label: "Fixed Deposit", icon: "🏦", description: "Bank term deposits with quarterly compounding" },
  { id: "CAGR", label: "CAGR Growth", icon: "📊", description: "Compound annual growth rate across holding periods" },
  { id: "XIRR", label: "XIRR Solver", icon: "⚡", description: "Internal rate of return on irregular dated cash flows" },
  { id: "FIRE", label: "FIRE Planner", icon: "🔥", description: "Financial Independence, Retire Early targets" },
];

const PIE_COLORS = ["#2b73ff", "#22c55e"];
const EMI_PIE_COLORS = ["#3b82f6", "#ef4444"];

const tooltipStyle = {
  contentStyle: {
    background: "#13161b",
    border: "1px solid #242932",
    borderRadius: 8,
    fontSize: 12,
    color: "#e6e9ef",
  },
  labelStyle: { color: "#9ca3af" },
  itemStyle: { color: "#e6e9ef" },
};

export default function CalculatorsPage() {
  const { privacyMode } = usePrivacy();
  const [activeTab, setActiveTab] = useState<CalculatorTab>("SIP");

  // SIP Inputs
  const [sipMonthly, setSipMonthly] = useState(10000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(15);

  // Step-Up Inputs
  const [stepUpMonthly, setStepUpMonthly] = useState(10000);
  const [stepUpStepPct, setStepUpStepPct] = useState(10);
  const [stepUpRate, setStepUpRate] = useState(12);
  const [stepUpYears, setStepUpYears] = useState(15);

  // Lumpsum Inputs
  const [lumpPrincipal, setLumpPrincipal] = useState(100000);
  const [lumpRate, setLumpRate] = useState(12);
  const [lumpYears, setLumpYears] = useState(10);

  // EMI Inputs
  const [emiPrincipal, setEmiPrincipal] = useState(5000000);
  const [emiRate, setEmiRate] = useState(8.5);
  const [emiYears, setEmiYears] = useState(20);

  // Fixed Deposit Inputs
  const [fdDeposit, setFdDeposit] = useState(100000);
  const [fdRate, setFdRate] = useState(7.0);
  const [fdYears, setFdYears] = useState(5);
  const [fdFrequency, setFdFrequency] = useState<FDCompoundingFrequency>("QUARTERLY");

  // CAGR Inputs
  const [cagrInitial, setCagrInitial] = useState(100000);
  const [cagrFinal, setCagrFinal] = useState(250000);
  const [cagrYears, setCagrYears] = useState(5);

  // XIRR Inputs
  const [xirrEntries, setXirrEntries] = useState<XIRRCashflowEntry[]>([
    { date: "2024-01-01", amount: -100000 },
    { date: "2024-07-01", amount: -50000 },
    { date: "2025-01-01", amount: 185000 },
  ]);

  // FIRE Inputs
  const [fireMonthlyExp, setFireMonthlyExp] = useState(50000);
  const [fireInflation, setFireInflation] = useState(6);
  const [fireSWR, setFireSWR] = useState(4);
  const [fireCurrentSavings, setFireCurrentSavings] = useState(1000000);
  const [fireYears, setFireYears] = useState(15);
  const [firePreReturn, setFirePreReturn] = useState(12);

  // Expandable breakdown tables
  const [showBreakdown, setShowBreakdown] = useState(false);

  // 1. Calculations
  const sipResult = useMemo(
    () =>
      calculateSIP({
        monthlyInvestment: sipMonthly,
        annualReturnPct: sipRate,
        durationYears: sipYears,
      }),
    [sipMonthly, sipRate, sipYears]
  );

  const stepUpResult = useMemo(
    () =>
      calculateStepUpSIP({
        initialMonthlySIP: stepUpMonthly,
        annualStepUpPct: stepUpStepPct,
        annualReturnPct: stepUpRate,
        durationYears: stepUpYears,
      }),
    [stepUpMonthly, stepUpStepPct, stepUpRate, stepUpYears]
  );

  const lumpsumResult = useMemo(
    () =>
      calculateLumpsum({
        initialInvestment: lumpPrincipal,
        annualReturnPct: lumpRate,
        durationYears: lumpYears,
      }),
    [lumpPrincipal, lumpRate, lumpYears]
  );

  const emiResult = useMemo(
    () =>
      calculateEMI({
        principalAmount: emiPrincipal,
        annualInterestRatePct: emiRate,
        tenureYears: emiYears,
      }),
    [emiPrincipal, emiRate, emiYears]
  );

  const fdResult = useMemo(
    () =>
      calculateFD({
        depositAmount: fdDeposit,
        annualInterestRatePct: fdRate,
        durationYears: fdYears,
        compoundingFrequency: fdFrequency,
      }),
    [fdDeposit, fdRate, fdYears, fdFrequency]
  );

  const cagrResult = useMemo(
    () =>
      calculateCAGR({
        initialInvestment: cagrInitial,
        finalInvestment: cagrFinal,
        durationYears: cagrYears,
      }),
    [cagrInitial, cagrFinal, cagrYears]
  );

  const xirrResult = useMemo(
    () =>
      calculateXIRRCalculator({
        cashflows: xirrEntries,
      }),
    [xirrEntries]
  );

  const fireResult = useMemo(
    () =>
      calculateFIRE({
        currentMonthlyExpenses: fireMonthlyExp,
        expectedInflationPct: fireInflation,
        safeWithdrawalRatePct: fireSWR,
        currentSavings: fireCurrentSavings,
        yearsToRetirement: fireYears,
        expectedPreRetirementReturnPct: firePreReturn,
      }),
    [fireMonthlyExp, fireInflation, fireSWR, fireCurrentSavings, fireYears, firePreReturn]
  );

  // Charts data
  const pieData = useMemo(() => {
    if (activeTab === "SIP") {
      return [
        { name: "Invested Capital", value: sipResult.totalInvested },
        { name: "Estimated Returns", value: sipResult.estimatedReturns },
      ];
    }
    if (activeTab === "STEP_UP") {
      return [
        { name: "Total Contributions", value: stepUpResult.totalInvested },
        { name: "Estimated Returns", value: stepUpResult.estimatedReturns },
      ];
    }
    if (activeTab === "LUMPSUM") {
      return [
        { name: "Principal", value: lumpsumResult.investedPrincipal },
        { name: "Estimated Gains", value: lumpsumResult.estimatedGains },
      ];
    }
    if (activeTab === "EMI") {
      return [
        { name: "Principal Loan", value: emiResult.principalAmount },
        { name: "Total Interest", value: emiResult.totalInterestPayable },
      ];
    }
    if (activeTab === "FD") {
      return [
        { name: "Principal Deposit", value: fdResult.investedDeposit },
        { name: "Interest Earned", value: fdResult.totalInterestEarned },
      ];
    }
    return [];
  }, [activeTab, sipResult, stepUpResult, lumpsumResult, emiResult, fdResult]);

  // XIRR Cashflow handlers
  const handleAddXirrFlow = () => {
    const today = new Date().toISOString().split("T")[0];
    setXirrEntries([
      ...xirrEntries,
      { date: today, amount: -10000 },
    ]);
  };

  const handleUpdateXirrFlow = (index: number, field: "date" | "amount", value: any) => {
    const updated = [...xirrEntries];
    if (field === "date") updated[index].date = String(value);
    if (field === "amount") updated[index].amount = Number(value);
    setXirrEntries(updated);
  };

  const handleRemoveXirrFlow = (index: number) => {
    if (xirrEntries.length <= 2) return;
    setXirrEntries(xirrEntries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Financial Planning Calculators</h1>
        <p className="text-sm text-gray-400 mt-1">
          Deterministic financial planning models for wealth compounding, loans, term deposits, and retirement independence.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-bg-border/60">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowBreakdown(false);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-bg-card border border-bg-border/60 text-gray-400 hover:text-white hover:bg-bg-hover"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Inputs Left, Outputs Right */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Inputs Panel */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="p-5 space-y-6">
            <CardHeader
              title={`${TABS.find((t) => t.id === activeTab)?.label} Parameters`}
              subtitle="Adjust sliders or type values directly"
            />

            {/* 1. SIP */}
            {activeTab === "SIP" && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="sip-monthly">Monthly Investment</label>
                    <span className="font-bold text-brand-300 text-sm font-mono">{formatINR(sipMonthly, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="sip-monthly"
                    type="range"
                    min={500}
                    max={200000}
                    step={500}
                    value={sipMonthly}
                    onChange={(e) => setSipMonthly(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹500</span>
                    <span>₹2,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="sip-rate">Expected Annual Return</label>
                    <span className="font-bold text-white text-sm font-mono">{sipRate}%</span>
                  </div>
                  <input
                    id="sip-rate"
                    type="range"
                    min={1}
                    max={30}
                    step={0.5}
                    value={sipRate}
                    onChange={(e) => setSipRate(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1%</span>
                    <span>30%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="sip-years">Investment Duration</label>
                    <span className="font-bold text-white text-sm font-mono">{sipYears} Years</span>
                  </div>
                  <input
                    id="sip-years"
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={sipYears}
                    onChange={(e) => setSipYears(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>40 Yrs</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. STEP-UP SIP */}
            {activeTab === "STEP_UP" && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="stepup-monthly">Initial Monthly SIP</label>
                    <span className="font-bold text-brand-300 text-sm font-mono">{formatINR(stepUpMonthly, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="stepup-monthly"
                    type="range"
                    min={1000}
                    max={100000}
                    step={500}
                    value={stepUpMonthly}
                    onChange={(e) => setStepUpMonthly(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹1,000</span>
                    <span>₹1,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="stepup-pct">Annual Step-Up Increment</label>
                    <span className="font-bold text-emerald-400 text-sm font-mono">+{stepUpStepPct}%</span>
                  </div>
                  <input
                    id="stepup-pct"
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={stepUpStepPct}
                    onChange={(e) => setStepUpStepPct(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>0% (Flat)</span>
                    <span>50%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="stepup-rate">Expected Annual Return</label>
                    <span className="font-bold text-white text-sm font-mono">{stepUpRate}%</span>
                  </div>
                  <input
                    id="stepup-rate"
                    type="range"
                    min={1}
                    max={30}
                    step={0.5}
                    value={stepUpRate}
                    onChange={(e) => setStepUpRate(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1%</span>
                    <span>30%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="stepup-years">Duration</label>
                    <span className="font-bold text-white text-sm font-mono">{stepUpYears} Years</span>
                  </div>
                  <input
                    id="stepup-years"
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={stepUpYears}
                    onChange={(e) => setStepUpYears(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>40 Yrs</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. LUMPSUM */}
            {activeTab === "LUMPSUM" && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="lump-principal">One-Time Investment</label>
                    <span className="font-bold text-brand-300 text-sm font-mono">{formatINR(lumpPrincipal, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="lump-principal"
                    type="range"
                    min={5000}
                    max={2000000}
                    step={5000}
                    value={lumpPrincipal}
                    onChange={(e) => setLumpPrincipal(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹5,000</span>
                    <span>₹20,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="lump-rate">Expected Annual Return</label>
                    <span className="font-bold text-white text-sm font-mono">{lumpRate}%</span>
                  </div>
                  <input
                    id="lump-rate"
                    type="range"
                    min={1}
                    max={30}
                    step={0.5}
                    value={lumpRate}
                    onChange={(e) => setLumpRate(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1%</span>
                    <span>30%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="lump-years">Investment Duration</label>
                    <span className="font-bold text-white text-sm font-mono">{lumpYears} Years</span>
                  </div>
                  <input
                    id="lump-years"
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={lumpYears}
                    onChange={(e) => setLumpYears(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>40 Yrs</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. LOAN EMI */}
            {activeTab === "EMI" && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="emi-principal">Loan Amount</label>
                    <span className="font-bold text-blue-400 text-sm font-mono">{formatINR(emiPrincipal, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="emi-principal"
                    type="range"
                    min={50000}
                    max={20000000}
                    step={50000}
                    value={emiPrincipal}
                    onChange={(e) => setEmiPrincipal(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹50,000</span>
                    <span>₹2,00,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="emi-rate">Annual Interest Rate</label>
                    <span className="font-bold text-white text-sm font-mono">{emiRate}%</span>
                  </div>
                  <input
                    id="emi-rate"
                    type="range"
                    min={3}
                    max={24}
                    step={0.1}
                    value={emiRate}
                    onChange={(e) => setEmiRate(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>3%</span>
                    <span>24%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="emi-years">Loan Tenure</label>
                    <span className="font-bold text-white text-sm font-mono">{emiYears} Years ({emiYears * 12} Mo)</span>
                  </div>
                  <input
                    id="emi-years"
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={emiYears}
                    onChange={(e) => setEmiYears(Number(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>30 Yrs</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. FIXED DEPOSIT */}
            {activeTab === "FD" && (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="fd-deposit">Deposit Principal</label>
                    <span className="font-bold text-brand-300 text-sm font-mono">{formatINR(fdDeposit, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="fd-deposit"
                    type="range"
                    min={10000}
                    max={5000000}
                    step={10000}
                    value={fdDeposit}
                    onChange={(e) => setFdDeposit(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹10,000</span>
                    <span>₹50,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="fd-rate">Interest Rate (% p.a.)</label>
                    <span className="font-bold text-white text-sm font-mono">{fdRate}%</span>
                  </div>
                  <input
                    id="fd-rate"
                    type="range"
                    min={2}
                    max={15}
                    step={0.1}
                    value={fdRate}
                    onChange={(e) => setFdRate(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>2%</span>
                    <span>15%</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="fd-years">Tenure (Years)</label>
                    <span className="font-bold text-white text-sm font-mono">{fdYears} Years</span>
                  </div>
                  <input
                    id="fd-years"
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={fdYears}
                    onChange={(e) => setFdYears(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>20 Yrs</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="fd-frequency" className="block text-xs font-medium text-gray-300 mb-1.5">
                    Compounding Frequency
                  </label>
                  <select
                    id="fd-frequency"
                    value={fdFrequency}
                    onChange={(e) => setFdFrequency(e.target.value as FDCompoundingFrequency)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-bg-border text-white text-xs font-medium focus:outline-none focus:border-brand-500"
                  >
                    <option value="QUARTERLY">Quarterly (Indian Bank Standard)</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="HALF_YEARLY">Half-Yearly</option>
                    <option value="ANNUALLY">Annually</option>
                    <option value="SIMPLE">Simple Interest (At Maturity)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 6. CAGR */}
            {activeTab === "CAGR" && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="cagr-initial" className="block text-xs font-medium text-gray-300 mb-1.5">
                    Initial Investment (Beginning Value)
                  </label>
                  <input
                    id="cagr-initial"
                    type="number"
                    value={cagrInitial}
                    onChange={(e) => setCagrInitial(Math.max(1, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-bg-border text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label htmlFor="cagr-final" className="block text-xs font-medium text-gray-300 mb-1.5">
                    Final Investment (Ending Value)
                  </label>
                  <input
                    id="cagr-final"
                    type="number"
                    value={cagrFinal}
                    onChange={(e) => setCagrFinal(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-bg-border text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-2">
                    <label htmlFor="cagr-years">Duration (Years)</label>
                    <span className="font-bold text-white text-sm font-mono">{cagrYears} Years</span>
                  </div>
                  <input
                    id="cagr-years"
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={cagrYears}
                    onChange={(e) => setCagrYears(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1 Yr</span>
                    <span>30 Yrs</span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. XIRR */}
            {activeTab === "XIRR" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Dated Cash Flows</span>
                  <button
                    type="button"
                    onClick={handleAddXirrFlow}
                    className="px-2 py-1 bg-brand-600/30 text-brand-300 hover:bg-brand-600/50 rounded text-[11px] font-medium"
                  >
                    + Add Cash Flow
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Enter investments as negative amounts and redemptions / current portfolio value as positive amounts.
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {xirrEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-bg-base/60 p-2 rounded border border-bg-border/60">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) => handleUpdateXirrFlow(idx, "date", e.target.value)}
                        className="w-32 bg-bg-card border border-bg-border text-[11px] text-gray-200 px-2 py-1 rounded focus:outline-none"
                      />
                      <input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => handleUpdateXirrFlow(idx, "amount", e.target.value)}
                        placeholder="Amount"
                        className={cn(
                          "flex-1 bg-bg-card border border-bg-border text-xs px-2 py-1 rounded font-mono focus:outline-none",
                          entry.amount < 0 ? "text-amber-400" : "text-emerald-400"
                        )}
                      />
                      {xirrEntries.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveXirrFlow(idx)}
                          className="text-gray-500 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. FIRE */}
            {activeTab === "FIRE" && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-1.5">
                    <label htmlFor="fire-monthly">Current Monthly Expenses</label>
                    <span className="font-bold text-brand-300 text-sm font-mono">{formatINR(fireMonthlyExp, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="fire-monthly"
                    type="range"
                    min={10000}
                    max={300000}
                    step={2500}
                    value={fireMonthlyExp}
                    onChange={(e) => setFireMonthlyExp(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>₹10,000</span>
                    <span>₹3,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-1.5">
                    <label htmlFor="fire-inf">Expected Inflation (% p.a.)</label>
                    <span className="font-bold text-white text-sm font-mono">{fireInflation}%</span>
                  </div>
                  <input
                    id="fire-inf"
                    type="range"
                    min={3}
                    max={12}
                    step={0.5}
                    value={fireInflation}
                    onChange={(e) => setFireInflation(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-1.5">
                    <label htmlFor="fire-swr">Safe Withdrawal Rate (SWR %)</label>
                    <span className="font-bold text-amber-400 text-sm font-mono">{fireSWR}% ({100 / fireSWR}x)</span>
                  </div>
                  <input
                    id="fire-swr"
                    type="range"
                    min={2.5}
                    max={6.0}
                    step={0.25}
                    value={fireSWR}
                    onChange={(e) => setFireSWR(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-300 mb-1.5">
                    <label htmlFor="fire-savings">Current Retirement Savings</label>
                    <span className="font-bold text-white text-sm font-mono">{formatINR(fireCurrentSavings, { privacy: privacyMode })}</span>
                  </div>
                  <input
                    id="fire-savings"
                    type="range"
                    min={0}
                    max={10000000}
                    step={50000}
                    value={fireCurrentSavings}
                    onChange={(e) => setFireCurrentSavings(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fire-years" className="block text-[11px] font-medium text-gray-300 mb-1">
                      Years to Retirement
                    </label>
                    <input
                      id="fire-years"
                      type="number"
                      min={1}
                      max={40}
                      value={fireYears}
                      onChange={(e) => setFireYears(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 rounded bg-bg-card border border-bg-border text-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="fire-pre-return" className="block text-[11px] font-medium text-gray-300 mb-1">
                      Pre-Ret Return %
                    </label>
                    <input
                      id="fire-pre-return"
                      type="number"
                      min={0}
                      max={25}
                      value={firePreReturn}
                      onChange={(e) => setFirePreReturn(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded bg-bg-card border border-bg-border text-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Outputs Panel */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Summary Stat Cards */}
          {activeTab === "SIP" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Invested" value={formatINR(sipResult.totalInvested, { privacy: privacyMode })} />
              <StatCard label="Estimated Returns" value={formatINR(sipResult.estimatedReturns, { privacy: privacyMode })} change={`+${formatPercent((sipResult.estimatedReturns / (sipResult.totalInvested || 1)) * 100)}`} />
              <StatCard label="Estimated Final Corpus" value={formatINR(sipResult.finalCorpus, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "STEP_UP" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Contributions" value={formatINR(stepUpResult.totalInvested, { privacy: privacyMode })} />
              <StatCard label="Estimated Returns" value={formatINR(stepUpResult.estimatedReturns, { privacy: privacyMode })} change={`+${formatPercent((stepUpResult.estimatedReturns / (stepUpResult.totalInvested || 1)) * 100)}`} />
              <StatCard label="Estimated Final Corpus" value={formatINR(stepUpResult.finalCorpus, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "LUMPSUM" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Invested Principal" value={formatINR(lumpsumResult.investedPrincipal, { privacy: privacyMode })} />
              <StatCard label="Estimated Wealth Gains" value={formatINR(lumpsumResult.estimatedGains, { privacy: privacyMode })} change={`+${formatPercent((lumpsumResult.estimatedGains / (lumpsumResult.investedPrincipal || 1)) * 100)}`} />
              <StatCard label="Estimated Final Value" value={formatINR(lumpsumResult.finalValue, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "EMI" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Monthly EMI" value={formatINR(emiResult.monthlyEMI, { privacy: privacyMode })} />
              <StatCard label="Total Interest Payable" value={formatINR(emiResult.totalInterestPayable, { privacy: privacyMode })} change={`${emiResult.interestToPrincipalRatioPct}% of principal`} />
              <StatCard label="Total Payment (P + I)" value={formatINR(emiResult.totalPayment, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "FD" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Deposit Amount" value={formatINR(fdResult.investedDeposit, { privacy: privacyMode })} />
              <StatCard label="Total Interest Earned" value={formatINR(fdResult.totalInterestEarned, { privacy: privacyMode })} change={`+${formatPercent((fdResult.totalInterestEarned / (fdResult.investedDeposit || 1)) * 100)}`} />
              <StatCard label="Maturity Value" value={formatINR(fdResult.maturityValue, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "CAGR" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="CAGR (Annualized)" value={`${cagrResult.cagrPct}%`} />
              <StatCard label="Total Absolute Gain" value={formatINR(cagrResult.totalGain, { privacy: privacyMode })} change={`+${cagrResult.absoluteReturnPct}% total`} />
              <StatCard label="Final Value" value={formatINR(cagrResult.finalInvestment, { privacy: privacyMode })} />
            </div>
          )}

          {activeTab === "XIRR" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Annualized XIRR" value={xirrResult.xirrPct !== null ? `${xirrResult.xirrPct}%` : "N/A"} change={xirrResult.isValid ? "Internal Rate of Return" : "Invalid cash flows"} />
              <StatCard label="Total Invested" value={formatINR(xirrResult.totalInvested, { privacy: privacyMode })} />
              <StatCard label="Net Profit / Gains" value={formatINR(xirrResult.netProfit, { privacy: privacyMode })} change={xirrResult.isValid ? `+${xirrResult.absoluteReturnPct}% abs` : "—"} />
            </div>
          )}

          {activeTab === "FIRE" && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatCard label="Future Annual Exp" value={formatINR(fireResult.futureAnnualExpenses, { privacy: privacyMode })} />
              <StatCard label="Target FIRE Corpus" value={formatINR(fireResult.targetCorpus, { privacy: privacyMode })} change={`${fireResult.corpusMultiplier}x expenses`} />
              <StatCard label="Savings Gap" value={formatINR(fireResult.savingsGap, { privacy: privacyMode })} />
              <StatCard label="Monthly SIP Req" value={formatINR(fireResult.monthlyInvestmentRequired, { privacy: privacyMode })} change={fireResult.isAlreadyIndependent ? "FIRE Achieved!" : "Needed to bridge gap"} />
            </div>
          )}

          {/* Visual Charts Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Growth Curve */}
            {["SIP", "STEP_UP", "LUMPSUM", "FD", "CAGR"].includes(activeTab) && (
              <Card className="col-span-12 md:col-span-7 p-5">
                <CardHeader title="Wealth Accumulation Trajectory" subtitle="Compound growth progression over investment duration" />
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={
                        activeTab === "SIP"
                          ? sipResult.breakdown
                          : activeTab === "STEP_UP"
                          ? stepUpResult.breakdown
                          : activeTab === "LUMPSUM"
                          ? lumpsumResult.breakdown
                          : activeTab === "FD"
                          ? fdResult.breakdown
                          : cagrResult.breakdown
                      }
                    >
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2b73ff" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2b73ff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#242932" />
                      <XAxis dataKey="year" stroke="#6b7280" tickFormatter={(v) => `Y${v}`} />
                      <YAxis stroke="#6b7280" tickFormatter={(v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${v / 1e3}K`)} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => formatINR(Number(v), { privacy: privacyMode })} />
                      <Area type="monotone" dataKey="totalValue" name="Corpus Value" stroke="#2b73ff" strokeWidth={2} fillOpacity={1} fill="url(#totalGrad)" />
                      <Area type="monotone" dataKey="invested" name="Invested Capital" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* EMI Balance Curve */}
            {activeTab === "EMI" && (
              <Card className="col-span-12 md:col-span-7 p-5">
                <CardHeader title="Loan Principal Amortization" subtitle="Outstanding balance reduction over loan tenure" />
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={emiResult.breakdown}>
                      <defs>
                        <linearGradient id="emiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#242932" />
                      <XAxis dataKey="year" stroke="#6b7280" tickFormatter={(v) => `Y${v}`} />
                      <YAxis stroke="#6b7280" tickFormatter={(v) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${v / 1e3}K`)} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => formatINR(Number(v), { privacy: privacyMode })} />
                      <Area type="monotone" dataKey="closingBalance" name="Outstanding Balance" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#emiGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Donut Ratio Chart */}
            {["SIP", "STEP_UP", "LUMPSUM", "EMI", "FD"].includes(activeTab) && (
              <Card className="col-span-12 md:col-span-5 p-5">
                <CardHeader title="Capital vs Returns Ratio" subtitle="Distribution of principal and interest/gain" />
                <div className="h-64 mt-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={activeTab === "EMI" ? EMI_PIE_COLORS[index % EMI_PIE_COLORS.length] : PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(v: any) => formatINR(Number(v), { privacy: privacyMode })} />
                      <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* FIRE Benchmarks Box */}
            {activeTab === "FIRE" && (
              <Card className="col-span-12 p-5">
                <CardHeader title="FIRE Independence Benchmarks" subtitle="Target corpus tiers based on post-retirement lifestyle" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div className="p-4 rounded-lg bg-bg-base/60 border border-bg-border/60">
                    <span className="text-xs text-gray-400 block font-medium">Lean FIRE (75% Expenses)</span>
                    <span className="text-lg font-bold text-white font-mono mt-1 block">
                      {formatINR(fireResult.leanFIRECorpus, { privacy: privacyMode })}
                    </span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">Essential lifestyle without luxury buffer</span>
                  </div>
                  <div className="p-4 rounded-lg bg-brand-600/10 border border-brand-600/30">
                    <span className="text-xs text-brand-300 block font-medium">Standard FIRE (100% Expenses)</span>
                    <span className="text-lg font-bold text-brand-400 font-mono mt-1 block">
                      {formatINR(fireResult.targetCorpus, { privacy: privacyMode })}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">Full current living standard preserved</span>
                  </div>
                  <div className="p-4 rounded-lg bg-bg-base/60 border border-bg-border/60">
                    <span className="text-xs text-gray-400 block font-medium">Fat FIRE (125% Expenses)</span>
                    <span className="text-lg font-bold text-white font-mono mt-1 block">
                      {formatINR(fireResult.fatFIRECorpus, { privacy: privacyMode })}
                    </span>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">Expanded discretionary & travel buffer</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Toggle Breakdown Table */}
          {["SIP", "STEP_UP", "LUMPSUM", "EMI", "FD", "CAGR"].includes(activeTab) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1.5"
              >
                <span>{showBreakdown ? "▼ Hide" : "▶ Show"} Year-by-Year Growth Table</span>
              </button>

              {showBreakdown && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-bg-border/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-bg-card border-b border-bg-border/60 text-gray-400 font-medium">
                      <tr>
                        <th className="px-3 py-2">Year</th>
                        {activeTab === "EMI" ? (
                          <>
                            <th className="px-3 py-2">Opening Balance</th>
                            <th className="px-3 py-2">Annual EMI</th>
                            <th className="px-3 py-2">Principal Repaid</th>
                            <th className="px-3 py-2">Interest Paid</th>
                            <th className="px-3 py-2">Closing Balance</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2">Invested Capital</th>
                            <th className="px-3 py-2">Estimated Gains / Returns</th>
                            <th className="px-3 py-2">Total Accumulated Value</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bg-border/40 font-mono">
                      {activeTab === "EMI"
                        ? emiResult.breakdown.map((row) => (
                            <tr key={row.year} className="hover:bg-bg-hover/40 text-gray-300">
                              <td className="px-3 py-2 font-sans font-medium text-white">Year {row.year}</td>
                              <td className="px-3 py-2">{formatINR(row.openingBalance, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-white">{formatINR(row.annualEMI, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-blue-400">{formatINR(row.principalPaid, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-rose-400">{formatINR(row.interestPaid, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-white font-bold">{formatINR(row.closingBalance, { privacy: privacyMode })}</td>
                            </tr>
                          ))
                        : (activeTab === "SIP"
                            ? sipResult.breakdown
                            : activeTab === "STEP_UP"
                            ? stepUpResult.breakdown
                            : activeTab === "LUMPSUM"
                            ? lumpsumResult.breakdown
                            : activeTab === "FD"
                            ? fdResult.breakdown
                            : cagrResult.breakdown
                          ).map((row) => (
                            <tr key={row.year} className="hover:bg-bg-hover/40 text-gray-300">
                              <td className="px-3 py-2 font-sans font-medium text-white">Year {row.year}</td>
                              <td className="px-3 py-2">{formatINR(row.invested, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-emerald-400">+{formatINR(row.returns, { privacy: privacyMode })}</td>
                              <td className="px-3 py-2 text-white font-bold">{formatINR(row.totalValue, { privacy: privacyMode })}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Educational Disclaimers and Methodology Box */}
          <div className="p-4 rounded-xl bg-bg-base/60 border border-bg-border/60 text-xs text-gray-400 space-y-1.5 leading-relaxed">
            <div className="font-semibold text-gray-200 flex items-center gap-1.5">
              <span>ℹ️</span> Methodology, Modeling Assumptions & Limitations
            </div>
            <p>
              • <strong className="text-gray-300">Deterministic Models:</strong> Calculations use standard mathematical compound growth, annuity due (mutual funds), and loan amortization formulas. Projected returns and historical safe withdrawal rates are illustrative benchmarks, not guarantees.
            </p>
            <p>
              • <strong className="text-gray-300">Taxes & Inflation:</strong> Net realized returns depend on applicable capital gains taxes (LTCG / STCG), expense ratios, and inflation fluctuations over the investment horizon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
