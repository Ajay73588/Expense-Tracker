"use client";

import React, { useState } from "react";
import type { AssetWithPL } from "@/types";
import { formatINR } from "@/utils/format";

interface DeleteConfirmModalProps {
  asset: AssetWithPL | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteConfirmModal({
  asset,
  isOpen,
  onClose,
  onSuccess,
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  async function handleDelete() {
    if (!asset) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message ?? "Failed to delete asset");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "An error occurred while deleting the asset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-bg-card border border-bg-border rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Delete Asset</h3>
            <p className="text-xs text-gray-400 mt-1">
              Are you sure you want to remove this holding from your portfolio?
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-negative/15 border border-negative/30 rounded-lg text-xs text-negative">
            {error}
          </div>
        )}

        <div className="p-3 bg-bg-hover/60 rounded-lg border border-bg-border/60 text-sm space-y-1">
          <div className="font-semibold text-white">{asset.name}</div>
          <div className="text-xs text-gray-400">
            Type: <span className="text-gray-300">{asset.type.replace("_", " ")}</span>
          </div>
          <div className="text-xs text-gray-400">
            Current Value:{" "}
            <span className="text-gray-200 font-medium">
              {formatINR(asset.currentValue)}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          This holding will be soft-deleted and excluded from all future portfolio, allocation, and net worth calculations.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn bg-negative hover:bg-negative/90 text-white text-xs px-4 py-1.5 rounded-lg"
          >
            {loading ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
