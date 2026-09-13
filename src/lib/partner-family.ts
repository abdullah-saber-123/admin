import { odooSearchReadAll } from "./odoo";

export interface PartnerFamily {
  /** Every partner id whose activity should count toward one of the input customers - the customers themselves plus their child contacts (branches, delivery/invoice addresses). */
  familyIds: number[];
  /** Maps any id in familyIds back to the top-level customer id it belongs to. */
  ownerOf: Map<number, number>;
}

interface CommercialPartnerRow {
  id: number;
  commercial_partner_id: [number, string] | false;
}

/**
 * Odoo often books invoices against a customer's top-level company record
 * while payments get recorded against one of its child contacts (a branch,
 * or a delivery/invoice address) - both share the same commercial_partner_id.
 * Without expanding to the full family, a payment tied to a child contact
 * silently never matches when we filter account.payment by the parent's id.
 */
export async function buildPartnerFamilies(partnerIds: number[]): Promise<PartnerFamily> {
  if (partnerIds.length === 0) return { familyIds: [], ownerOf: new Map() };

  const rows = await odooSearchReadAll<CommercialPartnerRow>(
    "res.partner",
    [["commercial_partner_id", "in", partnerIds]],
    ["id", "commercial_partner_id"]
  );

  const ownerOf = new Map<number, number>();
  for (const row of rows) {
    const owner = row.commercial_partner_id ? row.commercial_partner_id[0] : row.id;
    ownerOf.set(row.id, owner);
  }
  for (const id of partnerIds) {
    if (!ownerOf.has(id)) ownerOf.set(id, id);
  }

  return { familyIds: Array.from(ownerOf.keys()), ownerOf };
}
