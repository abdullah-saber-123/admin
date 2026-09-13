"use client";

import { RefreshCw } from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `منذ ${days} يوم`;
}

export function SyncStatus({
  syncedAt,
  refreshing,
  onRefresh,
}: {
  syncedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
      {syncedAt ? <span>آخر تحديث: {timeAgo(syncedAt)}</span> : null}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-2.5 py-1 hover:bg-[var(--hover)] disabled:opacity-50"
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
        {refreshing ? "جارٍ التحديث..." : "تحديث الآن"}
      </button>
    </div>
  );
}
