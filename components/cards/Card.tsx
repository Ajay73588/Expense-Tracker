import { cn } from "@/utils/cn";
import { ReactNode } from "react";

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  change,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  change?: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-gray-400";
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{label}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {change && <div className={cn("text-xs mt-1 font-medium", toneClass)}>{change}</div>}
      {hint && <div className="text-xs mt-1 text-gray-500">{hint}</div>}
    </div>
  );
}
