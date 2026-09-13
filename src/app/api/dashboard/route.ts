import { NextResponse } from "next/server";
import { buildDashboardSummary } from "@/lib/analytics";
import { isOdooConfigured } from "@/lib/odoo";
import { getCustomersSnapshot } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isOdooConfigured()) {
    return NextResponse.json({ error: "لم يتم إعداد بيانات اتصال أودو (.env.local)" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  try {
    const snapshot = await getCustomersSnapshot(forceRefresh);
    const summary = buildDashboardSummary(snapshot.customers);
    return NextResponse.json({ summary, syncedAt: snapshot.syncedAt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطأ غير معروف" }, { status: 502 });
  }
}
