"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/cards/Card";
import { CategorySplitChart, IncomeExpenseChart } from "@/components/charts/Charts";
import { formatINR, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  account: string | null;
  tags: string[];
}

interface TransactionData {
  list: Transaction[];
  summary: { month: string; income: number; expense: number; net: number }[];
  currentMonth: { income: number; expense: number; net: number };
  split: { category: string; amount: number; percent: number }[];
}

const TYPE_PILL: Record<string, string> = {
  INCOME: "pill-positive",
  EXPENSE: "pill-negative",
  TRANSFER: "pill-neutral",
};

const EXPENSE_CATEGORIES = ["Food", "Rent", "Transport", "Utilities", "Entertainment", "Shopping", "Healthcare", "SIP", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Dividend", "Interest", "Other"];

export default function TransactionsPage() {
  const [data, setData] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    type: "EXPENSE",
    amount: "",
    category: "Food",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    account: "HDFC Bank",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/transactions");
    const json = await res.json();
    if (json.ok) setData(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data?.list.filter((t) => filter === "ALL" || t.type === filter) ?? [];

  async function addTransaction() {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setSaving(true);
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        date: new Date(form.date).toISOString(),
        tags: [],
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ type: "EXPENSE", amount: "", category: "Food", description: "", date: new Date().toISOString().slice(0, 10), account: "HDFC Bank" });
    load();
  }

  async function deleteTransaction(id: string) {
    await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading transactions…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Income, expenses, and monthly cash flow.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Transaction</button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category: e.target.value === "INCOME" ? "Salary" : "Food" }))}>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Amount (₹)</label>
                <input className="input" type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {(form.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Description (optional)</label>
                <input className="input" placeholder="Note…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Account</label>
                <input className="input" placeholder="HDFC Bank" value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={addTransaction} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">This Month Income</div>
          <div className="text-xl font-bold text-positive">{formatINR(data?.currentMonth.income ?? 0, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">This Month Expense</div>
          <div className="text-xl font-bold text-negative">{formatINR(data?.currentMonth.expense ?? 0, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Net Savings</div>
          <div className={cn("text-xl font-bold", (data?.currentMonth.net ?? 0) >= 0 ? "text-positive" : "text-negative")}>
            {formatINR(data?.currentMonth.net ?? 0, { compact: true })}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Monthly Cash Flow" subtitle="Last 6 months" />
          <IncomeExpenseChart data={data?.summary ?? []} />
        </Card>
        <Card>
          <CardHeader title="Spending by Category" subtitle="This month" />
          <CategorySplitChart data={data?.split ?? []} />
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader
          title="All Transactions"
          subtitle={`${filtered.length} records`}
          action={
            <div className="flex gap-1">
              {["ALL", "INCOME", "EXPENSE", "TRANSFER"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    filter === f ? "bg-brand-600/20 text-brand-300 border border-brand-600/40" : "text-gray-500 hover:text-gray-300"
                  )}>
                  {f}
                </button>
              ))}
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                <th className="text-left pb-2 pr-4 font-medium">Date</th>
                <th className="text-left pb-2 pr-4 font-medium">Category</th>
                <th className="text-left pb-2 pr-4 font-medium">Description</th>
                <th className="text-left pb-2 pr-4 font-medium">Type</th>
                <th className="text-right pb-2 pr-4 font-medium">Amount</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-bg-border/40 hover:bg-bg-hover/30 transition-colors group">
                  <td className="py-2.5 pr-4 text-gray-400 tabular-nums text-xs whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="py-2.5 pr-4 text-gray-300">{t.category}</td>
                  <td className="py-2.5 pr-4 text-gray-500 max-w-[200px] truncate">{t.description ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <span className={TYPE_PILL[t.type] ?? "pill-neutral"}>{t.type}</span>
                  </td>
                  <td className={cn("py-2.5 pr-4 text-right font-medium tabular-nums",
                    t.type === "INCOME" ? "text-positive" : t.type === "EXPENSE" ? "text-negative" : "text-gray-300")}>
                    {t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : ""}{formatINR(t.amount)}
                  </td>
                  <td className="py-2.5">
                    <button onClick={() => deleteTransaction(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-negative transition-all text-xs">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">No transactions found.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
