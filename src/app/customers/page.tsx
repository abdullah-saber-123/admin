"use client";

import { useEffect, useState } from "react";
import type { CustomerAnalysis } from "@/lib/types";
import { CustomersTable } from "@/components/CustomersTable";
import { LoadingView, ErrorView } from "@/components/StateViews";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCustomers(data.customers);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorView message={error} />;
  if (!customers) return <LoadingView />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">العملاء</h1>
        <p className="text-sm text-[var(--ink-muted)]">{customers.length} عميل لديهم حركة فواتير أو رصيد مستحق</p>
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
