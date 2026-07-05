"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchParentSavingsPageData } from "@/lib/parent/fetch-parent-tab-page-data";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";
import type { ParentSavingsData } from "@/lib/savings/types";

export function parentSavingsPageQueryKey(familyId: string) {
  return [...parentQueryKeys.savings(familyId), "page"] as const;
}

export function useParentSavingsData(familyId: string) {
  return useQuery({
    queryKey: parentSavingsPageQueryKey(familyId),
    queryFn: () => fetchParentSavingsPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
