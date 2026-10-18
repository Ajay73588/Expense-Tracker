import { createHash } from "node:crypto";

export interface FingerprintInput {
  userId: string;
  accountId?: string | null;
  date: string; // ISO or YYYY-MM-DD
  amount: number;
  type: string; // INCOME | EXPENSE | TRANSFER
  description: string;
  reference?: string | null;
}

/**
 * Generates a deterministic SHA-256 fingerprint for a transaction.
 * Incorporates user, account, normalized date, rounded amount, type, normalized narration, and reference.
 * Distinct same-day purchases with different references or distinct accounts/descriptions produce different fingerprints.
 */
export function generateTransactionFingerprint(input: FingerprintInput): string {
  // Normalize date to YYYY-MM-DD
  const dateStr = typeof input.date === "string" ? input.date.slice(0, 10) : new Date(input.date).toISOString().slice(0, 10);
  
  // Normalize description: lowercase, strip non-alphanumeric noise, collapse whitespace
  const cleanDesc = (input.description || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Normalize amount to 2 decimal places
  const amountStr = Math.abs(input.amount).toFixed(2);

  const cleanRef = (input.reference || "").trim().toLowerCase();
  const accountStr = (input.accountId || "none").trim().toLowerCase();

  const raw = `${input.userId}|${accountStr}|${dateStr}|${amountStr}|${input.type.toUpperCase()}|${cleanDesc}|${cleanRef}`;
  return createHash("sha256").update(raw).digest("hex");
}
