"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { PartnerLedger } from "@/lib/types";
import { formatDate, formatSar } from "@/lib/format";
import { LoadingView, ErrorView } from "@/components/StateViews";

export default function CustomerStatementPage() {
  const params = useParams<{ id: string }>();
  const [ledger, setLedger] = useState<PartnerLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${params.id}/ledger`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setLedger(data.ledger);
      })
      .catch((e) => setError(String(e)));
  }, [params.id]);

  if (error) return <ErrorView message={error} />;
  if (!ledger) return <LoadingView label="جارٍ تحميل كشف الحساب..." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/customers/${ledger.partnerId}`}
            className="mb-1 flex items-center gap-1 text-xs text-[var(--ink-muted)] hover:text-[var(--brand)]"
          >
            <ArrowRight size={14} />
            رجوع إلى تحليل العميل
          </Link>
          <h1 className="text-xl font-bold">كشف حساب: {ledger.partnerName}</h1>
        </div>
        <div className="flex gap-6 text-left">
          <div>
            <div className="text-xs text-[var(--ink-muted)]">الرصيد الافتتاحي</div>
            <div className="tabular-nums font-bold">{formatSar(ledger.openingBalance)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--ink-muted)]">الرصيد الختامي</div>
            <div
              className="tabular-nums font-bold"
              style={{ color: ledger.closingBalance > 0 ? "var(--status-critical)" : "var(--status-good)" }}
            >
              {formatSar(ledger.closingBalance)}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-right text-[var(--ink-muted)]">
              <th className="whitespace-nowrap px-4 py-2 font-medium">التاريخ</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">القيد</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">البيان</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">مدين</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">دائن</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">الرصيد</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)] bg-[var(--hover)] text-xs text-[var(--ink-muted)]">
              <td className="px-4 py-2" colSpan={5}>
                رصيد افتتاحي
              </td>
              <td className="px-4 py-2 tabular-nums">{formatSar(ledger.openingBalance)}</td>
              <td />
            </tr>
            {ledger.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(entry.date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{entry.moveName}</td>
                <td className="px-4 py-2.5">{entry.label}</td>
                <td className="px-4 py-2.5 tabular-nums">{entry.debit > 0 ? formatSar(entry.debit) : "-"}</td>
                <td className="px-4 py-2.5 tabular-nums">{entry.credit > 0 ? formatSar(entry.credit) : "-"}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium">{formatSar(entry.balance)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: entry.reconciled ? "color-mix(in srgb, var(--status-good) 15%, transparent)" : "color-mix(in srgb, var(--status-warning) 20%, transparent)",
                      color: entry.reconciled ? "var(--status-good)" : "var(--status-warning)",
                    }}
                  >
                    {entry.reconciled ? "مسدد" : "مفتوح"}
                  </span>
                </td>
              </tr>
            ))}
            {ledger.entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                  لا توجد حركات في كشف الحساب
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
