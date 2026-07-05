"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentTargetsPageData,
  type ParentTargetsData,
} from "@/lib/parent/fetch-parent-tab-page-data";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export type { ParentTargetsData };

export function parentTargetsPageQueryKey(familyId: string) {
  return [...parentQueryKeys.targets(familyId), "page"] as const;
}

export function useParentTargetsData(familyId: string) {
  return useQuery({
    queryKey: parentTargetsPageQueryKey(familyId),
    queryFn: () => fetchParentTargetsPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
