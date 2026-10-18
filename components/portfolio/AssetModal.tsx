"use client";

import React, { useState, useEffect } from "react";
import type { AssetWithPL, AssetType } from "@/types";
import { ASSET_TYPES } from "@/types";

interface AssetModalProps {
  isOpen: boolean;
  assetToEdit?: AssetWithPL | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TYPE_LABELS: Record<AssetType, string> = {
  STOCK: "Stock (Equity)",
  MUTUAL_FUND: "Mutual Fund",
  FIXED_DEPOSIT: "Fixed Deposit / RD",
  EPF_PPF: "EPF / PPF / NPS",
  REAL_ESTATE: "Real Estate",
  GOLD: "Gold / Precious Metals",
  CRYPTO: "Cryptocurrency",
  CASH: "Cash / Bank Balance",
};

const UNIT_BASED_TYPES: AssetType[] = ["STOCK", "MUTUAL_FUND", "CRYPTO", "GOLD"];

export function AssetModal({
  isOpen,
  assetToEdit,
  onClose,
  onSuccess,
}: AssetModalProps) {
  const isEditing = Boolean(assetToEdit);

  const [type, setType] = useState<AssetType>("STOCK");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [account, setAccount] = useState("");
  const [isin, setIsin] = useState("");
  const [folio, setFolio] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isUnitBased = UNIT_BASED_TYPES.includes(type);

  useEffect(() => {
    if (assetToEdit) {
      setType(assetToEdit.type);
      setName(assetToEdit.name);
      setSymbol(assetToEdit.symbol ?? "");
      setQuantity(String(assetToEdit.quantity));
      setAvgBuyPrice(String(assetToEdit.avgBuyPrice));
      setCurrentPrice(String(assetToEdit.currentPrice));
      setCurrency(assetToEdit.currency);
      setAccount(assetToEdit.account ?? "");
      setIsin(assetToEdit.isin ?? "");
    } else {
      resetForm();
    }
    setErrors({});
    setServerError(null);
  }, [assetToEdit, isOpen]);

  function resetForm() {
    setType("STOCK");
    setName("");
    setSymbol("");
    setQuantity("1");
    setAvgBuyPrice("");
    setCurrentPrice("");
    setCurrency("INR");
    setAccount("");
    setIsin("");
    setFolio("");
  }

  function handleTypeChange(newType: AssetType) {
    setType(newType);
    if (!UNIT_BASED_TYPES.includes(newType)) {
      setQuantity("1");
    }
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Asset name is required";
    }

    const qtyNum = parseFloat(quantity);
    if (isUnitBased && (isNaN(qtyNum) || qtyNum <= 0)) {
      newErrors.quantity = "Quantity must be greater than 0";
    }

    const buyPriceNum = parseFloat(avgBuyPrice);
    if (isNaN(buyPriceNum) || buyPriceNum < 0) {
      newErrors.avgBuyPrice = isUnitBased
        ? "Purchase price must be 0 or greater"
        : "Invested amount must be 0 or greater";
    }

    if (currentPrice.trim() !== "") {
      const curPriceNum = parseFloat(currentPrice);
      if (isNaN(curPriceNum) || curPriceNum < 0) {
        newErrors.currentPrice = "Current price / valuation must be 0 or greater";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    const qty = isUnitBased ? parseFloat(quantity) : 1;
    const buyPrice = parseFloat(avgBuyPrice);
    const currPrice = currentPrice.trim() !== "" ? parseFloat(currentPrice) : buyPrice;

    const isPriceChanged = isEditing && assetToEdit
      ? (currentPrice.trim() !== "" ? parseFloat(currentPrice) !== assetToEdit.currentPrice : false)
      : false;
    const priceSource = isEditing && assetToEdit
      ? (isPriceChanged ? "MANUAL" : (assetToEdit.priceSource ?? undefined))
      : undefined;

    const payload: any = {
      type,
      name: name.trim(),
      symbol: symbol.trim() || null,
      quantity: qty,
      avgBuyPrice: buyPrice,
      currentPrice: currPrice,
      currency: currency.toUpperCase(),
      account: account.trim() || null,
      isin: isin.trim() || null,
      folio: folio.trim() || null,
      ...(priceSource ? { priceSource } : {}),
    };

    try {
      const endpoint = isEditing ? `/api/assets/${assetToEdit!.id}` : "/api/assets";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message ?? "Failed to save asset");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err?.message ?? "An error occurred while saving the asset");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-bg-card border border-bg-border rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? "Edit Asset Holding" : "Add Asset Holding"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEditing
                ? "Update holding details and manual valuation."
                : "Manually track stocks, mutual funds, FDs, gold, real estate, and more."}
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

        {serverError && (
          <div className="p-3 bg-negative/15 border border-negative/30 rounded-lg text-xs text-negative">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Category */}
          <div>
            <label className="label">Asset Category</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AssetType)}
              disabled={isEditing}
              className="input bg-bg-card"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Name & Symbol */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Asset / Scheme Name *</label>
              <input
                type="text"
                placeholder={isUnitBased ? "e.g. Reliance Industries" : "e.g. SBI 3-Yr FD"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`input ${errors.name ? "border-negative" : ""}`}
              />
              {errors.name && <p className="text-[11px] text-negative mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="label">
                {isUnitBased ? "Symbol / Ticker" : "Identifier / Account Ref"}
              </label>
              <input
                type="text"
                placeholder={isUnitBased ? "e.g. RELIANCE.NS, AAPL" : "e.g. FD-2026-001"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Quantities & Prices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isUnitBased ? (
              <div>
                <label className="label">Quantity / Units *</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 50"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`input ${errors.quantity ? "border-negative" : ""}`}
                />
                {errors.quantity && (
                  <p className="text-[11px] text-negative mt-1">{errors.quantity}</p>
                )}
              </div>
            ) : null}

            <div>
              <label className="label">
                {isUnitBased ? "Average Buy Price / NAV *" : "Invested Amount *"}
              </label>
              <input
                type="number"
                step="any"
                placeholder={isUnitBased ? "e.g. 2500" : "e.g. 100000"}
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                className={`input ${errors.avgBuyPrice ? "border-negative" : ""}`}
              />
              {errors.avgBuyPrice && (
                <p className="text-[11px] text-negative mt-1">{errors.avgBuyPrice}</p>
              )}
            </div>

            <div>
              <label className="label">
                {isUnitBased ? "Current Price (CMP)" : "Current Valuation / Balance"}
              </label>
              <input
                type="number"
                step="any"
                placeholder={
                  isUnitBased
                    ? "Leave blank to auto-fetch or match cost"
                    : "Defaults to invested amount"
                }
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                className={`input ${errors.currentPrice ? "border-negative" : ""}`}
              />
              {errors.currentPrice && (
                <p className="text-[11px] text-negative mt-1">{errors.currentPrice}</p>
              )}
            </div>

            <div>
              <label className="label">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input bg-bg-card"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Account / Institution & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Broker / Bank / Institution</label>
              <input
                type="text"
                placeholder="e.g. Zerodha, HDFC Bank, EPFO"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label">ISIN / Folio (Optional)</label>
              <input
                type="text"
                placeholder="e.g. INE002A01018"
                value={isin}
                onChange={(e) => setIsin(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-bg-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs px-4 py-1.5"
            >
              {loading ? "Saving..." : isEditing ? "Update Holding" : "Add Holding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
