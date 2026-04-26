"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/utils/format";

const COLORS = ["#2b73ff", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ef4444", "#ec4899"];

const tooltipStyle = {
  contentStyle: {
    background: "#13161b",
    border: "1px solid #242932",
    borderRadius: 8,
    fontSize: 12,
    color: "#e6e9ef",
  },
  labelStyle: { color: "#9ca3af" },
  itemStyle: { color: "#e6e9ef" },
};

export function NetWorthChart({ data }: { data: { date: string; netWorth: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b73ff" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#2b73ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e25" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatINR(v, { compact: true })}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => formatINR(v)}
          labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN")}
        />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke="#2b73ff"
          strokeWidth={2}
          fill="url(#nwGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e25" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v: number) => formatINR(v, { compact: true })}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatINR(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AllocationPie({
  data,
}: {
  data: { assetType: string; value: number; percent: number }[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="assetType"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {filtered.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) => [formatINR(v), name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => value.replace("_", " ")}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategorySplitChart({
  data,
}: {
  data: { category: string; amount: number }[];
}) {
  const top = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1e25" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatINR(v, { compact: true })}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => formatINR(v)} />
        <Bar dataKey="amount" fill="#2b73ff" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HealthScoreRadial({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#2b73ff" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - pct / 100);
  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" stroke="#1a1e25" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r="52"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-white tabular-nums">{score.toFixed(1)}</div>
        <div className="text-xs text-gray-500">out of {max}</div>
      </div>
    </div>
  );
}
