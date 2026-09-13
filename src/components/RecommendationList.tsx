import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { Recommendation } from "@/lib/types";

const severityMeta = {
  critical: { color: "var(--status-critical)", icon: OctagonAlert },
  warning: { color: "var(--status-warning)", icon: AlertTriangle },
  info: { color: "var(--brand)", icon: Info },
  positive: { color: "var(--status-good)", icon: CheckCircle2 },
} as const;

export function RecommendationList({ items }: { items: Recommendation[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((rec, i) => {
        const meta = severityMeta[rec.severity];
        const Icon = meta.icon;
        return (
          <li
            key={i}
            className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
            >
              <Icon size={14} />
            </span>
            <div>
              <div className="text-sm font-bold text-[var(--ink)]">{rec.title}</div>
              <div className="mt-0.5 text-sm text-[var(--ink-secondary)]">{rec.detail}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
