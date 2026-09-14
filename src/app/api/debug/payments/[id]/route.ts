import { NextResponse } from "next/server";
import { odooSearchReadAll } from "@/lib/odoo";
import { buildPartnerFamilies } from "@/lib/partner-family";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RawPayment {
  id: number;
  partner_id: [number, string] | false;
  partner_type: string | false;
  payment_type: string;
  state: string;
  amount: number;
  date: string;
  ref: string | false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const partnerId = Number(id);
  if (!Number.isFinite(partnerId)) {
    return NextResponse.json({ error: "معرّف عميل غير صالح" }, { status: 400 });
  }

  try {
    const { familyIds, ownerOf } = await buildPartnerFamilies([partnerId]);

    // No filters at all beyond the id set, so we can see exactly what
    // exists before any of our domain assumptions are applied.
    const raw = await odooSearchReadAll<RawPayment>(
      "account.payment",
      [["partner_id", "in", familyIds]],
      ["id", "partner_id", "partner_type", "payment_type", "state", "amount", "date", "ref"],
      { order: "date desc" }
    );

    const distinctStates = Array.from(new Set(raw.map((p) => p.state))).sort();
    const distinctPaymentTypes = Array.from(new Set(raw.map((p) => p.payment_type))).sort();
    const distinctPartnerTypes = Array.from(new Set(raw.map((p) => String(p.partner_type)))).sort();

    const inboundOnly = raw.filter((p) => p.payment_type === "inbound");
    const currentDomainMatch = raw.filter(
      (p) =>
        p.payment_type === "inbound" &&
        p.partner_type === "customer" &&
        !["cancel", "canceled", "cancelled"].includes(p.state)
    );

    return NextResponse.json({
      requestedPartnerId: partnerId,
      familyIds,
      familyOwnerMap: Array.from(ownerOf.entries()),
      totalPaymentsForFamilyAnyFilter: raw.length,
      totalAmountAnyFilter: raw.reduce((s, p) => s + p.amount, 0),
      inboundCount: inboundOnly.length,
      inboundAmount: inboundOnly.reduce((s, p) => s + p.amount, 0),
      currentAppLogicCount: currentDomainMatch.length,
      currentAppLogicAmount: currentDomainMatch.reduce((s, p) => s + p.amount, 0),
      distinctStates,
      distinctPaymentTypes,
      distinctPartnerTypes,
      sample: raw.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
