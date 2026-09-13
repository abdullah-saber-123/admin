import { NextResponse } from "next/server";
import { buildDashboardSummary, getAllCustomerAnalyses } from "@/lib/analytics";
import { cached, invalidateCache } from "@/lib/cache";
import { isOdooConfigured } from "@/lib/odoo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isOdooConfigured()) {
    return NextResponse.json({ error: "لم يتم إعداد بيانات اتصال أودو (.env.local)" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("refresh") === "1") invalidateCache("customers");

  try {
    const customers = await cached("customers", 5 * 60 * 1000, getAllCustomerAnalyses);
    const summary = buildDashboardSummary(customers);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطأ غير معروف" }, { status: 502 });
  }
}
