import { NextResponse } from "next/server";
import { diagnosePayments } from "@/lib/debug-payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partnerId = Number(id);
  if (!Number.isFinite(partnerId)) {
    return NextResponse.json({ error: "معرّف عميل غير صالح" }, { status: 400 });
  }

  try {
    const result = await diagnosePayments(partnerId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
