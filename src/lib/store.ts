import { head, put } from "@vercel/blob";
import type { CustomerAnalysis } from "./types";

const SNAPSHOT_PATH = "sync/customers-snapshot.json";

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
