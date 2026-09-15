import { odooSearchReadAll } from "./odoo";
import { buildPartnerFamilies } from "./partner-family";

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

export async function diagnosePayments(partnerId: number, partnerName?: string) {
  const { familyIds, ownerOf } = await buildPartnerFamilies([partnerId]);

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
    (p) => p.payment_type === "inbound" && p.partner_type === "customer" && !["cancel", "canceled", "cancelled"].includes(p.state)
  );

  return {
    partnerId,
    partnerName,
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
  };
}
