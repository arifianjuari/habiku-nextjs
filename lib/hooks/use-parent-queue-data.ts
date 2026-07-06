"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchParentQueuePageData } from "@/lib/parent/fetch-parent-queue-client";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export function parentQueuePageQueryKey(familyId: string) {
  return [...parentQueryKeys.queue(familyId), "page"] as const;
}

export function useParentQueueData(familyId: string) {
  return useQuery({
    queryKey: parentQueuePageQueryKey(familyId),
    queryFn: () => fetchParentQueuePageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
