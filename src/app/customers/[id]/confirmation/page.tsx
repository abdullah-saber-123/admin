"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Printer } from "lucide-react";
import type { CustomerAnalysis, ReconciliationRecord } from "@/lib/types";
import { formatDate, formatSar } from "@/lib/format";
import { LoadingView, ErrorView } from "@/components/StateViews";

export default function BalanceConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerAnalysis | null>(null);
  const [record, setRecord] = useState<ReconciliationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${params.id}`).then((r) => r.json()),
      fetch(`/api/customers/${params.id}/reconciliation`).then((r) => r.json()),
    ])
      .then(([customerData, reconciliationData]) => {
        if (customerData.error) {
          setError(customerData.error);
          return;
        }
        setCustomer(customerData.customer);
        setRecord(reconciliationData.record ?? null);
      })
      .catch((e) => setError(String(e)));
  }, [params.id]);

  if (error) return <ErrorView message={error} />;
  if (!customer) return <LoadingView />;

  const today = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/customers/${customer.id}`}
          className="flex items-center gap-1 text-xs text-[var(--ink-muted)] hover:text-[var(--brand)]"
        >
          <ArrowRight size={14} />
          رجوع إلى تحليل العميل
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
        >
          <Printer size={15} />
          طباعة النموذج
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 border-b border-[var(--border)] pb-4 text-center">
          <h1 className="text-lg font-bold">نموذج مصادقة رصيد</h1>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Balance Confirmation Form</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-[var(--ink-muted)]">اسم العميل</div>
            <div className="font-medium">{customer.name}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ink-muted)]">تاريخ إصدار النموذج</div>
            <div className="font-medium tabular-nums">{formatDate(today)}</div>
          </div>
          {customer.city ? (
            <div>
              <div className="text-xs text-[var(--ink-muted)]">المدينة</div>
              <div className="font-medium">{customer.city}</div>
            </div>
          ) : null}
          {customer.phone ? (
            <div>
              <div className="text-xs text-[var(--ink-muted)]">الجوال</div>
              <div className="font-medium tabular-nums">{customer.phone}</div>
            </div>
          ) : null}
        </div>

        <div className="mb-6 rounded-lg border border-[var(--border)] p-4 text-center">
          <div className="text-xs text-[var(--ink-muted)]">الرصيد المستحق حتى تاريخه</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--brand)]">{formatSar(customer.totalOutstanding)}</div>
        </div>

        <p className="mb-6 text-sm leading-7 text-[var(--ink-secondary)]">
          نقر نحن الموقعين أدناه بأن الرصيد الموضح أعلاه والبالغ{" "}
          <span className="font-bold text-[var(--ink)]">{formatSar(customer.totalOutstanding)}</span> يمثل الرصيد المستحق في ذمة العميل المذكور
          وفقًا لسجلاتنا المحاسبية بتاريخ {formatDate(today)}، وأنه تمت مطابقته ومراجعته من الطرفين.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-6 border-t border-[var(--border)] pt-4 text-sm">
          <div>
            <div className="text-xs text-[var(--ink-muted)]">المطابق (من الشركة)</div>
            <div className="font-medium">{record?.reconciledBy || "…………………………"}</div>
            <div className="mt-1 text-xs text-[var(--ink-muted)]">
              تاريخ آخر مطابقة: {record ? formatDate(record.reconciledAt) : "…………………………"}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--ink-muted)]">ملاحظات</div>
            <div className="font-medium">{record?.notes || "-"}</div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div className="text-center">
            <div className="mb-8 border-b border-[var(--border-strong)]" />
            <div className="font-medium">توقيع المحاسب / المطابق</div>
            <div className="text-xs text-[var(--ink-muted)]">الاسم والتوقيع والتاريخ</div>
          </div>
          <div className="text-center">
            <div className="mb-8 border-b border-[var(--border-strong)]" />
            <div className="font-medium">توقيع العميل</div>
            <div className="text-xs text-[var(--ink-muted)]">الاسم والتوقيع والتاريخ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
