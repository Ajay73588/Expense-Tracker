"use client";

import { useState, useCallback } from "react";
import { cn } from "@/utils/cn";
import { formatINR } from "@/utils/format";

interface PreviewRow {
  type: string;
  name: string;
  symbol: string | null;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
  account: string;
}

interface ImportReport {
  source: string;
  added: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
  preview: PreviewRow[];
}

const SAMPLE_CSV = `Name,Symbol,Quantity,Average Price
Reliance Industries,RELIANCE,10,2800
HDFC Bank,HDFCBANK,15,1600
Infosys,INFY,25,1700
TCS,TCS,5,3900`;

const BROKERS = [
  { name: "Groww", note: "Portfolio Holdings CSV from Groww app" },
  { name: "Zerodha", note: "Console › Holdings › Download CSV" },
  { name: "INDmoney", note: "Multi-asset export CSV" },
  { name: "Generic", note: "Any CSV with Name, Symbol, Quantity, Price columns" },
];

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const text = await file.text();
    setCsvText(text);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, preview: true }),
    });
    const json = await res.json();
    if (json.ok) {
      setDetectedSource(json.data.source);
      setPreview(json.data.rows ?? []);
      setStep("preview");
    } else {
      setError("Could not parse file. Check format.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function runImport() {
    setImporting(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const json = await res.json();
    setImporting(false);
    if (json.ok) {
      setReport(json.data);
      setStep("done");
    } else {
      setError(json.error?.message ?? "Import failed");
    }
  }

  function useSample() {
    setCsvText(SAMPLE_CSV);
    const rows: PreviewRow[] = [
      { type: "STOCK", name: "Reliance Industries", symbol: "RELIANCE", quantity: 10, avgBuyPrice: 2800, currency: "INR", account: "Manual Import" },
      { type: "STOCK", name: "HDFC Bank", symbol: "HDFCBANK", quantity: 15, avgBuyPrice: 1600, currency: "INR", account: "Manual Import" },
    ];
    setDetectedSource("Generic");
    setPreview(rows);
    setStep("preview");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Portfolio</h1>
        <p className="text-sm text-gray-500 mt-1">Upload CSV from Groww, Zerodha, INDmoney or any broker.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {(["upload", "preview", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center font-bold",
              step === s ? "bg-brand-600 text-white" :
              (step === "preview" && i === 0) || step === "done" ? "bg-positive/20 text-positive" :
              "bg-bg-hover text-gray-500"
            )}>
              {(step === "preview" && i === 0) || (step === "done" && i < 2) ? "✓" : i + 1}
            </div>
            <span className={step === s ? "text-gray-200" : "text-gray-500"}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 2 && <span className="text-bg-border">—</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
              dragging ? "border-brand-500 bg-brand-600/10" : "border-bg-border hover:border-bg-border/60"
            )}
            onClick={() => document.getElementById("csv-input")?.click()}
          >
            <div className="text-4xl mb-3">↥</div>
            <div className="text-gray-300 font-medium mb-1">Drop CSV here or click to browse</div>
            <div className="text-sm text-gray-500">Supports Groww, Zerodha, INDmoney, and generic CSVs</div>
            <input id="csv-input" type="file" accept=".csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {error && <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-sm text-negative">{error}</div>}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-bg-border" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 h-px bg-bg-border" />
          </div>

          <button onClick={useSample} className="btn-secondary w-full justify-center text-sm">
            Try with sample data
          </button>

          {/* Supported brokers */}
          <div className="card p-4">
            <div className="text-sm font-medium text-gray-300 mb-3">Supported formats</div>
            <div className="grid grid-cols-2 gap-2">
              {BROKERS.map(b => (
                <div key={b.name} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="text-gray-200 font-medium">{b.name}</div>
                    <div className="text-gray-500">{b.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-300">
                Detected broker: <span className="text-brand-300 font-medium">{detectedSource ?? "Unknown"}</span>
              </div>
              <div className="text-xs text-gray-500">{preview.length} holdings to import</div>
            </div>
            <button onClick={() => setStep("upload")} className="btn-ghost text-sm">← Back</button>
          </div>

          {error && <div className="bg-negative/10 border border-negative/30 rounded-lg p-3 text-sm text-negative">{error}</div>}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border text-xs text-gray-500 uppercase">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Symbol</th>
                  <th className="text-right p-3 font-medium">Qty</th>
                  <th className="text-right p-3 font-medium">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-bg-border/40">
                    <td className="p-3 text-gray-200">{r.name}</td>
                    <td className="p-3">
                      <span className="pill pill-neutral text-[10px]">{r.type.replace("_", " ")}</span>
                    </td>
                    <td className="p-3 text-gray-400 font-mono text-xs">{r.symbol ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums text-gray-300">{r.quantity.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</td>
                    <td className="p-3 text-right tabular-nums text-gray-300">{formatINR(r.avgBuyPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep("upload")}>Cancel</button>
            <button className="btn-primary flex-1" onClick={runImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${preview.length} Holdings`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && report && (
        <div className="space-y-4">
          <div className="card p-8 text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-white mb-2">Import Complete</h2>
            <p className="text-gray-400 text-sm mb-6">Your portfolio has been updated from {report.source}.</p>
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-6">
              <div className="bg-positive/10 rounded-lg p-3">
                <div className="text-2xl font-bold text-positive">{report.added}</div>
                <div className="text-xs text-gray-400 mt-0.5">Added</div>
              </div>
              <div className="bg-brand-600/10 rounded-lg p-3">
                <div className="text-2xl font-bold text-brand-300">{report.updated}</div>
                <div className="text-xs text-gray-400 mt-0.5">Updated</div>
              </div>
              <div className="bg-bg-hover rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-400">{report.skipped}</div>
                <div className="text-xs text-gray-400 mt-0.5">Skipped</div>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="bg-negative/10 border border-negative/20 rounded-lg p-3 mb-4 text-left">
                <div className="text-xs font-medium text-negative mb-1">Warnings:</div>
                {report.errors.map((e, i) => <div key={i} className="text-xs text-gray-400">{e}</div>)}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setStep("upload"); setReport(null); setCsvText(""); setPreview([]); }} className="btn-secondary">
                Import Another
              </button>
              <a href="/portfolio" className="btn-primary">View Portfolio →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
