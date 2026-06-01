"use client";

import { useQuery } from "@tanstack/react-query";
import { childQueryKeys } from "@/lib/child/query-keys";
import { fetchChildMissionsData } from "@/lib/child/fetch-child-data";
import { isValidChildProfileId } from "@/lib/child/profile-id";

const CHILD_STALE_MS = 60_000;

export function useChildMissionsData(profileId: string | null) {
  const enabled = isValidChildProfileId(profileId);

  return useQuery({
    queryKey: enabled ? childQueryKeys.missions(profileId) : ["child", "missions", "disabled"],
    queryFn: () => fetchChildMissionsData(profileId!),
    enabled,
    staleTime: CHILD_STALE_MS,
    placeholderData: (prev) => prev,
  });
}
