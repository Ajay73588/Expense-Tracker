"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/utils/cn";
import { usePrivacy } from "@/context/PrivacyContext";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/portfolio", label: "Portfolio", icon: "◈" },
  { href: "/transactions", label: "Transactions", icon: "₹" },
  { href: "/budget", label: "Budget", icon: "◧" },
  { href: "/goals", label: "Goals", icon: "◎" },
  { href: "/liabilities", label: "Liabilities", icon: "⚖" },
  { href: "/calculators", label: "Calculators", icon: "🧮" },
  { href: "/ai", label: "AI Advisor", icon: "✦" },
  { href: "/import", label: "Import", icon: "↥" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { privacyMode, togglePrivacyMode } = usePrivacy();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Mobile Top Header (< lg breakpoints) ─────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-bg-card/95 backdrop-blur-sm border-b border-bg-border px-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold text-white text-sm">
            F
          </div>
          <span className="font-semibold text-white text-sm">FinanceAI</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePrivacyMode}
            aria-label={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
            title={privacyMode ? "Privacy Mode Active" : "Privacy Mode Inactive"}
            className={cn(
              "p-2 rounded-lg text-sm border transition-colors",
              privacyMode
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-bg-hover border-bg-border text-gray-400"
            )}>
            {privacyMode ? "🔒" : "👁"}
          </button>
          <UserButton />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="p-2 rounded-lg bg-bg-hover border border-bg-border text-gray-300 hover:text-white transition-colors">
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* ── Mobile Navigation Drawer ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] bg-bg-card h-full border-r border-bg-border flex flex-col z-10 shadow-2xl">
            <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold text-white text-sm">
                  F
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">FinanceAI</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider">Advisory v1.0</div>
                </div>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="text-gray-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {nav.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-brand-600/15 text-brand-300 border border-brand-600/30"
                        : "text-gray-400 hover:text-white hover:bg-bg-hover border border-transparent"
                    )}>
                    <span className="text-lg w-5 text-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-bg-border flex items-center gap-3">
              <UserButton />
              {isLoaded && user && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">{user.fullName || "User"}</div>
                  <div className="text-xs text-gray-500 truncate">{user.primaryEmailAddress?.emailAddress}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Fixed Sidebar (>= lg breakpoints) ───────────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-bg-card border-r border-bg-border flex-col">
        <div className="px-6 py-5 border-b border-bg-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold text-white">
              F
            </div>
            <div>
              <div className="font-semibold text-white">FinanceAI</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Advisory v1.0</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-brand-600/15 text-brand-300 border border-brand-600/30"
                    : "text-gray-400 hover:text-white hover:bg-bg-hover border border-transparent"
                )}>
                <span className="text-lg w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Privacy Mode Control */}
        <div className="px-3 py-2 border-t border-bg-border/60">
          <button
            onClick={togglePrivacyMode}
            title={privacyMode ? "Privacy Mode Active (balances masked)" : "Privacy Mode Inactive (click to mask balances)"}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
              privacyMode
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                : "bg-bg-base/40 border-bg-border/60 text-gray-400 hover:text-gray-200 hover:bg-bg-hover"
            )}>
            <span className="flex items-center gap-2">
              <span>{privacyMode ? "🔒" : "👁"}</span>
              <span>{privacyMode ? "Privacy: ON" : "Privacy: OFF"}</span>
            </span>
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                privacyMode ? "bg-amber-400 animate-pulse" : "bg-gray-600"
              )}
            />
          </button>
        </div>

        <div className="p-4 border-t border-bg-border flex items-center gap-3">
          <UserButton />
          {isLoaded && user && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">{user.fullName || "User"}</div>
              <div className="text-xs text-gray-500 truncate">{user.primaryEmailAddress?.emailAddress}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
