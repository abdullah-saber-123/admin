"use client";

import { useEffect, useState } from "react";
import type { CustomerAnalysis } from "@/lib/types";
import { CustomersTable } from "@/components/CustomersTable";
import { LoadingView, ErrorView } from "@/components/StateViews";
import { SyncStatus } from "@/components/SyncStatus";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerAnalysis[] | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function load(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    fetch(`/api/customers${forceRefresh ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setCustomers(data.customers);
          setSyncedAt(data.syncedAt ?? null);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    load(false);
  }, []);

  if (error) return <ErrorView message={error} />;
  if (!customers) return <LoadingView />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">العملاء</h1>
          <p className="text-sm text-[var(--ink-muted)]">{customers.length} عميل لديهم حركة فواتير أو رصيد مستحق</p>
        </div>
        <SyncStatus syncedAt={syncedAt} refreshing={refreshing} onRefresh={() => load(true)} />
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
