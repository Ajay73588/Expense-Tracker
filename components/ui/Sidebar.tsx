"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/portfolio", label: "Portfolio", icon: "◈" },
  { href: "/transactions", label: "Transactions", icon: "₹" },
  { href: "/budget", label: "Budget", icon: "◧" },
  { href: "/goals", label: "Goals", icon: "◎" },
  { href: "/ai", label: "AI Advisor", icon: "✦" },
  { href: "/import", label: "Import", icon: "↥" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
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
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-brand-600/15 text-brand-300 border border-brand-600/30"
                  : "text-gray-400 hover:text-white hover:bg-bg-hover border border-transparent"
              )}
            >
              <span className="text-lg w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-bg-border">
        <div className="text-xs text-gray-500 mb-2">Demo mode — seeded data</div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-bg-hover flex items-center justify-center text-xs font-semibold">
            DI
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-200 truncate">Demo Investor</div>
            <div className="text-[10px] text-gray-500 truncate">demo@financeai.app</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
