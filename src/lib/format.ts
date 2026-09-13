export function formatSar(value: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(value)) + " ر.س";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatPct(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("ar-SA", { month: "short", year: "2-digit" }).format(d);
}
