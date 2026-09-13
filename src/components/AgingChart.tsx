"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgingBuckets } from "@/lib/types";
import { formatSar } from "@/lib/format";

const bucketColors = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];

export function AgingChart({ aging }: { aging: AgingBuckets }) {
  const data = [
    { label: "غير مستحق", value: Math.max(0, aging.current) },
    { label: "1-30 يوم", value: Math.max(0, aging.d1_30) },
    { label: "31-60 يوم", value: Math.max(0, aging.d31_60) },
    { label: "61-90 يوم", value: Math.max(0, aging.d61_90) },
    { label: "90+ يوم", value: Math.max(0, aging.d90_plus) },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--ink-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border-strong)" }} tickLine={false} />
        <YAxis
          tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip
          cursor={{ fill: "var(--hover)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
          formatter={(value) => [formatSar(Number(value)), "الرصيد"]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={bucketColors[i]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
