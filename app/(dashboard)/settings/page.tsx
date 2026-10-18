"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { usePrivacy } from "@/context/PrivacyContext";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { privacyMode, togglePrivacyMode } = usePrivacy();

  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data?.data?.currency) {
          setSelectedCurrency(data.data.currency);
        }
      })
      .catch(() => {});
  }, []);

  const handleCurrencyChange = async (curr: string) => {
    setSelectedCurrency(curr);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: curr }),
    }).catch(() => {});
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const res = await fetch("/api/export", {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to download data export.");
      }

      // Extract filename from header or use default
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `financeai-export-${new Date().toISOString().split("T")[0]}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportMessage({
        type: "success",
        text: `Data export successfully generated and downloaded (${filename}).`,
      });
    } catch (err: any) {
      setExportMessage({
        type: "error",
        text: err?.message || "An unexpected error occurred while exporting your data.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmationInput.trim().toUpperCase() !== "DELETE") {
      setDeleteError("You must type DELETE to confirm account deletion.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: "DELETE",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || "Failed to delete account.");
      }

      // Successfully purged in database; sign out of Clerk and redirect
      await signOut(() => {
        router.push("/sign-up");
      });
    } catch (err: any) {
      setDeleteError(err?.message || "An unexpected error occurred during account deletion.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings & Privacy</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage your account profile, GDPR/DPDP data portability exports, and account lifecycle.
        </p>
      </div>

      {/* Account Profile Card */}
      <section className="bg-bg-card border border-bg-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <span>👤</span> Account Profile
        </h2>
        {isLoaded && user ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-bg-base/60 border border-bg-border/60 rounded-lg p-3">
              <span className="text-gray-400 block text-xs">Full Name</span>
              <span className="text-gray-200 font-medium">{user.fullName || "User"}</span>
            </div>
            <div className="bg-bg-base/60 border border-bg-border/60 rounded-lg p-3">
              <span className="text-gray-400 block text-xs">Primary Email</span>
              <span className="text-gray-200 font-medium">{user.primaryEmailAddress?.emailAddress || "N/A"}</span>
            </div>
            <div className="bg-bg-base/60 border border-bg-border/60 rounded-lg p-3">
              <span className="text-gray-400 block text-xs">Authentication Provider</span>
              <span className="text-brand-400 font-medium">Clerk Auth</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 animate-pulse">Loading profile information...</div>
        )}
      </section>

      {/* Preferences & Privacy Controls */}
      <section className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <span>⚙️</span> Display Preferences & Privacy Mode
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Privacy Mode Switch */}
          <div className="bg-bg-base/60 border border-bg-border/60 rounded-lg p-4 flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                <span>{privacyMode ? "🔒" : "👁"}</span>
                <span>Privacy Mode</span>
              </span>
              <p className="text-xs text-gray-400 leading-relaxed">
                Mask monetary balances (`₹ ••••••`) across the dashboard and tables for discretion.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePrivacyMode}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                privacyMode ? "bg-amber-500" : "bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                  privacyMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Currency Preference */}
          <div className="bg-bg-base/60 border border-bg-border/60 rounded-lg p-4 flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-sm font-medium text-white">Base Currency</span>
              <p className="text-xs text-gray-400">
                Primary reporting currency for portfolio summaries and valuation rollups.
              </p>
            </div>
            <select
              value={selectedCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-bg-card border border-bg-border text-white text-xs font-medium focus:outline-none focus:border-brand-500"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Data Portability & Export (F-22) */}
      <section className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>📥</span> Data Portability & Export
            </h2>
            <p className="text-xs text-gray-400 mt-1 max-w-xl">
              Under GDPR and DPDP data rights, you can download a complete, unencrypted copy of all financial records,
              holdings, transactions, and planning calculations stored in FinanceAI.
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-sm transition-colors whitespace-nowrap shadow-sm"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Generating Export...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Download Data Export (JSON)</span>
              </>
            )}
          </button>
        </div>

        {exportMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              exportMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            <span>{exportMessage.type === "success" ? "✓" : "⚠"}</span>
            <span>{exportMessage.text}</span>
          </div>
        )}

        <div className="border-t border-bg-border/60 pt-4">
          <span className="text-xs font-medium text-gray-300 block mb-2">Export Scope & Contents:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-400">
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Bank & Demat Accounts
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Stock & MF Assets
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Transactions & Transfers
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Debts & Loan Schedules
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Budgets & Limits
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Financial Goals
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> Net Worth Snapshots
            </div>
            <div className="flex items-center gap-1.5 bg-bg-base/40 p-2 rounded border border-bg-border/40">
              <span className="text-brand-400">✓</span> AI Advisor History
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone: Account Deletion (F-22) */}
      <section className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-red-400 flex items-center gap-2">
            <span>⚠</span> Danger Zone: Account Deletion
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            Permanently delete your account and all associated financial records. This action immediately and
            irreversibly purges your assets, accounts, transactions, debts, goals, and history from our database.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              setConfirmationInput("");
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-bg-card border border-red-500/30 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xl">
                ⚠
              </div>
              <h3 className="text-lg font-bold text-white">Permanently Delete Account?</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                This operation is <span className="text-red-400 font-semibold">irreversible</span>. All your personal
                financial assets, portfolios, bank accounts, transactions, liabilities, snapshots, and AI conversations
                will be permanently purged.
              </p>
            </div>

            <div className="bg-bg-base/80 p-3 rounded-lg border border-bg-border/60 text-xs text-gray-400 space-y-2">
              <span className="block font-medium text-gray-300">
                To confirm deletion, type <span className="text-red-400 font-bold select-all">DELETE</span> below:
              </span>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => {
                  setConfirmationInput(e.target.value);
                  setDeleteError(null);
                }}
                placeholder="DELETE"
                disabled={isDeleting}
                className="w-full px-3 py-2 rounded bg-bg-card border border-bg-border text-white text-sm focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            {deleteError && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-bg-hover hover:bg-bg-border text-gray-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmationInput.trim().toUpperCase() !== "DELETE" || isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Purging Account...</span>
                  </>
                ) : (
                  <span>Permanently Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
