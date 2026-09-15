"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSar, monthLabel } from "@/lib/format";

export interface TrendPoint {
  month: string;
  sales: number;
  collections: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-[var(--ink-muted)]">لا توجد بيانات كافية</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--border-strong)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          labelFormatter={(v) => monthLabel(String(v))}
          formatter={(value, name) => [formatSar(Number(value)), name === "sales" ? "المبيعات" : "المدفوعات"]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
        />
        <Legend
          formatter={(value: string) => (value === "sales" ? "المبيعات" : "المدفوعات")}
          wrapperStyle={{ fontSize: 12, color: "var(--ink-secondary)" }}
        />
        <Line type="monotone" dataKey="sales" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="collections" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
