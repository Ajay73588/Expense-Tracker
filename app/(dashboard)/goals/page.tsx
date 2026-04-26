"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/cards/Card";
import { formatINR, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyRequired: number;
  status: string;
  progress: number;
  monthsRemaining: number;
  onTrack: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-brand-600/20 text-brand-300",
  COMPLETED: "bg-positive/20 text-positive",
  PAUSED: "bg-gray-600/20 text-gray-400",
};

const GOAL_ICONS = ["◎", "⌂", "✈", "🎓", "💼", "🚗", "💡", "🏥"];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "0",
    targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/goals");
    const json = await res.json();
    if (json.ok) setGoals(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveGoal() {
    if (!form.name || !form.targetAmount) return;
    setSaving(true);
    const method = editId ? "PATCH" : "POST";
    const url = editId ? `/api/goals?id=${editId}` : "/api/goals";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount),
        targetDate: new Date(form.targetDate).toISOString(),
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setEditId(null);
    setForm({ name: "", targetAmount: "", currentAmount: "0", targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
    load();
  }

  async function deleteGoal(id: string) {
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    load();
  }

  function openEdit(g: Goal) {
    setForm({
      name: g.name,
      targetAmount: String(g.targetAmount),
      currentAmount: String(g.currentAmount),
      targetDate: g.targetDate.slice(0, 10),
    });
    setEditId(g.id);
    setShowAdd(true);
  }

  const active = goals.filter(g => g.status === "ACTIVE");
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0);
  const onTrack = active.filter(g => g.onTrack).length;

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading goals…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          <p className="text-sm text-gray-500 mt-1">Financial milestones and progress tracking.</p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ name: "", targetAmount: "", currentAmount: "0", targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) }); setShowAdd(true); }} className="btn-primary">+ New Goal</button>
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{editId ? "Edit Goal" : "New Goal"}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Goal Name</label>
                <input className="input" placeholder="e.g. Retirement Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Target Amount (₹)</label>
                  <input className="input" type="number" placeholder="1000000" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Saved So Far (₹)</label>
                  <input className="input" type="number" placeholder="0" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Target Date</label>
                <input className="input" type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary flex-1" onClick={saveGoal} disabled={saving}>{saving ? "Saving…" : editId ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Active Goals</div>
          <div className="text-2xl font-bold text-white">{active.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Total Target</div>
          <div className="text-2xl font-bold text-white">{formatINR(totalTarget, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">Total Saved</div>
          <div className="text-2xl font-bold text-positive">{formatINR(totalSaved, { compact: true })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 mb-1">On Track</div>
          <div className="text-2xl font-bold text-white">{onTrack}/{active.length}</div>
        </div>
      </div>

      {/* Goal cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {goals.map((g, i) => {
          const daysLeft = Math.max(0, Math.round((new Date(g.targetDate).getTime() - Date.now()) / 86400000));
          return (
            <Card key={g.id} className="relative group">
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(g)} className="text-gray-500 hover:text-brand-400 text-xs px-1">✎</button>
                <button onClick={() => deleteGoal(g.id)} className="text-gray-500 hover:text-negative text-xs px-1">✕</button>
              </div>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-brand-600/15 flex items-center justify-center text-xl">
                  {GOAL_ICONS[i % GOAL_ICONS.length]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{g.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("pill text-[10px]", STATUS_COLORS[g.status])}>{g.status}</span>
                    {g.onTrack
                      ? <span className="text-[10px] text-positive">On track</span>
                      : <span className="text-[10px] text-warning">Behind</span>}
                  </div>
                </div>
              </div>

              {/* Progress ring */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="24" stroke="#1a1e25" strokeWidth="6" fill="none" />
                    <circle cx="30" cy="30" r="24"
                      stroke={g.progress >= 100 ? "#22c55e" : "#2b73ff"}
                      strokeWidth="6" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min(1, g.progress / 100))}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {g.progress.toFixed(0)}%
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Saved</span>
                    <span className="text-positive font-medium tabular-nums">{formatINR(g.currentAmount, { compact: true })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Target</span>
                    <span className="text-gray-200 font-medium tabular-nums">{formatINR(g.targetAmount, { compact: true })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Remaining</span>
                    <span className="text-gray-400 tabular-nums">{formatINR(g.targetAmount - g.currentAmount, { compact: true })}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-bg-border/50 pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-500">Deadline</div>
                  <div className="text-gray-200">{formatDate(g.targetDate)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Monthly needed</div>
                  <div className="text-brand-300 font-medium">{formatINR(g.monthlyRequired, { compact: true })}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500">{daysLeft > 0 ? `${daysLeft} days left` : "Overdue"}</div>
                </div>
              </div>
            </Card>
          );
        })}

        {goals.length === 0 && (
          <div className="col-span-3 card p-12 text-center">
            <div className="text-4xl mb-3">◎</div>
            <div className="text-gray-300 font-medium mb-1">No goals yet</div>
            <div className="text-gray-500 text-sm mb-4">Set financial goals to stay on track.</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">+ Create First Goal</button>
          </div>
        )}
      </div>
    </div>
  );
}
