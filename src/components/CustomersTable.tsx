"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CustomerAnalysis } from "@/lib/types";
import { formatPct, formatSar } from "@/lib/format";
import { GradeBadge } from "./GradeBadge";

type SortKey = "name" | "score" | "totalSales" | "totalOutstanding" | "commitmentPct" | "paymentRatePct";

export function CustomersTable({ customers }: { customers: CustomerAnalysis[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers.slice();
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name, "ar") * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return list;
  }, [customers, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "العميل" },
    { key: "score", label: "التقييم" },
    { key: "totalSales", label: "المبيعات" },
    { key: "totalOutstanding", label: "الرصيد المستحق" },
    { key: "commitmentPct", label: "الالتزام" },
    { key: "paymentRatePct", label: "معدل السداد" },
  ];

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
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="cursor-pointer select-none whitespace-nowrap px-4 py-2 font-medium hover:text-[var(--ink)]"
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]">
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:text-[var(--brand)] hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <GradeBadge grade={c.grade} />
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatSar(c.totalSales)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatSar(c.totalOutstanding)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatPct(c.commitmentPct)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatPct(c.paymentRatePct)}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--ink-muted)]">
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
