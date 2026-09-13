import { getAllCustomerAnalyses } from "./analytics";
import { cached } from "./cache";
import { isBlobConfigured, loadSnapshot, saveSnapshot, type CustomerSnapshot } from "./store";

export async function runFullSync(): Promise<CustomerSnapshot> {
  const customers = await getAllCustomerAnalyses();
  if (isBlobConfigured()) {
    return saveSnapshot(customers);
  }
  return { syncedAt: new Date().toISOString(), customers };
}

export async function getCustomersSnapshot(forceRefresh = false): Promise<CustomerSnapshot> {
  if (forceRefresh) {
    const snapshot = await runFullSync();
    return snapshot;
  }

  return cached("customers-snapshot", 2 * 60 * 1000, async () => {
    const stored = await loadSnapshot();
    if (stored) return stored;
    return runFullSync();
  });
}
