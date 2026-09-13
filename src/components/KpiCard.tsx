import { type LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const toneColor =
    tone === "good"
      ? "var(--status-good)"
      : tone === "warning"
        ? "var(--status-warning)"
        : tone === "critical"
          ? "var(--status-critical)"
          : "var(--brand)";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm text-[var(--ink-muted)]">{label}</span>
        {Icon ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${toneColor}1a`, color: toneColor }}
          >
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-[var(--ink)]">{value}</div>
      {sub ? <div className="mt-1 text-xs text-[var(--ink-muted)]">{sub}</div> : null}
    </div>
  );
}
