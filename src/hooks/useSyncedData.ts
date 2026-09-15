"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SyncedResponse {
  error?: string;
  syncedAt?: string | null;
  refreshing?: boolean;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24; // ~2 minutes

/**
 * Fetches `url`, showing the last known data immediately instead of a
 * blocking spinner. Calling `refresh()` re-fetches with ?refresh=1, which
 * kicks off a background Odoo sync server-side and returns the still-stale
 * snapshot right away - this hook then polls quietly until `syncedAt`
 * actually moves forward (or gives up after ~2 minutes), so the page never
 * blocks on a full 600+ customer sync.
 */
export function useSyncedData<T extends SyncedResponse>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const fetchOnce = useCallback(
    async (forceRefresh: boolean): Promise<T | null> => {
      const res = await fetch(`${url}${forceRefresh ? "?refresh=1" : ""}`);
      const json = (await res.json()) as T;
      if (json.error) {
        setError(json.error);
        return null;
      }
      setError(null);
      setData(json);
      return json;
    },
    [url]
  );

  const pollUntilFresh = useCallback(
    (baselineSyncedAt: string | null | undefined) => {
      attempts.current = 0;
      const tick = () => {
        attempts.current += 1;
        fetchOnce(false).then((json) => {
          const isFresh = json?.syncedAt && json.syncedAt !== baselineSyncedAt;
          if (isFresh || attempts.current >= MAX_POLL_ATTEMPTS) {
            setRefreshing(false);
            stopPolling();
          } else {
            pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
          }
        });
      };
      pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
    },
    [fetchOnce, stopPolling]
  );

  const load = useCallback(
    (forceRefresh = false) => {
      stopPolling();
      const baseline = data?.syncedAt;
      if (forceRefresh) setRefreshing(true);
      fetchOnce(forceRefresh).then((json) => {
        if (forceRefresh && json) pollUntilFresh(baseline);
        else if (!forceRefresh) setRefreshing(Boolean(json?.refreshing));
      });
    },
    [data?.syncedAt, fetchOnce, pollUntilFresh, stopPolling]
  );

  useEffect(() => {
    load(false);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, error, refreshing, refresh: () => load(true) };
}
