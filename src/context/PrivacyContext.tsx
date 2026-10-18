"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { formatINR } from "@/utils/format";

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (value: boolean) => void;
  formatMoney: (value: number, opts?: { compact?: boolean }) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  privacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
  formatMoney: (value: number, opts?: { compact?: boolean }) => formatINR(value, opts),
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyModeState] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initial read from localStorage
    try {
      const saved = localStorage.getItem("financeai_privacy_mode");
      if (saved !== null) {
        setPrivacyModeState(saved === "true");
        document.documentElement.setAttribute("data-privacy-mode", saved);
      }
    } catch {
      // LocalStorage access may be restricted
    }

    // 2. Fetch server preferences
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && typeof data?.data?.privacyMode === "boolean") {
          setPrivacyModeState(data.data.privacyMode);
          try {
            localStorage.setItem("financeai_privacy_mode", String(data.data.privacyMode));
            document.documentElement.setAttribute("data-privacy-mode", String(data.data.privacyMode));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const setPrivacyMode = useCallback((val: boolean) => {
    setPrivacyModeState(val);
    try {
      localStorage.setItem("financeai_privacy_mode", String(val));
      document.documentElement.setAttribute("data-privacy-mode", String(val));
    } catch {}

    // Persist to server
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privacyMode: val }),
    }).catch(() => {});
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode(!privacyMode);
  }, [privacyMode, setPrivacyMode]);

  const formatMoney = useCallback(
    (value: number, opts?: { compact?: boolean }) => {
      return formatINR(value, { ...opts, privacy: privacyMode });
    },
    [privacyMode]
  );

  return (
    <PrivacyContext.Provider
      value={{
        privacyMode,
        togglePrivacyMode,
        setPrivacyMode,
        formatMoney,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
