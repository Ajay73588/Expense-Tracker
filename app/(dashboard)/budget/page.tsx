"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/cards/Card";
import { formatINR } from "@/utils/format";
import { cn } from "@/utils/cn";

interface BudgetUsage {
  id: string;
  category: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  usedPercent: number;
  status: "OK" | "WARN" | "EXCEEDED";
  month: number;
  year: number;
}

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();

const CATEGORIES = ["Food","Rent","Transport","Utilities","Entertainment","Shopping","Healthcare","SIP","Education","Insurance","Travel","Other"];

const STATUS_BAR: Record<string, string> = {
  OK: "bg-positive",
  WARN: "bg-warning",
  EXCEEDED: "bg-negative",
};

const STATUS_PILL: Record<string, string> = {
  OK: "pill-positive",
  WARN: "pill-warn",
  EXCEEDED: "pill-negative",
};

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<BudgetUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Food", monthlyLimit: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/budget?month=${CURRENT_MONTH}&year=${CURRENT_YEAR}`);
    const json = await res.json();
    if (json.ok) setBudgets(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveBudget() {
    if (!form.monthlyLimit || isNaN(Number(form.monthlyLimit))) return;
    setSaving(true);
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        monthlyLimit: Number(form.monthlyLimit),
        month: CURRENT_MONTH,
        year: CURRENT_YEAR,
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ category: "Food", monthlyLimit: "" });
    load();
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/budget?id=${id}`, { method: "DELETE" });
    load();
  }

  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const exceeded = budgets.filter(b => b.status === "EXCEEDED").length;
  const warned = budgets.filter(b => b.status === "WARN").length;

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading budgets…</div>;

  const monthName = new Date(CURRENT_YEAR, CURRENT_MONTH - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget</h1>
          <p className="text-sm text-gray-500 mt-1">{monthName} · Spending limits and usage.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Budget</button>
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Set Budget Limit</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Monthly Limit (₹)</label>
                <input className="input" type="number" placeholder="10000" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={saveBudget} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Total Budget</div>
          <div className="text-xl font-bold text-white">{formatINR(totalLimit, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Total Spent</div>
          <div className="text-xl font-bold text-white">{formatINR(totalSpent, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Remaining</div>
          <div className={cn("text-xl font-bold", totalSpent <= totalLimit ? "text-positive" : "text-negative")}>
            {formatINR(Math.max(0, totalLimit - totalSpent), { compact: true })}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Alerts</div>
          <div className="text-xl font-bold">
            {exceeded > 0 && <span className="text-negative">{exceeded} exceeded</span>}
            {exceeded > 0 && warned > 0 && <span className="text-gray-500"> · </span>}
            {warned > 0 && <span className="text-warning">{warned} warning</span>}
            {exceeded === 0 && warned === 0 && <span className="text-positive">All clear</span>}
          </div>
        </div>
      </div>

      {/* Budget cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {budgets.map(b => (
          <Card key={b.id} className="relative group">
            <button
              onClick={() => deleteBudget(b.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-negative text-xs px-1"
            >
              ✕
            </button>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-white">{b.category}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {formatINR(b.spent)} spent of {formatINR(b.monthlyLimit)}
                </div>
              </div>
              <span className={STATUS_PILL[b.status]}>{b.status}</span>
            </div>

            <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-2">
              <div
                className={cn("h-full transition-all rounded-full", STATUS_BAR[b.status])}
                style={{ width: `${Math.min(100, b.usedPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{b.usedPercent.toFixed(0)}% used</span>
              <span className={b.remaining > 0 ? "text-gray-300" : "text-negative"}>
                {b.remaining > 0 ? `${formatINR(b.remaining)} left` : `${formatINR(Math.abs(b.remaining))} over`}
              </span>
            </div>
          </Card>
        ))}

        {budgets.length === 0 && (
          <div className="col-span-3 card p-12 text-center">
            <div className="text-4xl mb-3">◧</div>
            <div className="text-gray-300 font-medium mb-1">No budgets set</div>
            <div className="text-gray-500 text-sm mb-4">Set spending limits to track your expenses.</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">+ Create First Budget</button>
          </div>
        )}
      </div>

      {/* Spend table */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader title="Budget Summary Table" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                  <th className="text-left pb-2 pr-4 font-medium">Category</th>
                  <th className="text-right pb-2 pr-4 font-medium">Limit</th>
                  <th className="text-right pb-2 pr-4 font-medium">Spent</th>
                  <th className="text-right pb-2 pr-4 font-medium">Remaining</th>
                  <th className="text-right pb-2 pr-4 font-medium">Used %</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => (
                  <tr key={b.id} className="border-b border-bg-border/40">
                    <td className="py-2.5 pr-4 text-gray-200 font-medium">{b.category}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">{formatINR(b.monthlyLimit)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-200">{formatINR(b.spent)}</td>
                    <td className={cn("py-2.5 pr-4 text-right tabular-nums", b.remaining >= 0 ? "text-positive" : "text-negative")}>
                      {formatINR(Math.abs(b.remaining))}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-300">{b.usedPercent.toFixed(1)}%</td>
                    <td className="py-2.5">
                      <span className={STATUS_PILL[b.status]}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
