import type { QueryClient } from "@tanstack/react-query";
import { PARENT_STALE_MS } from "@/lib/query/constants";

type CacheEntry<T> = {
  value: T;
  ts: number;
};

export function seedParentListCache<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  value: T,
) {
  const entryKey = [...queryKey, "stale-entry"] as const;
  queryClient.setQueryData<CacheEntry<T>>(entryKey, {
    value,
    ts: Date.now(),
  });
}

export function readParentListCache<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): T | null {
  const entryKey = [...queryKey, "stale-entry"] as const;
  const entry = queryClient.getQueryData<CacheEntry<T>>(entryKey);
  if (!entry || Date.now() - entry.ts >= PARENT_STALE_MS) return null;
  return entry.value;
}
