"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchParentTasksPageData,
  type ParentTasksData,
} from "@/lib/parent/fetch-parent-tab-page-data";
import { parentQueryKeys } from "@/lib/parent/query-keys";
import { PARENT_STALE_MS } from "@/lib/query/constants";

export type { ParentTasksData };

export function parentTasksPageQueryKey(familyId: string) {
  return [...parentQueryKeys.tasks(familyId), "page"] as const;
}

export function useParentTasksData(familyId: string) {
  return useQuery({
    queryKey: parentTasksPageQueryKey(familyId),
    queryFn: () => fetchParentTasksPageData(familyId),
    staleTime: PARENT_STALE_MS,
  });
}
