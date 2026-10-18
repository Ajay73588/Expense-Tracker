"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/cards/Card";
import { CategorySplitChart, IncomeExpenseChart } from "@/components/charts/Charts";
import { formatINR, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  account: string | null;
  accountId?: string | null;
  transferGroupId?: string | null;
  tags: string[];
}

export interface Account {
  id: string;
  name: string;
  type: "BANK" | "BROKER" | "CREDIT_CARD" | "WALLET" | "OTHER";
  currency: string;
  isDefault: boolean;
  note?: string | null;
  closedAt?: string | null;
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Bank Account",
  BROKER: "Brokerage",
  CREDIT_CARD: "Credit Card",
  WALLET: "Digital Wallet",
  OTHER: "Other Account",
};

const ACCOUNT_TYPE_BADGES: Record<string, string> = {
  BANK: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  BROKER: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  CREDIT_CARD: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  WALLET: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  OTHER: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
};

const EXPENSE_CATEGORIES = ["Food", "Rent", "Transport", "Utilities", "Entertainment", "Shopping", "Healthcare", "SIP", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Business", "Dividend", "Interest", "Other"];

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<"transactions" | "accounts">("transactions");
  const [data, setData] = useState<TransactionData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  // Transaction Add/Edit Modal
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txForm, setTxForm] = useState({
    type: "EXPENSE",
    amount: "",
    category: "Food",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    accountId: "",
    account: "",
  });
  const [savingTx, setSavingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Account Add/Edit Modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    type: "BANK" as Account["type"],
    currency: "INR",
    isDefault: false,
    note: "",
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      const json = await res.json();
      if (json.ok && json.data?.accounts) {
        setAccounts(json.data.accounts);
      }
    } catch {
      // Ignore network errors on unmounted
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions");
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch {
      // Ignore network errors
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadTransactions(), loadAccounts()]);
    setLoading(false);
  }, [loadTransactions, loadAccounts]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = data?.list.filter((t) => filter === "ALL" || t.type === filter) ?? [];

  // ── Transaction Actions ─────────────────────────────────────────────────────

  function startAddTx() {
    setEditingTx(null);
    setTxError(null);
    const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
    setTxForm({
      type: "EXPENSE",
      amount: "",
      category: "Food",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      accountId: defaultAcc?.id || "",
      account: defaultAcc?.name || "",
    });
    setShowTxModal(true);
  }

  function startEditTx(t: Transaction) {
    setEditingTx(t);
    setTxError(null);
    setTxForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category,
      description: t.description ?? "",
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      accountId: t.accountId ?? "",
      account: t.account ?? "",
    });
    setShowTxModal(true);
  }

  async function saveTransaction() {
    if (!txForm.amount || isNaN(Number(txForm.amount)) || Number(txForm.amount) <= 0) {
      setTxError("Amount must be a positive number.");
      return;
    }
    setSavingTx(true);
    setTxError(null);

    const payload = {
      type: txForm.type,
      amount: Number(txForm.amount),
      category: txForm.category,
      description: txForm.description.trim() || null,
      date: new Date(txForm.date).toISOString(),
      accountId: txForm.accountId || null,
      account: txForm.account || null,
      tags: editingTx?.tags || [],
    };

    try {
      let res;
      if (editingTx) {
        res = await fetch(`/api/transactions?id=${editingTx.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setTxError(json?.error?.message || "Failed to save transaction.");
        setSavingTx(false);
        return;
      }

      setShowTxModal(false);
      setEditingTx(null);
      await loadTransactions();
    } catch {
      setTxError("Network error while saving transaction.");
    } finally {
      setSavingTx(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
    await loadTransactions();
  }

  // ── Transfer Actions ────────────────────────────────────────────────────────

  function startTransfer() {
    setTransferError(null);
    const source = accounts[0]?.id || "";
    const dest = accounts.find((a) => a.id !== source)?.id || "";
    setTransferForm({
      fromAccountId: source,
      toAccountId: dest,
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    });
    setShowTransferModal(true);
  }

  async function saveTransfer() {
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      setTransferError("Please select both source and destination accounts.");
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setTransferError("Source and destination accounts must be different.");
      return;
    }
    if (!transferForm.amount || isNaN(Number(transferForm.amount)) || Number(transferForm.amount) <= 0) {
      setTransferError("Transfer amount must be a positive number.");
      return;
    }

    setSavingTransfer(true);
    setTransferError(null);

    try {
      const res = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.toAccountId,
          amount: Number(transferForm.amount),
          date: new Date(transferForm.date).toISOString(),
          description: transferForm.description.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setTransferError(json?.error?.message || "Failed to execute transfer.");
        setSavingTransfer(false);
        return;
      }

      setShowTransferModal(false);
      await loadTransactions();
    } catch {
      setTransferError("Network error while creating transfer.");
    } finally {
      setSavingTransfer(false);
    }
  }

  // ── Account Actions ─────────────────────────────────────────────────────────

  function startAddAccount() {
    setEditingAccount(null);
    setAccountError(null);
    setAccountForm({
      name: "",
      type: "BANK",
      currency: "INR",
      isDefault: accounts.length === 0,
      note: "",
    });
    setShowAccountModal(true);
  }

  function startEditAccount(acc: Account) {
    setEditingAccount(acc);
    setAccountError(null);
    setAccountForm({
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      isDefault: acc.isDefault,
      note: acc.note || "",
    });
    setShowAccountModal(true);
  }

  async function saveAccount() {
    if (!accountForm.name.trim()) {
      setAccountError("Account name is required.");
      return;
    }

    setSavingAccount(true);
    setAccountError(null);

    const payload = {
      name: accountForm.name.trim(),
      type: accountForm.type,
      currency: accountForm.currency.toUpperCase(),
      isDefault: accountForm.isDefault,
      note: accountForm.note.trim() || null,
    };

    try {
      let res;
      if (editingAccount) {
        res = await fetch(`/api/accounts/${editingAccount.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAccountError(json?.error?.message || "Failed to save account.");
        setSavingAccount(false);
        return;
      }

      setShowAccountModal(false);
      setEditingAccount(null);
      await loadAccounts();
    } catch {
      setAccountError("Network error while saving account.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function closeAccount(id: string, name: string) {
    if (
      !confirm(
        `Safely close "${name}"?\n\nHistorical transactions and assets will be preserved, but this account will no longer appear for new transactions.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${id}/close`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json?.error?.message || "Failed to close account.");
        return;
      }
      await loadAccounts();
    } catch {
      alert("Network error while closing account.");
    }
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`Delete account "${name}"? Only accounts with zero transactions or assets can be deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(
          json?.error?.message ||
            "Cannot delete account with existing transactions or assets. Use 'Close Account' instead to preserve records."
        );
        return;
      }
      await loadAccounts();
    } catch {
      alert("Network error while deleting account.");
    }
  }

  if (loading) return <div className="text-gray-500 text-sm p-8">Loading ledger and accounts…</div>;

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ledger &amp; Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track transactions, double-entry transfers, and connected financial accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="bg-bg-card border border-bg-border rounded-lg p-1 flex">
            <button
              onClick={() => setActiveTab("transactions")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === "transactions"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}>
              💳 Transactions
            </button>
            <button
              onClick={() => setActiveTab("accounts")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === "accounts"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}>
              🏦 Accounts ({accounts.length})
            </button>
          </div>

          <button onClick={startTransfer} className="btn-secondary text-sm">
            ⇄ Transfer
          </button>
          {activeTab === "transactions" ? (
            <button onClick={startAddTx} className="btn-primary text-sm">
              + Add Transaction
            </button>
          ) : (
            <button onClick={startAddAccount} className="btn-primary text-sm">
              + Add Account
            </button>
          )}
        </div>
      </div>

      {/* ── TAB 1: TRANSACTIONS VIEW ────────────────────────────────────────── */}
      {activeTab === "transactions" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">This Month Income</div>
              <div className="text-xl font-bold text-positive">
                {formatINR(data?.currentMonth.income ?? 0, { compact: true })}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">This Month Expense</div>
              <div className="text-xl font-bold text-negative">
                {formatINR(data?.currentMonth.expense ?? 0, { compact: true })}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-gray-500 mb-1">Net Savings</div>
              <div
                className={cn(
                  "text-xl font-bold",
                  (data?.currentMonth.net ?? 0) >= 0 ? "text-positive" : "text-negative"
                )}>
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
                  {["ALL", "INCOME", "EXPENSE", "TRANSFER"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                        filter === f
                          ? "bg-brand-600/20 text-brand-300 border border-brand-600/40"
                          : "text-gray-500 hover:text-gray-300"
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
                    <th className="text-left pb-2 pr-4 font-medium">Account</th>
                    <th className="text-left pb-2 pr-4 font-medium">Type</th>
                    <th className="text-right pb-2 pr-4 font-medium">Amount</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-bg-border/40 hover:bg-bg-hover/30 transition-colors group">
                      <td className="py-2.5 pr-4 text-gray-400 tabular-nums text-xs whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-300 font-medium">{t.category}</td>
                      <td className="py-2.5 pr-4 text-gray-500 max-w-[200px] truncate">
                        {t.description ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                        {t.account ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-bg-hover border border-bg-border text-gray-300">
                            {t.account}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={TYPE_PILL[t.type] ?? "pill-neutral"}>{t.type}</span>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pr-4 text-right font-medium tabular-nums",
                          t.type === "INCOME"
                            ? "text-positive"
                            : t.type === "EXPENSE"
                            ? "text-negative"
                            : "text-gray-300"
                        )}>
                        {t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : ""}
                        {formatINR(t.amount)}
                      </td>
                      <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => startEditTx(t)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-all text-xs px-1"
                          title="Edit transaction"
                          aria-label="Edit transaction">
                          ✎
                        </button>
                        <button
                          onClick={() => deleteTransaction(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-negative transition-all text-xs px-1"
                          title="Delete transaction"
                          aria-label="Delete transaction">
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
      )}

      {/* ── TAB 2: ACCOUNTS MANAGEMENT VIEW ─────────────────────────────────── */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="card p-5 space-y-4 hover:border-bg-border/80 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-base">{acc.name}</h3>
                        {acc.isDefault && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type} • {acc.currency}
                      </p>
                    </div>
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", ACCOUNT_TYPE_BADGES[acc.type] || ACCOUNT_TYPE_BADGES.OTHER)}>
                      {acc.type}
                    </span>
                  </div>

                  {acc.note && (
                    <p className="text-xs text-gray-400 mt-3 bg-bg-hover/60 p-2 rounded-lg border border-bg-border/40">
                      {acc.note}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-bg-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-positive"></span>
                    <span>Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditAccount(acc)}
                      className="px-2.5 py-1 rounded bg-bg-hover text-gray-300 hover:text-white hover:bg-bg-border text-xs transition-colors">
                      Edit
                    </button>
                    <button
                      onClick={() => closeAccount(acc.id, acc.name)}
                      className="px-2.5 py-1 rounded bg-negative/10 text-negative hover:bg-negative/20 text-xs transition-colors"
                      title="Safely close account (preserves historical ledger data)">
                      Close
                    </button>
                    <button
                      onClick={() => deleteAccount(acc.id, acc.name)}
                      className="text-gray-500 hover:text-negative text-xs transition-colors px-1"
                      title="Delete (only if zero records linked)"
                      aria-label={`Delete account ${acc.name}`}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {accounts.length === 0 && (
            <div className="card p-12 text-center space-y-3">
              <div className="text-3xl">🏦</div>
              <h3 className="text-lg font-semibold text-white">No Accounts Connected</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Add your bank accounts, brokerage accounts, or digital wallets to organize transactions and unlock double-entry transfers.
              </p>
              <button onClick={startAddAccount} className="btn-primary text-sm mt-2">
                + Create First Account
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ADD / EDIT TRANSACTION ──────────────────────────────────── */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingTx ? "Edit Transaction" : "Add Transaction"}
              </h2>
              <button
                onClick={() => {
                  setShowTxModal(false);
                  setEditingTx(null);
                }}
                className="text-gray-500 hover:text-white text-xl">
                ×
              </button>
            </div>

            {txError && (
              <div className="p-3 rounded-lg bg-negative/10 border border-negative/20 text-negative text-xs">
                {txError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={txForm.type}
                  disabled={editingTx?.type === "TRANSFER"}
                  onChange={(e) =>
                    setTxForm((f) => ({
                      ...f,
                      type: e.target.value,
                      category: e.target.value === "INCOME" ? "Salary" : "Food",
                    }))
                  }>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="TRANSFER" disabled={!editingTx}>
                    Transfer
                  </option>
                </select>
              </div>

              <div>
                <label className="label">Amount (₹)</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={txForm.amount}
                  onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={txForm.category}
                  onChange={(e) => setTxForm((f) => ({ ...f, category: e.target.value }))}>
                  {(txForm.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={txForm.date}
                  onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>

              {/* Dynamic Account Selector */}
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Linked Account</label>
                  <button
                    type="button"
                    onClick={() => {
                      startAddAccount();
                    }}
                    className="text-[11px] text-brand-400 hover:text-brand-300">
                    + New Account
                  </button>
                </div>
                <select
                  className="input"
                  value={txForm.accountId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const acc = accounts.find((a) => a.id === selectedId);
                    setTxForm((f) => ({
                      ...f,
                      accountId: selectedId,
                      account: acc ? acc.name : "",
                    }));
                  }}>
                  <option value="">None / Unassigned</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}){acc.isDefault ? " ★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="label">Description (optional)</label>
                <input
                  className="input"
                  placeholder="Note or merchant…"
                  value={txForm.description}
                  onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setShowTxModal(false);
                  setEditingTx(null);
                }}>
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={saveTransaction} disabled={savingTx}>
                {savingTx ? "Saving…" : editingTx ? "Save Changes" : "Add Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TRANSFER FUNDS ──────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Transfer Funds</h2>
                <p className="text-xs text-gray-400">
                  Atomically record balanced debit and credit legs.
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-gray-500 hover:text-white text-xl">
                ×
              </button>
            </div>

            {transferError && (
              <div className="p-3 rounded-lg bg-negative/10 border border-negative/20 text-negative text-xs">
                {transferError}
              </div>
            )}

            {accounts.length < 2 ? (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning space-y-2">
                <p>You need at least two open accounts to create a transfer.</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    startAddAccount();
                  }}
                  className="btn-primary text-xs w-full">
                  + Create Another Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">From Account (Source / Debit)</label>
                  <select
                    className="input"
                    value={transferForm.fromAccountId}
                    onChange={(e) => setTransferForm((f) => ({ ...f, fromAccountId: e.target.value }))}>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">To Account (Destination / Credit)</label>
                  <select
                    className="input"
                    value={transferForm.toAccountId}
                    onChange={(e) => setTransferForm((f) => ({ ...f, toAccountId: e.target.value }))}>
                    {accounts.map((acc) => (
                      <option
                        key={acc.id}
                        value={acc.id}
                        disabled={acc.id === transferForm.fromAccountId}>
                        {acc.name} ({acc.type}) {acc.id === transferForm.fromAccountId ? "— (Source)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {transferForm.fromAccountId &&
                  transferForm.toAccountId &&
                  transferForm.fromAccountId === transferForm.toAccountId && (
                    <div className="text-xs text-negative">
                      Source and destination accounts must be different.
                    </div>
                  )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Amount (₹)</label>
                    <input
                      className="input"
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={transferForm.amount}
                      onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">Date</label>
                    <input
                      className="input"
                      type="date"
                      value={transferForm.date}
                      onChange={(e) => setTransferForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. Monthly savings, credit card payment…"
                    value={transferForm.description}
                    onChange={(e) => setTransferForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={saveTransfer}
                    disabled={
                      savingTransfer ||
                      !transferForm.amount ||
                      transferForm.fromAccountId === transferForm.toAccountId
                    }>
                    {savingTransfer ? "Transferring…" : "Execute Transfer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT ACCOUNT ───────────────────────────────────────── */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingAccount ? "Edit Account" : "Add New Account"}
              </h2>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  setEditingAccount(null);
                }}
                className="text-gray-500 hover:text-white text-xl">
                ×
              </button>
            </div>

            {accountError && (
              <div className="p-3 rounded-lg bg-negative/10 border border-negative/20 text-negative text-xs">
                {accountError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Account Name</label>
                <input
                  className="input"
                  placeholder="e.g. HDFC Salary, Zerodha Trading, Axis CC"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Account Type</label>
                  <select
                    className="input"
                    value={accountForm.type}
                    onChange={(e) =>
                      setAccountForm((f) => ({ ...f, type: e.target.value as Account["type"] }))
                    }>
                    <option value="BANK">Bank Account</option>
                    <option value="BROKER">Brokerage</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="WALLET">Digital Wallet</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="label">Currency</label>
                  <select
                    className="input"
                    value={accountForm.currency}
                    onChange={(e) => setAccountForm((f) => ({ ...f, currency: e.target.value }))}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes / Description (optional)</label>
                <input
                  className="input"
                  placeholder="Account number or usage details…"
                  value={accountForm.note}
                  onChange={(e) => setAccountForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={accountForm.isDefault}
                  onChange={(e) => setAccountForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded border-bg-border text-brand-600 focus:ring-brand-500 bg-bg-hover"
                />
                <label htmlFor="isDefault" className="text-xs text-gray-300 cursor-pointer">
                  Set as default account for transactions &amp; imports
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setShowAccountModal(false);
                    setEditingAccount(null);
                  }}>
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={saveAccount}
                  disabled={savingAccount || !accountForm.name.trim()}>
                  {savingAccount ? "Saving…" : editingAccount ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
