"use client";

import type { CustomerAnalysis } from "@/lib/types";
import { CustomersTable } from "@/components/CustomersTable";
import { LoadingView, ErrorView } from "@/components/StateViews";
import { SyncStatus } from "@/components/SyncStatus";
import { useSyncedData } from "@/hooks/useSyncedData";

interface CustomersResponse {
  error?: string;
  customers: CustomerAnalysis[];
  syncedAt: string | null;
  refreshing?: boolean;
}

export default function CustomersPage() {
  const { data, error, refreshing, refresh } = useSyncedData<CustomersResponse>("/api/customers");

  if (error) return <ErrorView message={error} />;
  if (!data) return <LoadingView />;

  const customers = data.customers;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">العملاء</h1>
          <p className="text-sm text-[var(--ink-muted)]">{customers.length} عميل لديهم حركة فواتير أو رصيد مستحق</p>
        </div>
        <SyncStatus syncedAt={data.syncedAt} refreshing={refreshing} onRefresh={refresh} />
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
