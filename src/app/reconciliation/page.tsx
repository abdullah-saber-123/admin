"use client";

import { useEffect, useState } from "react";
import type { CustomerAnalysis, ReconciliationRecord } from "@/lib/types";
import { LoadingView, ErrorView } from "@/components/StateViews";
import { ReconciliationTable } from "@/components/ReconciliationTable";
import { SyncStatus } from "@/components/SyncStatus";
import { useSyncedData } from "@/hooks/useSyncedData";

interface CustomersResponse {
  error?: string;
  customers: CustomerAnalysis[];
  syncedAt: string | null;
  refreshing?: boolean;
}

export default function ReconciliationPage() {
  const { data, error, refreshing, refresh } = useSyncedData<CustomersResponse>("/api/customers");
  const [records, setRecords] = useState<Record<number, ReconciliationRecord> | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reconciliation")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.records ?? []) as ReconciliationRecord[];
        setRecords(Object.fromEntries(list.map((r) => [r.customerId, r])));
      })
      .catch((e) => setRecordsError(String(e)));
  }, []);

  if (error) return <ErrorView message={error} />;
  if (recordsError) return <ErrorView message={recordsError} />;
  if (!data || !records) return <LoadingView />;

  const customers = data.customers;
  const reconciledCount = customers.filter((c) => records[c.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">المطابقات</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            {reconciledCount} من {customers.length} عميل تمت مطابقة رصيده
          </p>
        </div>
        <SyncStatus syncedAt={data.syncedAt} refreshing={refreshing} onRefresh={refresh} />
      </div>
      <ReconciliationTable
        customers={customers}
        records={records}
        onSaved={(record) => setRecords((prev) => ({ ...(prev ?? {}), [record.customerId]: record }))}
      />
    </div>
  );
}
