import { Loader2, TriangleAlert } from "lucide-react";

export function LoadingView({ label = "جارٍ تحميل البيانات من أودو..." }: { label?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-[var(--ink-muted)]">
      <Loader2 className="animate-spin" size={28} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-center">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--status-critical) 15%, transparent)", color: "var(--status-critical)" }}
      >
        <TriangleAlert size={20} />
      </span>
      <div className="text-sm font-medium text-[var(--ink)]">تعذّر جلب البيانات</div>
      <div className="max-w-md px-4 text-xs text-[var(--ink-muted)]">{message}</div>
    </div>
  );
}
