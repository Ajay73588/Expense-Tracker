"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format";

// ── Types ───────────────────────────────────────────────────────────────────

type MainTab = "assets" | "transactions" | "history";
type AssetSubTab = "broker" | "cas";
type TxSubTab = "bank" | "standard";

type Broker = "GROWW" | "INDMONEY";
type AssetClass = "IN_STOCK" | "US_STOCK" | "MUTUAL_FUND";

interface MatrixEntry {
  broker: Broker;
  assetClass: AssetClass;
  supported: boolean;
  expectedColumns: string[];
  reason: string | null;
}
interface Issue {
  row: number | null;
  field?: string;
  message: string;
  severity: "error" | "warning";
}
interface Holding {
  name: string;
  symbol: string | null;
  isin: string | null;
  folio: string | null;
  quantity: number;
  averagePrice: number;
  investedValue: number;
  currency: string;
  statementPrice: number | null;
}
interface RemovedHolding {
  id: string;
  name: string;
  folio: string | null;
  quantity: number;
  symbol: string | null;
  isin: string | null;
  account: string | null;
}
interface BrokerPreview {
  summary: { totalRows: number; validRows: number; invalidRows: number; warnings: number };
  holdings: Holding[];
  issues: Issue[];
  plan: { toAdd: number; toUpdate: number; toRemove: number };
  holdingsToRemove?: RemovedHolding[];
  removalNote: string | null;
  hint: string | null;
  canImport: boolean;
  fileName: string;
}
interface BrokerReport {
  added: number;
  updated: number;
  removed: number;
  skippedInvalidRows: number;
  warnings: Issue[];
  priceEnrichment: {
    updated: number;
    failed: { name: string; reason: string; message: string }[];
    unsupported: number;
    timedOut: boolean;
  };
  fx: { rate: number; asOf: string; source: string; stale: boolean } | { error: string } | null;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
}

interface StandardTxRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  category: string;
  isDuplicate?: boolean;
  validationError?: string | null;
}
interface StandardPreview {
  fileName: string;
  fileKind: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columnMapping: Record<string, string>;
  detectedHeaders: string[];
  rows: StandardTxRow[];
  canImport: boolean;
}

interface BankTxRow {
  rowNumber: number;
  date: string;
  narration: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  balance?: number | null;
  balanceWarning?: string | null;
  suggestedCategory: string;
  isTransferCandidate: boolean;
  isDuplicate: boolean;
  validationError?: string | null;
}
interface BankPreview {
  fileName: string;
  detection: {
    detectedBank: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    format: string;
    accountMasked?: string;
    evidence: string[];
    extractor?: "DETERMINISTIC_ADAPTER" | "AI_NVIDIA_NIM_UNIVERSAL" | "AI_GEMINI_UNIVERSAL";
    isEncrypted?: boolean;
    requiresPassword?: boolean;
  };
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  rows: BankTxRow[];
  warnings: string[];
  canImport: boolean;
  extractor: "DETERMINISTIC_ADAPTER" | "AI_NVIDIA_NIM_UNIVERSAL" | "AI_GEMINI_UNIVERSAL";
}

interface CasPreview {
  fileName: string;
  result: {
    provider: string;
    isEncrypted: boolean;
    status: string;
  };
  holdings: Holding[];
  overlappingHoldings: { name: string; folio: string | null; isin: string | null; existingSource: string | null }[];
  summary: { totalParsed: number; validHoldings: number; overlaps: number };
  notes: string[];
  canImport: boolean;
}

interface HistoryItem {
  id: string;
  importDate: string;
  source: string;
  fileType: string;
  fileName: string;
  accountName: string | null;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  finalStatus: "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED" | "ROLLED_BACK";
  canRollback: boolean;
}

const BROKERS: { id: Broker; label: string; help: string }[] = [
  { id: "GROWW", label: "Groww", help: "Stocks: Reports › Stocks holdings statement (.xlsx). Mutual funds: Reports › Holdings statement (.xlsx)." },
  { id: "INDMONEY", label: "INDmoney", help: "US stocks: Holdings report (.xls). Mutual funds: Holdings report (.xlsx)." },
];
const CLASSES: { id: AssetClass; label: string }[] = [
  { id: "IN_STOCK", label: "Indian Stocks" },
  { id: "US_STOCK", label: "US Stocks" },
  { id: "MUTUAL_FUND", label: "Mutual Funds" },
];

export default function ImportPage() {
  const [mainTab, setMainTab] = useState<MainTab>("assets");
  const [assetSubTab, setAssetSubTab] = useState<AssetSubTab>("broker");
  const [txSubTab, setTxSubTab] = useState<TxSubTab>("bank");

  // Shared state
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userAccounts, setUserAccounts] = useState<AccountOption[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Broker Import state
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [broker, setBroker] = useState<Broker | null>(null);
  const [assetClass, setAssetClass] = useState<AssetClass | null>(null);
  const [brokerFile, setBrokerFile] = useState<File | null>(null);
  const [brokerPreview, setBrokerPreview] = useState<BrokerPreview | null>(null);
  const [brokerReport, setBrokerReport] = useState<BrokerReport | null>(null);
  const [replaceMissing, setReplaceMissing] = useState(false);
  const [showBrokerIssues, setShowBrokerIssues] = useState(false);

  // Bank Import state
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankPassword, setBankPassword] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [bankPreview, setBankPreview] = useState<BankPreview | null>(null);
  const [bankCommitDone, setBankCommitDone] = useState(false);

  // Standard Import state
  const [standardFile, setStandardFile] = useState<File | null>(null);
  const [standardAccountId, setStandardAccountId] = useState<string>("");
  const [standardPreview, setStandardPreview] = useState<StandardPreview | null>(null);
  const [standardCommitDone, setStandardCommitDone] = useState(false);

  // CAS Import state
  const [casFile, setCasFile] = useState<File | null>(null);
  const [casPassword, setCasPassword] = useState("");
  const [casPreview, setCasPreview] = useState<CasPreview | null>(null);
  const [casCommitDone, setCasCommitDone] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // Load initial options and user accounts
  useEffect(() => {
    fetch("/api/import")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setMatrix(j.data.matrix);
      })
      .catch(() => {});

    fetch("/api/accounts")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.data?.accounts) {
          setUserAccounts(j.data.accounts);
          const def = j.data.accounts.find((a: AccountOption) => a.isDefault) || j.data.accounts[0];
          if (def) {
            setBankAccountId(def.id);
            setStandardAccountId(def.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loadHistory = useCallback(() => {
    fetch("/api/import/history")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setHistoryList(j.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mainTab === "history") loadHistory();
  }, [mainTab, loadHistory]);

  const entry = useMemo(
    () => matrix.find((m) => m.broker === broker && m.assetClass === assetClass) ?? null,
    [matrix, broker, assetClass]
  );

  // ── Broker flow handlers ──────────────────────────────────────────────────

  const sendBroker = useCallback(
    async (f: File, confirm: boolean, replace: boolean = replaceMissing) => {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("broker", broker as string);
      fd.set("assetClass", assetClass as string);
      fd.set("confirm", String(confirm));
      fd.set("replaceMissing", String(replace));
      const res = await fetch("/api/import", { method: "POST", body: fd });
      return res.json();
    },
    [broker, assetClass, replaceMissing]
  );

  const onBrokerFile = useCallback(
    async (f: File) => {
      setError(null);
      if (!broker || !assetClass || !entry?.supported) {
        setError("Choose a supported broker and asset type first.");
        return;
      }
      setBusy(true);
      try {
        const j = await sendBroker(f, false, replaceMissing);
        if (!j.ok) {
          setError(j.error?.message ?? "Could not read broker file.");
          return;
        }
        setBrokerFile(f);
        setBrokerPreview(j.data);
        setShowBrokerIssues(j.data.summary.invalidRows > 0 || !j.data.canImport);
      } catch {
        setError("Upload failed. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [broker, assetClass, entry, sendBroker, replaceMissing]
  );

  async function confirmBroker() {
    if (!brokerFile) return;
    setBusy(true);
    setError(null);
    try {
      const j = await sendBroker(brokerFile, true, replaceMissing);
      if (!j.ok) {
        setError(j.error?.message ?? "Broker import failed.");
        return;
      }
      setBrokerReport(j.data);
      setSuccessMessage(`Successfully imported ${j.data.added + j.data.updated} holdings from ${broker}.`);
    } catch {
      setError("Import failed. Nothing was saved; please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Bank statement flow handlers ──────────────────────────────────────────

  const onBankFile = useCallback(
    async (f: File, pwdOverride?: string) => {
      setError(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("sourceType", "BANK");
        fd.set("confirm", "false");
        const activePwd = pwdOverride ?? bankPassword;
        if (activePwd) fd.set("password", activePwd);
        if (bankAccountId) fd.set("accountId", bankAccountId);

        const res = await fetch("/api/import/transactions", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) {
          setError(j.error?.message ?? "Could not parse bank statement.");
          return;
        }
        setBankFile(f);
        setBankPreview(j.data);
        if (j.data.suggestedAccountId) {
          setBankAccountId(j.data.suggestedAccountId);
        }
      } catch {
        setError("Failed to upload bank statement.");
      } finally {
        setBusy(false);
      }
    },
    [bankAccountId, bankPassword]
  );

  async function confirmBank() {
    if (!bankFile || !bankAccountId) {
      setError("Please select a destination account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", bankFile);
      fd.set("sourceType", "BANK");
      fd.set("confirm", "true");
      fd.set("accountId", bankAccountId);
      if (bankPassword) fd.set("password", bankPassword);
      fd.set("skipDuplicates", String(skipDuplicates));

      const res = await fetch("/api/import/transactions", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Bank statement import failed.");
        return;
      }
      setBankCommitDone(true);
      setSuccessMessage(`Imported ${j.data.importedCount} transactions into selected account.`);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Standard transaction flow handlers ───────────────────────────────────

  const onStandardFile = useCallback(
    async (f: File) => {
      setError(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("sourceType", "STANDARD");
        fd.set("confirm", "false");
        if (standardAccountId) fd.set("accountId", standardAccountId);

        const res = await fetch("/api/import/transactions", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) {
          setError(j.error?.message ?? "Could not parse standard transaction file.");
          return;
        }
        setStandardFile(f);
        setStandardPreview(j.data);
      } catch {
        setError("Failed to upload file.");
      } finally {
        setBusy(false);
      }
    },
    [standardAccountId]
  );

  async function confirmStandard() {
    if (!standardFile) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", standardFile);
      fd.set("sourceType", "STANDARD");
      fd.set("confirm", "true");
      if (standardAccountId) fd.set("accountId", standardAccountId);
      fd.set("skipDuplicates", String(skipDuplicates));

      const res = await fetch("/api/import/transactions", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Standard transaction import failed.");
        return;
      }
      setStandardCommitDone(true);
      setSuccessMessage(`Imported ${j.data.importedCount} transactions successfully.`);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── CAS PDF flow handlers ─────────────────────────────────────────────────

  const onCasFile = useCallback(
    async (f: File, pass = casPassword) => {
      setError(null);
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("confirm", "false");
        if (pass) fd.set("password", pass);

        const res = await fetch("/api/import/cas", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) {
          setError(j.error?.message ?? "Could not read CAS PDF.");
          return;
        }
        setCasFile(f);
        setCasPreview(j.data);
      } catch {
        setError("Failed to process CAS PDF.");
      } finally {
        setBusy(false);
      }
    },
    [casPassword]
  );

  async function confirmCas() {
    if (!casFile) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", casFile);
      fd.set("confirm", "true");
      if (casPassword) fd.set("password", casPassword);

      const res = await fetch("/api/import/cas", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "CAS import failed.");
        return;
      }
      setCasCommitDone(true);
      setSuccessMessage(`Imported ${j.data.added + j.data.updated} mutual fund positions from CAS.`);
    } catch {
      setError("CAS import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Rollback handler ──────────────────────────────────────────────────────

  async function handleRollback(id: string) {
    if (!confirm("Are you sure you want to roll back this import? Records created by this batch will be safely removed.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error?.message ?? "Rollback failed.");
        return;
      }
      setSuccessMessage(`Import rolled back (${j.data.rolledBackCount} records removed).`);
      loadHistory();
    } catch {
      setError("Rollback failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Import Center</h1>
        <p className="text-sm text-gray-400 mt-1">
          Unified, privacy-first ingestion for bank statements, standard ledgers, broker exports, and CAS mutual funds.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-bg-border gap-2">
        <button
          onClick={() => { setMainTab("assets"); setError(null); }}
          className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            mainTab === "assets" ? "border-brand-500 text-brand-300 font-semibold" : "border-transparent text-gray-400 hover:text-gray-200")}
        >
          Assets &amp; Portfolio
        </button>
        <button
          onClick={() => { setMainTab("transactions"); setError(null); }}
          className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            mainTab === "transactions" ? "border-brand-500 text-brand-300 font-semibold" : "border-transparent text-gray-400 hover:text-gray-200")}
        >
          Income &amp; Expenses
        </button>
        <button
          onClick={() => { setMainTab("history"); setError(null); }}
          className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
            mainTab === "history" ? "border-brand-500 text-brand-300 font-semibold" : "border-transparent text-gray-400 hover:text-gray-200")}
        >
          Import History
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-sm text-negative flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-negative hover:underline">Dismiss</button>
        </div>
      )}
      {successMessage && (
        <div className="bg-positive/10 border border-positive/30 rounded-lg p-3 text-sm text-positive flex justify-between items-center">
          <span>✓ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-positive hover:underline">Dismiss</button>
        </div>
      )}

      {/* =======================================================================
          TAB 1: ASSETS & PORTFOLIO
      ======================================================================== */}
      {mainTab === "assets" && (
        <div className="space-y-5">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => { setAssetSubTab("broker"); setError(null); }}
              className={cn("px-4 py-1.5 rounded-lg border", assetSubTab === "broker" ? "bg-brand-600/20 border-brand-500 text-white font-medium" : "border-bg-border text-gray-400")}
            >
              Broker Import (Groww &amp; INDmoney)
            </button>
            <button
              onClick={() => { setAssetSubTab("cas"); setError(null); }}
              className={cn("px-4 py-1.5 rounded-lg border", assetSubTab === "cas" ? "bg-brand-600/20 border-brand-500 text-white font-medium" : "border-bg-border text-gray-400")}
            >
              CAS PDF (CAMS &amp; KFintech)
            </button>
          </div>

          {/* Broker Import Subtab */}
          {assetSubTab === "broker" && (
            <div className="space-y-5">
              {!brokerPreview && !brokerReport && (
                <>
                  <div className="card p-4 space-y-3">
                    <div className="text-sm font-medium text-gray-300">1. Select Broker</div>
                    <div className="flex gap-2 flex-wrap">
                      {BROKERS.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setBroker(b.id)}
                          className={cn("px-4 py-2 rounded-lg border text-sm", broker === b.id ? "border-brand-500 bg-brand-600/10 text-white" : "border-bg-border text-gray-400 hover:text-gray-200")}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                    {broker && <div className="text-xs text-gray-500">How to export: {BROKERS.find((b) => b.id === broker)?.help}</div>}
                  </div>

                  <div className="card p-4 space-y-3">
                    <div className="text-sm font-medium text-gray-300">2. Asset type</div>
                    <div className="flex gap-2 flex-wrap">
                      {CLASSES.map((c) => {
                        const m = matrix.find((x) => x.broker === broker && x.assetClass === c.id);
                        const disabled = !broker || (m ? !m.supported : false);
                        return (
                          <button
                            key={c.id}
                            disabled={disabled}
                            onClick={() => setAssetClass(c.id)}
                            title={m?.reason ?? undefined}
                            className={cn("px-4 py-2 rounded-lg border text-sm", assetClass === c.id ? "border-brand-500 bg-brand-600/10 text-white" : "border-bg-border text-gray-400 hover:text-gray-200", disabled && "opacity-40 cursor-not-allowed")}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {entry && !entry.supported && <div className="text-xs text-amber-400">{entry.reason}</div>}
                    {entry?.supported && <div className="text-xs text-gray-500">Expected columns: {entry.expectedColumns.join(", ")}</div>}
                  </div>

                  <div className="card p-4 space-y-3">
                    <div className="text-sm font-medium text-gray-300">3. Upload file</div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onBrokerFile(f); }}
                      onClick={() => entry?.supported && document.getElementById("broker-import-file")?.click()}
                      className={cn("border-2 border-dashed rounded-xl p-8 text-center transition-colors", entry?.supported ? "cursor-pointer" : "opacity-40 cursor-not-allowed", dragging ? "border-brand-500 bg-brand-600/10" : "border-bg-border")}
                    >
                      <div className="text-gray-300 font-medium mb-1">{busy ? "Reading file…" : "Drop file here or click to browse"}</div>
                      <div className="text-sm text-gray-500">.csv, .xls or .xlsx · max 5 MB · in-memory processing only</div>
                      <input
                        id="broker-import-file"
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onBrokerFile(f); e.target.value = ""; }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Broker Preview */}
              {brokerPreview && !brokerReport && (
                <div className="space-y-4">
                  <div className="card p-4 space-y-3">
                    <div className="text-sm text-gray-300">
                      IMPORT PREVIEW · <span className="text-brand-300">{BROKERS.find((b) => b.id === broker)?.label}</span> · {CLASSES.find((c) => c.id === assetClass)?.label}
                      <span className="text-gray-500"> · {brokerPreview.fileName}</span>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div><span className="text-positive font-semibold">{brokerPreview.summary.validRows}</span> valid rows</div>
                      <div><span className={brokerPreview.summary.invalidRows ? "text-negative font-semibold" : "text-gray-400"}>{brokerPreview.summary.invalidRows}</span> invalid rows</div>
                      <div><span className={brokerPreview.summary.warnings ? "text-amber-400 font-semibold" : "text-gray-400"}>{brokerPreview.summary.warnings}</span> warnings</div>
                    </div>
                    {brokerPreview.hint && <div className="text-sm text-amber-400">{brokerPreview.hint}</div>}
                    {brokerPreview.canImport && (
                      <div className="text-xs text-gray-400">
                        On import: {brokerPreview.plan.toAdd} new · {brokerPreview.plan.toUpdate} updated{replaceMissing ? ` · ${brokerPreview.plan.toRemove} removed` : ""}
                      </div>
                    )}
                  </div>

                  {brokerPreview.holdings.length > 0 && (
                    <div className="card overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                            <th className="text-left p-3 font-medium">Name</th>
                            <th className="text-left p-3 font-medium">Symbol / ISIN</th>
                            <th className="text-right p-3 font-medium">Qty</th>
                            <th className="text-right p-3 font-medium">Avg price</th>
                            <th className="text-right p-3 font-medium">Invested</th>
                            <th className="text-left p-3 font-medium">Ccy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {brokerPreview.holdings.map((h, i) => (
                            <tr key={i} className="border-b border-bg-border/40">
                              <td className="p-3 text-gray-200">{h.name}</td>
                              <td className="p-3 text-gray-400 font-mono text-xs">{h.symbol ?? h.isin ?? "—"}</td>
                              <td className="p-3 text-right tabular-nums text-gray-300">{h.quantity.toLocaleString("en-IN", { maximumFractionDigits: 8 })}</td>
                              <td className="p-3 text-right tabular-nums text-gray-300">{formatCurrency(h.averagePrice, h.currency, 4)}</td>
                              <td className="p-3 text-right tabular-nums text-gray-300">{formatCurrency(h.investedValue, h.currency)}</td>
                              <td className="p-3 text-gray-400">{h.currency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => { setBrokerPreview(null); setBrokerFile(null); }}>Cancel</button>
                    <button className="btn-primary flex-1" onClick={confirmBroker} disabled={busy || !brokerPreview.canImport}>
                      {busy ? "Importing…" : `Confirm Import (${brokerPreview.summary.validRows})`}
                    </button>
                  </div>
                </div>
              )}

              {/* Broker Report Done */}
              {brokerReport && (
                <div className="card p-6 space-y-4 text-center">
                  <div className="text-4xl text-positive">✓</div>
                  <h2 className="text-xl font-bold text-white">{brokerReport.added + brokerReport.updated} holdings imported</h2>
                  <p className="text-sm text-gray-400">{brokerReport.added} added · {brokerReport.updated} updated · {brokerReport.removed} removed</p>
                  <div className="flex gap-3 justify-center pt-3">
                    <button onClick={() => { setBrokerPreview(null); setBrokerReport(null); setBrokerFile(null); }} className="btn-secondary">Import another</button>
                    <Link href="/portfolio" className="btn-primary">View Portfolio →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAS PDF Subtab */}
          {assetSubTab === "cas" && (
            <div className="space-y-5">
              {!casPreview && !casCommitDone && (
                <div className="card p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Consolidated Account Statement (CAS) PDF</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Extracts mutual fund folios, units, and NAVs from CAMS and KFintech CAS statements.
                    </p>
                  </div>

                  <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3 text-xs text-brand-300 space-y-1">
                    <div className="font-medium">🔒 Zero-Retention Ephemeral Privacy Guarantee</div>
                    <div>
                      CAS PDFs are decrypted strictly in volatile RAM and never saved to disk. Passwords are never stored, logged, or shared with external AI.
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Statement Password (if encrypted)</label>
                    <input
                      type="password"
                      placeholder="e.g. UPPERCASE PAN or PAN + DOB (DDMMYYYY)"
                      value={casPassword}
                      onChange={(e) => setCasPassword(e.target.value)}
                      className="input w-full max-w-md text-sm"
                    />
                    <span className="text-[11px] text-gray-500 block mt-1">Leave blank if your CAS is unencrypted.</span>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onCasFile(f); }}
                    onClick={() => document.getElementById("cas-file-input")?.click()}
                    className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors", dragging ? "border-brand-500 bg-brand-600/10" : "border-bg-border")}
                  >
                    <div className="text-gray-300 font-medium mb-1">{busy ? "Decrypting and parsing CAS…" : "Drop CAS PDF here or click to browse"}</div>
                    <div className="text-xs text-gray-500">.pdf format · max 10 MB</div>
                    <input
                      id="cas-file-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onCasFile(f); e.target.value = ""; }}
                    />
                  </div>
                </div>
              )}

              {casPreview && !casCommitDone && (
                <div className="space-y-4">
                  <div className="card p-4 space-y-2">
                    <div className="text-sm font-semibold text-white">CAS Preview: {casPreview.result.provider} Statement</div>
                    <div className="text-xs text-gray-400">
                      Found {casPreview.summary.validHoldings} mutual fund holding(s). Status: <span className="font-mono text-brand-300">{casPreview.result.status}</span>
                    </div>
                    {casPreview.notes.map((note, idx) => (
                      <div key={idx} className="text-xs text-amber-400">ℹ {note}</div>
                    ))}
                  </div>

                  {casPreview.holdings.length > 0 && (
                    <div className="card overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                            <th className="text-left p-3">Scheme Name</th>
                            <th className="text-left p-3">Folio</th>
                            <th className="text-left p-3">ISIN</th>
                            <th className="text-right p-3">Units</th>
                            <th className="text-right p-3">NAV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {casPreview.holdings.map((h, i) => (
                            <tr key={i} className="border-b border-bg-border/30">
                              <td className="p-3 text-gray-200">{h.name}</td>
                              <td className="p-3 text-gray-400 font-mono text-xs">{h.folio || "—"}</td>
                              <td className="p-3 text-gray-400 font-mono text-xs">{h.isin || "—"}</td>
                              <td className="p-3 text-right tabular-nums text-gray-300">{h.quantity}</td>
                              <td className="p-3 text-right tabular-nums text-gray-300">{h.averagePrice ? formatCurrency(h.averagePrice, "INR") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => { setCasPreview(null); setCasFile(null); }}>Cancel</button>
                    <button className="btn-primary flex-1" onClick={confirmCas} disabled={busy || !casPreview.canImport}>
                      {busy ? "Importing…" : `Confirm CAS Import (${casPreview.summary.validHoldings})`}
                    </button>
                  </div>
                </div>
              )}

              {casCommitDone && (
                <div className="card p-6 space-y-4 text-center">
                  <div className="text-4xl text-positive">✓</div>
                  <h2 className="text-xl font-bold text-white">CAS Mutual Funds Imported</h2>
                  <p className="text-sm text-gray-400">Your holdings have been reconciled with your portfolio.</p>
                  <div className="flex gap-3 justify-center pt-3">
                    <button onClick={() => { setCasPreview(null); setCasCommitDone(false); setCasFile(null); }} className="btn-secondary">Import another</button>
                    <Link href="/portfolio" className="btn-primary">View Portfolio →</Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 2: INCOME & EXPENSES
      ======================================================================== */}
      {mainTab === "transactions" && (
        <div className="space-y-5">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => { setTxSubTab("bank"); setError(null); }}
              className={cn("px-4 py-1.5 rounded-lg border", txSubTab === "bank" ? "bg-brand-600/20 border-brand-500 text-white font-medium" : "border-bg-border text-gray-400")}
            >
              Import from Bank Statement
            </button>
            <button
              onClick={() => { setTxSubTab("standard"); setError(null); }}
              className={cn("px-4 py-1.5 rounded-lg border", txSubTab === "standard" ? "bg-brand-600/20 border-brand-500 text-white font-medium" : "border-bg-border text-gray-400")}
            >
              Standard Import (CSV / Excel)
            </button>
          </div>

          {/* Bank Statement Subtab */}
          {txSubTab === "bank" && (
            <div className="space-y-5">
              {!bankPreview && !bankCommitDone && (
                <div className="card p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Bank Statement Import (PDF, CSV, TXT, XLSX)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload bank statements from <span className="text-brand-300 font-semibold">HDFC, ICICI, SBI, Axis, Kotak</span>, or any unfamiliar bank. Uses deterministic local parsing for verified formats and <span className="text-brand-300 font-semibold">Gemini AI</span> for universal PDF extraction.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Destination Account</label>
                      <select
                        value={bankAccountId}
                        onChange={(e) => setBankAccountId(e.target.value)}
                        className="input w-full text-sm"
                      >
                        {userAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.type}) {a.isDefault ? "★ Default" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Statement Password <span className="text-gray-500 font-normal">(optional, for encrypted PDFs)</span>
                      </label>
                      <input
                        type="password"
                        value={bankPassword}
                        onChange={(e) => setBankPassword(e.target.value)}
                        placeholder="e.g. DOB (DDMMYYYY) or PAN"
                        className="input w-full text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onBankFile(f); }}
                    onClick={() => document.getElementById("bank-file-input")?.click()}
                    className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors", dragging ? "border-brand-500 bg-brand-600/10" : "border-bg-border")}
                  >
                    <div className="text-gray-300 font-medium mb-1">{busy ? "Analyzing & extracting statement…" : "Drop bank statement here or click to browse"}</div>
                    <div className="text-xs text-gray-500">.pdf, .csv, .txt, or .xlsx · max 10 MB · in-memory processing only</div>
                    <input
                      id="bank-file-input"
                      type="file"
                      accept=".pdf,.csv,.txt,.xlsx"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onBankFile(f); e.target.value = ""; }}
                    />
                  </div>
                </div>
              )}

              {bankPreview && !bankCommitDone && (
                <div className="space-y-4">
                  <div className="card p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="text-sm font-semibold text-white">
                        Bank: <span className="text-brand-300">{bankPreview.detection.detectedBank}</span>
                        <span className="ml-2 text-xs font-normal text-gray-400">({bankPreview.detection.format})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge-info text-xs">Confidence: {bankPreview.detection.confidence}</span>
                        <span className={cn("text-xs px-2.5 py-0.5 rounded-full font-medium", bankPreview.extractor?.startsWith("AI_") ? "bg-purple-900/40 text-purple-300 border border-purple-500/30" : "bg-blue-900/40 text-blue-300 border border-blue-500/30")}>
                          {bankPreview.extractor === "AI_NVIDIA_NIM_UNIVERSAL" ? "✨ AI-Assisted (NVIDIA NIM)" : bankPreview.extractor === "AI_GEMINI_UNIVERSAL" ? "✨ AI-Assisted (Gemini)" : "⚡ Deterministic Adapter"}
                        </span>
                      </div>
                    </div>

                    {bankPreview.detection.accountMasked && (
                      <div className="text-xs text-gray-400">
                        Masked Account Identifier: <span className="font-mono text-white">{bankPreview.detection.accountMasked}</span>
                      </div>
                    )}

                    {bankPreview.warnings.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 space-y-1">
                        <div className="font-semibold">⚠️ Warnings & Reconciliation Notes:</div>
                        {bankPreview.warnings.map((w, idx) => (
                          <div key={idx}>• {w}</div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-6 text-xs text-gray-300 pt-1">
                      <div><strong className="text-positive">{bankPreview.validRows}</strong> Ready to import</div>
                      <div><strong className="text-amber-400">{bankPreview.duplicateRows}</strong> Duplicates detected</div>
                      <div><strong className="text-negative">{bankPreview.invalidRows}</strong> Invalid / flagged</div>
                    </div>
                  </div>

                  {bankPreview.detection.isEncrypted && (
                    <div className="card p-4 flex gap-3 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-300 mb-1">Statement Password</label>
                        <input
                          type="password"
                          value={bankPassword}
                          onChange={(e) => setBankPassword(e.target.value)}
                          placeholder="Enter password to re-extract"
                          className="input w-full text-sm font-mono"
                        />
                      </div>
                      <button
                        onClick={() => bankFile && onBankFile(bankFile, bankPassword)}
                        disabled={busy || !bankPassword}
                        className="btn-secondary self-end"
                      >
                        Re-extract with Password
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      id="skip-dup-bank"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="skip-dup-bank">Skip duplicate transactions automatically during import</label>
                  </div>

                  {bankPreview.rows.length > 0 && (
                    <div className="card overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-bg-card">
                          <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                            <th className="text-left p-3">Date</th>
                            <th className="text-left p-3">Narration</th>
                            <th className="text-left p-3">Type</th>
                            <th className="text-right p-3">Amount</th>
                            <th className="text-right p-3">Balance</th>
                            <th className="text-left p-3">Category</th>
                            <th className="text-left p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bankPreview.rows.map((r, i) => (
                            <tr key={i} className="border-b border-bg-border/30">
                              <td className="p-3 text-gray-300 text-xs font-mono">{r.date}</td>
                              <td className="p-3 text-gray-200 text-xs max-w-xs truncate" title={r.narration}>{r.narration}</td>
                              <td className="p-3">
                                <span className={cn("text-xs px-2 py-0.5 rounded font-medium", r.direction === "CREDIT" ? "bg-positive/20 text-positive" : "bg-negative/20 text-negative")}>
                                  {r.direction === "CREDIT" ? "Credit (Income)" : "Debit (Expense)"}
                                </span>
                              </td>
                              <td className="p-3 text-right tabular-nums text-gray-200 font-medium">
                                {formatCurrency(r.amount, "INR")}
                              </td>
                              <td className="p-3 text-right tabular-nums text-xs">
                                {typeof r.balance === "number" ? (
                                  <span className={r.balanceWarning ? "text-amber-400 font-semibold" : "text-gray-400"} title={r.balanceWarning || undefined}>
                                    {formatCurrency(r.balance, "INR")}
                                    {r.balanceWarning && " ⚠️"}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 text-xs text-brand-300">{r.suggestedCategory}</td>
                              <td className="p-3 text-xs">
                                {r.isDuplicate ? (
                                  <span className="text-amber-400 font-medium">Duplicate</span>
                                ) : r.validationError ? (
                                  <span className="text-negative">{r.validationError}</span>
                                ) : (
                                  <span className="text-positive">Valid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => { setBankPreview(null); setBankFile(null); }}>Cancel</button>
                    <button className="btn-primary flex-1" onClick={confirmBank} disabled={busy || !bankPreview.canImport}>
                      {busy ? "Importing…" : `Confirm Bank Import (${bankPreview.validRows})`}
                    </button>
                  </div>
                </div>
              )}

              {bankCommitDone && (
                <div className="card p-6 space-y-4 text-center">
                  <div className="text-4xl text-positive">✓</div>
                  <h2 className="text-xl font-bold text-white">Bank Transactions Imported</h2>
                  <p className="text-sm text-gray-400">Transactions are now recorded in your ledger.</p>
                  <div className="flex gap-3 justify-center pt-3">
                    <button onClick={() => { setBankPreview(null); setBankCommitDone(false); setBankFile(null); }} className="btn-secondary">Import another</button>
                    <Link href="/transactions" className="btn-primary">View Transactions →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Standard Transaction Subtab */}
          {txSubTab === "standard" && (
            <div className="space-y-5">
              {!standardPreview && !standardCommitDone && (
                <div className="card p-5 space-y-4">
                  <div className="flex justify-between items-start flex-wrap gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-white">Standard Transaction Import</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Upload custom transaction spreadsheets (CSV, TSV, or XLSX). Automatic column detection with manual mapping support.
                      </p>
                    </div>
                    <a
                      href="/api/import/template"
                      download="FinanceAI_Transaction_Template.csv"
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <span>📥</span> Download CSV Template
                    </a>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Target Account (Optional Default)</label>
                    <select
                      value={standardAccountId}
                      onChange={(e) => setStandardAccountId(e.target.value)}
                      className="input w-full max-w-md text-sm"
                    >
                      <option value="">Auto-resolve from file</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                      ))}
                    </select>
                  </div>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onStandardFile(f); }}
                    onClick={() => document.getElementById("standard-file-input")?.click()}
                    className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors", dragging ? "border-brand-500 bg-brand-600/10" : "border-bg-border")}
                  >
                    <div className="text-gray-300 font-medium mb-1">{busy ? "Parsing file…" : "Drop CSV, TSV, or XLSX here or click to browse"}</div>
                    <div className="text-xs text-gray-500">.csv, .tsv, .xlsx · max 10 MB</div>
                    <input
                      id="standard-file-input"
                      type="file"
                      accept=".csv,.tsv,.xlsx"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onStandardFile(f); e.target.value = ""; }}
                    />
                  </div>
                </div>
              )}

              {standardPreview && !standardCommitDone && (
                <div className="space-y-4">
                  <div className="card p-4 space-y-3">
                    <div className="text-sm font-semibold text-white">File: {standardPreview.fileName} ({standardPreview.fileKind})</div>
                    <div className="flex gap-6 text-xs text-gray-300">
                      <div><strong className="text-positive">{standardPreview.validRows}</strong> Valid</div>
                      <div><strong className="text-amber-400">{standardPreview.duplicateRows}</strong> Duplicates</div>
                      <div><strong className="text-negative">{standardPreview.invalidRows}</strong> Invalid</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      id="skip-dup-std"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="skip-dup-std">Skip duplicate transactions automatically during import</label>
                  </div>

                  {standardPreview.rows.length > 0 && (
                    <div className="card overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-bg-card">
                          <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                            <th className="text-left p-3">Date</th>
                            <th className="text-left p-3">Description</th>
                            <th className="text-left p-3">Type</th>
                            <th className="text-right p-3">Amount</th>
                            <th className="text-left p-3">Category</th>
                            <th className="text-left p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standardPreview.rows.map((r, i) => (
                            <tr key={i} className="border-b border-bg-border/30">
                              <td className="p-3 text-gray-300 text-xs font-mono">{r.date}</td>
                              <td className="p-3 text-gray-200 text-xs max-w-xs truncate" title={r.description}>{r.description}</td>
                              <td className="p-3 text-xs font-medium text-brand-300">{r.type}</td>
                              <td className="p-3 text-right tabular-nums text-gray-200 font-medium">
                                {formatCurrency(r.amount, r.currency)}
                              </td>
                              <td className="p-3 text-xs text-gray-400">{r.category}</td>
                              <td className="p-3 text-xs">
                                {r.isDuplicate ? (
                                  <span className="text-amber-400 font-medium">Duplicate</span>
                                ) : r.validationError ? (
                                  <span className="text-negative">{r.validationError}</span>
                                ) : (
                                  <span className="text-positive">Valid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="btn-secondary flex-1" onClick={() => { setStandardPreview(null); setStandardFile(null); }}>Cancel</button>
                    <button className="btn-primary flex-1" onClick={confirmStandard} disabled={busy || !standardPreview.canImport}>
                      {busy ? "Importing…" : `Confirm Standard Import (${standardPreview.validRows})`}
                    </button>
                  </div>
                </div>
              )}

              {standardCommitDone && (
                <div className="card p-6 space-y-4 text-center">
                  <div className="text-4xl text-positive">✓</div>
                  <h2 className="text-xl font-bold text-white">Transactions Imported</h2>
                  <p className="text-sm text-gray-400">Transactions are now recorded in your ledger.</p>
                  <div className="flex gap-3 justify-center pt-3">
                    <button onClick={() => { setStandardPreview(null); setStandardCommitDone(false); setStandardFile(null); }} className="btn-secondary">Import another</button>
                    <Link href="/transactions" className="btn-primary">View Transactions →</Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 3: IMPORT HISTORY
      ======================================================================== */}
      {mainTab === "history" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Recent Imports</h3>
            <button onClick={loadHistory} className="btn-ghost text-xs">Refresh</button>
          </div>

          {historyList.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 text-sm">
              No imports recorded yet. Import bank statements or broker portfolios to track history here.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">File</th>
                    <th className="text-left p-3">Account / Target</th>
                    <th className="text-right p-3">Imported</th>
                    <th className="text-right p-3">Duplicates</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => (
                    <tr key={h.id} className="border-b border-bg-border/30">
                      <td className="p-3 text-xs text-gray-400 font-mono">{new Date(h.importDate).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-xs text-brand-300 font-medium">{h.source}</td>
                      <td className="p-3 text-xs text-gray-300 max-w-xs truncate" title={h.fileName}>{h.fileName}</td>
                      <td className="p-3 text-xs text-gray-400">{h.accountName || "—"}</td>
                      <td className="p-3 text-right tabular-nums text-positive font-medium">{h.importedCount}</td>
                      <td className="p-3 text-right tabular-nums text-gray-400">{h.duplicateCount}</td>
                      <td className="p-3 text-xs">
                        <span className={cn("px-2 py-0.5 rounded font-medium",
                          h.finalStatus === "COMPLETED" ? "bg-positive/20 text-positive" :
                          h.finalStatus === "COMPLETED_WITH_WARNINGS" ? "bg-amber-400/20 text-amber-400" :
                          h.finalStatus === "ROLLED_BACK" ? "bg-gray-500/20 text-gray-400" : "bg-negative/20 text-negative"
                        )}>
                          {h.finalStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {h.canRollback && h.finalStatus !== "ROLLED_BACK" ? (
                          <button
                            onClick={() => handleRollback(h.id)}
                            className="text-xs text-negative hover:underline"
                            disabled={busy}
                          >
                            Rollback
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
