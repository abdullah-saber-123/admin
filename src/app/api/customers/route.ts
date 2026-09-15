import { NextResponse } from "next/server";
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
    return NextResponse.json({ customers: snapshot.customers, syncedAt: snapshot.syncedAt, refreshing: snapshot.refreshing });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطأ غير معروف" }, { status: 502 });
  }
}
