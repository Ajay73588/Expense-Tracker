export function formatINR(value: number, opts?: { compact?: boolean; privacy?: boolean }): string {
  if (opts?.privacy) return "₹ •••••";
  if (!Number.isFinite(value)) return "₹0";
  if (opts?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function classifyAssetType(symbol: string | null, rawType?: string): string {
  const t = (rawType ?? "").toUpperCase();
  if (["STOCK", "MUTUAL_FUND", "CRYPTO", "REAL_ESTATE", "CASH"].includes(t)) return t;
  const s = (symbol ?? "").toUpperCase();
  if (/BTC|ETH|SOL|DOGE|MATIC|ADA|DOT|XRP/.test(s)) return "CRYPTO";
  if (/^[A-Z]+$/.test(s) && s.length <= 10) return "STOCK";
  return "MUTUAL_FUND";
}
