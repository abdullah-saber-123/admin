import { odooSearchReadAll } from "./odoo";

export interface ReceivableLine {
  id: number;
  partnerId: number;
  date: string;
  dateMaturity: string | null;
  debit: number;
  credit: number;
  amountResidual: number;
  reconciled: boolean;
}

interface RawMoveLine {
  id: number;
  partner_id: [number, string] | false;
  date: string;
  date_maturity: string | false;
  debit: number;
  credit: number;
  amount_residual: number;
  full_reconcile_id: [number, string] | false;
}

const FIELDS = ["id", "partner_id", "date", "date_maturity", "debit", "credit", "amount_residual", "full_reconcile_id"];

function mapLines(raw: RawMoveLine[]): ReceivableLine[] {
  return raw
    .filter((l): l is RawMoveLine & { partner_id: [number, string] } => Boolean(l.partner_id))
    .map((l) => ({
      id: l.id,
      partnerId: l.partner_id[0],
      date: l.date,
      dateMaturity: l.date_maturity || null,
      debit: l.debit,
      credit: l.credit,
      amountResidual: l.amount_residual,
      reconciled: Boolean(l.full_reconcile_id),
    }));
}

/**
 * Journal items on customers' receivable accounts - the same source Odoo's own
 * Partner Ledger / Aged Receivable reports read from. Used instead of
 * invoice-level fields so outstanding balance, aging, and commitment always
 * match what the accounting team sees in Odoo (manual entries, write-offs,
 * and partial reconciliations included).
 */
export async function fetchReceivableLines(partnerIds?: number[]): Promise<ReceivableLine[]> {
  const domain: unknown[] = [["parent_state", "=", "posted"]];
  if (partnerIds?.length) domain.push(["partner_id", "in", partnerIds]);

  try {
    const raw = await odooSearchReadAll<RawMoveLine>(
      "account.move.line",
      [...domain, ["account_id.account_type", "=", "asset_receivable"]],
      FIELDS,
      { order: "date asc, id asc" }
    );
    return mapLines(raw);
  } catch (err) {
    if (!String(err).includes("account_type")) throw err;
    const raw = await odooSearchReadAll<RawMoveLine>(
      "account.move.line",
      [...domain, ["account_id.internal_type", "=", "receivable"]],
      FIELDS,
      { order: "date asc, id asc" }
    );
    return mapLines(raw);
  }
}
