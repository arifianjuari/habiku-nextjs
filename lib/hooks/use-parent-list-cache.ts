"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PARENT_STALE_MS } from "@/lib/query/constants";

type CacheEntry<T> = {
  value: T;
  ts: number;
};

export function useParentListCache<T>(
  queryKey: readonly unknown[],
  serverData: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const queryClient = useQueryClient();
  const entryKey = [...queryKey, "stale-entry"] as const;

  const [data, setDataState] = useState<T>(() => {
    const entry = queryClient.getQueryData<CacheEntry<T>>(entryKey);
    if (entry && Date.now() - entry.ts < PARENT_STALE_MS) {
      return entry.value;
    }
    return serverData;
  });

  const setData = useCallback(
    (value: T | ((prev: T) => T)) => {
      setDataState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        queryClient.setQueryData<CacheEntry<T>>(entryKey, {
          value: next,
          ts: Date.now(),
        });
        return next;
      });
    },
    [entryKey, queryClient],
  );

  useEffect(() => {
    const entry = queryClient.getQueryData<CacheEntry<T>>(entryKey);
    if (!entry || Date.now() - entry.ts >= PARENT_STALE_MS) {
      queryClient.setQueryData<CacheEntry<T>>(entryKey, {
        value: serverData,
        ts: Date.now(),
      });
      setDataState(serverData);
    }
  }, [serverData, entryKey, queryClient]);

  return [data, setData];
}
