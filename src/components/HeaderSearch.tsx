"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { CustomerAnalysis } from "@/lib/types";
import { GradeBadge } from "./GradeBadge";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerAnalysis[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function ensureLoaded() {
    if (customers !== null) return;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => setCustomers(data.customers ?? []))
      .catch(() => setCustomers([]));
  }

  const q = query.trim().toLowerCase();
  const results =
    q.length > 0 && customers
      ? customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              (c.phone ?? "").toLowerCase().includes(q) ||
              (c.email ?? "").toLowerCase().includes(q)
          )
          .slice(0, 8)
      : [];

  function goTo(id: number) {
    setOpen(false);
    setQuery("");
    router.push(`/customers/${id}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--page)] px-3 py-1.5">
        <Search size={15} className="text-[var(--ink-muted)]" />
        <input
          value={query}
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            ensureLoaded();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) goTo(results[0].id);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="ابحث عن عميل بالاسم أو الجوال..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--ink-muted)]"
        />
      </div>

      {open && q.length > 0 ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {customers === null ? (
            <div className="px-3 py-3 text-sm text-[var(--ink-muted)]">جارٍ التحميل...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--ink-muted)]">لا يوجد عميل مطابق</div>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => goTo(c.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-[var(--hover)]"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{c.name}</span>
                      {c.phone ? <span className="text-xs text-[var(--ink-muted)]">{c.phone}</span> : null}
                    </span>
                    <GradeBadge grade={c.grade} showLabel={false} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
