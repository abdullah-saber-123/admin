"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Banknote, HandCoins, Users, Wallet } from "lucide-react";
import type { DashboardSummary } from "@/lib/types";
import { formatPct, formatSar } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { AgingChart } from "@/components/AgingChart";
import { GradeBadge } from "@/components/GradeBadge";
import { LoadingView, ErrorView } from "@/components/StateViews";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSummary(data.summary);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorView message={error} />;
  if (!summary) return <LoadingView />;

  const totalGrades = Object.values(summary.gradeDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">لوحة تحكم العملاء</h1>
        <p className="text-sm text-[var(--ink-muted)]">نظرة عامة على أداء السداد والتحصيل وأعمار الديون لكافة العملاء</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="عدد العملاء" value={String(summary.totalCustomers)} icon={Users} />
        <KpiCard label="إجمالي المبيعات" value={formatSar(summary.totalSales)} icon={Banknote} />
        <KpiCard label="إجمالي التحصيل" value={formatSar(summary.totalCollected)} icon={HandCoins} />
        <KpiCard
          label="الرصيد المستحق"
          value={formatSar(summary.totalOutstanding)}
          icon={Wallet}
          tone={summary.totalOutstanding > summary.totalSales * 0.3 ? "warning" : "neutral"}
        />
        <KpiCard
          label="متوسط الالتزام"
          value={formatPct(summary.avgCommitment)}
          icon={BadgeCheck}
          tone={summary.avgCommitment >= 75 ? "good" : summary.avgCommitment >= 55 ? "warning" : "critical"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold">أعمار الديون الإجمالية</h2>
          <AgingChart aging={summary.aging} />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-bold">توزيع تقييم العملاء</h2>
          <div className="flex flex-col gap-3">
            {(["A", "B", "C", "D"] as const).map((g) => {
              const count = summary.gradeDistribution[g];
              const pct = (count / totalGrades) * 100;
              return (
                <div key={g} className="flex items-center gap-3">
                  <GradeBadge grade={g} showLabel={false} />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--hover)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          g === "A" ? "var(--grade-a)" : g === "B" ? "var(--grade-b)" : g === "C" ? "var(--grade-c)" : "var(--grade-d)",
                      }}
                    />
                  </div>
                  <span className="w-8 text-left text-xs tabular-nums text-[var(--ink-muted)]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-bold">أعلى العملاء خطورة (ديون متأخرة)</h2>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {summary.topRiskCustomers.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/customers/${c.id}`} className="font-medium hover:text-[var(--brand)] hover:underline">
                  {c.name}
                </Link>
                <span className="tabular-nums text-[var(--status-critical)]">{formatSar(c.overdue)}</span>
              </li>
            ))}
            {summary.topRiskCustomers.length === 0 ? (
              <li className="py-6 text-center text-[var(--ink-muted)]">لا توجد ديون متأخرة حالياً</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-bold">أعلى العملاء مبيعاً</h2>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {summary.topSalesCustomers.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/customers/${c.id}`} className="font-medium hover:text-[var(--brand)] hover:underline">
                  {c.name}
                </Link>
                <span className="tabular-nums text-[var(--series-1)]">{formatSar(c.totalSales)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
