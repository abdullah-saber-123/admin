import type { RatingGrade } from "@/lib/types";

const gradeMeta: Record<RatingGrade, { color: string; label: string }> = {
  A: { color: "var(--grade-a)", label: "ممتاز" },
  B: { color: "var(--grade-b)", label: "جيد" },
  C: { color: "var(--grade-c)", label: "متوسط" },
  D: { color: "var(--grade-d)", label: "ضعيف" },
};

export function GradeBadge({ grade, showLabel = true }: { grade: RatingGrade; showLabel?: boolean }) {
  const meta = gradeMeta[grade];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style={{ backgroundColor: meta.color, color: "#fff" }}>
        {grade}
      </span>
      {showLabel ? meta.label : null}
    </span>
  );
}
