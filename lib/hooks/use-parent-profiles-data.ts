"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentProfilesPageData,
  type ParentProfilesData,
} from "@/lib/parent/fetch-parent-tab-page-data";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export type { ParentProfilesData };

export function parentProfilesPageQueryKey(familyId: string) {
  return [...parentQueryKeys.profiles(familyId), "page"] as const;
}

export function useParentProfilesData(familyId: string) {
  return useQuery({
    queryKey: parentProfilesPageQueryKey(familyId),
    queryFn: () => fetchParentProfilesPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
