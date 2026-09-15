"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { FileCheck2, UserCheck } from "lucide-react";
import type { CustomerAnalysis, ReconciliationRecord } from "@/lib/types";
import { formatDate, formatSar } from "@/lib/format";

interface ReconciliationTableProps {
  customers: CustomerAnalysis[];
  records: Record<number, ReconciliationRecord>;
  onSaved: (record: ReconciliationRecord) => void;
}

export function ReconciliationTable({ customers, records, onSaved }: ReconciliationTableProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
  }, [customers, query]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث عن عميل..."
          className="w-full max-w-xs rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-right text-[var(--ink-muted)]">
              <th className="whitespace-nowrap px-4 py-2 font-medium">العميل</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">الرصيد الحالي</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">المطابق</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">تاريخ آخر مطابقة</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const record = records[c.id];
              const isEditing = editingId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/customers/${c.id}`} className="hover:text-[var(--brand)] hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatSar(c.totalOutstanding)}</td>
                    <td className="px-4 py-2.5">{record ? record.reconciledBy : <span className="text-[var(--ink-muted)]">لم تتم المطابقة</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums">{record ? formatDate(record.reconciledAt) : "-"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingId(isEditing ? null : c.id)}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs hover:bg-[var(--hover)]"
                        >
                          <UserCheck size={13} />
                          {record ? "تحديث المطابقة" : "تسجيل مطابقة"}
                        </button>
                        <Link
                          href={`/customers/${c.id}/confirmation`}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs hover:bg-[var(--hover)]"
                        >
                          <FileCheck2 size={13} />
                          نموذج مصادقة رصيد
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {isEditing ? (
                    <tr className="border-b border-[var(--border)] bg-[var(--hover)]">
                      <td colSpan={5} className="px-4 py-3">
                        <ReconciliationForm
                          customer={c}
                          existing={record}
                          onCancel={() => setEditingId(null)}
                          onSaved={(saved) => {
                            onSaved(saved);
                            setEditingId(null);
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                  لا يوجد عملاء مطابقون
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReconciliationForm({
  customer,
  existing,
  onCancel,
  onSaved,
}: {
  customer: CustomerAnalysis;
  existing?: ReconciliationRecord;
  onCancel: () => void;
  onSaved: (record: ReconciliationRecord) => void;
}) {
  const [reconciledBy, setReconciledBy] = useState(existing?.reconciledBy ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reconciledBy.trim()) {
      setError("الرجاء إدخال اسم المطابق");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}/reconciliation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciledBy: reconciledBy.trim(),
          customerName: customer.name,
          balance: customer.totalOutstanding,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      onSaved(data.record as ReconciliationRecord);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[var(--ink-muted)]">اسم المطابق</label>
        <input
          value={reconciledBy}
          onChange={(e) => setReconciledBy(e.target.value)}
          placeholder="اسم الموظف"
          className="w-48 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        />
      </div>
      <div className="flex flex-1 min-w-[12rem] flex-col gap-1">
        <label className="text-xs text-[var(--ink-muted)]">ملاحظات (اختياري)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات عن المطابقة"
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
        />
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "جارٍ الحفظ..." : "حفظ"}
      </button>
      <button onClick={onCancel} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm hover:bg-[var(--surface)]">
        إلغاء
      </button>
      {error ? <span className="text-xs" style={{ color: "var(--status-critical)" }}>{error}</span> : null}
    </div>
  );
}
