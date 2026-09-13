"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import type { CustomerAnalysis } from "@/lib/types";
import { formatPct, formatSar } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { GradeBadge } from "@/components/GradeBadge";
import { AgingChart } from "@/components/AgingChart";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { RecommendationList } from "@/components/RecommendationList";
import { LoadingView, ErrorView } from "@/components/StateViews";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCustomer(data.customer);
      })
      .catch((e) => setError(String(e)));
  }, [params.id]);

  if (error) return <ErrorView message={error} />;
  if (!customer) return <LoadingView />;

  const monthKeys = Array.from(new Set([...customer.monthlySales.map((m) => m.month), ...customer.monthlyCollections.map((m) => m.month)])).sort();
  const salesByMonth = new Map(customer.monthlySales.map((m) => [m.month, m.total]));
  const collectionsByMonth = new Map(customer.monthlyCollections.map((m) => [m.month, m.total]));
  const trend: TrendPoint[] = monthKeys.map((month) => ({
    month,
    sales: salesByMonth.get(month) ?? 0,
    collections: collectionsByMonth.get(month) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <GradeBadge grade={customer.grade} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
            {customer.email ? (
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {customer.email}
              </span>
            ) : null}
            {customer.phone ? (
              <span className="flex items-center gap-1.5">
                <Phone size={14} /> {customer.phone}
              </span>
            ) : null}
            {customer.city ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {customer.city}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs text-[var(--ink-muted)]">التقييم العام</div>
          <div className="text-3xl font-extrabold tabular-nums text-[var(--brand)]">{customer.score.toFixed(0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="إجمالي المبيعات" value={formatSar(customer.totalSales)} />
        <KpiCard label="إجمالي التحصيل" value={formatSar(customer.totalCollected)} />
        <KpiCard
          label="الرصيد المستحق"
          value={formatSar(customer.totalOutstanding)}
          tone={customer.totalOutstanding > customer.creditLimit && customer.creditLimit > 0 ? "critical" : "neutral"}
        />
        <KpiCard label="معدل السداد" value={formatPct(customer.paymentRatePct)} tone={customer.paymentRatePct >= 85 ? "good" : "warning"} />
        <KpiCard label="نسبة الالتزام" value={formatPct(customer.commitmentPct)} tone={customer.commitmentPct >= 75 ? "good" : customer.commitmentPct >= 55 ? "warning" : "critical"} />
        <KpiCard label="متوسط أيام التحصيل (DSO)" value={`${customer.dso.toFixed(0)} يوم`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-bold">أعمار الرصيد المستحق</h2>
          <AgingChart aging={customer.aging} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-bold">المبيعات مقابل التحصيل (آخر 12 شهر)</h2>
          <TrendChart data={trend} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold">التوصيات والتحليل</h2>
        <RecommendationList items={customer.recommendations} />
      </div>
    </div>
  );
}
