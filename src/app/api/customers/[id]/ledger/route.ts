import { NextResponse } from "next/server";
import { getPartnerLedger } from "@/lib/ledger";
import { isOdooConfigured } from "@/lib/odoo";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isOdooConfigured()) {
    return NextResponse.json({ error: "لم يتم إعداد بيانات اتصال أودو (.env.local)" }, { status: 500 });
  }

  const { id } = await params;
  const partnerId = Number(id);
  if (!Number.isFinite(partnerId)) {
    return NextResponse.json({ error: "معرّف عميل غير صالح" }, { status: 400 });
  }

  try {
    const ledger = await getPartnerLedger(partnerId);
    if (!ledger) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ ledger });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "خطأ غير معروف" }, { status: 502 });
  }
}
