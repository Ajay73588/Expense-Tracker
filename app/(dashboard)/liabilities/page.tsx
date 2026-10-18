"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardHeader, StatCard } from "@/components/cards/Card";
import { formatINR, formatPercent, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import { calculateEMI, round2 } from "@/lib/finance/amortization";
import type { LiabilityItem, LiabilitySummary, LiabilityType } from "@/types";

const TYPE_CONFIG: Record<
  LiabilityType,
  { label: string; badge: string; icon: string }
> = {
  HOME_LOAN: { label: "Home Loan", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: "⌂" },
  CAR_LOAN: { label: "Car Loan", badge: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: "🚗" },
  PERSONAL_LOAN: { label: "Personal Loan", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: "💼" },
  EDUCATION_LOAN: { label: "Education Loan", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: "🎓" },
  CREDIT_CARD: { label: "Credit Card", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: "💳" },
  OTHER: { label: "Other Liability", badge: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: "⚖" },
};

interface ScheduleInstallment {
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

interface PrepaymentSimResult {
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
  schedule: ScheduleInstallment[];
}

export default function LiabilitiesPage() {
  const [summary, setSummary] = useState<LiabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LiabilityItem | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);
  const [activeLiability, setActiveLiability] = useState<LiabilityItem | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<LiabilityType>("HOME_LOAN");
  const [formPrincipal, setFormPrincipal] = useState("");
  const [formOutstanding, setFormOutstanding] = useState("");
  const [formRate, setFormRate] = useState("8.5");
  const [formTenure, setFormTenure] = useState("240");
  const [formEMI, setFormEMI] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Simulation state
  const [simStrategy, setSimStrategy] = useState<"REDUCE_TENURE" | "REDUCE_EMI">("REDUCE_TENURE");
  const [simMonthlyExtra, setSimMonthlyExtra] = useState("5000");
  const [simLumpSum, setSimLumpSum] = useState("100000");
  const [simLumpSumMonth, setSimLumpSumMonth] = useState("12");
  const [simResult, setSimResult] = useState<PrepaymentSimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [schedulePage, setSchedulePage] = useState(1);

  // Fetch liabilities data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/liabilities");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to load liabilities");
      }
      setSummary(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to load liabilities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live calculated EMI for modal form
  const previewEMI = useMemo(() => {
    const p = Number(formPrincipal) || 0;
    const r = Number(formRate) || 0;
    const n = Number(formTenure) || 0;
    if (p > 0 && n > 0) {
      return calculateEMI(p, r, n);
    }
    return 0;
  }, [formPrincipal, formRate, formTenure]);

  // Open Add modal
  const openAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormType("HOME_LOAN");
    setFormPrincipal("");
    setFormOutstanding("");
    setFormRate("8.5");
    setFormTenure("240");
    setFormEMI("");
    setFormDueDate("");
    setFormError(null);
    setShowFormModal(true);
  };

  // Open Edit modal
  const openEditModal = (item: LiabilityItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormType(item.type);
    setFormPrincipal(String(item.principalAmount));
    setFormOutstanding(String(item.outstandingAmount));
    setFormRate(String(item.interestRate));
    setFormTenure(item.estimatedRemainingMonths ? String(item.estimatedRemainingMonths) : "120");
    setFormEMI(item.monthlyEMI ? String(item.monthlyEMI) : "");
    setFormDueDate(item.dueDate ? item.dueDate.slice(0, 10) : "");
    setFormError(null);
    setShowFormModal(true);
  };

  // Save (create or update) liability
  const handleSaveLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const principal = Number(formPrincipal);
    const outstanding = Number(formOutstanding || formPrincipal);
    const rate = Number(formRate);
    const emi = formEMI ? Number(formEMI) : (previewEMI > 0 ? previewEMI : undefined);
    const tenure = Number(formTenure);

    if (!formName.trim()) {
      setFormError("Please enter a loan or liability name.");
      return;
    }
    if (principal <= 0) {
      setFormError("Principal amount must be greater than zero.");
      return;
    }
    if (outstanding < 0) {
      setFormError("Outstanding amount cannot be negative.");
      return;
    }
    if (rate < 0) {
      setFormError("Interest rate cannot be negative.");
      return;
    }

    try {
      setFormSubmitting(true);
      const payload: any = {
        name: formName.trim(),
        type: formType,
        principalAmount: principal,
        outstandingAmount: outstanding,
        interestRate: rate,
        monthlyEMI: emi,
        tenureMonths: tenure > 0 ? tenure : undefined,
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
      };

      const url = editingItem ? `/api/liabilities/${editingItem.id}` : "/api/liabilities";
      const method = editingItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to save liability");
      }

      setShowFormModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save liability");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete liability
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
    try {
      const res = await fetch(`/api/liabilities/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || "Failed to delete");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete liability");
    }
  };

  // Run prepayment simulation
  const runSimulation = useCallback(
    async (liability: LiabilityItem, extraMonthly: number, lump: number, lumpMonth: number, strategy: "REDUCE_TENURE" | "REDUCE_EMI") => {
      try {
        setSimLoading(true);
        const body: any = {
          strategy,
          monthlyExtra: extraMonthly > 0 ? extraMonthly : undefined,
          lumpSums: lump > 0 && lumpMonth > 0 ? [{ month: lumpMonth, amount: lump }] : [],
        };

        const res = await fetch(`/api/liabilities/${liability.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error?.message || "Simulation failed");
        }
        setSimResult(json.data);
        setSchedulePage(1);
      } catch (err: any) {
        alert(err.message || "Failed to run prepayment simulation");
      } finally {
        setSimLoading(false);
      }
    },
    []
  );

  // Open Simulator modal
  const openSimulatorModal = (item: LiabilityItem) => {
    setActiveLiability(item);
    setShowSimModal(true);
    // Trigger initial simulation
    runSimulation(
      item,
      Number(simMonthlyExtra) || 0,
      Number(simLumpSum) || 0,
      Number(simLumpSumMonth) || 12,
      simStrategy
    );
  };

  const handleSimTrigger = () => {
    if (!activeLiability) return;
    runSimulation(
      activeLiability,
      Number(simMonthlyExtra) || 0,
      Number(simLumpSum) || 0,
      Number(simLumpSumMonth) || 12,
      simStrategy
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Liabilities & Debt Center</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track loans, monitor EMIs, and simulate prepayment strategies to become debt-free faster.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-colors shadow-lg shadow-brand-600/20 w-fit"
        >
          <span>+</span>
          <span>Add Loan / Liability</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-bg-card/50 border border-bg-border/50" />
          ))}
        </div>
      )}

      {/* Stat Cards */}
      {!loading && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Outstanding Debt"
            value={formatINR(summary.totalOutstanding)}
            hint={`${summary.liabilitiesCount} active accounts`}
            tone="negative"
          />
          <StatCard
            label="Total Monthly EMI"
            value={formatINR(summary.totalMonthlyEMI)}
            hint="Scheduled monthly outflows"
          />
          <StatCard
            label="Weighted Avg Interest"
            value={formatPercent(summary.weightedInterestRate)}
            hint="Annual borrowing rate"
          />
          <StatCard
            label="Original Principal"
            value={formatINR(summary.totalPrincipal)}
            hint={
              summary.totalPrincipal > 0
                ? `${round2(((summary.totalPrincipal - summary.totalOutstanding) / summary.totalPrincipal) * 100)}% repaid overall`
                : "No active loans"
            }
            tone="positive"
          />
        </div>
      )}

      {/* Liabilities List */}
      {!loading && summary && (
        <Card className="p-6">
          <CardHeader
            title="Active Liabilities & Loans"
            subtitle={`${summary.liabilities.length} liabilities registered`}
          />

          {summary.liabilities.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-brand-600/10 border border-brand-500/20 flex items-center justify-center text-3xl mx-auto mb-4 text-brand-400">
                ⚖
              </div>
              <h3 className="text-base font-semibold text-white">No liabilities recorded</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto mt-1 mb-6">
                You have zero active debts logged. Add home loans, car loans, or personal debts to track repayments and run prepayment simulations.
              </p>
              <button
                onClick={openAddModal}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
              >
                + Add Your First Liability
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {summary.liabilities.map((item) => {
                const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.OTHER;
                const progress = item.progressPct ?? 0;

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-bg-card/70 border border-bg-border hover:border-brand-500/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Type Badge + Actions */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1",
                              config.badge
                            )}
                          >
                            <span>{config.icon}</span>
                            <span>{config.label}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-bg-hover transition-colors text-xs"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-bg-hover transition-colors text-xs"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Loan Name & Balance */}
                      <h4 className="text-lg font-semibold text-white tracking-tight">{item.name}</h4>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-rose-400">
                          {formatINR(item.outstandingAmount)}
                        </span>
                        <span className="text-xs text-gray-400">
                          left of {formatINR(item.principalAmount)}
                        </span>
                      </div>

                      {/* Repayment Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Repayment Progress</span>
                          <span className="font-medium text-gray-300">{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div className="mt-4 pt-3 border-t border-bg-border/60 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500">Interest Rate</div>
                          <div className="font-semibold text-white mt-0.5">{item.interestRate}%</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Monthly EMI</div>
                          <div className="font-semibold text-white mt-0.5">
                            {item.monthlyEMI ? formatINR(item.monthlyEMI) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Est. Remaining</div>
                          <div className="font-semibold text-white mt-0.5">
                            {item.estimatedRemainingMonths ? `${item.estimatedRemainingMonths} mos` : "—"}
                          </div>
                        </div>
                      </div>

                      {item.dueDate && (
                        <div className="mt-2 text-[11px] text-gray-400">
                          Next due date: <span className="text-gray-300">{formatDate(item.dueDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Prepayment & Amortization Action */}
                    <div className="mt-5 pt-3 border-t border-bg-border/50">
                      <button
                        onClick={() => openSimulatorModal(item)}
                        className="w-full py-2 px-3 rounded-lg bg-brand-600/15 hover:bg-brand-600/25 border border-brand-500/30 text-brand-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>⚡</span>
                        <span>Amortization & Prepayment Simulator</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Liability Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-bg-card border border-bg-border p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingItem ? "Edit Liability" : "Add Loan / Liability"}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveLiability} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Loan / Liability Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Home Loan, ICICI Car Loan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Liability Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as LiabilityType)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="HOME_LOAN">Home Loan</option>
                  <option value="CAR_LOAN">Car Loan</option>
                  <option value="PERSONAL_LOAN">Personal Loan</option>
                  <option value="EDUCATION_LOAN">Education Loan</option>
                  <option value="CREDIT_CARD">Credit Card Debt</option>
                  <option value="OTHER">Other Liability</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Original Principal (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 5000000"
                    value={formPrincipal}
                    onChange={(e) => setFormPrincipal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Current Outstanding (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Leave blank to match principal"
                    value={formOutstanding}
                    onChange={(e) => setFormOutstanding(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Annual Interest Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 8.5"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Tenure (Total Months)</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 240 (20 years)"
                    value={formTenure}
                    onChange={(e) => setFormTenure(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic EMI Calculator Preview */}
              {previewEMI > 0 && (
                <div className="p-3 rounded-xl bg-brand-600/10 border border-brand-500/30 flex items-center justify-between text-xs">
                  <span className="text-gray-300">Deterministic Calculated EMI:</span>
                  <span className="font-bold text-brand-300 text-sm">{formatINR(previewEMI)}/mo</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Monthly EMI Override (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder={previewEMI > 0 ? String(previewEMI) : "e.g. 43391"}
                    value={formEMI}
                    onChange={(e) => setFormEMI(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">Next Payment Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-lg border border-bg-border text-gray-300 text-sm hover:bg-bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors shadow-lg shadow-brand-600/20 disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingItem ? "Update Liability" : "Create Liability"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Amortization & Prepayment Simulator Modal */}
      {showSimModal && activeLiability && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-bg-card border border-bg-border p-6 shadow-2xl space-y-6 my-6 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-bg-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {activeLiability.name} — Amortization & Prepayment Simulator
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Outstanding: <span className="text-rose-400 font-semibold">{formatINR(activeLiability.outstandingAmount)}</span> · Rate:{" "}
                  <span className="text-white font-semibold">{activeLiability.interestRate}%</span> · EMI:{" "}
                  <span className="text-white font-semibold">
                    {activeLiability.monthlyEMI ? formatINR(activeLiability.monthlyEMI) : "—"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-gray-400 hover:text-white text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Simulator Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Simulator Controls Card */}
              <div className="p-5 rounded-xl bg-bg-card/50 border border-bg-border space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Choose Prepayment Strategy
                  </span>
                  {/* Strategy Tabs */}
                  <div className="inline-flex rounded-lg bg-bg-input p-1 border border-bg-border">
                    <button
                      type="button"
                      onClick={() => {
                        setSimStrategy("REDUCE_TENURE");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        simStrategy === "REDUCE_TENURE"
                          ? "bg-brand-600 text-white shadow"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      Reduce Tenure (Pay Off Earlier)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSimStrategy("REDUCE_EMI");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        simStrategy === "REDUCE_EMI"
                          ? "bg-brand-600 text-white shadow"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      Reduce EMI (Lower Outflow)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Extra Monthly Payment (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={simMonthlyExtra}
                      onChange={(e) => setSimMonthlyExtra(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Lump Sum Prepayment (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 100000"
                      value={simLumpSum}
                      onChange={(e) => setSimLumpSum(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Lump Sum Payment Month
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 12"
                      value={simLumpSumMonth}
                      onChange={(e) => setSimLumpSumMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-bg-input border border-bg-border text-white text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSimTrigger}
                  disabled={simLoading}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <span>{simLoading ? "Calculating..." : "Recalculate Schedule"}</span>
                </button>
              </div>

              {/* Dynamic Savings Hero */}
              {simResult && (
                <div className="space-y-4">
                  {simResult.savings.interestSaved > 0 ? (
                    <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-brand-950/30 to-bg-card border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                          <span>🎉</span>
                          <span>
                            You will save {formatINR(simResult.savings.interestSaved)} in total interest!
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">
                          {simStrategy === "REDUCE_TENURE"
                            ? `Your loan is paid off ${simResult.savings.monthsSaved} months (${(simResult.savings.monthsSaved / 12).toFixed(1)} years) earlier!`
                            : `Your ongoing monthly EMI drops by ${formatINR(simResult.original.monthlyEMI - simResult.revised.monthlyEMI)} while saving interest!`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Total Prepayments</div>
                        <div className="text-lg font-bold text-white">
                          {formatINR(simResult.revised.totalPrepayments)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-bg-card/40 border border-bg-border text-xs text-gray-400">
                      Standard amortization baseline. Add prepayment amounts above to simulate interest savings and early debt-free dates.
                    </div>
                  )}

                  {/* Comparison Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-bg-card border border-bg-border text-xs">
                      <div className="text-gray-500">Original Tenure</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {simResult.original.tenureMonths} mos
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-card border border-bg-border text-xs">
                      <div className="text-gray-500">Revised Tenure</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        {simResult.revised.tenureMonths} mos
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-card border border-bg-border text-xs">
                      <div className="text-gray-500">Original Total Interest</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {formatINR(simResult.original.totalInterest)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-bg-card border border-bg-border text-xs">
                      <div className="text-gray-500">Revised Total Interest</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        {formatINR(simResult.revised.totalInterest)}
                      </div>
                    </div>
                  </div>

                  {/* Amortization Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">Month-by-Month Amortization Schedule</h4>
                      <span className="text-xs text-gray-400">
                        {simResult.schedule.length} installments
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-bg-border">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-bg-input text-gray-400 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-3 py-2.5">Month</th>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Opening Balance</th>
                            <th className="px-3 py-2.5">EMI Paid</th>
                            <th className="px-3 py-2.5">Principal</th>
                            <th className="px-3 py-2.5">Interest</th>
                            <th className="px-3 py-2.5">Prepayment</th>
                            <th className="px-3 py-2.5">Closing Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-bg-border/60">
                          {simResult.schedule
                            .slice((schedulePage - 1) * 24, schedulePage * 24)
                            .map((inst) => (
                              <tr key={inst.month} className="hover:bg-bg-hover/50">
                                <td className="px-3 py-2 font-medium text-gray-300">#{inst.month}</td>
                                <td className="px-3 py-2 text-gray-400">{inst.date}</td>
                                <td className="px-3 py-2 text-white font-mono">{formatINR(inst.openingBalance)}</td>
                                <td className="px-3 py-2 text-white font-mono">{formatINR(inst.emi)}</td>
                                <td className="px-3 py-2 text-emerald-400 font-mono">
                                  {formatINR(inst.principal)}
                                </td>
                                <td className="px-3 py-2 text-rose-400 font-mono">{formatINR(inst.interest)}</td>
                                <td className="px-3 py-2 font-mono">
                                  {inst.prepayment ? (
                                    <span className="text-brand-300 font-semibold">
                                      +{formatINR(inst.prepayment)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-white font-mono font-medium">
                                  {formatINR(inst.closingBalance)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {simResult.schedule.length > 24 && (
                      <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
                        <span>
                          Showing months {(schedulePage - 1) * 24 + 1} to{" "}
                          {Math.min(schedulePage * 24, simResult.schedule.length)} of {simResult.schedule.length}
                        </span>
                        <div className="flex gap-2">
                          <button
                            disabled={schedulePage <= 1}
                            onClick={() => setSchedulePage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1 rounded bg-bg-card border border-bg-border hover:bg-bg-hover disabled:opacity-40"
                          >
                            Previous 24
                          </button>
                          <button
                            disabled={schedulePage * 24 >= simResult.schedule.length}
                            onClick={() => setSchedulePage((p) => p + 1)}
                            className="px-3 py-1 rounded bg-bg-card border border-bg-border hover:bg-bg-hover disabled:opacity-40"
                          >
                            Next 24
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-bg-border flex justify-end">
              <button
                onClick={() => setShowSimModal(false)}
                className="px-5 py-2 rounded-lg bg-bg-input hover:bg-bg-hover border border-bg-border text-white text-xs font-medium transition-colors"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
