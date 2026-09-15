import { odooSearchReadAll } from "./odoo";
import { buildPartnerFamilies } from "./partner-family";

export interface ReceivableLine {
  date: string;
  dateMaturity: string | null;
  debit: number;
  credit: number;
  amountResidual: number;
}

interface PartnerAccountRow {
  id: number;
  property_account_receivable_id: [number, string] | false;
}

interface RawLine {
  id: number;
  partner_id: [number, string] | false;
  date: string;
  date_maturity: string | false;
  debit: number;
  credit: number;
  amount_residual: number;
}

/**
 * Every journal item on each customer's own receivable account
 * (property_account_receivable_id) - opening balance, invoices, payments,
 * and credit notes/returns together, in one feed. This is exactly the data
 * behind Odoo's own Partner Ledger report (/odoo/partner-ledger), and the
 * only source that reliably includes payments across every Odoo version:
 * unlike account.payment, whose `state`/`partner_type` fields and exact
 * partner (a branch contact vs. the parent company) vary, every payment
 * still posts a journal entry on this exact account.
 */
export async function fetchReceivableLinesForCustomers(customerIds: number[]): Promise<Map<number, ReceivableLine[]>> {
  const result = new Map<number, ReceivableLine[]>();
  if (customerIds.length === 0) return result;

  const { familyIds, ownerOf } = await buildPartnerFamilies(customerIds);

  const partnerRows = await odooSearchReadAll<PartnerAccountRow>(
    "res.partner",
    [["id", "in", familyIds]],
    ["id", "property_account_receivable_id"]
  );
  const accountIds = Array.from(
    new Set(
      partnerRows
        .map((p) => (p.property_account_receivable_id ? p.property_account_receivable_id[0] : null))
        .filter((x): x is number => x !== null)
    )
  );
  if (accountIds.length === 0) return result;

  const lines = await odooSearchReadAll<RawLine>(
    "account.move.line",
    [
      ["account_id", "in", accountIds],
      ["partner_id", "in", familyIds],
      ["parent_state", "=", "posted"],
    ],
    ["id", "partner_id", "date", "date_maturity", "debit", "credit", "amount_residual"],
    { order: "date asc, id asc" }
  );

  for (const line of lines) {
    if (!line.partner_id) continue;
    const owner = ownerOf.get(line.partner_id[0]) ?? line.partner_id[0];
    if (!result.has(owner)) result.set(owner, []);
    result.get(owner)!.push({
      date: line.date,
      dateMaturity: line.date_maturity || null,
      debit: line.debit,
      credit: line.credit,
      amountResidual: line.amount_residual,
    });
  }

  return result;
}
