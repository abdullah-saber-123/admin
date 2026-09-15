import { NextResponse } from "next/server";
import { loadReconciliations } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const records = await loadReconciliations();
  return NextResponse.json({ records: Object.values(records) });
}
