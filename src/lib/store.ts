import { head, put } from "@vercel/blob";
import type { CustomerAnalysis, ReconciliationRecord } from "./types";

const SNAPSHOT_PATH = "sync/customers-snapshot.json";
const RECONCILIATION_PATH = "reconciliation/records.json";

export interface CustomerSnapshot {
  syncedAt: string;
  customers: CustomerAnalysis[];
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function saveSnapshot(customers: CustomerAnalysis[]): Promise<CustomerSnapshot> {
  const snapshot: CustomerSnapshot = { syncedAt: new Date().toISOString(), customers };
  await put(SNAPSHOT_PATH, JSON.stringify(snapshot), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return snapshot;
}

export async function loadSnapshot(): Promise<CustomerSnapshot | null> {
  if (!isBlobConfigured()) return null;
  try {
    const meta = await head(SNAPSHOT_PATH);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CustomerSnapshot;
  } catch {
    return null;
  }
}

export async function loadReconciliations(): Promise<Record<number, ReconciliationRecord>> {
  if (!isBlobConfigured()) return {};
  try {
    const meta = await head(RECONCILIATION_PATH);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as { records: Record<number, ReconciliationRecord> };
    return data.records ?? {};
  } catch {
    return {};
  }
}

export async function saveReconciliation(record: ReconciliationRecord): Promise<Record<number, ReconciliationRecord>> {
  const records = await loadReconciliations();
  records[record.customerId] = record;
  await put(RECONCILIATION_PATH, JSON.stringify({ records }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return records;
}
