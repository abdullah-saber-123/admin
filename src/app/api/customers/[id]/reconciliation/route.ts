import { NextResponse } from "next/server";
import { isBlobConfigured, loadReconciliations, saveReconciliation } from "@/lib/store";
import type { ReconciliationRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "معرّف عميل غير صالح" }, { status: 400 });
  }

  const records = await loadReconciliations();
  return NextResponse.json({ record: records[customerId] ?? null });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) {
    return NextResponse.json({ error: "معرّف عميل غير صالح" }, { status: 400 });
  }

  if (!isBlobConfigured()) {
    return NextResponse.json({ error: "لم يتم إعداد التخزين (BLOB_READ_WRITE_TOKEN)" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const reconciledBy = typeof body?.reconciledBy === "string" ? body.reconciledBy.trim() : "";
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const balance = typeof body?.balance === "number" ? body.balance : 0;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!reconciledBy) {
    return NextResponse.json({ error: "اسم المطابق مطلوب" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const record: ReconciliationRecord = {
    customerId,
    customerName,
    reconciledBy,
    reconciledAt: now,
    balance,
    notes,
    updatedAt: now,
  };

  try {
    await saveReconciliation(record);
    return NextResponse.json({ record });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطأ غير معروف" }, { status: 502 });
  }
}
