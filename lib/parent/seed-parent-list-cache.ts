import type { QueryClient } from "@tanstack/react-query";

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
