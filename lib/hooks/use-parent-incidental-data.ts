"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentIncidentalPageData,
  type ParentIncidentalData,
} from "@/lib/parent/fetch-parent-incidental-client";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export type { ParentIncidentalData };

export function parentIncidentalPageQueryKey(familyId: string) {
  return [...parentQueryKeys.incidental(familyId), "page"] as const;
}

export function useParentIncidentalData(familyId: string) {
  return useQuery({
    queryKey: parentIncidentalPageQueryKey(familyId),
    queryFn: () => fetchParentIncidentalPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
