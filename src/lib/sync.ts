import { after } from "next/server";
import { getAllCustomerAnalyses } from "./analytics";
import { cached, invalidateCache } from "./cache";
import { isBlobConfigured, loadSnapshot, saveSnapshot, type CustomerSnapshot } from "./store";

const CACHE_KEY = "customers-snapshot";
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function runFullSync(): Promise<CustomerSnapshot> {
  const customers = await getAllCustomerAnalyses();
  const snapshot = isBlobConfigured() ? await saveSnapshot(customers) : { syncedAt: new Date().toISOString(), customers };
  invalidateCache(CACHE_KEY);
  return snapshot;
}

async function readCachedOrLiveSnapshot(): Promise<CustomerSnapshot> {
  return cached(CACHE_KEY, CACHE_TTL_MS, async () => {
    const stored = await loadSnapshot();
    if (stored) return stored;
    return runFullSync();
  });
}

export interface SnapshotResult extends CustomerSnapshot {
  /** true when this response is the last known snapshot while a fresh sync runs in the background */
  refreshing: boolean;
}

/**
 * Never makes the caller wait on a full Odoo sync (which can take a while
 * over 600+ customers). A forced refresh serves the current snapshot
 * immediately and kicks the real sync off in the background via
 * `after()`, so the page updates on its next load/poll instead of the
 * button spinning for the whole sync duration.
 */
export async function getCustomersSnapshot(forceRefresh = false): Promise<SnapshotResult> {
  const snapshot = await readCachedOrLiveSnapshot();

  if (forceRefresh) {
    after(() => runFullSync());
    return { ...snapshot, refreshing: true };
  }

  return { ...snapshot, refreshing: false };
}
