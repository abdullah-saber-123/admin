const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(key?: string) {
  if (key) store.delete(key);
  else store.clear();
}
