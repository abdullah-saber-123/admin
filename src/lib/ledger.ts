import { odooSearchRead, odooSearchReadAll } from "./odoo";
import type { LedgerEntry, PartnerLedger } from "./types";

interface PartnerAccountInfo {
  id: number;
  name: string;
  property_account_receivable_id: [number, string] | false;
}

interface MoveLine {
  id: number;
  date: string;
  move_id: [number, string] | false;
  name: string | false;
  ref: string | false;
  debit: number;
  credit: number;
  full_reconcile_id: [number, string] | false;
}

export async function getPartnerLedger(partnerId: number): Promise<PartnerLedger | null> {
  const partners = await odooSearchRead<PartnerAccountInfo>(
    "res.partner",
    [["id", "=", partnerId]],
    ["id", "name", "property_account_receivable_id"]
  );
  const partner = partners[0];
  if (!partner) return null;

  const receivableAccountId = partner.property_account_receivable_id
    ? partner.property_account_receivable_id[0]
    : null;

  const domain: unknown[] = [
    ["partner_id", "=", partnerId],
    ["parent_state", "=", "posted"],
  ];
  if (receivableAccountId) {
    domain.push(["account_id", "=", receivableAccountId]);
  } else {
    domain.push(["account_id.account_type", "in", ["asset_receivable", "liability_payable"]]);
  }

  let lines: MoveLine[];
  try {
    lines = await odooSearchReadAll<MoveLine>(
      "account.move.line",
      domain,
      ["id", "date", "move_id", "name", "ref", "debit", "credit", "full_reconcile_id"],
      { order: "date asc, id asc" }
    );
  } catch (err) {
    if (receivableAccountId || !String(err).includes("account_type")) throw err;
    const fallbackDomain = [
      ["partner_id", "=", partnerId],
      ["parent_state", "=", "posted"],
      ["account_id.internal_type", "in", ["receivable", "payable"]],
    ];
    lines = await odooSearchReadAll<MoveLine>(
      "account.move.line",
      fallbackDomain,
      ["id", "date", "move_id", "name", "ref", "debit", "credit", "full_reconcile_id"],
      { order: "date asc, id asc" }
    );
  }

  let balance = 0;
  const entries: LedgerEntry[] = lines.map((line) => {
    balance += line.debit - line.credit;
    return {
      id: line.id,
      date: line.date,
      moveName: line.move_id ? line.move_id[1] : "",
      label: line.name || line.ref || "-",
      ref: line.ref || null,
      debit: line.debit,
      credit: line.credit,
      balance,
      reconciled: Boolean(line.full_reconcile_id),
    };
  });

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    openingBalance: 0,
    closingBalance: balance,
    entries,
  };
}
